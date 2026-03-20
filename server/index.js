/** sOn Messenger — Node.js API сервер + WebSocket */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { WebSocketServer } = require('ws');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const multer = require('multer');
const { pool, initDB } = require('./db');
const { ensureBucket, uploadFile, getDownloadUrl, getUploadUrl } = require('./storage');
require('dotenv').config();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

// ==================== Безопасность ====================

// Заголовки безопасности (CSP, HSTS, X-Frame-Options и т.д.)
app.use(helmet({
  contentSecurityPolicy: false, // CSP управляется через nginx
}));

// CORS — только разрешённые домены
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:8080', 'http://localhost'];
app.use(cors({
  origin: (origin, callback) => {
    // Разрешить запросы без origin (мобильные приложения, curl, серверные запросы)
    if (!origin) return callback(null, true);
    // Разрешить ngrok-домены
    if (origin.endsWith('.ngrok-free.dev') || origin.endsWith('.ngrok.io')) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Заблокировано CORS'));
  },
  credentials: true,
}));

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
app.use(express.json());

// ==================== Middleware ====================

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
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
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, display_name',
      [email, display_name, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, display_name: user.display_name }, JWT_SECRET, { expiresIn: '7d' });
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
    res.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/** GET /api/users/me */
app.get('/api/users/me', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT id, email, display_name, avatar_url, is_online FROM users WHERE id = $1', [req.user.id]);
  res.json(result.rows[0]);
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
  const result = await pool.query(
    'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
    [chatId, userId]
  );
  if (result.rows.length === 0) {
    return res.status(403).json({ error: 'Нет доступа к этому чату' });
  }
  next();
}

// ==================== CHATS ====================

/** GET /api/chats — список чатов пользователя */
app.get('/api/chats', authMiddleware, async (req, res) => {
  const result = await pool.query(`
    SELECT c.*, cm.unread_count,
      (SELECT json_agg(json_build_object('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'is_online', u.is_online))
       FROM chat_members cm2 JOIN users u ON u.id = cm2.user_id WHERE cm2.chat_id = c.id) as members,
      (SELECT json_build_object('content', m.content, 'created_at', m.created_at, 'sender_id', m.sender_id)
       FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
    FROM chats c
    JOIN chat_members cm ON cm.chat_id = c.id
    WHERE cm.user_id = $1
    ORDER BY c.created_at DESC
  `, [req.user.id]);
  res.json({ chats: result.rows });
});

/** POST /api/chats — создать чат */
app.post('/api/chats', authMiddleware, async (req, res) => {
  const { type = 'direct', name, member_ids = [] } = req.body;
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

/** GET /api/chats/:chatId/messages */
app.get('/api/chats/:chatId/messages', authMiddleware, chatMemberCheck, async (req, res) => {
  const result = await pool.query(
    `SELECT m.*, u.display_name as sender_name FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = $1 ORDER BY m.created_at ASC LIMIT 100`,
    [req.params.chatId]
  );
  res.json({ messages: result.rows });
});

/** POST /api/chats/:chatId/messages */
app.post('/api/chats/:chatId/messages', authMiddleware, chatMemberCheck, async (req, res) => {
  const { content, type = 'text' } = req.body;
  const result = await pool.query(
    'INSERT INTO messages (chat_id, sender_id, content, type) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.params.chatId, req.user.id, content, type]
  );
  const msg = result.rows[0];
  msg.sender_name = req.user.display_name;

  // Отправить через WebSocket всем участникам чата
  broadcastToChat(req.params.chatId, { type: 'new_message', message: msg });
  res.status(201).json(msg);
});

// ==================== WEBSOCKET ====================

const wss = new WebSocketServer({ server, path: '/ws' });

/** Хранение подключений: userId → Set<ws> */
const connections = new Map();

wss.on('connection', (ws, req) => {
  // Поддержка двух способов аутентификации:
  // 1. Через первое сообщение (безопасный способ — рекомендуемый)
  // 2. Через query-параметр (обратная совместимость)
  const url = new URL(req.url, `http://${req.headers.host}`);
  const urlToken = url.searchParams.get('token');

  let user = null;
  let authenticated = false;

  // Попытка auth через query (обратная совместимость)
  if (urlToken) {
    try {
      user = jwt.verify(urlToken, JWT_SECRET);
      authenticated = true;
      registerConnection(ws, user);
    } catch {
      // Токен невалиден — ждём auth через первое сообщение
    }
  }

  // Таймаут аутентификации: 10 секунд на отправку auth-сообщения
  const authTimeout = !authenticated ? setTimeout(() => {
    if (!authenticated) {
      ws.close(4001, 'Таймаут аутентификации');
    }
  }, 10000) : null;

  ws.on('message', (data) => {
    try {
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

      handleWsMessage(user, ws, msg);
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

/** Обработка WebSocket сообщений */
function handleWsMessage(user, ws, msg) {
  switch (msg.type) {
    case 'typing':
      broadcastToChat(msg.chat_id, { type: 'typing', user_id: user.id, display_name: user.display_name }, user.id);
      break;
    case 'stop_typing':
      broadcastToChat(msg.chat_id, { type: 'stop_typing', user_id: user.id }, user.id);
      break;
    case 'read':
      broadcastToChat(msg.chat_id, { type: 'read', message_id: msg.message_id, user_id: user.id }, user.id);
      break;

    // ==================== WebRTC Signaling ====================

    case 'call_offer':
      // Переслать SDP offer целевому пользователю
      sendToUser(msg.target_user_id, {
        type: 'call_offer',
        caller_id: user.id,
        caller_name: user.display_name,
        chat_id: msg.chat_id,
        sdp: msg.sdp,
        is_video: msg.is_video || false,
      });
      break;

    case 'call_answer':
      // Переслать SDP answer вызывающему
      sendToUser(msg.target_user_id, {
        type: 'call_answer',
        answerer_id: user.id,
        chat_id: msg.chat_id,
        sdp: msg.sdp,
      });
      break;

    case 'ice_candidate':
      // Переслать ICE candidate другой стороне
      sendToUser(msg.target_user_id, {
        type: 'ice_candidate',
        from_user_id: user.id,
        chat_id: msg.chat_id,
        candidate: msg.candidate,
      });
      break;

    case 'call_end':
      // Уведомить собеседника о завершении звонка
      sendToUser(msg.target_user_id, {
        type: 'call_end',
        from_user_id: user.id,
        chat_id: msg.chat_id,
        reason: msg.reason || 'ended',
      });
      break;

    case 'call_reject':
      // Уведомить о отклонении звонка
      sendToUser(msg.target_user_id, {
        type: 'call_reject',
        from_user_id: user.id,
        chat_id: msg.chat_id,
      });
      break;
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

/** Отправить сообщение всем участникам чата */
async function broadcastToChat(chatId, data, excludeUserId = null) {
  const members = await pool.query('SELECT user_id FROM chat_members WHERE chat_id = $1', [chatId]);
  const payload = JSON.stringify(data);
  for (const row of members.rows) {
    if (row.user_id === excludeUserId) continue;
    const userConns = connections.get(row.user_id);
    if (userConns) {
      for (const ws of userConns) {
        if (ws.readyState === 1) ws.send(payload);
      }
    }
  }
}

// ==================== ФАЙЛЫ ====================

/** POST /api/media/upload — загрузка файла */
app.post('/api/media/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не прикреплён' });

    const folder = req.body.folder || 'attachments';
    const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, folder);

    // Сохранить запись в БД
    await pool.query(
      `INSERT INTO attachments (id, message_id, uploader_id, file_name, file_size, mime_type, url, object_name)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
      [req.body.message_id || null, req.user.id, req.file.originalname, result.size, result.mimeType, result.url, result.objectName]
    );

    res.status(201).json(result);
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

/** POST /api/media/download — pre-signed URL для скачивания */
app.post('/api/media/download', authMiddleware, async (req, res) => {
  try {
    const objectName = req.body.object_name;
    const url = await getDownloadUrl(objectName);
    res.json({ url });
  } catch (err) {
    console.error('Ошибка получения URL:', err);
    res.status(404).json({ error: 'Файл не найден' });
  }
});

/** POST /api/media/upload-url — получить pre-signed URL для прямой загрузки */
app.post('/api/media/upload-url', authMiddleware, async (req, res) => {
  try {
    const { fileName, folder = 'attachments' } = req.body;
    const ext = fileName?.split('.').pop() || 'bin';
    const objectName = `${folder}/${require('uuid').v4()}.${ext}`;
    const url = await getUploadUrl(objectName);
    res.json({ url, objectName });
  } catch (err) {
    console.error('Ошибка pre-signed URL:', err);
    res.status(500).json({ error: 'Ошибка генерации URL' });
  }
});

// ==================== HEALTH ====================

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'son-api', uptime: process.uptime() }));

// ==================== START ====================

async function start() {
  await initDB();
  await ensureBucket().catch((err) => console.warn('⚠️ MinIO недоступен:', err.message));
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 sOn API сервер запущен на http://localhost:${PORT}`);
    console.log(`🔌 WebSocket на ws://localhost:${PORT}/ws`);
  });
}

start();
