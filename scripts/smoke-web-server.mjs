#!/usr/bin/env node
/**
 * Smoke-check для контура webApp + server.
 * Проверяет:
 * 1) /health
 * 2) auth/register двух пользователей
 * 3) создание secret-чата
 * 4) запрет plaintext для secret-чата
 * 5) отправку ciphertext + e2ee payload
 * 6) получение ciphertext (без расшифровки на сервере)
 */

import { randomBytes } from 'node:crypto';

function parseArgs(argv) {
  const args = { baseUrl: process.env.SMOKE_BASE_URL || '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base-url' && argv[i + 1]) {
      args.baseUrl = argv[i + 1];
      i++;
    }
  }
  return args;
}

function normalizeBaseUrl(input) {
  if (!input) return '';
  return input.endsWith('/') ? input.slice(0, -1) : input;
}

async function requestJson(baseUrl, path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return { status: res.status, json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function ensureUser(baseUrl, { email, displayName, password }) {
  const login = await requestJson(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (login.status === 200 && login.json?.token && login.json?.user?.id) {
    return { token: login.json.token, id: login.json.user.id };
  }

  const register = await requestJson(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: {
      email,
      display_name: displayName,
      password,
    },
  });
  assert(register.status === 201, `register ${email} вернул ${register.status}`);
  assert(register.json?.token, `register ${email} не вернул token`);
  assert(register.json?.user?.id, `register ${email} не вернул user.id`);
  return { token: register.json.token, id: register.json.user.id };
}

async function run() {
  const { baseUrl: rawBaseUrl } = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  if (!baseUrl) {
    throw new Error('Не задан base URL. Используйте --base-url https://staging.example.com или SMOKE_BASE_URL.');
  }

  const ephemeral = process.env.SMOKE_EPHEMERAL === '1';
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const defaultPassword = process.env.SMOKE_PASSWORD || 'SmokePass!123456789';
  const email1 = process.env.SMOKE_USER1_EMAIL || (ephemeral ? `smoke-u1-${suffix}@example.com` : 'smoke-user1@son.local');
  const email2 = process.env.SMOKE_USER2_EMAIL || (ephemeral ? `smoke-u2-${suffix}@example.com` : 'smoke-user2@son.local');
  const display1 = process.env.SMOKE_USER1_NAME || 'Smoke User 1';
  const display2 = process.env.SMOKE_USER2_NAME || 'Smoke User 2';
  const smokeChatPrefix = 'SMOKE-SECRET';

  console.log(`[SMOKE] База: ${baseUrl}`);

  const health = await requestJson(baseUrl, '/health');
  assert(health.status === 200, `GET /health вернул ${health.status}`);
  assert(health.json?.status === 'ok' || health.json?.status === 'degraded', 'Некорректный ответ /health');
  console.log(`[SMOKE] /health OK (${health.json?.status})`);

  const user1 = await ensureUser(baseUrl, {
    email: email1,
    displayName: display1,
    password: defaultPassword,
  });
  console.log(`[SMOKE] user1 готов (${email1})`);

  const user2 = await ensureUser(baseUrl, {
    email: email2,
    displayName: display2,
    password: defaultPassword,
  });
  console.log(`[SMOKE] user2 готов (${email2})`);

  const user1Chats = await requestJson(baseUrl, '/api/chats', {
    method: 'GET',
    token: user1.token,
  });
  assert(user1Chats.status === 200, `GET /api/chats (user1) вернул ${user1Chats.status}`);
  const staleSmokeChats = (user1Chats.json?.chats || []).filter((c) => typeof c.name === 'string' && c.name.startsWith(smokeChatPrefix));
  for (const stale of staleSmokeChats) {
    if (!stale?.id) continue;
    await requestJson(baseUrl, `/api/chats/${stale.id}`, {
      method: 'DELETE',
      token: user1.token,
    });
  }
  if (staleSmokeChats.length > 0) {
    console.log(`[SMOKE] очищено старых smoke-чатов: ${staleSmokeChats.length}`);
  }

  const createSecret = await requestJson(baseUrl, '/api/chats', {
    method: 'POST',
    token: user1.token,
    body: {
      type: 'secret',
      member_ids: [user2.id],
      name: `${smokeChatPrefix}-${suffix}`,
    },
  });
  assert(createSecret.status === 201, `create secret chat вернул ${createSecret.status}`);
  assert(createSecret.json?.chat?.id, 'create secret chat не вернул chat.id');
  const chatId = createSecret.json.chat.id;
  console.log(`[SMOKE] secret chat создан (${chatId})`);

  const plaintextTry = await requestJson(baseUrl, `/api/chats/${chatId}/messages`, {
    method: 'POST',
    token: user1.token,
    body: {
      content: `plaintext-${suffix}`,
      type: 'text',
    },
  });
  assert(plaintextTry.status === 400, `plaintext в secret чате должен вернуть 400, получен ${plaintextTry.status}`);
  console.log('[SMOKE] plaintext для secret чата корректно отклонён');

  const ciphertext = `ciphertext-${suffix}`;
  const nonce = randomBytes(24).toString('base64');
  const sendSecret = await requestJson(baseUrl, `/api/chats/${chatId}/messages`, {
    method: 'POST',
    token: user1.token,
    body: {
      content: ciphertext,
      type: 'text',
      e2ee: {
        nonce,
        algorithm: 'XSalsa20-Poly1305',
        header: {
          dh_public_key: randomBytes(32).toString('base64'),
          previous_count: 0,
          message_number: 0,
        },
      },
    },
  });
  assert(sendSecret.status === 201, `ciphertext send вернул ${sendSecret.status}`);
  assert(sendSecret.json?.content === ciphertext, 'Сервер изменил ciphertext в ответе');
  assert(sendSecret.json?.e2ee_nonce === nonce, 'Сервер не сохранил e2ee_nonce');
  assert(sendSecret.json?.e2ee_algorithm === 'XSalsa20-Poly1305', 'Сервер не сохранил e2ee_algorithm');
  console.log('[SMOKE] ciphertext + e2ee payload успешно сохранены');

  const fetchByUser2 = await requestJson(baseUrl, `/api/chats/${chatId}/messages`, {
    method: 'GET',
    token: user2.token,
  });
  assert(fetchByUser2.status === 200, `fetch messages вернул ${fetchByUser2.status}`);
  const messages = Array.isArray(fetchByUser2.json?.messages) ? fetchByUser2.json.messages : [];
  const target = messages.find((m) => m.id === sendSecret.json.id);
  assert(!!target, 'Сообщение не найдено в истории');
  assert(target.content === ciphertext, 'В истории content не равен ciphertext');
  assert(target.e2ee_nonce === nonce, 'В истории отсутствует e2ee_nonce');
  assert(target.e2ee_algorithm === 'XSalsa20-Poly1305', 'В истории отсутствует e2ee_algorithm');
  assert(target.e2ee_header?.dh_public_key, 'В истории отсутствует e2ee_header');
  console.log('[SMOKE] user2 получает только ciphertext + e2ee metadata');

  const chatsUser2 = await requestJson(baseUrl, '/api/chats', {
    method: 'GET',
    token: user2.token,
  });
  assert(chatsUser2.status === 200, `GET /api/chats вернул ${chatsUser2.status}`);
  const secretChat = (chatsUser2.json?.chats || []).find((c) => c.id === chatId);
  assert(!!secretChat, 'secret чат не найден в списке user2');
  assert(secretChat.last_message?.content === '🔒 Зашифрованное сообщение', 'last_message раскрывает ciphertext');
  console.log('[SMOKE] last_message для secret-чата скрыт');

  const cleanup = await requestJson(baseUrl, `/api/chats/${chatId}`, {
    method: 'DELETE',
    token: user1.token,
  });
  assert(cleanup.status === 200, `cleanup delete chat вернул ${cleanup.status}`);
  console.log('[SMOKE] cleanup тестового чата выполнен');

  console.log('[SMOKE] УСПЕХ: webApp + server контур прошёл staging smoke');
}

run().catch((err) => {
  console.error(`[SMOKE] FAIL: ${err.message}`);
  process.exit(1);
});
