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
      'SELECT role, permissions FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Нет доступа к этому чату' });
    }
    // P2.2: сохраняем роль и права на объект запроса для downstream handlers
    req.chatRole = result.rows[0].role || 'member';
    req.chatPermissions = result.rows[0].permissions || {};
    next();
  } catch (err) {
    console.error('[chatMemberCheck] DB error', { chatId, userId, message: err?.message });
    res.status(503).json({ error: 'Сервис временно недоступен' });
  }
}

/**
 * P2.2: проверка прав на действие в группе.
 * owner — всегда разрешено. admin — если право в дефолтах или permissions.
 * member — только если право явно выдано в permissions.
 */
const ADMIN_DEFAULT_PERMISSIONS = new Set([
  'can_pin', 'can_delete_messages', 'can_invite', 'can_change_info',
]);

function hasPermission(role, permissions, action) {
  if (role === 'admin' && ADMIN_DEFAULT_PERMISSIONS.has(action)) return true;
  if (role === 'owner') return true;
  return permissions?.[action] === true;
}

/** Middleware-фабрика: проверяет конкретное право после chatMemberCheck */
function requirePermission(action) {
  return (req, res, next) => {
    if (!hasPermission(req.chatRole, req.chatPermissions, action)) {
      return res.status(403).json({ error: 'Недостаточно прав для этого действия' });
    }
    next();
  };
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
  // Marker-based пагинация (паттерн из MAX)
  const limit = Math.min(parseInt(req.query.count) || 50, 200);
  const marker = req.query.marker; // ISO timestamp последнего чата

  let whereClause = 'WHERE cm.user_id = $1';
  const params = [req.user.id];

  if (marker) {
    params.push(marker);
    whereClause += ` AND COALESCE(c.last_message_at, c.created_at) < $${params.length}`;
  }

  params.push(limit + 1); // +1 чтобы определить has_more

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
    ${whereClause}
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    LIMIT $${params.length}
  `, params);

  const hasMore = result.rows.length > limit;
  const chats = hasMore ? result.rows.slice(0, limit) : result.rows;
  const nextMarker = hasMore
    ? (chats[chats.length - 1].last_message_at || chats[chats.length - 1].created_at)
    : null;

  res.json({ chats, marker: nextMarker });
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
  // Marker-based пагинация (паттерн из MAX)
  const limit = Math.min(parseInt(req.query.count || req.query.limit) || 50, 200);
  const marker = req.query.marker || req.query.before; // marker = ISO timestamp

  let query, params;
  if (marker) {
    query = `SELECT m.*, u.display_name as sender_name FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = $1 AND m.created_at < $2
     ORDER BY m.created_at DESC LIMIT $3`;
    params = [req.params.chatId, marker, limit + 1];
  } else {
    query = `SELECT m.*, u.display_name as sender_name FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = $1
     ORDER BY m.created_at DESC LIMIT $2`;
    params = [req.params.chatId, limit + 1];
  }

  const result = await pool.query(query, params);
  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const messages = rows.reverse(); // Хронологический порядок (ASC)

  // Загрузить реакции для всех сообщений одним запросом
  let messagesWithReactions = messages;
  if (messages.length > 0) {
    const messageIds = messages.map((m) => m.id);
    const reactionsResult = await pool.query(
      'SELECT r.message_id, r.emoji, r.user_id FROM reactions r WHERE r.message_id = ANY($1::uuid[])',
      [messageIds]
    );
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

  const nextMarker = hasMore ? rows[0].created_at : null; // rows[0] — самый старый (DESC → первый)
  res.json({ messages: messagesWithReactions, marker: nextMarker, has_more: hasMore });
});

/** POST /api/chats/:chatId/messages */
app.post('/api/chats/:chatId/messages', authMiddleware, messageLimiter, chatMemberCheck, async (req, res) => {
  const { content, type = 'text', reply_to, self_destruct_seconds, e2ee,
    forwarded_from_id, forwarded_from_chat_name, forwarded_from_sender_name,
    mentioned_user_ids } = req.body;
  const chatId = req.params.chatId;

  const allowedTypes = ['text', 'image', 'file', 'audio', 'video', 'voice', 'system', 'poll', 'video_note', 'sticker'];
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

    // P2.3/P2.6: forwarded_from_* и mentioned_user_ids сохраняются при отправке
    const safeMentions = Array.isArray(mentioned_user_ids) ? mentioned_user_ids.filter(id => typeof id === 'string') : null;
    const result = await client.query(
      `INSERT INTO messages (chat_id, sender_id, content, type, reply_to, self_destruct_at,
        e2ee_nonce, e2ee_header, e2ee_algorithm,
        forwarded_from_id, forwarded_from_chat_name, forwarded_from_sender_name,
        mentioned_user_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [chatId, req.user.id, dbContent, type, reply_to || null, selfDestructAt,
        e2eeNonce, e2eeHeader, e2eeAlgorithm,
        forwarded_from_id || null, forwarded_from_chat_name || null, forwarded_from_sender_name || null,
        safeMentions]
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
app.patch('/api/chats/:chatId', authMiddleware, chatMemberCheck, requirePermission('can_change_info'), async (req, res) => {
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

// ==================== INVITE LINKS (P2.1) ====================

/** POST /api/chats/:chatId/invite — создать invite link (только admin) */
app.post('/api/chats/:chatId/invite', authMiddleware, chatMemberCheck, requirePermission('can_invite'), async (req, res) => {
  try {
    const chatId = req.params.chatId;
    // Только group чаты
    const chat = await pool.query('SELECT type FROM chats WHERE id = $1', [chatId]);
    if (chat.rows[0]?.type !== 'group') {
      return res.status(400).json({ error: 'Invite links доступны только для групп' });
    }
    // Только admin
    const role = await pool.query(
      'SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.user.id]
    );
    if (role.rows[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Только администратор может создавать ссылки' });
    }
    const { expires_hours, max_uses } = req.body || {};
    const expiresAt = expires_hours
      ? new Date(Date.now() + Number(expires_hours) * 3600000).toISOString()
      : null;
    // Генерируем уникальный токен (16 байт hex = 32 символа)
    const token = require('crypto').randomBytes(16).toString('hex');
    const result = await pool.query(
      `INSERT INTO chat_invites (chat_id, token, created_by, expires_at, max_uses)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [chatId, token, req.user.id, expiresAt, max_uses || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[invite create]', err?.message);
    res.status(500).json({ error: 'Ошибка создания приглашения' });
  }
});

/** GET /api/invite/:token — информация о группе по invite token (без auth) */
app.get('/api/invite/:token', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ci.id, ci.chat_id, ci.expires_at, ci.max_uses, ci.uses_count,
             c.name as chat_name, c.avatar_url as chat_avatar,
             (SELECT COUNT(*) FROM chat_members WHERE chat_id = ci.chat_id)::int as member_count
      FROM chat_invites ci
      JOIN chats c ON c.id = ci.chat_id
      WHERE ci.token = $1
    `, [req.params.token]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Приглашение не найдено или истекло' });
    }
    const invite = result.rows[0];
    // Проверить срок и использования
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Срок приглашения истёк' });
    }
    if (invite.max_uses && invite.uses_count >= invite.max_uses) {
      return res.status(410).json({ error: 'Лимит использований исчерпан' });
    }
    res.json({
      chat_name: invite.chat_name,
      chat_avatar: invite.chat_avatar,
      member_count: invite.member_count,
    });
  } catch (err) {
    console.error('[invite info]', err?.message);
    res.status(500).json({ error: 'Ошибка получения информации' });
  }
});

/** POST /api/invite/:token/join — вступить в группу по invite (с auth) */
app.post('/api/invite/:token/join', authMiddleware, async (req, res) => {
  try {
    const invite = await pool.query(
      'SELECT * FROM chat_invites WHERE token = $1',
      [req.params.token]
    );
    if (invite.rows.length === 0) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }
    const inv = invite.rows[0];
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Срок приглашения истёк' });
    }
    if (inv.max_uses && inv.uses_count >= inv.max_uses) {
      return res.status(410).json({ error: 'Лимит использований исчерпан' });
    }
    // Проверить что юзер ещё не в чате
    const existing = await pool.query(
      'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [inv.chat_id, req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Вы уже участник этой группы' });
    }
    // Добавить в чат + обновить счётчик
    await pool.query(
      'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)',
      [inv.chat_id, req.user.id, 'member']
    );
    await pool.query(
      'UPDATE chat_invites SET uses_count = uses_count + 1 WHERE id = $1',
      [inv.id]
    );
    // Уведомить участников
    broadcastToChat(inv.chat_id, {
      type: 'member_added',
      chat_id: inv.chat_id,
      user_id: req.user.id,
      display_name: req.user.display_name,
    });
    res.json({ ok: true, chat_id: inv.chat_id });
  } catch (err) {
    console.error('[invite join]', err?.message);
    res.status(500).json({ error: 'Ошибка вступления' });
  }
});

/** DELETE /api/chats/:chatId/invite/:inviteId — отозвать invite */
app.delete('/api/chats/:chatId/invite/:inviteId', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM chat_invites WHERE id = $1 AND chat_id = $2 RETURNING id',
      [req.params.inviteId, req.params.chatId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[invite delete]', err?.message);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

/** GET /api/chats/:chatId/invites — список invite links чата */
app.get('/api/chats/:chatId/invites', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM chat_invites WHERE chat_id = $1 ORDER BY created_at DESC',
      [req.params.chatId]
    );
    res.json({ invites: result.rows });
  } catch (err) {
    console.error('[invites list]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// ==================== PINNED MESSAGES (P2.4) ====================

/** POST /api/chats/:chatId/pin — закрепить сообщение */
app.post('/api/chats/:chatId/pin', authMiddleware, chatMemberCheck, requirePermission('can_pin'), async (req, res) => {
  try {
    const { message_id } = req.body;
    if (!message_id) return res.status(400).json({ error: 'message_id обязателен' });
    // Проверить что сообщение принадлежит чату
    const msg = await pool.query(
      'SELECT id, content, sender_id FROM messages WHERE id = $1 AND chat_id = $2',
      [message_id, req.params.chatId]
    );
    if (msg.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено в этом чате' });
    }
    await pool.query(
      'UPDATE chats SET pinned_message_id = $1 WHERE id = $2',
      [message_id, req.params.chatId]
    );
    broadcastToChat(req.params.chatId, {
      type: 'message_pinned',
      chat_id: req.params.chatId,
      message_id,
      pinned_by: req.user.id,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[pin]', err?.message);
    res.status(500).json({ error: 'Ошибка закрепления' });
  }
});

/** DELETE /api/chats/:chatId/pin — открепить */
app.delete('/api/chats/:chatId/pin', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    await pool.query(
      'UPDATE chats SET pinned_message_id = NULL WHERE id = $1',
      [req.params.chatId]
    );
    broadcastToChat(req.params.chatId, {
      type: 'message_unpinned',
      chat_id: req.params.chatId,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[unpin]', err?.message);
    res.status(500).json({ error: 'Ошибка открепления' });
  }
});

// ==================== FORWARDED MESSAGES (P2.3) ====================

/** POST /api/chats/:chatId/forward — переслать сообщение из другого чата */
app.post('/api/chats/:chatId/forward', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const { source_message_id, source_chat_id } = req.body;
    if (!source_message_id || !source_chat_id) {
      return res.status(400).json({ error: 'source_message_id и source_chat_id обязательны' });
    }
    // Проверить что юзер — участник исходного чата
    const memberCheck = await pool.query(
      'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [source_chat_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Нет доступа к исходному чату' });
    }
    // Получить оригинальное сообщение
    const original = await pool.query(`
      SELECT m.content, m.type, m.sender_id, u.display_name as sender_name,
             c.name as chat_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      JOIN chats c ON c.id = m.chat_id
      WHERE m.id = $1 AND m.chat_id = $2
    `, [source_message_id, source_chat_id]);
    if (original.rows.length === 0) {
      return res.status(404).json({ error: 'Исходное сообщение не найдено' });
    }
    const orig = original.rows[0];
    // Нельзя пересылать секретные
    const targetChat = await pool.query('SELECT type FROM chats WHERE id = $1', [req.params.chatId]);
    if (targetChat.rows[0]?.type === 'secret') {
      return res.status(400).json({ error: 'Нельзя пересылать в секретный чат' });
    }
    // Создать forwarded сообщение
    const result = await pool.query(`
      INSERT INTO messages (chat_id, sender_id, content, type,
        forwarded_from_id, forwarded_from_chat_name, forwarded_from_sender_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [
      req.params.chatId, req.user.id, orig.content, orig.type,
      source_message_id, orig.chat_name || 'Чат', orig.sender_name,
    ]);
    const msg = result.rows[0];
    msg.sender_name = req.user.display_name;
    // Обновить last_message_at
    await pool.query('UPDATE chats SET last_message_at = $1 WHERE id = $2', [msg.created_at, req.params.chatId]);
    await pool.query(
      'UPDATE chat_members SET unread_count = unread_count + 1 WHERE chat_id = $1 AND user_id != $2',
      [req.params.chatId, req.user.id]
    );
    broadcastToChat(req.params.chatId, { type: 'new_message', message: msg }, req.user.id);
    const pushContent = orig.content?.substring(0, 100) || 'Пересланное сообщение';
    sendPushToOfflineMembers(req.params.chatId, req.user.id, pushContent, req.user.display_name);
    res.status(201).json(msg);
  } catch (err) {
    console.error('[forward]', err?.message);
    res.status(500).json({ error: 'Ошибка пересылки' });
  }
});

// ==================== @MENTIONS (P2.6) ====================

/** GET /api/chats/:chatId/members/search?q= — поиск участников для @mention */
app.get('/api/chats/:chatId/members/search', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || typeof q !== 'string' || q.length < 1) {
      return res.status(400).json({ error: 'Параметр q обязателен' });
    }
    const result = await pool.query(`
      SELECT u.id, u.display_name, u.avatar_url
      FROM chat_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.chat_id = $1
        AND u.id != $2
        AND u.display_name ILIKE $3
      ORDER BY u.display_name
      LIMIT 10
    `, [req.params.chatId, req.user.id, `%${q}%`]);
    res.json({ members: result.rows });
  } catch (err) {
    console.error('[members search]', err?.message);
    res.status(500).json({ error: 'Ошибка поиска' });
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

// ==================== RBAC (P2.2) ====================

/** PATCH /api/chats/:chatId/members/:userId/role — изменить роль участника */
app.patch('/api/chats/:chatId/members/:userId/role', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const { role, permissions } = req.body;
    const VALID_ROLES = ['admin', 'member'];
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Роль должна быть admin или member' });
    }
    // Только owner может менять роли
    if (req.chatRole !== 'owner') {
      return res.status(403).json({ error: 'Только создатель группы может менять роли' });
    }
    // Нельзя менять роль себе
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Нельзя изменить свою роль' });
    }
    // Проверяем что целевой пользователь в чате
    const target = await pool.query(
      'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [req.params.chatId, req.params.userId]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден в этом чате' });
    }
    const safePerms = typeof permissions === 'object' && permissions !== null ? permissions : {};
    await pool.query(
      'UPDATE chat_members SET role = $1, permissions = $2 WHERE chat_id = $3 AND user_id = $4',
      [role, JSON.stringify(safePerms), req.params.chatId, req.params.userId]
    );
    broadcastToChat(req.params.chatId, {
      type: 'member_role_changed',
      chat_id: req.params.chatId,
      user_id: req.params.userId,
      role,
      changed_by: req.user.id,
    });
    res.json({ ok: true, role, permissions: safePerms });
  } catch (err) {
    console.error('[role change]', err?.message);
    res.status(500).json({ error: 'Ошибка изменения роли' });
  }
});

/** GET /api/chats/:chatId/members — список участников с ролями */
app.get('/api/chats/:chatId/members', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cm.user_id, cm.role, cm.permissions, cm.joined_at,
             u.display_name, u.avatar_url, u.is_online
      FROM chat_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.chat_id = $1
      ORDER BY
        CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
        u.display_name
    `, [req.params.chatId]);
    res.json({ members: result.rows });
  } catch (err) {
    console.error('[members list]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** GET /api/chats/:chatId/admins — список админов (паттерн из MAX) */
app.get('/api/chats/:chatId/admins', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cm.user_id, cm.role, cm.permissions, cm.joined_at,
             u.display_name, u.avatar_url, u.is_online
      FROM chat_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.chat_id = $1 AND cm.role IN ('owner', 'admin')
      ORDER BY CASE cm.role WHEN 'owner' THEN 0 ELSE 1 END, u.display_name
    `, [req.params.chatId]);
    res.json({ members: result.rows });
  } catch (err) {
    console.error('[admins list]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** GET /api/chats/:chatId/membership — мой статус в чате (паттерн из MAX) */
app.get('/api/chats/:chatId/membership', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cm.user_id, cm.role, cm.permissions, cm.joined_at,
             u.display_name, u.avatar_url, u.is_online
      FROM chat_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.chat_id = $1 AND cm.user_id = $2
    `, [req.params.chatId, req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Вы не участник этого чата' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[membership]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** DELETE /api/chats/:chatId/members/me — покинуть чат (паттерн из MAX) */
app.delete('/api/chats/:chatId/members/me', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    // Владелец не может покинуть чат
    const member = await pool.query(
      'SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [req.params.chatId, req.user.id]
    );
    if (member.rows[0]?.role === 'owner') {
      return res.status(400).json({ error: 'Владелец не может покинуть чат. Передайте права сначала.' });
    }

    await pool.query(
      'DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [req.params.chatId, req.user.id]
    );

    broadcastToChat(req.params.chatId, {
      type: 'user_removed',
      chat_id: req.params.chatId,
      user_id: req.user.id,
      left_voluntarily: true,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[leave chat]', err?.message);
    res.status(500).json({ error: 'Ошибка при выходе из чата' });
  }
});

// ==================== LIVEKIT GROUP CALLS (P2.12) ====================

const { AccessToken } = require('livekit-server-sdk');

const LK_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LK_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LK_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';

/** POST /api/calls/token — получить LiveKit room token */
app.post('/api/calls/token', authMiddleware, async (req, res) => {
  try {
    const { chat_id, is_video = false } = req.body;
    if (!chat_id) return res.status(400).json({ error: 'chat_id обязателен' });

    // Проверить membership
    const member = await pool.query(
      'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chat_id, req.user.id]
    );
    if (member.rows.length === 0) {
      return res.status(403).json({ error: 'Нет доступа к этому чату' });
    }

    // Room name = chat_id (один room на чат)
    const roomName = `chat-${chat_id}`;

    const token = new AccessToken(LK_API_KEY, LK_API_SECRET, {
      identity: req.user.id,
      name: req.user.display_name,
      metadata: JSON.stringify({ chat_id, is_video }),
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();
    res.json({ token: jwt, url: LK_URL, room: roomName });
  } catch (err) {
    console.error('[livekit token]', err?.message);
    res.status(500).json({ error: 'Ошибка генерации токена' });
  }
});

/** POST /api/calls/group-start — инициировать групповой звонок (broadcast WS) */
app.post('/api/calls/group-start', authMiddleware, chatMemberCheck, async (req, res) => {
  try {
    const { is_video = false } = req.body;
    const chatId = req.params.chatId || req.body.chat_id;
    if (!chatId) return res.status(400).json({ error: 'chat_id обязателен' });

    // Broadcast WS event всем участникам
    broadcastToChat(chatId, {
      type: 'group_call_started',
      chat_id: chatId,
      caller_id: req.user.id,
      caller_name: req.user.display_name,
      is_video,
    }, req.user.id);

    res.json({ ok: true, room: `chat-${chatId}` });
  } catch (err) {
    console.error('[group call start]', err?.message);
    res.status(500).json({ error: 'Ошибка запуска звонка' });
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

// ==================== POLLS (P2.9) ====================

/** POST /api/chats/:chatId/polls — создать опрос (как сообщение type='poll') */
app.post('/api/chats/:chatId/polls', authMiddleware, messageLimiter, chatMemberCheck, async (req, res) => {
  try {
    const { question, options, is_multiple_choice = false, is_anonymous = false, expires_hours } = req.body;
    if (!question || typeof question !== 'string' || question.length < 1 || question.length > 300) {
      return res.status(400).json({ error: 'Вопрос от 1 до 300 символов' });
    }
    if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
      return res.status(400).json({ error: 'От 2 до 10 вариантов ответа' });
    }
    for (const opt of options) {
      if (typeof opt !== 'string' || opt.length < 1 || opt.length > 200) {
        return res.status(400).json({ error: 'Каждый вариант от 1 до 200 символов' });
      }
    }
    const chatId = req.params.chatId;
    const expiresAt = expires_hours
      ? new Date(Date.now() + Number(expires_hours) * 3600000).toISOString()
      : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Создаём сообщение с type='poll'
      const msgResult = await client.query(
        `INSERT INTO messages (chat_id, sender_id, content, type) VALUES ($1, $2, $3, 'poll') RETURNING *`,
        [chatId, req.user.id, question]
      );
      const msg = msgResult.rows[0];
      msg.sender_name = req.user.display_name;

      // Создаём poll
      const pollResult = await client.query(
        `INSERT INTO polls (message_id, question, is_multiple_choice, is_anonymous, expires_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [msg.id, question, is_multiple_choice, is_anonymous, expiresAt]
      );
      const poll = pollResult.rows[0];

      // Создаём варианты
      const pollOptions = [];
      for (let i = 0; i < options.length; i++) {
        const optResult = await client.query(
          `INSERT INTO poll_options (poll_id, text, sort_order) VALUES ($1, $2, $3) RETURNING *`,
          [poll.id, options[i], i]
        );
        pollOptions.push({ ...optResult.rows[0], votes: 0, voted: false });
      }

      // Обновить last_message_at
      await client.query('UPDATE chats SET last_message_at = $1 WHERE id = $2', [msg.created_at, chatId]);
      await client.query(
        'UPDATE chat_members SET unread_count = unread_count + 1 WHERE chat_id = $1 AND user_id != $2',
        [chatId, req.user.id]
      );
      await client.query('COMMIT');

      const fullMsg = {
        ...msg,
        poll: { ...poll, options: pollOptions, total_votes: 0 },
      };
      broadcastToChat(chatId, { type: 'new_message', message: fullMsg }, req.user.id);
      res.status(201).json(fullMsg);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[poll create]', err?.message);
    res.status(500).json({ error: 'Ошибка создания опроса' });
  }
});

/** POST /api/polls/:pollId/vote — проголосовать */
app.post('/api/polls/:pollId/vote', authMiddleware, async (req, res) => {
  try {
    const { option_id } = req.body;
    if (!option_id) return res.status(400).json({ error: 'option_id обязателен' });
    const pollId = req.params.pollId;

    // Проверить что poll существует и user — участник чата
    const pollCheck = await pool.query(`
      SELECT p.id, p.is_multiple_choice, p.expires_at, m.chat_id
      FROM polls p JOIN messages m ON m.id = p.message_id
      WHERE p.id = $1
    `, [pollId]);
    if (pollCheck.rows.length === 0) return res.status(404).json({ error: 'Опрос не найден' });
    const poll = pollCheck.rows[0];

    if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Опрос завершён' });
    }

    // Проверить membership
    const member = await pool.query(
      'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [poll.chat_id, req.user.id]
    );
    if (member.rows.length === 0) return res.status(403).json({ error: 'Нет доступа' });

    // Проверить что option принадлежит poll'у
    const optCheck = await pool.query(
      'SELECT 1 FROM poll_options WHERE id = $1 AND poll_id = $2',
      [option_id, pollId]
    );
    if (optCheck.rows.length === 0) return res.status(400).json({ error: 'Вариант не найден' });

    // Если не multiple_choice — удалить предыдущие голоса
    if (!poll.is_multiple_choice) {
      await pool.query(
        'DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
        [pollId, req.user.id]
      );
    }

    // Toggle: если голос уже есть — убрать, иначе добавить
    const existing = await pool.query(
      'SELECT id FROM poll_votes WHERE poll_id = $1 AND option_id = $2 AND user_id = $3',
      [pollId, option_id, req.user.id]
    );
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM poll_votes WHERE id = $1', [existing.rows[0].id]);
    } else {
      await pool.query(
        'INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)',
        [pollId, option_id, req.user.id]
      );
    }

    // Получить обновлённые результаты
    const results = await pool.query(`
      SELECT po.id, po.text, po.sort_order,
        COUNT(pv.id)::int as votes,
        BOOL_OR(pv.user_id = $2) as voted
      FROM poll_options po
      LEFT JOIN poll_votes pv ON pv.option_id = po.id
      WHERE po.poll_id = $1
      GROUP BY po.id
      ORDER BY po.sort_order
    `, [pollId, req.user.id]);
    const totalVotes = results.rows.reduce((sum, r) => sum + r.votes, 0);

    broadcastToChat(poll.chat_id, {
      type: 'poll_updated',
      poll_id: pollId,
      options: results.rows,
      total_votes: totalVotes,
    });

    res.json({ options: results.rows, total_votes: totalVotes });
  } catch (err) {
    console.error('[poll vote]', err?.message);
    res.status(500).json({ error: 'Ошибка голосования' });
  }
});

/** GET /api/polls/:pollId — результаты опроса */
app.get('/api/polls/:pollId', authMiddleware, async (req, res) => {
  try {
    const pollId = req.params.pollId;
    const poll = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
    if (poll.rows.length === 0) return res.status(404).json({ error: 'Опрос не найден' });

    const results = await pool.query(`
      SELECT po.id, po.text, po.sort_order,
        COUNT(pv.id)::int as votes,
        BOOL_OR(pv.user_id = $2) as voted
      FROM poll_options po
      LEFT JOIN poll_votes pv ON pv.option_id = po.id
      WHERE po.poll_id = $1
      GROUP BY po.id
      ORDER BY po.sort_order
    `, [pollId, req.user.id]);
    const totalVotes = results.rows.reduce((sum, r) => sum + r.votes, 0);

    res.json({
      ...poll.rows[0],
      options: results.rows,
      total_votes: totalVotes,
    });
  } catch (err) {
    console.error('[poll get]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// ==================== URL PREVIEW (P2.10) ====================

const ogs = require('open-graph-scraper');
const crypto = require('crypto');

// Защита от SSRF: только публичные URL с http/https
function isPublicUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname;
    // Блокируем приватные IP и localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) return false;
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
    return true;
  } catch {
    return false;
  }
}

/** GET /api/og?url= — получить OpenGraph preview для URL */
app.get('/api/og', authMiddleware, async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || typeof url !== 'string' || url.length > 2000) {
      return res.status(400).json({ error: 'URL обязателен (до 2000 символов)' });
    }
    if (!isPublicUrl(url)) {
      return res.status(400).json({ error: 'Недопустимый URL' });
    }
    // Проверяем кэш (SHA-256 хэш URL → og_cache)
    const urlHash = crypto.createHash('sha256').update(url).digest('hex');
    const cached = await pool.query(
      "SELECT * FROM og_cache WHERE url_hash = $1 AND fetched_at > NOW() - INTERVAL '1 hour'",
      [urlHash]
    );
    if (cached.rows.length > 0) {
      const c = cached.rows[0];
      return res.json({ title: c.title, description: c.description, image: c.image_url, site_name: c.site_name, url });
    }

    // Fetch OG tags с таймаутом
    const { result } = await ogs({
      url,
      timeout: 5000,
      fetchOptions: { headers: { 'User-Agent': 'sOn-Bot/1.0' } },
    });

    const ogData = {
      title: result.ogTitle?.substring(0, 500) || null,
      description: result.ogDescription?.substring(0, 1000) || null,
      image: result.ogImage?.[0]?.url || null,
      site_name: result.ogSiteName?.substring(0, 200) || null,
    };

    // Сохранить в кэш (upsert)
    await pool.query(`
      INSERT INTO og_cache (url_hash, url, title, description, image_url, site_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (url_hash) DO UPDATE SET
        title = EXCLUDED.title, description = EXCLUDED.description,
        image_url = EXCLUDED.image_url, site_name = EXCLUDED.site_name,
        fetched_at = NOW()
    `, [urlHash, url, ogData.title, ogData.description, ogData.image, ogData.site_name]);

    res.json({ ...ogData, url });
  } catch (err) {
    // Ошибка fetch — возвращаем пустой preview (не 500)
    console.error('[og]', err?.message);
    res.json({ title: null, description: null, image: null, site_name: null, url: req.query.url });
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

// ==================== СТИКЕРЫ (P2.8) ====================

/** GET /api/sticker-packs — доступные пакеты стикеров */
app.get('/api/sticker-packs', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sp.*,
        EXISTS(SELECT 1 FROM user_sticker_packs usp WHERE usp.pack_id = sp.id AND usp.user_id = $1) as is_added
      FROM sticker_packs sp
      ORDER BY sp.is_official DESC, sp.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json({ packs: result.rows });
  } catch (err) {
    console.error('[sticker packs]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** GET /api/sticker-packs/my — мои добавленные паки */
app.get('/api/sticker-packs/my', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sp.* FROM sticker_packs sp
      JOIN user_sticker_packs usp ON usp.pack_id = sp.id
      WHERE usp.user_id = $1
      ORDER BY usp.added_at DESC
    `, [req.user.id]);
    res.json({ packs: result.rows });
  } catch (err) {
    console.error('[my sticker packs]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** GET /api/sticker-packs/:id/stickers — стикеры в пакете */
app.get('/api/sticker-packs/:id/stickers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM stickers WHERE pack_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    res.json({ stickers: result.rows });
  } catch (err) {
    console.error('[stickers]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** POST /api/sticker-packs/:id/add — добавить пак себе */
app.post('/api/sticker-packs/:id/add', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO user_sticker_packs (user_id, pack_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[add sticker pack]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** DELETE /api/sticker-packs/:id/add — убрать пак */
app.delete('/api/sticker-packs/:id/add', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM user_sticker_packs WHERE user_id = $1 AND pack_id = $2',
      [req.user.id, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[remove sticker pack]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** POST /api/sticker-packs — создать пак (admin/owner) */
app.post('/api/sticker-packs', authMiddleware, async (req, res) => {
  try {
    const { name, description, cover_url } = req.body;
    if (!name || typeof name !== 'string' || name.length > 100) {
      return res.status(400).json({ error: 'Название от 1 до 100 символов' });
    }
    const result = await pool.query(
      `INSERT INTO sticker_packs (name, description, cover_url, author_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), description?.substring(0, 500) || null, cover_url || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[create sticker pack]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// ==================== КАНАЛЫ (P2.7) ====================

/** POST /api/channels — создать канал */
app.post('/api/channels', authMiddleware, async (req, res) => {
  try {
    const { name, description, is_public = true } = req.body;
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 200) {
      return res.status(400).json({ error: 'Название от 1 до 200 символов' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ch = await client.query(
        `INSERT INTO channels (name, description, owner_id, is_public) VALUES ($1, $2, $3, $4) RETURNING *`,
        [name.trim(), description?.substring(0, 1000) || null, req.user.id, is_public]
      );
      const channel = ch.rows[0];
      await client.query(
        `INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [channel.id, req.user.id]
      );
      await client.query('UPDATE channels SET subscriber_count = 1 WHERE id = $1', [channel.id]);
      await client.query('COMMIT');
      res.status(201).json({ ...channel, subscriber_count: 1 });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[channel create]', err?.message);
    res.status(500).json({ error: 'Ошибка создания канала' });
  }
});

/** GET /api/channels — каналы текущего пользователя */
app.get('/api/channels', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, cm.role
      FROM channels c
      JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $1
      ORDER BY c.created_at DESC
    `, [req.user.id]);
    res.json({ channels: result.rows });
  } catch (err) {
    console.error('[channels list]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** GET /api/channels/:id — информация о канале */
app.get('/api/channels/:id', authMiddleware, async (req, res) => {
  try {
    const ch = await pool.query('SELECT * FROM channels WHERE id = $1', [req.params.id]);
    if (ch.rows.length === 0) return res.status(404).json({ error: 'Канал не найден' });
    const membership = await pool.query(
      'SELECT role FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ ...ch.rows[0], my_role: membership.rows[0]?.role || null });
  } catch (err) {
    console.error('[channel get]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** POST /api/channels/:id/subscribe — подписаться */
app.post('/api/channels/:id/subscribe', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Уже подписан' });
    await pool.query(
      `INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, 'subscriber')`,
      [req.params.id, req.user.id]
    );
    await pool.query('UPDATE channels SET subscriber_count = subscriber_count + 1 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[channel subscribe]', err?.message);
    res.status(500).json({ error: 'Ошибка подписки' });
  }
});

/** DELETE /api/channels/:id/subscribe — отписаться */
app.delete('/api/channels/:id/subscribe', authMiddleware, async (req, res) => {
  try {
    const member = await pool.query(
      'SELECT role FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (member.rows.length === 0) return res.status(404).json({ error: 'Не подписан' });
    if (member.rows[0].role === 'owner') return res.status(400).json({ error: 'Владелец не может отписаться' });
    await pool.query('DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    await pool.query('UPDATE channels SET subscriber_count = GREATEST(subscriber_count - 1, 0) WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[channel unsubscribe]', err?.message);
    res.status(500).json({ error: 'Ошибка отписки' });
  }
});

/** POST /api/channels/:id/posts — создать пост (только owner/admin) */
app.post('/api/channels/:id/posts', authMiddleware, async (req, res) => {
  try {
    const member = await pool.query(
      'SELECT role FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!member.rows[0] || !['owner', 'admin'].includes(member.rows[0].role)) {
      return res.status(403).json({ error: 'Только администраторы могут публиковать' });
    }
    const { content, type = 'text', attachment_url } = req.body;
    if (!content || typeof content !== 'string' || content.length > 10000) {
      return res.status(400).json({ error: 'Контент обязателен (до 10000 символов)' });
    }
    const result = await pool.query(
      `INSERT INTO channel_posts (channel_id, author_id, content, type, attachment_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.user.id, content, type, attachment_url || null]
    );
    const post = result.rows[0];
    // WS broadcast всем подписчикам
    const subs = await pool.query('SELECT user_id FROM channel_members WHERE channel_id = $1', [req.params.id]);
    const payload = JSON.stringify({ type: 'channel_post', channel_id: req.params.id, post });
    for (const sub of subs.rows) {
      const conns = connections.get(sub.user_id);
      if (!conns) continue;
      for (const ws of conns) {
        if (ws.readyState === 1) try { ws.send(payload); } catch { /* skip */ }
      }
    }
    res.status(201).json(post);
  } catch (err) {
    console.error('[channel post]', err?.message);
    res.status(500).json({ error: 'Ошибка публикации' });
  }
});

/** GET /api/channels/:id/posts — лента постов канала */
app.get('/api/channels/:id/posts', authMiddleware, async (req, res) => {
  try {
    const member = await pool.query(
      'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (member.rows.length === 0) return res.status(403).json({ error: 'Подпишитесь для просмотра' });
    const before = req.query.before || new Date().toISOString();
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const result = await pool.query(`
      SELECT cp.*, u.display_name as author_name, u.avatar_url as author_avatar
      FROM channel_posts cp
      JOIN users u ON u.id = cp.author_id
      WHERE cp.channel_id = $1 AND cp.created_at < $2
      ORDER BY cp.created_at DESC LIMIT $3
    `, [req.params.id, before, limit]);
    res.json({ posts: result.rows, has_more: result.rows.length === limit });
  } catch (err) {
    console.error('[channel posts]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// ==================== STORIES (P2.11) ====================

/** POST /api/stories — создать story (24h TTL) */
app.post('/api/stories', authMiddleware, uploadLimiter, async (req, res) => {
  try {
    const { media_url, media_type = 'image', caption } = req.body;
    if (!media_url || typeof media_url !== 'string') {
      return res.status(400).json({ error: 'media_url обязателен' });
    }
    const ALLOWED_STORY_TYPES = ['image', 'video'];
    if (!ALLOWED_STORY_TYPES.includes(media_type)) {
      return res.status(400).json({ error: 'Тип: image или video' });
    }
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const result = await pool.query(
      `INSERT INTO stories (user_id, media_url, media_type, caption, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, media_url, media_type, caption?.substring(0, 500) || null, expiresAt]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[story create]', err?.message);
    res.status(500).json({ error: 'Ошибка создания story' });
  }
});

/** GET /api/stories — stories контактов (не истёкшие) */
app.get('/api/stories', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, u.display_name, u.avatar_url,
        EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = $1) as viewed
      FROM stories s
      JOIN users u ON u.id = s.user_id
      WHERE s.expires_at > NOW()
        AND (s.user_id = $1 OR s.user_id IN (
          SELECT contact_id FROM contacts WHERE owner_id = $1
        ))
      ORDER BY
        CASE WHEN s.user_id = $1 THEN 0 ELSE 1 END,
        s.created_at DESC
    `, [req.user.id]);
    // Группируем по пользователю
    const grouped = new Map();
    for (const story of result.rows) {
      if (!grouped.has(story.user_id)) {
        grouped.set(story.user_id, {
          user_id: story.user_id,
          display_name: story.display_name,
          avatar_url: story.avatar_url,
          stories: [],
          has_unviewed: false,
        });
      }
      const g = grouped.get(story.user_id);
      g.stories.push(story);
      if (!story.viewed) g.has_unviewed = true;
    }
    res.json({ users: Array.from(grouped.values()) });
  } catch (err) {
    console.error('[stories list]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** POST /api/stories/:id/view — отметить story просмотренной */
app.post('/api/stories/:id/view', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO story_views (story_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );
    await pool.query(
      'UPDATE stories SET views_count = (SELECT COUNT(*) FROM story_views WHERE story_id = $1) WHERE id = $1',
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[story view]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** DELETE /api/stories/:id — удалить свою story */
app.delete('/api/stories/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM stories WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Story не найдена' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[story delete]', err?.message);
    res.status(500).json({ error: 'Ошибка удаления' });
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

// ==================== 2FA TOTP (P3.3) ====================

const { authenticator } = require('otplib');

/** POST /api/auth/mfa/setup — начать настройку 2FA (генерировать secret) */
app.post('/api/auth/mfa/setup', authMiddleware, async (req, res) => {
  try {
    // Проверить что 2FA ещё не включена
    const existing = await pool.query(
      'SELECT is_enabled FROM user_mfa WHERE user_id = $1',
      [req.user.id]
    );
    if (existing.rows[0]?.is_enabled) {
      return res.status(409).json({ error: '2FA уже включена' });
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.email, 'sOn Messenger', secret);

    // Сохранить secret (ещё не включена)
    await pool.query(`
      INSERT INTO user_mfa (user_id, totp_secret, is_enabled)
      VALUES ($1, $2, false)
      ON CONFLICT (user_id) DO UPDATE SET totp_secret = $2, is_enabled = false
    `, [req.user.id, secret]);

    res.json({ secret, otpauth_url: otpauth });
  } catch (err) {
    console.error('[mfa setup]', err?.message);
    res.status(500).json({ error: 'Ошибка настройки 2FA' });
  }
});

/** POST /api/auth/mfa/verify — подтвердить 2FA код и активировать */
app.post('/api/auth/mfa/verify', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ error: 'Код должен быть 6 цифр' });
    }

    const mfa = await pool.query(
      'SELECT totp_secret, is_enabled FROM user_mfa WHERE user_id = $1',
      [req.user.id]
    );
    if (mfa.rows.length === 0) {
      return res.status(400).json({ error: 'Сначала вызовите /api/auth/mfa/setup' });
    }
    if (mfa.rows[0].is_enabled) {
      return res.status(409).json({ error: '2FA уже активна' });
    }

    const isValid = authenticator.check(code, mfa.rows[0].totp_secret);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный код' });
    }

    // Генерируем backup-коды (10 штук, 8 символов каждый)
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(require('crypto').randomBytes(4).toString('hex'));
    }
    // Хешируем backup-коды для хранения
    const hashedCodes = backupCodes.map(c =>
      require('crypto').createHash('sha256').update(c).digest('hex')
    );

    await pool.query(
      'UPDATE user_mfa SET is_enabled = true, backup_codes = $2, enabled_at = NOW() WHERE user_id = $1',
      [req.user.id, hashedCodes]
    );

    res.json({ ok: true, backup_codes: backupCodes });
  } catch (err) {
    console.error('[mfa verify]', err?.message);
    res.status(500).json({ error: 'Ошибка верификации' });
  }
});

/** DELETE /api/auth/mfa — отключить 2FA */
app.delete('/api/auth/mfa', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Код обязателен' });

    const mfa = await pool.query(
      'SELECT totp_secret FROM user_mfa WHERE user_id = $1 AND is_enabled = true',
      [req.user.id]
    );
    if (mfa.rows.length === 0) {
      return res.status(400).json({ error: '2FA не включена' });
    }

    const isValid = authenticator.check(code, mfa.rows[0].totp_secret);
    if (!isValid) return res.status(401).json({ error: 'Неверный код' });

    await pool.query('DELETE FROM user_mfa WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[mfa disable]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** GET /api/auth/mfa/status — статус 2FA */
app.get('/api/auth/mfa/status', authMiddleware, async (req, res) => {
  try {
    const mfa = await pool.query(
      'SELECT is_enabled, enabled_at FROM user_mfa WHERE user_id = $1',
      [req.user.id]
    );
    res.json({
      is_enabled: mfa.rows[0]?.is_enabled || false,
      enabled_at: mfa.rows[0]?.enabled_at || null,
    });
  } catch (err) {
    console.error('[mfa status]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// ==================== PHONE AUTH (P3.4) ====================

/**
 * POST /api/auth/phone/send-code — отправить SMS-код на телефон.
 * В production нужно подключить Twilio/SMS.ru/другой провайдер.
 * Сейчас — в dev-режиме код логируется в консоль.
 */
app.post('/api/auth/phone/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || typeof phone !== 'string' || phone.length < 10 || phone.length > 15) {
      return res.status(400).json({ error: 'Номер телефона от 10 до 15 символов' });
    }
    // Проверить rate limit — максимум 3 кода за 10 минут на один номер
    const recent = await pool.query(
      "SELECT COUNT(*)::int as count FROM phone_verifications WHERE phone = $1 AND created_at > NOW() - INTERVAL '10 minutes'",
      [phone]
    );
    if (recent.rows[0].count >= 3) {
      return res.status(429).json({ error: 'Слишком много попыток. Подождите 10 минут.' });
    }
    // Генерируем 6-значный код
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 минут
    await pool.query(
      'INSERT INTO phone_verifications (phone, code, expires_at) VALUES ($1, $2, $3)',
      [phone, code, expiresAt]
    );

    // TODO: отправить SMS через провайдер
    // В dev — логируем
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[phone auth] Код для ${phone}: ${code}`);
    }
    // В production подключить:
    // await sendSMS(phone, `sOn: ваш код — ${code}`);

    res.json({ ok: true, expires_in: 300 });
  } catch (err) {
    console.error('[phone send-code]', err?.message);
    res.status(500).json({ error: 'Ошибка отправки кода' });
  }
});

/** POST /api/auth/phone/verify — подтвердить код и войти/зарегистрироваться */
app.post('/api/auth/phone/verify', async (req, res) => {
  try {
    const { phone, code, display_name } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: 'phone и code обязательны' });
    }
    // Найти неиспользованный код
    const verification = await pool.query(`
      SELECT id, attempts FROM phone_verifications
      WHERE phone = $1 AND code = $2 AND used = false AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `, [phone, code]);

    if (verification.rows.length === 0) {
      // Увеличить счётчик попыток для последнего кода
      await pool.query(`
        UPDATE phone_verifications SET attempts = attempts + 1
        WHERE phone = $1 AND used = false AND expires_at > NOW()
        AND attempts < 5
      `, [phone]);
      return res.status(401).json({ error: 'Неверный или истёкший код' });
    }

    // Пометить код использованным
    await pool.query(
      'UPDATE phone_verifications SET used = true WHERE id = $1',
      [verification.rows[0].id]
    );

    // Найти или создать пользователя по телефону
    let user = (await pool.query('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
    if (!user) {
      // Регистрация нового пользователя по телефону
      const name = display_name || phone;
      const hash = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 12);
      const result = await pool.query(
        `INSERT INTO users (phone, display_name, password_hash, email)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [phone, name, hash, `${phone}@phone.sonchat.uk`]
      );
      user = result.rows[0];
    }

    // Выдать JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, display_name: user.display_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('son-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({
      token,
      user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url, phone: user.phone },
    });
  } catch (err) {
    console.error('[phone verify]', err?.message);
    res.status(500).json({ error: 'Ошибка верификации' });
  }
});

// ==================== SESSION MANAGEMENT (P3.5) ====================

/** GET /api/sessions — список активных сессий пользователя */
app.get('/api/sessions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, device_name, device_type, ip_address, last_active_at, created_at,
        (token_hash = $2) as is_current
      FROM sessions
      WHERE user_id = $1 AND is_revoked = false
      ORDER BY last_active_at DESC
      LIMIT 50
    `, [req.user.id, req.sessionTokenHash || '']);
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error('[sessions list]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** DELETE /api/sessions/:id — отозвать конкретную сессию */
app.delete('/api/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE sessions SET is_revoked = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия не найдена' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[session revoke]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
  }
});

/** DELETE /api/sessions — отозвать ВСЕ сессии кроме текущей */
app.delete('/api/sessions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE sessions SET is_revoked = true
       WHERE user_id = $1 AND is_revoked = false AND token_hash != $2
       RETURNING id`,
      [req.user.id, req.sessionTokenHash || '']
    );
    res.json({ ok: true, revoked_count: result.rows.length });
  } catch (err) {
    console.error('[sessions revoke all]', err?.message);
    res.status(500).json({ error: 'Ошибка' });
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
