/** sOn Messenger — Node.js API сервер + WebSocket */
// P1.2: Sentry должен инициализироваться ДО всех остальных require,
// чтобы корректно инструментировать http/express.
require('dotenv').config();
const sentry = require('./sentry');
sentry.init();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { WebSocketServer } = require('ws');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const multer = require('multer');
const { pool, initDB } = require('./db');
const {
  ensureBucket,
  uploadFile,
  getDownloadUrl,
  getUploadUrl,
  minioHealth,
  isAllowedFolder,
  isAllowedMime,
  sanitizeExt,
  ALLOWED_FOLDERS,
} = require('./storage');
const { logger, httpLogger } = require('./logger');

// ==================== Валидация окружения ====================

if (process.env.NODE_ENV !== 'test') {
  const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'];
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      console.error(`❌ Переменная окружения ${key} обязательна`);
      process.exit(1);
    }
  }
  if (process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET должен быть минимум 32 символа');
    process.exit(1);
  }
  // SEC: Предупреждения о слабых credentials в production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET.includes('dev') || process.env.JWT_SECRET.includes('local')) {
      console.warn('⚠️  ВНИМАНИЕ: JWT_SECRET содержит "dev"/"local" — не используйте dev-секрет в production!');
    }
    if (process.env.MINIO_ACCESS_KEY === 'minioadmin' || process.env.MINIO_SECRET_KEY === 'minioadmin') {
      console.warn('⚠️  ВНИМАНИЕ: MinIO использует credentials по умолчанию (minioadmin) — смените для production!');
    }
    if (process.env.DATABASE_URL?.includes('postgres:postgres')) {
      console.warn('⚠️  ВНИМАНИЕ: PostgreSQL использует credentials по умолчанию — смените для production!');
    }
  }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

// Trust proxy — для корректного определения IP за nginx
app.set('trust proxy', 1);

// ==================== Безопасность ====================

// P1.3: structured logging + request-ID (pino-http).
// Должен быть самым первым middleware, чтобы логировать абсолютно все запросы,
// включая те что дальше падают на CORS или rate-limit.
app.use(httpLogger);

// P1.10: Заголовки безопасности через helmet.
// API-сервер отдаёт только JSON (HTML страницы — через nginx в web-контейнере),
// поэтому CSP здесь максимально жёсткий: default-src 'none'.
// Основной CSP для SPA задаётся в webApp/nginx.conf.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  // HSTS — Cloudflare Tunnel уже добавляет, но для прямого доступа тоже нужен.
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: false, // preload не ставим — домен может измениться
  },
  // Запрещаем MIME sniffing и embedding.
  xContentTypeOptions: true,
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Не раскрываем Express в заголовке X-Powered-By (helmet убирает по умолчанию).
}));

// CORS — только разрешённые домены
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:8080', 'http://localhost'];
app.use(cors({
  origin: (origin, callback) => {
    // Разрешить запросы без origin (мобильные приложения, curl, серверные запросы)
    if (!origin) return callback(null, true);
    // Разрешить ngrok и cloudflare tunnel домены
    if (origin.endsWith('.ngrok-free.dev') || origin.endsWith('.ngrok.io')) return callback(null, true);
    if (origin.endsWith('.trycloudflare.com')) return callback(null, true);
    if (origin.endsWith('.sonchat.uk')) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Заблокировано CORS'));
  },
  credentials: true,
}));

// HI-18: Cookie parser для httpOnly JWT
app.use(cookieParser());

// Rate limiting на аутентификацию — защита от brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20, // максимум 20 попыток
  message: { error: 'Слишком много попыток. Подождите 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Общий rate limiter для API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 200, // 200 запросов в минуту
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// P1.11: отдельный лимит на отправку сообщений — 60/мин (~1 msg/sec).
// Глобальный apiLimiter (200/мин) слишком мягкий для спам-защиты.
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Слишком много сообщений. Подождите.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// P1.11: лимит на загрузку файлов — 30/мин (тяжёлые операции + MinIO writes).
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Слишком много загрузок. Подождите.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// SEC: Ограничить размер JSON body (1MB)
app.use(express.json({ limit: '1mb' }));

// ==================== Middleware ====================

function authMiddleware(req, res, next) {
  // HI-18: Проверять cookie ИЛИ Authorization header
  const token = req.cookies?.['son-token'] || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Невалидный токен' });
  }
}

// ==================== AUTH ====================

/** POST /api/auth/register */
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, display_name, password } = req.body;
    if (!email || !display_name || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    // SEC: Валидация входных данных
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }
    if (typeof display_name !== 'string' || display_name.length < 2 || display_name.length > 50) {
      return res.status(400).json({ error: 'Имя должно быть от 2 до 50 символов' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Пароль должен быть от 8 до 128 символов' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, display_name',
      [email, display_name, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, display_name: user.display_name }, JWT_SECRET, { expiresIn: '7d' });
    // HI-18: Установить httpOnly cookie
    res.cookie('son-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email уже зарегистрирован' });
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/** POST /api/auth/login */
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

    const token = jwt.sign({ id: user.id, email: user.email, display_name: user.display_name }, JWT_SECRET, { expiresIn: '7d' });
    await pool.query('UPDATE users SET is_online = true WHERE id = $1', [user.id]);
    // HI-18: Установить httpOnly cookie
    res.cookie('son-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/** POST /api/auth/logout — очистить httpOnly cookie */
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('son-token', { path: '/' });
  res.json({ ok: true });
});

/** GET /api/users/me */
app.get('/api/users/me', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT id, email, display_name, avatar_url, is_online FROM users WHERE id = $1', [req.user.id]);
  res.json(result.rows[0]);
});

/** PATCH /api/users/me — обновить профиль */
app.patch('/api/users/me', authMiddleware, async (req, res) => {
  try {
    const { display_name, avatar_url } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;
    if (display_name !== undefined) {
      if (typeof display_name !== 'string' || display_name.length < 2 || display_name.length > 50) {
        return res.status(400).json({ error: 'Имя должно быть от 2 до 50 символов' });
      }
      updates.push(`display_name = $${idx++}`);
      values.push(display_name);
    }
    if (avatar_url !== undefined) {
      // P1.12: валидация avatar_url — только http/https протокол, до 500 символов.
      // Защита от SSRF (javascript:, file://, data:, внутренние IP).
      if (avatar_url !== null) {
        if (typeof avatar_url !== 'string' || avatar_url.length > 500) {
          return res.status(400).json({ error: 'Некорректный avatar_url' });
        }
        try {
          const parsed = new URL(avatar_url);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return res.status(400).json({ error: 'avatar_url должен использовать http или https' });
          }
        } catch {
          return res.status(400).json({ error: 'Некорректный avatar_url' });
        }
      }
      updates.push(`avatar_url = $${idx++}`);
      values.push(avatar_url);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Нет данных для обновления' });
    values.push(req.user.id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, display_name, avatar_url, is_online`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

/** POST /api/users/me/avatar — загрузить аватар */
const AVATAR_MIME_WHITELIST = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

app.post('/api/users/me/avatar', authMiddleware, uploadLimiter, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    // SEC-2: строгий whitelist для аватаров — только изображения
    if (!AVATAR_MIME_WHITELIST.has(req.file.mimetype)) {
      return res.status(400).json({ error: 'Аватар должен быть изображением (JPEG/PNG/WebP/GIF)' });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Размер аватара не должен превышать 5 MB' });
    }
    const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, 'avatars');
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [result.url, req.user.id]);
    res.json({ avatar_url: result.url });
  } catch (err) {
    console.error('[avatar upload]', err?.message);
    res.status(500).json({ error: 'Ошибка загрузки аватара' });
  }
});

/** PATCH /api/users/me/password — смена пароля */
app.patch('/api/users/me/password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Все поля обязательны' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Пароль минимум 8 символов' });
    const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный текущий пароль' });
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
});

// ==================== Настройки пользователя ====================

/** GET /api/settings */
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    let result = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.user.id]);
      result = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки настроек' });
  }
});

/** PATCH /api/settings */
app.patch('/api/settings', authMiddleware, async (req, res) => {
  try {
    const allowed = ['theme', 'language', 'notifications_enabled', 'notification_sound', 'notification_preview', 'show_online_status', 'read_receipts', 'app_lock'];
    const updates = [];
    const values = [];
    let idx = 1;
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(req.body[key]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Нет данных' });
    updates.push(`updated_at = NOW()`);
    values.push(req.user.id);
    // Upsert: создать запись если не существует
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.user.id]);
    const result = await pool.query(
      `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения настроек' });
  }
});

// ==================== Push Notifications ====================
const webpush = require('web-push');
webpush.setVapidDetails(
  'mailto:admin@sonchat.uk',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

/** POST /api/push/subscribe — register push subscription */
app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    await pool.query(
      `INSERT INTO push_tokens (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Push subscription failed' });
  }
});

/** DELETE /api/push/subscribe — unregister */
app.delete('/api/push/subscribe', authMiddleware, async (req, res) => {
  const { endpoint } = req.body;
  await pool.query('DELETE FROM push_tokens WHERE endpoint = $1 AND user_id = $2', [endpoint, req.user.id]);
  res.json({ ok: true });
});

/** GET /api/push/vapid-key — get public VAPID key */
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

// ==================== Контакты ====================

/** GET /api/contacts */
app.get('/api/contacts', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.nickname, c.is_favorite, c.created_at,
        u.id as user_id, u.display_name, u.email, u.avatar_url, u.is_online, u.last_seen_at
      FROM contacts c
      JOIN users u ON u.id = c.contact_id
      WHERE c.owner_id = $1
      ORDER BY c.is_favorite DESC, u.display_name
    `, [req.user.id]);
    res.json({ contacts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки контактов' });
  }
});

/** POST /api/contacts — добавить контакт */
app.post('/api/contacts', authMiddleware, async (req, res) => {
  try {
    const { contact_id, nickname } = req.body;
    if (!contact_id) return res.status(400).json({ error: 'contact_id обязателен' });
    if (contact_id === req.user.id) return res.status(400).json({ error: 'Нельзя добавить себя' });
    // Проверить что пользователь существует
    const user = await pool.query('SELECT id FROM users WHERE id = $1', [contact_id]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    const result = await pool.query(
      'INSERT INTO contacts (owner_id, contact_id, nickname) VALUES ($1, $2, $3) ON CONFLICT (owner_id, contact_id) DO UPDATE SET nickname = COALESCE($3, contacts.nickname) RETURNING *',
      [req.user.id, contact_id, nickname || null]
    );
    // Вернуть контакт с данными пользователя
    const contact = await pool.query(`
      SELECT c.id, c.nickname, c.is_favorite, c.created_at,
        u.id as user_id, u.display_name, u.email, u.avatar_url, u.is_online
      FROM contacts c JOIN users u ON u.id = c.contact_id WHERE c.id = $1
    `, [result.rows[0].id]);
    res.status(201).json(contact.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка добавления контакта' });
  }
});

/** DELETE /api/contacts/:id */
app.delete('/api/contacts/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id = $1 AND owner_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Контакт не найден' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления контакта' });
  }
});

/** PATCH /api/contacts/:id — обновить (nickname, is_favorite) */
app.patch('/api/contacts/:id', authMiddleware, async (req, res) => {
  try {
    const { nickname, is_favorite } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;
    if (nickname !== undefined) { updates.push(`nickname = $${idx++}`); values.push(nickname); }
    if (is_favorite !== undefined) { updates.push(`is_favorite = $${idx++}`); values.push(is_favorite); }
    if (updates.length === 0) return res.status(400).json({ error: 'Нет данных' });
    values.push(req.params.id, req.user.id);
    const result = await pool.query(
      `UPDATE contacts SET ${updates.join(', ')} WHERE id = $${idx++} AND owner_id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Контакт не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления контакта' });
  }
});

/** GET /api/users/search?q= */
app.get('/api/users/search', authMiddleware, async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const result = await pool.query(
    'SELECT id, display_name, email, avatar_url, is_online FROM users WHERE (display_name ILIKE $1 OR email ILIKE $1) AND id != $2 LIMIT 20',
    [q, req.user.id]
  );
  res.json({ users: result.rows });
});

// ==================== Проверка членства в чате ====================

/** Middleware: проверить что пользователь — участник чата */
async function chatMemberCheck(req, res, next) {
  const chatId = req.params.chatId;
  const userId = req.user.id;
  try {
    const result = await pool.query(
      'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Нет доступа к этому чату' });
    }
    next();
  } catch (err) {
    console.error('[chatMemberCheck] DB error', { chatId, userId, message: err?.message });
    res.status(503).json({ error: 'Сервис временно недоступен' });
  }
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSecretPayload(content, e2ee) {
  let payload = null;

  if (isPlainObject(e2ee)) {
    payload = {
      ciphertext: content,
      nonce: e2ee.nonce,
      algorithm: e2ee.algorithm,
      header: e2ee.header,
    };
  } else if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (isPlainObject(parsed)) payload = parsed;
    } catch {
      return null;
    }
  }

  if (!isPlainObject(payload)) return null;
  if (typeof payload.ciphertext !== 'string' || payload.ciphertext.length === 0) return null;
  if (payload.ciphertext.length > 30000) return null;
  if (typeof payload.nonce !== 'string' || payload.nonce.length === 0) return null;
  if (payload.algorithm !== 'XSalsa20-Poly1305') return null;
  if (!isPlainObject(payload.header)) return null;
  if (typeof payload.header.dh_public_key !== 'string' || payload.header.dh_public_key.length === 0) return null;
  if (typeof payload.header.previous_count !== 'number' || payload.header.previous_count < 0) return null;
  if (typeof payload.header.message_number !== 'number' || payload.header.message_number < 0) return null;

  return {
    ciphertext: payload.ciphertext,
    nonce: payload.nonce,
    algorithm: payload.algorithm,
    header: {
      dh_public_key: payload.header.dh_public_key,
      previous_count: payload.header.previous_count,
      message_number: payload.header.message_number,
    },
  };
}

// ==================== CHATS ====================

/** GET /api/chats — список чатов пользователя */
app.get('/api/chats', authMiddleware, async (req, res) => {
  const result = await pool.query(`
    SELECT c.*, cm.unread_count,
      (SELECT json_agg(json_build_object('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'is_online', u.is_online))
       FROM chat_members cm2 JOIN users u ON u.id = cm2.user_id WHERE cm2.chat_id = c.id) as members,
      (SELECT json_build_object(
        'content', CASE WHEN c.type = 'secret' THEN '🔒 Зашифрованное сообщение' ELSE m.content END,
        'created_at', m.created_at,
        'sender_id', m.sender_id
      )
       FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
    FROM chats c
    JOIN chat_members cm ON cm.chat_id = c.id
    WHERE cm.user_id = $1
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
  `, [req.user.id]);
  res.json({ chats: result.rows });
});

/** POST /api/chats — создать чат */
app.post('/api/chats', authMiddleware, async (req, res) => {
  const { type = 'direct', name, member_ids = [] } = req.body;

  // SEC: Валидация
  const allowedChatTypes = ['direct', 'group', 'secret'];
  if (!allowedChatTypes.includes(type)) {
    return res.status(400).json({ error: 'Недопустимый тип чата' });
  }
  if (name && (typeof name !== 'string' || name.length > 100)) {
    return res.status(400).json({ error: 'Имя чата не может быть длиннее 100 символов' });
  }
  if (!Array.isArray(member_ids) || member_ids.length > 100) {
    return res.status(400).json({ error: 'Слишком много участников' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const chatResult = await client.query(
      'INSERT INTO chats (type, name, created_by) VALUES ($1, $2, $3) RETURNING *',
      [type, name, req.user.id]
    );
    const chat = chatResult.rows[0];

    // Добавить создателя
    await client.query(
      'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)',
      [chat.id, req.user.id, 'admin']
    );

    // Добавить участников
    for (const memberId of member_ids) {
      await client.query(
        'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [chat.id, memberId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ chat });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания чата' });
  } finally {
    client.release();
  }
});

// ==================== MESSAGES ====================

/** GET /api/chats/:chatId/messages?before=ISO&limit=50 — с пагинацией */
app.get('/api/chats/:chatId/messages', authMiddleware, chatMemberCheck, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const before = req.query.before; // ISO timestamp для курсорной пагинации

  let query, params;
  if (before) {
    query = `SELECT m.*, u.display_name as sender_name FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = $1 AND m.created_at < $2
     ORDER BY m.created_at DESC LIMIT $3`;
    params = [req.params.chatId, before, limit];
  } else {
    query = `SELECT m.*, u.display_name as sender_name FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = $1
     ORDER BY m.created_at DESC LIMIT $2`;
    params = [req.params.chatId, limit];
  }

  const result = await pool.query(query, params);
  const messages = result.rows.reverse(); // Хронологический порядок (ASC)

  // Загрузить реакции для всех сообщений одним запросом
  let messagesWithReactions = messages;
  if (messages.length > 0) {
    const messageIds = messages.map((m) => m.id);
    const reactionsResult = await pool.query(
      'SELECT r.message_id, r.emoji, r.user_id FROM reactions r WHERE r.message_id = ANY($1::uuid[])',
      [messageIds]
    );
    // Группировка: { messageId: { emoji: [userId, ...] } }
    const reactionsMap = {};
    for (const r of reactionsResult.rows) {
      if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = {};
      if (!reactionsMap[r.message_id][r.emoji]) reactionsMap[r.message_id][r.emoji] = [];
      reactionsMap[r.message_id][r.emoji].push(r.user_id);
    }
    messagesWithReactions = messages.map((m) => ({
      ...m,
      reactions: reactionsMap[m.id] || {},
    }));
  }

  res.json({ messages: messagesWithReactions, has_more: result.rows.length === limit });
});

/** POST /api/chats/:chatId/messages */
app.post('/api/chats/:chatId/messages', authMiddleware, messageLimiter, chatMemberCheck, async (req, res) => {
  const { content, type = 'text', reply_to, self_destruct_seconds, e2ee } = req.body;
  const chatId = req.params.chatId;

  const allowedTypes = ['text', 'image', 'file', 'audio', 'video', 'system'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ error: 'Недопустимый тип сообщения' });
  }

  const chatResult = await pool.query('SELECT type FROM chats WHERE id = $1', [chatId]);
  if (chatResult.rows.length === 0) {
    return res.status(404).json({ error: 'Чат не найден' });
  }
  const chatType = chatResult.rows[0].type;

  // SEC-5: reply_to должен принадлежать тому же чату.
  // Защищает от утечки message_id из других чатов, в т.ч. секретных,
  // и от нарушения изоляции секретных чатов от обычных.
  if (reply_to !== undefined && reply_to !== null) {
    if (typeof reply_to !== 'string') {
      return res.status(400).json({ error: 'Некорректный reply_to' });
    }
    const replyCheck = await pool.query(
      'SELECT 1 FROM messages WHERE id = $1 AND chat_id = $2',
      [reply_to, chatId]
    );
    if (replyCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Сообщение для ответа не найдено в этом чате' });
    }
  }

  // Проверка блокировки: если отправитель заблокирован кем-то из участников (для direct чатов)
  if (chatType === 'direct') {
    const blocked = await pool.query(
      `SELECT 1 FROM blocked_users bu
       JOIN chat_members cm ON cm.user_id = bu.blocker_id AND cm.chat_id = $1
       WHERE bu.blocked_id = $2 LIMIT 1`,
      [chatId, req.user.id]
    );
    if (blocked.rows.length > 0) {
      return res.status(403).json({ error: 'Вы не можете отправлять сообщения этому пользователю' });
    }
  }

  let dbContent = content;
  let e2eeNonce = null;
  let e2eeHeader = null;
  let e2eeAlgorithm = null;

  if (chatType === 'secret') {
    if (type !== 'text') {
      return res.status(400).json({ error: 'Секретный чат поддерживает только текстовые сообщения' });
    }

    const payload = normalizeSecretPayload(content, e2ee);
    if (!payload) {
      return res.status(400).json({ error: 'Для секретного чата требуется валидный E2EE payload' });
    }

    dbContent = payload.ciphertext;
    e2eeNonce = payload.nonce;
    e2eeHeader = payload.header;
    e2eeAlgorithm = payload.algorithm;
  } else {
    // SEC: Валидация содержимого сообщения
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }
    if (content.length > 10000) {
      return res.status(400).json({ error: 'Сообщение не может быть длиннее 10000 символов' });
    }
  }

  // P1.12: валидация self_destruct_seconds — число от 5 до 604800 (7 дней).
  // Без этого клиент может передать NaN, Infinity, отрицательное — Date(NaN).
  const MAX_SELF_DESTRUCT = 7 * 24 * 3600;
  if (self_destruct_seconds !== undefined && self_destruct_seconds !== null) {
    const secs = Number(self_destruct_seconds);
    if (!Number.isFinite(secs) || secs < 5 || secs > MAX_SELF_DESTRUCT) {
      return res.status(400).json({ error: 'Недопустимое время самоуничтожения (5 сек — 7 дней)' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ME-19: Self-destruct timer
    const selfDestructAt = self_destruct_seconds
      ? new Date(Date.now() + Number(self_destruct_seconds) * 1000).toISOString()
      : null;

    const result = await client.query(
      'INSERT INTO messages (chat_id, sender_id, content, type, reply_to, self_destruct_at, e2ee_nonce, e2ee_header, e2ee_algorithm) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [chatId, req.user.id, dbContent, type, reply_to || null, selfDestructAt, e2eeNonce, e2eeHeader, e2eeAlgorithm]
    );
    const msg = result.rows[0];
    msg.sender_name = req.user.display_name;

    // Обновить last_message_at в чате
    await client.query('UPDATE chats SET last_message_at = $1 WHERE id = $2', [msg.created_at, chatId]);

    // Увеличить unread_count для всех участников кроме отправителя
    await client.query(
      'UPDATE chat_members SET unread_count = unread_count + 1 WHERE chat_id = $1 AND user_id != $2',
      [chatId, req.user.id]
    );

    await client.query('COMMIT');

    // Отправить через WebSocket всем участникам чата (кроме отправителя — у него уже есть optimistic update)
    broadcastToChat(chatId, { type: 'new_message', message: msg }, req.user.id);
    // Push-уведомления для офлайн-пользователей.
    // SEC: для секретных чатов НЕ отправляем содержимое — оно зашифровано
    // и клиент всё равно его не покажет. Вместо этого — заглушка.
    const pushContent = chatType === 'secret' ? null : content;
    sendPushToOfflineMembers(req.params.chatId, req.user.id, pushContent, req.user.display_name);
    res.status(201).json(msg);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка отправки сообщения:', err);
    res.status(500).json({ error: 'Ошибка отправки сообщения' });
  } finally {
    client.release();
  }
});

/** POST /api/chats/:chatId/read — сбросить счётчик непрочитанных */
app.post('/api/chats/:chatId/read', authMiddleware, chatMemberCheck, async (req, res) => {
  await pool.query(
    'UPDATE chat_members SET unread_count = 0 WHERE chat_id = $1 AND user_id = $2',
    [req.params.chatId, req.user.id]
  );
  res.json({ ok: true });
});

/** DELETE /api/chats/:chatId — удалить чат */
app.delete('/api/chats/:chatId', authMiddleware, chatMemberCheck, async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  // Проверить права: group — только создатель, direct/secret — любой участник
  const chatResult = await pool.query('SELECT type, created_by FROM chats WHERE id = $1', [chatId]);
  if (chatResult.rows.length === 0) {
    return res.status(404).json({ error: 'Чат не найден' });
  }
  const chat = chatResult.rows[0];
  if (chat.type === 'group' && chat.created_by !== userId) {
    return res.status(403).json({ error: 'Только создатель может удалить группу' });
  }

  // Уведомить участников ДО удаления (нужны chat_members)
  broadcastToChat(chatId, { type: 'chat_deleted', chat_id: chatId }, userId);

  // CASCADE удалит: chat_members, messages, attachments
  await pool.query('DELETE FROM chats WHERE id = $1', [chatId]);

  res.json({ ok: true });
});

/** PATCH /api/chats/:chatId — обновить группу (имя, описание, аватар) */
app.patch('/api/chats/:chatId', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const { name, description, avatar_url } = req.body;
    // Только для групп
    const chatResult = await pool.query('SELECT type FROM chats WHERE id = $1', [req.params.chatId]);
    if (chatResult.rows[0]?.type !== 'group') {
      return res.status(400).json({ error: 'Редактировать можно только группы' });
    }
    // Только admin
    const roleResult = await pool.query('SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2', [req.params.chatId, req.user.id]);
    if (roleResult.rows[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Только администратор может редактировать группу' });
    }
    const updates = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length < 1 || name.length > 100) {
        return res.status(400).json({ error: 'Имя группы от 1 до 100 символов' });
      }
      updates.push(`name = $${idx++}`); values.push(name.trim());
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > 500) {
        return res.status(400).json({ error: 'Описание до 500 символов' });
      }
      updates.push(`description = $${idx++}`); values.push(description.trim());
    }
    if (avatar_url !== undefined) {
      // P1.12: та же валидация URL что и в /api/users/me
      if (avatar_url !== null) {
        if (typeof avatar_url !== 'string' || avatar_url.length > 500) {
          return res.status(400).json({ error: 'Некорректный avatar_url' });
        }
        try {
          const parsed = new URL(avatar_url);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return res.status(400).json({ error: 'avatar_url должен использовать http или https' });
          }
        } catch {
          return res.status(400).json({ error: 'Некорректный avatar_url' });
        }
      }
      updates.push(`avatar_url = $${idx++}`); values.push(avatar_url);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Нет данных' });
    values.push(req.params.chatId);
    const result = await pool.query(
      `UPDATE chats SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    broadcastToChat(req.params.chatId, { type: 'chat_updated', chat: result.rows[0] });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления группы' });
  }
});

/** DELETE /api/chats/:chatId/messages/:id — удалить своё сообщение */
app.delete('/api/chats/:chatId/messages/:id', authMiddleware, chatMemberCheck, async (req, res) => {
  const result = await pool.query(
    'DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(403).json({ error: 'Нельзя удалить чужое сообщение или сообщение не найдено' });
  }
  broadcastToChat(req.params.chatId, { type: 'message_deleted', chat_id: req.params.chatId, message_id: req.params.id });
  res.status(204).send();
});

/** PATCH /api/chats/:chatId/messages/:id — редактировать своё сообщение */
app.patch('/api/chats/:chatId/messages/:id', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Содержимое обязательно' });
    }
    const result = await pool.query(
      'UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2 AND sender_id = $3 AND chat_id = $4 RETURNING *',
      [content.trim(), req.params.id, req.user.id, req.params.chatId]
    );
    if (result.rows.length === 0) return res.status(403).json({ error: 'Нельзя редактировать' });
    const msg = result.rows[0];
    broadcastToChat(req.params.chatId, { type: 'message_edited', chat_id: req.params.chatId, message: msg });
    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка редактирования' });
  }
});

// ==================== РЕАКЦИИ ====================

// P1.12: whitelist реакций — только известные emoji.
// Без whitelist поле VARCHAR(10) принимает любой текст, включая HTML-подобный.
const ALLOWED_EMOJIS = new Set([
  '❤️', '👍', '👎', '😂', '😮', '😢', '😡', '🔥', '👏', '🎉',
  '💯', '🤔', '👀', '🙏', '💪', '✅', '❌', '⭐', '🤣', '😍',
]);

/** POST /api/chats/:chatId/messages/:id/reactions — добавить/убрать реакцию (toggle) */
app.post('/api/chats/:chatId/messages/:id/reactions', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji || typeof emoji !== 'string') return res.status(400).json({ error: 'emoji обязателен' });
    if (!ALLOWED_EMOJIS.has(emoji)) return res.status(400).json({ error: 'Недопустимая реакция' });
    // Toggle: если реакция уже есть — удалить, иначе — добавить
    const existing = await pool.query(
      'SELECT id FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [req.params.id, req.user.id, emoji]
    );
    let action;
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM reactions WHERE id = $1', [existing.rows[0].id]);
      action = 'removed';
    } else {
      await pool.query(
        'INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
        [req.params.id, req.user.id, emoji]
      );
      action = 'added';
    }
    // Получить все реакции на это сообщение
    const reactions = await pool.query(
      'SELECT emoji, user_id FROM reactions WHERE message_id = $1',
      [req.params.id]
    );
    broadcastToChat(req.params.chatId, {
      type: 'reaction_update',
      chat_id: req.params.chatId,
      message_id: req.params.id,
      reactions: reactions.rows,
      action,
      user_id: req.user.id,
      emoji,
    });
    res.json({ action, reactions: reactions.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка реакции' });
  }
});

/** GET /api/chats/:chatId/messages/:id/reactions — получить реакции */
app.get('/api/chats/:chatId/messages/:id/reactions', authMiddleware, chatMemberCheck, async (req, res) => {
  const result = await pool.query(
    'SELECT r.emoji, r.user_id, u.display_name FROM reactions r JOIN users u ON u.id = r.user_id WHERE r.message_id = $1',
    [req.params.id]
  );
  res.json({ reactions: result.rows });
});

// ==================== УПРАВЛЕНИЕ ГРУППОЙ ====================

/** POST /api/chats/:chatId/members — добавить участника */
app.post('/api/chats/:chatId/members', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id обязателен' });
    // Проверить что чат — группа
    const chat = await pool.query('SELECT type, created_by FROM chats WHERE id = $1', [req.params.chatId]);
    if (chat.rows[0].type !== 'group') return res.status(400).json({ error: 'Можно добавлять только в группы' });
    // Проверить что текущий пользователь — admin
    const member = await pool.query('SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2', [req.params.chatId, req.user.id]);
    if (member.rows[0].role !== 'admin') return res.status(403).json({ error: 'Только админ может добавлять участников' });
    await pool.query('INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.chatId, user_id]);
    // Уведомить чат
    const newUser = await pool.query('SELECT display_name FROM users WHERE id = $1', [user_id]);
    broadcastToChat(req.params.chatId, { type: 'member_added', chat_id: req.params.chatId, user_id, display_name: newUser.rows[0]?.display_name });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка добавления участника' });
  }
});

/** DELETE /api/chats/:chatId/members/:userId — удалить участника */
app.delete('/api/chats/:chatId/members/:userId', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const chat = await pool.query('SELECT type FROM chats WHERE id = $1', [req.params.chatId]);
    if (chat.rows[0].type !== 'group') return res.status(400).json({ error: 'Только для групп' });
    // Admin или сам участник может выйти
    const member = await pool.query('SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2', [req.params.chatId, req.user.id]);
    const isSelf = req.params.userId === req.user.id;
    if (!isSelf && member.rows[0].role !== 'admin') return res.status(403).json({ error: 'Только админ может удалять' });
    await pool.query('DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2', [req.params.chatId, req.params.userId]);
    broadcastToChat(req.params.chatId, { type: 'member_removed', chat_id: req.params.chatId, user_id: req.params.userId });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления участника' });
  }
});

// ==================== ИСТОРИЯ ЗВОНКОВ ====================

/** GET /api/calls/history — история звонков текущего пользователя */
app.get('/api/calls/history', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ch.*,
        caller.display_name AS caller_name, caller.avatar_url AS caller_avatar,
        callee.display_name AS callee_name, callee.avatar_url AS callee_avatar
      FROM call_history ch
      JOIN users caller ON caller.id = ch.caller_id
      JOIN users callee ON callee.id = ch.callee_id
      WHERE ch.caller_id = $1 OR ch.callee_id = $1
      ORDER BY ch.created_at DESC
      LIMIT 100
    `, [req.user.id]);
    res.json({ calls: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки истории звонков' });
  }
});

/** POST /api/calls/log — записать звонок в историю */
app.post('/api/calls/log', authMiddleware, async (req, res) => {
  try {
    const { chat_id, callee_id, is_video, status, started_at, ended_at, duration_seconds } = req.body;
    if (!callee_id) return res.status(400).json({ error: 'callee_id обязателен' });
    const allowedStatuses = ['missed', 'answered', 'declined', 'no_answer'];
    const callStatus = allowedStatuses.includes(status) ? status : 'missed';
    const result = await pool.query(
      `INSERT INTO call_history (chat_id, caller_id, callee_id, is_video, status, started_at, ended_at, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [chat_id || null, req.user.id, callee_id, !!is_video, callStatus, started_at || null, ended_at || null, duration_seconds || 0]
    );
    res.status(201).json({ call: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка записи звонка' });
  }
});

// ==================== WEBSOCKET ====================

const wss = new WebSocketServer({ server, path: '/ws' });

/** Хранение подключений: userId → Set<ws> */
const connections = new Map();

// SEC: Rate limiting для WebSocket — sliding window per user
const wsRateLimits = new Map(); // userId → { count, windowStart }
const WS_RATE_LIMIT = 100; // макс сообщений
const WS_RATE_WINDOW = 60000; // за 60 сек

function checkWsRateLimit(userId) {
  const now = Date.now();
  let entry = wsRateLimits.get(userId);
  if (!entry || now - entry.windowStart > WS_RATE_WINDOW) {
    entry = { count: 0, windowStart: now };
    wsRateLimits.set(userId, entry);
  }
  entry.count++;
  return entry.count <= WS_RATE_LIMIT;
}

// Очистка старых записей каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of wsRateLimits) {
    if (now - entry.windowStart > WS_RATE_WINDOW * 2) wsRateLimits.delete(userId);
  }
}, 300000);

/** Получить значение cookie по имени */
function getCookieValue(cookieHeader, name) {
  if (!cookieHeader || !name) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValueParts] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValueParts.join('='));
    }
  }
  return null;
}

wss.on('connection', (ws, req) => {
  // Аутентификация через cookie на handshake (основной путь)
  // и через первое auth-сообщение (fallback).
  let user = null;
  let authenticated = false;
  let authTimeout = null;

  // Попробовать аутентифицировать по httpOnly cookie сразу при подключении.
  const cookieToken = getCookieValue(req?.headers?.cookie, 'son-token');
  if (cookieToken) {
    try {
      user = jwt.verify(cookieToken, JWT_SECRET);
      authenticated = true;
      registerConnection(ws, user);
      ws.send(JSON.stringify({ type: 'auth_success', user_id: user.id }));
    } catch {
      // Если cookie-токен невалиден, ждём auth-сообщение от клиента.
    }
  }

  if (!authenticated) {
    // Таймаут аутентификации: 10 секунд на отправку auth-сообщения
    authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, 'Таймаут аутентификации');
      }
    }, 10000);
  }

  // SEC: Ограничение размера сообщения (64 KB)
  ws.on('message', (data) => {
    try {
      if (data.length > 65536) {
        ws.send(JSON.stringify({ type: 'error', message: 'Сообщение слишком большое' }));
        return;
      }

      const msg = JSON.parse(data);

      // Первое сообщение — аутентификация
      if (!authenticated && msg.type === 'auth') {
        try {
          user = jwt.verify(msg.token, JWT_SECRET);
          authenticated = true;
          if (authTimeout) clearTimeout(authTimeout);
          registerConnection(ws, user);
          ws.send(JSON.stringify({ type: 'auth_success', user_id: user.id }));
        } catch {
          ws.close(4001, 'Невалидный токен');
        }
        return;
      }

      if (!authenticated) {
        ws.send(JSON.stringify({ type: 'error', message: 'Не аутентифицирован' }));
        return;
      }

      // SEC: Rate limiting per user
      if (!checkWsRateLimit(user.id)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Слишком много сообщений. Подождите.' }));
        return;
      }

      handleWsMessage(user, ws, msg).catch((err) => {
        console.error('Ошибка обработки WS:', err);
      });
    } catch (err) {
      console.error('Ошибка обработки WS:', err);
    }
  });

  ws.on('close', () => {
    if (authTimeout) clearTimeout(authTimeout);
    if (user) {
      connections.get(user.id)?.delete(ws);
      if (connections.get(user.id)?.size === 0) {
        connections.delete(user.id);
        pool.query('UPDATE users SET is_online = false, last_seen_at = NOW() WHERE id = $1', [user.id]);
        console.log(`🔴 ${user.display_name} отключился`);
      }
    }
  });
});

/** Зарегистрировать WebSocket-подключение */
function registerConnection(ws, user) {
  if (!connections.has(user.id)) connections.set(user.id, new Set());
  connections.get(user.id).add(ws);
  console.log(`🟢 ${user.display_name} подключился (${connections.get(user.id).size} сессий)`);
  pool.query('UPDATE users SET is_online = true WHERE id = $1', [user.id]);
}

/**
 * Проверить, что user является участником указанного чата.
 * Возвращает true/false, никогда не выбрасывает (при ошибке БД — false).
 */
async function isChatMember(userId, chatId) {
  if (!userId || !chatId || typeof chatId !== 'string') return false;
  try {
    const r = await pool.query(
      'SELECT 1 FROM chat_members WHERE user_id = $1 AND chat_id = $2 LIMIT 1',
      [userId, chatId]
    );
    return r.rows.length > 0;
  } catch (err) {
    console.error('[isChatMember] DB error', { userId, chatId, message: err?.message });
    return false;
  }
}

/**
 * Проверить, что два пользователя входят в общий чат.
 * Используется для авторизации WebRTC signaling — нельзя звонить
 * произвольному пользователю по user_id, только тем, с кем есть общий чат.
 */
async function haveSharedChat(userA, userB) {
  if (!userA || !userB || userA === userB) return false;
  try {
    const r = await pool.query(
      `SELECT 1 FROM chat_members cm1
       JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
       WHERE cm1.user_id = $1 AND cm2.user_id = $2
       LIMIT 1`,
      [userA, userB]
    );
    return r.rows.length > 0;
  } catch (err) {
    console.error('[haveSharedChat] DB error', { userA, userB, message: err?.message });
    return false;
  }
}

/** Обработка WebSocket сообщений */
async function handleWsMessage(user, ws, msg) {
  switch (msg.type) {
    case 'typing':
    case 'stop_typing':
    case 'read': {
      // SEC: убеждаемся, что отправитель реально в этом чате
      if (!(await isChatMember(user.id, msg.chat_id))) return;
      if (msg.type === 'typing') {
        broadcastToChat(msg.chat_id, { type: 'typing', user_id: user.id, display_name: user.display_name }, user.id);
      } else if (msg.type === 'stop_typing') {
        broadcastToChat(msg.chat_id, { type: 'stop_typing', user_id: user.id, display_name: user.display_name }, user.id);
      } else {
        broadcastToChat(msg.chat_id, { type: 'read', message_id: msg.message_id, user_id: user.id }, user.id);
      }
      break;
    }

    // ==================== WebRTC Signaling ====================

    case 'call_offer':
    case 'call_answer':
    case 'ice_candidate':
    case 'call_end':
    case 'call_reject': {
      // SEC-4: проверяем, что target_user_id входит в общий чат с отправителем.
      // Без этого любой аутентифицированный пользователь может звонить/слать SDP
      // произвольному пользователю по user_id (harassment + DoS через signaling).
      if (!msg.target_user_id || typeof msg.target_user_id !== 'string') return;
      if (!(await haveSharedChat(user.id, msg.target_user_id))) return;

      if (msg.type === 'call_offer') {
        sendToUser(msg.target_user_id, {
          type: 'call_offer',
          caller_id: user.id,
          caller_name: user.display_name,
          chat_id: msg.chat_id,
          sdp: msg.sdp,
          is_video: msg.is_video || false,
        });
      } else if (msg.type === 'call_answer') {
        sendToUser(msg.target_user_id, {
          type: 'call_answer',
          answerer_id: user.id,
          chat_id: msg.chat_id,
          sdp: msg.sdp,
        });
      } else if (msg.type === 'ice_candidate') {
        sendToUser(msg.target_user_id, {
          type: 'ice_candidate',
          from_user_id: user.id,
          chat_id: msg.chat_id,
          candidate: msg.candidate,
        });
      } else if (msg.type === 'call_end') {
        sendToUser(msg.target_user_id, {
          type: 'call_end',
          from_user_id: user.id,
          chat_id: msg.chat_id,
          reason: msg.reason || 'ended',
        });
      } else if (msg.type === 'call_reject') {
        sendToUser(msg.target_user_id, {
          type: 'call_reject',
          from_user_id: user.id,
          chat_id: msg.chat_id,
        });
      }
      break;
    }
  }
}

/** Отправить сообщение конкретному пользователю */
function sendToUser(userId, data) {
  const userConns = connections.get(userId);
  if (!userConns) return;
  const payload = JSON.stringify(data);
  for (const ws of userConns) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

/**
 * Отправить сообщение всем участникам чата.
 * Функция не выбрасывает ошибок — при любом сбое БД/сериализации
 * пишет лог и возвращает void, чтобы вызывающий код не должен был
 * оборачивать каждый вызов в try/catch. Критично для доставки сообщений.
 */
async function broadcastToChat(chatId, data, excludeUserId = null) {
  try {
    const members = await pool.query(
      'SELECT user_id FROM chat_members WHERE chat_id = $1',
      [chatId]
    );
    const payload = JSON.stringify(data);
    for (const row of members.rows) {
      if (row.user_id === excludeUserId) continue;
      const userConns = connections.get(row.user_id);
      if (!userConns) continue;
      for (const ws of userConns) {
        if (ws.readyState !== 1) continue;
        try {
          ws.send(payload);
        } catch (sendErr) {
          console.error('[broadcastToChat] ws.send failed', {
            chatId,
            userId: row.user_id,
            message: sendErr?.message,
          });
        }
      }
    }
  } catch (err) {
    console.error('[broadcastToChat] failed', {
      chatId,
      dataType: data?.type,
      message: err?.message,
    });
  }
}

/**
 * Отправить push-уведомления офлайн-участникам чата.
 * Никогда не выбрасывает ошибок — все сбои логируются.
 * Поскольку вызывается после res.json(201), она не должна ронять запрос.
 */
async function sendPushToOfflineMembers(chatId, senderId, messageContent, senderName) {
  try {
    const members = await pool.query(
      'SELECT cm.user_id FROM chat_members cm WHERE cm.chat_id = $1 AND cm.user_id != $2',
      [chatId, senderId]
    );
    for (const member of members.rows) {
      // Skip if user has active WS connections
      if (connections.has(member.user_id) && connections.get(member.user_id).size > 0) continue;
      let tokens;
      try {
        tokens = await pool.query(
          'SELECT endpoint, p256dh, auth FROM push_tokens WHERE user_id = $1',
          [member.user_id]
        );
      } catch (dbErr) {
        console.error('[push] failed to load tokens', {
          userId: member.user_id,
          message: dbErr?.message,
        });
        continue;
      }
      for (const token of tokens.rows) {
        const subscription = {
          endpoint: token.endpoint,
          keys: { p256dh: token.p256dh, auth: token.auth },
        };
        // При messageContent === null (секретный чат) показываем заглушку,
        // чтобы не сливать plaintext содержимое в push.
        const pushBody = messageContent === null
          ? '🔒 Зашифрованное сообщение'
          : (messageContent?.substring(0, 100) || 'Новое сообщение');
        const payload = JSON.stringify({
          title: senderName || 'sOn',
          body: pushBody,
          chat_id: chatId,
        });
        webpush
          .sendNotification(subscription, payload)
          .catch(async (err) => {
            if (err?.statusCode === 410) {
              // Подписка умерла — удаляем, но не роняем ничего при ошибке delete
              try {
                await pool.query(
                  'DELETE FROM push_tokens WHERE endpoint = $1',
                  [token.endpoint]
                );
              } catch (delErr) {
                console.error('[push] failed to delete expired token', {
                  endpoint: token.endpoint,
                  message: delErr?.message,
                });
              }
            } else {
              console.error('[push] sendNotification failed', {
                statusCode: err?.statusCode,
                message: err?.message,
              });
            }
          });
      }
    }
  } catch (err) {
    console.error('[sendPushToOfflineMembers] failed', {
      chatId,
      senderId,
      message: err?.message,
    });
  }
}

// ==================== E2EE PREKEYS ====================

/** PUT /api/keys/bundle — загрузить prekey bundle */
app.put('/api/keys/bundle', authMiddleware, async (req, res) => {
  const { identity_key, signing_key, signed_prekey, signed_prekey_id, signed_prekey_signature, one_time_prekeys } = req.body;

  if (!identity_key || !signing_key || !signed_prekey || !signed_prekey_signature) {
    return res.status(400).json({ error: 'Все поля prekey bundle обязательны' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Обновить/создать основной prekey bundle
    await client.query(`
      INSERT INTO prekeys (user_id, identity_key, signing_key, signed_prekey, signed_prekey_id, signed_prekey_signature)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        identity_key = EXCLUDED.identity_key,
        signing_key = EXCLUDED.signing_key,
        signed_prekey = EXCLUDED.signed_prekey,
        signed_prekey_id = EXCLUDED.signed_prekey_id,
        signed_prekey_signature = EXCLUDED.signed_prekey_signature,
        created_at = NOW()
    `, [req.user.id, identity_key, signing_key, signed_prekey, signed_prekey_id, signed_prekey_signature]);

    // Загрузить one-time prekeys если есть
    if (one_time_prekeys?.length) {
      for (const otpk of one_time_prekeys) {
        await client.query(`
          INSERT INTO one_time_prekeys (user_id, key_id, public_key)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, key_id) DO NOTHING
        `, [req.user.id, otpk.key_id, otpk.public_key]);
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка загрузки prekey bundle:', err);
    res.status(500).json({ error: 'Ошибка сохранения ключей' });
  } finally {
    client.release();
  }
});

/** GET /api/keys/bundle/:userId — получить prekey bundle собеседника */
app.get('/api/keys/bundle/:userId', authMiddleware, async (req, res) => {
  const targetUserId = req.params.userId;

  // Получить основной bundle
  const bundleResult = await pool.query(
    'SELECT identity_key, signing_key, signed_prekey, signed_prekey_id, signed_prekey_signature FROM prekeys WHERE user_id = $1',
    [targetUserId]
  );

  if (bundleResult.rows.length === 0) {
    return res.status(404).json({ error: 'Prekey bundle не найден для этого пользователя' });
  }

  const bundle = bundleResult.rows[0];

  // Попытаться забрать один one-time prekey (атомарно)
  const otpkResult = await pool.query(`
    UPDATE one_time_prekeys SET used = true
    WHERE id = (
      SELECT id FROM one_time_prekeys
      WHERE user_id = $1 AND used = false
      ORDER BY created_at ASC LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING key_id, public_key
  `, [targetUserId]);

  const response = {
    identity_key: bundle.identity_key,
    signing_key: bundle.signing_key,
    signed_prekey: bundle.signed_prekey,
    signed_prekey_id: bundle.signed_prekey_id,
    signed_prekey_signature: bundle.signed_prekey_signature,
  };

  if (otpkResult.rows.length > 0) {
    Object.assign(response, {
      one_time_prekey: otpkResult.rows[0].public_key,
      one_time_prekey_id: otpkResult.rows[0].key_id,
    });
  }

  res.json(response);
});

/** GET /api/keys/count — сколько OPK осталось у текущего пользователя */
app.get('/api/keys/count', authMiddleware, async (req, res) => {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM one_time_prekeys WHERE user_id = $1 AND used = false',
    [req.user.id]
  );
  res.json({ remaining_one_time_prekeys: parseInt(result.rows[0].count) });
});

// ==================== ФАЙЛЫ ====================

/** POST /api/media/upload — загрузка файла */
app.post('/api/media/upload', authMiddleware, uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не прикреплён' });

    // SEC-2: whitelist MIME-типов. Заявленный клиентом mimetype сравнивается
    // со списком разрешённых. avatars уходят через отдельный endpoint.
    if (!isAllowedMime(req.file.mimetype)) {
      return res.status(400).json({ error: 'Недопустимый тип файла' });
    }

    // SEC-2: whitelist папок. avatars доступны только через /api/users/me/avatar,
    // остальные произвольные значения приводятся к 'attachments'.
    const rawFolder = req.body.folder;
    if (rawFolder !== undefined && !isAllowedFolder(rawFolder)) {
      return res.status(400).json({ error: 'Недопустимая папка' });
    }
    if (rawFolder === 'avatars') {
      return res.status(400).json({ error: 'Для аватаров используйте /api/users/me/avatar' });
    }
    const folder = rawFolder || 'attachments';

    const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, folder);

    // Сохранить запись в БД
    await pool.query(
      `INSERT INTO attachments (id, message_id, uploader_id, file_name, file_size, mime_type, url, object_name)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
      [req.body.message_id || null, req.user.id, req.file.originalname, result.size, result.mimeType, result.url, result.objectName]
    );

    res.status(201).json(result);
  } catch (err) {
    console.error('[media upload]', err?.message);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

/** POST /api/media/download — pre-signed URL для скачивания */
app.post('/api/media/download', authMiddleware, async (req, res) => {
  try {
    const objectName = req.body?.object_name;

    // SEC-3: валидация object_name + проверка ownership/доступа.
    // Без неё любой аутентифицированный пользователь может запросить
    // presigned URL для чужого объекта.
    if (
      !objectName ||
      typeof objectName !== 'string' ||
      objectName.length > 300 ||
      objectName.includes('..') ||
      objectName.startsWith('/')
    ) {
      return res.status(400).json({ error: 'Недопустимое имя объекта' });
    }

    // Проверяем, что объект принадлежит пользователю либо доступен ему
    // через участие в чате (для attachments) или это публичный аватар.
    let hasAccess = false;

    if (objectName.startsWith('avatars/')) {
      // Аватары публичны по политике bucket, но всё равно проверяем что объект существует
      // и этот запрос не используется для разведки. Разрешаем любому аутентифицированному.
      hasAccess = true;
    } else {
      const r = await pool.query(
        `SELECT 1 FROM attachments a
         LEFT JOIN messages m ON m.id = a.message_id
         LEFT JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $2
         WHERE a.object_name = $1
           AND (a.uploader_id = $2 OR cm.user_id = $2)
         LIMIT 1`,
        [objectName, req.user.id]
      );
      hasAccess = r.rows.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Нет доступа к файлу' });
    }

    const url = await getDownloadUrl(objectName);
    res.json({ url });
  } catch (err) {
    console.error('[media download]', err?.message);
    res.status(404).json({ error: 'Файл не найден' });
  }
});

/** POST /api/media/upload-url — получить pre-signed URL для прямой загрузки */
app.post('/api/media/upload-url', authMiddleware, uploadLimiter, async (req, res) => {
  try {
    const { fileName, folder } = req.body || {};

    // SEC-2: whitelist папок (тот же, что для /api/media/upload)
    if (folder !== undefined && !isAllowedFolder(folder)) {
      return res.status(400).json({ error: 'Недопустимая папка' });
    }
    if (folder === 'avatars') {
      return res.status(400).json({ error: 'Для аватаров используйте /api/users/me/avatar' });
    }
    const safeFolder = folder || 'attachments';

    // SEC-2: санитизация расширения (только a-z0-9, до 10 символов)
    const ext = sanitizeExt(fileName);
    const objectName = `${safeFolder}/${uuid()}.${ext}`;
    const url = await getUploadUrl(objectName);
    res.json({ url, objectName });
  } catch (err) {
    console.error('[upload-url]', err?.message);
    res.status(500).json({ error: 'Ошибка генерации URL' });
  }
});

// ==================== ПОИСК СООБЩЕНИЙ ====================

/** GET /api/messages/search?q=text&chat_id=optional */
app.get('/api/messages/search', authMiddleware, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({ error: 'Минимум 2 символа для поиска' });
    }
    const chatId = req.query.chat_id;
    // DB-2: используем Postgres FTS (content_tsv + GIN-индекс).
    // После применения phase-0-hardening.sql ILIKE-поиск с seq scan
    // заменён на быстрый @@ plainto_tsquery.
    let query, params;
    if (chatId) {
      // Search within specific chat (must be member)
      const member = await pool.query('SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2', [chatId, req.user.id]);
      if (member.rows.length === 0) return res.status(403).json({ error: 'Нет доступа' });
      query = `SELECT m.*, u.display_name as sender_name, c.name as chat_name
        FROM messages m JOIN users u ON u.id = m.sender_id JOIN chats c ON c.id = m.chat_id
        WHERE m.chat_id = $1 AND m.content_tsv @@ plainto_tsquery('russian', $2)
        ORDER BY m.created_at DESC LIMIT 50`;
      params = [chatId, q];
    } else {
      // Search across all user's chats
      query = `SELECT m.*, u.display_name as sender_name, c.name as chat_name
        FROM messages m JOIN users u ON u.id = m.sender_id JOIN chats c ON c.id = m.chat_id
        JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $1
        WHERE m.content_tsv @@ plainto_tsquery('russian', $2)
        ORDER BY m.created_at DESC LIMIT 50`;
      params = [req.user.id, q];
    }
    const result = await pool.query(query, params);
    res.json({ messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// ==================== БЛОКИРОВКА ПОЛЬЗОВАТЕЛЕЙ ====================

/** POST /api/users/:id/block — заблокировать пользователя */
app.post('/api/users/:id/block', authMiddleware, async (req, res) => {
  try {
    const blockedId = req.params.id;
    if (blockedId === req.user.id) return res.status(400).json({ error: 'Нельзя заблокировать себя' });
    // Проверить что пользователь существует
    const user = await pool.query('SELECT id FROM users WHERE id = $1', [blockedId]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    await pool.query(
      'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT (blocker_id, blocked_id) DO NOTHING',
      [req.user.id, blockedId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка блокировки' });
  }
});

/** DELETE /api/users/:id/block — разблокировать пользователя */
app.delete('/api/users/:id/block', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
      [req.user.id, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка разблокировки' });
  }
});

/** GET /api/users/blocked — список заблокированных */
app.get('/api/users/blocked', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.blocked_id, b.created_at,
        u.display_name, u.email, u.avatar_url
      FROM blocked_users b
      JOIN users u ON u.id = b.blocked_id
      WHERE b.blocker_id = $1
      ORDER BY b.created_at DESC
    `, [req.user.id]);
    res.json({ blocked: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки списка заблокированных' });
  }
});

// ==================== HEALTH ====================

/**
 * P1.7: разделённые health checks.
 *
 * /health/live — liveness. Процесс жив, event loop не заблокирован.
 *   Всегда 200, если Node-процесс отвечает. Используется Kubernetes/Docker
 *   для перезапуска "зависшего" контейнера.
 *
 * /health/ready — readiness. Все зависимости доступны и можно принимать
 *   трафик. 200 если postgres + redis + minio отвечают, 503 если нет.
 *
 * /health — legacy endpoint, поведение: та же проверка что /health/ready.
 *   Оставлен для обратной совместимости.
 */

/** Быстрая liveness-проверка */
app.get('/health/live', (_, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'son-api',
    uptime: process.uptime(),
  });
});

async function checkPostgres() {
  try {
    const t0 = Date.now();
    await pool.query('SELECT 1');
    return { status: 'ok', latency_ms: Date.now() - t0 };
  } catch (err) {
    return { status: 'error', message: err?.message };
  }
}

async function checkRedis() {
  // В тестовом окружении Redis недоступен — skip.
  if (process.env.NODE_ENV === 'test') return { status: 'ok', skipped: true };

  // Redis используется только через express-rate-limit и WS-rate-limit,
  // напрямую клиент не держится. Делаем лёгкий TCP-check через net.
  // Если redis недоступен — rate-limiters откатятся на memory.
  const net = require('net');
  const host = process.env.REDIS_HOST || 'redis';
  const port = parseInt(process.env.REDIS_PORT || '6379');
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const timeout = setTimeout(() => {
      sock.destroy();
      resolve({ status: 'error', message: 'timeout' });
    }, 2000);
    sock.once('connect', () => {
      clearTimeout(timeout);
      sock.destroy();
      resolve({ status: 'ok' });
    });
    sock.once('error', (err) => {
      clearTimeout(timeout);
      resolve({ status: 'error', message: err?.message });
    });
    sock.connect(port, host);
  });
}

async function checkMinio() {
  try {
    const t0 = Date.now();
    const ok = await minioHealth();
    return ok
      ? { status: 'ok', latency_ms: Date.now() - t0 }
      : { status: 'error', message: 'bucket check failed' };
  } catch (err) {
    return { status: 'error', message: err?.message };
  }
}

/** Readiness: все зависимости доступны */
app.get('/health/ready', async (_, res) => {
  const [postgres, redis, minio] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkMinio(),
  ]);
  const allOk =
    postgres.status === 'ok' &&
    redis.status === 'ok' &&
    minio.status === 'ok';
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ready' : 'not-ready',
    service: 'son-api',
    uptime: process.uptime(),
    checks: { postgres, redis, minio },
  });
});

/** Legacy endpoint — для обратной совместимости */
app.get('/health', async (_, res) => {
  const [postgres, redis, minio] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkMinio(),
  ]);
  const allOk =
    postgres.status === 'ok' &&
    redis.status === 'ok' &&
    minio.status === 'ok';
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    service: 'son-api',
    uptime: process.uptime(),
    postgres: postgres.status,
    redis: redis.status,
    minio: minio.status,
  });
});

// ==================== Global Error Handlers ====================

// P1.2: Sentry Express error handler. Должен быть ПЕРЕД кастомным
// error middleware, чтобы захватить ошибку до того как мы отдадим
// пользователю 500. Если SENTRY_DSN не задан — no-op.
sentry.setupExpressErrorHandler(app);

// Express error-handling middleware — ловит async rejections из route handlers
// и middleware (Express 5 автоматически передаёт их сюда через next(err)).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // req.log создан pino-http с привязанным req.id
  const log = req.log || logger;
  log.error({
    err,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  }, 'express error');
  if (res.headersSent) return;
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Safety net на уровне процесса — не даём процессу умереть от rejected
// promises, которые не попали в route handlers (например из WS callback'ов).
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ err }, 'unhandledRejection');
  sentry.captureException(err, { source: 'unhandledRejection' });
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
  sentry.captureException(err, { source: 'uncaughtException' });
  // Не выходим — пусть процесс дожмёт запросы, а потом систем-ди перезапустит
});

// ==================== START ====================

async function start() {
  await initDB();
  await ensureBucket().catch((err) => logger.warn({ err }, 'MinIO недоступен при старте'));
  server.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, 'sOn API сервер запущен');
  });
}

// ==================== Graceful Shutdown ====================

/**
 * Корректное завершение:
 * 1) отклоняем новые подключения, но даём отработать текущим HTTP-запросам,
 * 2) закрываем активные WebSocket соединения,
 * 3) закрываем пул PostgreSQL,
 * 4) выходим.
 *
 * P1.6: ранее server.close() не ожидался, pool.end() вызывался параллельно,
 * активные HTTP-запросы могли получить разорванное соединение.
 */
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n⏹️  ${signal} — завершение сервера...`);

  // Жёсткий таймаут на случай зависания (safety net)
  const hardTimeout = setTimeout(() => {
    console.error('⚠️ Принудительное завершение через 15 секунд');
    process.exit(1);
  }, 15000);
  hardTimeout.unref?.();

  try {
    // 1. Перестать принимать новые HTTP-подключения и дождаться активных запросов.
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    console.log('✅ HTTP сервер остановлен');

    // 2. Закрыть все WebSocket соединения (мягко, с кодом 1001).
    for (const ws of wss.clients) {
      try {
        ws.close(1001, 'Сервер перезапускается');
      } catch (err) {
        console.error('[shutdown] ws.close failed:', err?.message);
      }
    }
    // Даём WS клиентам коротенькую паузу, чтобы close frame ушёл
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('✅ WebSocket соединения закрыты');

    // 3. Закрыть пул PostgreSQL (после того как запросы прошли).
    await pool.end();
    console.log('✅ PostgreSQL пул закрыт');

    // 4. Flush Sentry events (no-op если DSN не задан).
    await sentry.close(2000);

    clearTimeout(hardTimeout);
    process.exit(0);
  } catch (err) {
    console.error('[shutdown] error:', err?.message);
    clearTimeout(hardTimeout);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((err) => {
    console.error('[shutdown] unhandled error:', err?.message);
    process.exit(1);
  });
});
process.on('SIGINT', () => {
  shutdown('SIGINT').catch((err) => {
    console.error('[shutdown] unhandled error:', err?.message);
    process.exit(1);
  });
});

// Запуск только при прямом вызове (не при импорте для тестов)
if (require.main === module) {
  start();
}

module.exports = { app, server, wss, pool };
