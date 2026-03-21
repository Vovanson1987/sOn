import type { Page } from '@playwright/test';

type ApiMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  type: string;
  status: string;
  created_at: string;
};

const authUser = {
  id: 'user-me',
  email: 'test@example.com',
  display_name: 'Тестовый пользователь',
};

const chats = [
  {
    id: 'chat-vladimir',
    type: 'direct',
    name: null,
    unread_count: 2,
    members: [
      { id: 'user-me', display_name: 'Тестовый пользователь', avatar_url: null, is_online: true },
      { id: 'user-vladimir', display_name: 'Vladimir', avatar_url: null, is_online: true },
    ],
    last_message: {
      content: 'Привет! Как дела?',
      created_at: '2026-03-20T11:00:00.000Z',
      sender_id: 'user-vladimir',
    },
    created_at: '2026-03-20T11:00:00.000Z',
  },
  {
    id: 'chat-secret',
    type: 'secret',
    name: 'Алексей',
    unread_count: 0,
    members: [
      { id: 'user-me', display_name: 'Тестовый пользователь', avatar_url: null, is_online: true },
      { id: 'user-alexey', display_name: 'Алексей', avatar_url: null, is_online: true },
    ],
    last_message: {
      content: '🔒 Зашифрованное сообщение',
      created_at: '2026-03-20T10:30:00.000Z',
      sender_id: 'user-alexey',
    },
    created_at: '2026-03-20T10:30:00.000Z',
  },
];

const messageStore: Record<string, ApiMessage[]> = {
  'chat-vladimir': [
    {
      id: 'msg-1',
      chat_id: 'chat-vladimir',
      sender_id: 'user-vladimir',
      sender_name: 'Vladimir',
      content: 'Привет! Как дела?',
      type: 'text',
      status: 'sent',
      created_at: '2026-03-20T11:00:00.000Z',
    },
  ],
  'chat-secret': [
    {
      id: 'msg-2',
      chat_id: 'chat-secret',
      sender_id: 'user-alexey',
      sender_name: 'Алексей',
      content: '🔒 Зашифрованное сообщение',
      type: 'text',
      status: 'sent',
      created_at: '2026-03-20T10:30:00.000Z',
    },
  ],
};

/** Подготовить e2e-окружение: моки API + вход через UI */
export async function setupAuthenticatedApiMocks(page: Page): Promise<void> {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'test-token',
        user: authUser,
      }),
    });
  });

  await page.route('**/api/chats/*/read', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/chats/*/messages', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const match = url.pathname.match(/\/api\/chats\/([^/]+)\/messages$/);
    const chatId = match?.[1] || '';

    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: messageStore[chatId] || [] }),
      });
      return;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as { content?: string; type?: string } | null;
      const created: ApiMessage = {
        id: `msg-${Date.now()}`,
        chat_id: chatId,
        sender_id: 'user-me',
        sender_name: 'Тестовый пользователь',
        content: payload?.content || '',
        type: payload?.type || 'text',
        status: 'sent',
        created_at: new Date().toISOString(),
      };
      messageStore[chatId] = [...(messageStore[chatId] || []), created];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    if (request.method() === 'DELETE') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'method_not_allowed' }),
    });
  });

  await page.route('**/api/chats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ chats }),
    });
  });

  await page.goto('/');
  await page.getByLabel('Email').fill(authUser.email);
  await page.getByLabel('Пароль').fill('password123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForSelector('nav[aria-label="Список чатов"]');
}
