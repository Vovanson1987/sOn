/** Интеграционные тесты API sOn Messenger */

// Устанавливаем переменные окружения до загрузки модулей
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Моки базы данных и хранилища
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock('../db', () => ({
  pool: {
    query: (...args) => mockQuery(...args),
    connect: () => {
      mockConnect();
      return Promise.resolve(mockClient);
    },
    end: () => Promise.resolve(),
  },
  initDB: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../storage', () => ({
  ensureBucket: jest.fn().mockResolvedValue(undefined),
  uploadFile: jest.fn().mockResolvedValue({
    objectName: 'attachments/test.jpg',
    url: 'http://localhost:9000/son-files/attachments/test.jpg',
    size: 1024,
    mimeType: 'image/jpeg',
  }),
  getDownloadUrl: jest.fn().mockResolvedValue('http://localhost:9000/presigned-url'),
  getUploadUrl: jest.fn().mockResolvedValue('http://localhost:9000/presigned-upload-url'),
}));

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}));

const { app } = require('../index');

const JWT_SECRET = process.env.JWT_SECRET;

/** Вспомогательная функция: создать JWT токен */
function makeToken(user = { id: 'user-1', email: 'test@test.com', display_name: 'Тест' }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.query.mockReset();
  mockClient.release.mockReset();
});

// ==================== Health ====================

describe('GET /health', () => {
  it('возвращает ok когда PostgreSQL доступен', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.postgres).toBe('ok');
  });

  it('возвращает degraded когда PostgreSQL недоступен', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.postgres).toBe('error');
  });
});

// ==================== AUTH ====================

describe('POST /api/auth/register', () => {
  it('регистрирует нового пользователя', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'new@test.com', display_name: 'Новый' }],
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', display_name: 'Новый', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('new@test.com');
  });

  it('возвращает 400 при отсутствии полей', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('обязательны');
  });

  it('возвращает 409 при дублировании email', async () => {
    const err = new Error('unique violation');
    err.code = '23505';
    mockQuery.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', display_name: 'Dup', password: 'password123' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('успешный вход', async () => {
    const hash = await bcrypt.hash('password123', 10);
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user-1', email: 'test@test.com', display_name: 'Тест', password_hash: hash, avatar_url: null }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE is_online

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.id).toBe('user-1');
  });

  it('возвращает 401 при неверном пароле', async () => {
    const hash = await bcrypt.hash('correct', 10);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'test@test.com', password_hash: hash }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('возвращает 401 при несуществующем email', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no@test.com', password: 'pass' });

    expect(res.status).toBe(401);
  });
});

// ==================== Аутентификация ====================

describe('Middleware авторизации', () => {
  it('возвращает 401 без токена', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('возвращает 401 с невалидным токеном', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });

  it('пропускает с валидным токеном', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'test@test.com', display_name: 'Тест', avatar_url: null, is_online: true }],
    });

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('user-1');
  });
});

// ==================== USERS ====================

describe('GET /api/users/search', () => {
  it('ищет пользователей по запросу', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'user-2', display_name: 'Владимир', email: 'vlad@test.com' }],
    });

    const res = await request(app)
      .get('/api/users/search?q=Влад')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].display_name).toBe('Владимир');
  });
});

// ==================== CHATS ====================

describe('GET /api/chats', () => {
  it('возвращает список чатов пользователя', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'chat-1', type: 'direct', name: null, members: [], last_message: null, unread_count: 0 },
      ],
    });

    const res = await request(app)
      .get('/api/chats')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.chats).toHaveLength(1);
  });
});

describe('POST /api/chats', () => {
  it('создаёт новый чат', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'chat-new', type: 'direct', name: null }] }) // INSERT chat
      .mockResolvedValueOnce({}) // INSERT creator member
      .mockResolvedValueOnce({}) // INSERT member
      .mockResolvedValueOnce({}); // COMMIT

    const res = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ type: 'direct', member_ids: ['user-2'] });

    expect(res.status).toBe(201);
    expect(res.body.chat.id).toBe('chat-new');
  });
});

// ==================== MESSAGES ====================

describe('GET /api/chats/:chatId/messages', () => {
  it('возвращает сообщения чата', async () => {
    // chatMemberCheck
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    // messages query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'msg-1', content: 'Привет', sender_id: 'user-1', sender_name: 'Тест', created_at: new Date().toISOString() },
      ],
    });
    // reactions query
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/chats/chat-1/messages')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].content).toBe('Привет');
  });

  it('возвращает 403 при отсутствии членства', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // chatMemberCheck fails

    const res = await request(app)
      .get('/api/chats/chat-2/messages')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/chats/:chatId/messages', () => {
  it('отправляет сообщение', async () => {
    // chatMemberCheck
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    // Тип чата
    mockQuery.mockResolvedValueOnce({ rows: [{ type: 'direct' }] });
    // Проверка блокировки (direct чат)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const now = new Date().toISOString();
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'msg-new', content: 'Тест', sender_id: 'user-1', created_at: now }] })
      .mockResolvedValueOnce({}) // UPDATE chats
      .mockResolvedValueOnce({}) // UPDATE unread
      .mockResolvedValueOnce({}); // COMMIT

    // broadcastToChat — SELECT chat_members
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-2' }] });
    // sendPushToOfflineMembers — SELECT chat_members
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/chats/chat-1/messages')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ content: 'Тест' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Тест');
  });

  it('возвращает 400 для секретного чата без e2ee payload', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // chatMemberCheck
    mockQuery.mockResolvedValueOnce({ rows: [{ type: 'secret' }] }); // тип чата

    const res = await request(app)
      .post('/api/chats/chat-secret/messages')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ content: 'plaintext' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('E2EE');
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('для секретного чата сохраняет только ciphertext и e2ee-метаданные', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // chatMemberCheck
    mockQuery.mockResolvedValueOnce({ rows: [{ type: 'secret' }] }); // тип чата

    const now = new Date().toISOString();
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          id: 'msg-secret-1',
          content: 'CIPHERTEXT',
          sender_id: 'user-1',
          created_at: now,
          e2ee_nonce: 'NONCE',
          e2ee_header: {
            dh_public_key: 'AQID',
            previous_count: 1,
            message_number: 2,
          },
          e2ee_algorithm: 'XSalsa20-Poly1305',
        }],
      })
      .mockResolvedValueOnce({}) // UPDATE chats
      .mockResolvedValueOnce({}) // UPDATE unread
      .mockResolvedValueOnce({}); // COMMIT

    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-2' }] }); // broadcastToChat

    const res = await request(app)
      .post('/api/chats/chat-secret/messages')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        content: 'CIPHERTEXT',
        e2ee: {
          nonce: 'NONCE',
          algorithm: 'XSalsa20-Poly1305',
          header: {
            dh_public_key: 'AQID',
            previous_count: 1,
            message_number: 2,
          },
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('CIPHERTEXT');
    expect(res.body.e2ee_nonce).toBe('NONCE');
    expect(res.body.e2ee_algorithm).toBe('XSalsa20-Poly1305');

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      expect.arrayContaining([
        'chat-secret',
        'user-1',
        'CIPHERTEXT',
        'text',
        null,
      ]),
    );
  });
});

describe('POST /api/chats/:chatId/read', () => {
  it('сбрасывает счётчик непрочитанных', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // chatMemberCheck
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const res = await request(app)
      .post('/api/chats/chat-1/read')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('DELETE /api/chats/:chatId/messages/:id', () => {
  it('удаляет собственное сообщение', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // chatMemberCheck
      .mockResolvedValueOnce({ rows: [{ id: 'msg-1' }] }) // DELETE
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-2' }] }); // broadcastToChat

    const res = await request(app)
      .delete('/api/chats/chat-1/messages/msg-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(204);
  });

  it('возвращает 403 при удалении чужого сообщения', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // chatMemberCheck
      .mockResolvedValueOnce({ rows: [] }); // DELETE — не нашлось

    const res = await request(app)
      .delete('/api/chats/chat-1/messages/msg-2')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(403);
  });
});

// ==================== E2EE KEYS ====================

describe('PUT /api/keys/bundle', () => {
  it('загружает prekey bundle', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // INSERT prekeys
      .mockResolvedValueOnce({}); // COMMIT

    const res = await request(app)
      .put('/api/keys/bundle')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        identity_key: 'aWRlbnRpdHk=',
        signing_key: 'c2lnbmluZw==',
        signed_prekey: 'c3Br',
        signed_prekey_id: 1,
        signed_prekey_signature: 'c2ln',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('возвращает 400 без обязательных полей', async () => {
    const res = await request(app)
      .put('/api/keys/bundle')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ identity_key: 'test' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/keys/bundle/:userId', () => {
  it('возвращает prekey bundle собеседника', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          identity_key: 'ik', signing_key: 'sk', signed_prekey: 'spk',
          signed_prekey_id: 1, signed_prekey_signature: 'sig',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ key_id: 0, public_key: 'otpk-0' }] }); // OTPK

    const res = await request(app)
      .get('/api/keys/bundle/user-2')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.identity_key).toBe('ik');
    expect(res.body.one_time_prekey).toBe('otpk-0');
  });

  it('возвращает 404 если bundle не найден', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/keys/bundle/user-unknown')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/keys/count', () => {
  it('возвращает количество оставшихся OPK', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '15' }] });

    const res = await request(app)
      .get('/api/keys/count')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.remaining_one_time_prekeys).toBe(15);
  });
});

// ==================== MEDIA ====================

describe('POST /api/media/upload', () => {
  it('загружает файл', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT attachment

    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', `Bearer ${makeToken()}`)
      .attach('file', Buffer.from('test-content'), 'test.jpg');

    expect(res.status).toBe(201);
    expect(res.body.objectName).toContain('attachments/');
  });

  it('возвращает 400 без файла', async () => {
    const res = await request(app)
      .post('/api/media/upload')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /api/media/download', () => {
  it('возвращает pre-signed URL', async () => {
    const res = await request(app)
      .post('/api/media/download')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ object_name: 'attachments/test.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('presigned');
  });
});
