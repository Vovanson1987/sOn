import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetMessages,
  mockSendMessage,
  mockDeleteMessage,
  authState,
  chatState,
  secretStoreState,
} = vi.hoisted(() => ({
  mockGetMessages: vi.fn(),
  mockSendMessage: vi.fn(),
  mockDeleteMessage: vi.fn(),
  authState: {
    user: {
      id: 'user-me',
      display_name: 'Я',
    },
  },
  chatState: {
    chats: [
      { id: 'chat-vladimir', type: 'direct' as const },
      { id: 'chat-secret', type: 'secret' as const },
    ],
  },
  secretStoreState: {
    getSession: vi.fn(),
    encryptForSend: vi.fn(),
    decryptReceived: vi.fn(),
  },
}));

vi.mock('@/api/client', () => ({
  getMessages: mockGetMessages,
  sendMessage: mockSendMessage,
  deleteMessage: mockDeleteMessage,
}));

vi.mock('../authStore', () => {
  const useAuthStore = Object.assign(
    vi.fn((selector: (s: typeof authState) => unknown) => selector(authState)),
    { getState: () => authState },
  );
  return { useAuthStore };
});

vi.mock('../chatStore', () => {
  const useChatStore = Object.assign(
    vi.fn((selector: (s: typeof chatState) => unknown) => selector(chatState)),
    { getState: () => chatState },
  );
  return { useChatStore };
});

vi.mock('../secretChatStore', () => {
  const useSecretChatStore = Object.assign(vi.fn(), {
    getState: () => secretStoreState,
  });
  return { useSecretChatStore };
});

import { useMessageStore } from '../messageStore';

describe('messageStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useMessageStore.setState({
      messages: {
        'chat-vladimir': [{
          id: 'msg-seed-1',
          chatId: 'chat-vladimir',
          senderId: 'user-vladimir',
          senderName: 'Vladimir',
          content: 'Тестовое сообщение',
          type: 'text',
          status: 'read',
          reactions: {},
          isDestroyed: false,
          createdAt: '2026-03-18T10:00:00Z',
        }],
        'chat-secret': [],
      },
      typingUsers: {},
      loadedChats: {},
      fetchError: null,
    });

    secretStoreState.getSession.mockReturnValue(null);
    secretStoreState.encryptForSend.mockResolvedValue(null);
    secretStoreState.decryptReceived.mockResolvedValue(null);
    mockSendMessage.mockResolvedValue({ id: 'msg-server' });
    mockGetMessages.mockResolvedValue({ messages: [] });
    mockDeleteMessage.mockResolvedValue({ ok: true });
  });

  it('sendMessage для обычного чата отправляет plaintext', async () => {
    await useMessageStore.getState().sendMessage('chat-vladimir', 'Привет');

    expect(mockSendMessage).toHaveBeenCalledWith(
      'chat-vladimir',
      'Привет',
      'text',
      undefined,
      undefined,
    );

    const msgs = useMessageStore.getState().getMessages('chat-vladimir');
    const last = msgs[msgs.length - 1];
    expect(last.content).toBe('Привет');
    expect(last.status).toBe('sent');
  });

  it('sendMessage для секретного чата шифрует до отправки', async () => {
    secretStoreState.getSession.mockReturnValue({ selfDestructTimer: 30 });
    secretStoreState.encryptForSend.mockResolvedValue({
      encrypted: {
        ciphertext: 'CIPHERTEXT',
        nonce: 'NONCE',
        algorithm: 'XSalsa20-Poly1305',
      },
      header: {
        dhPublicKey: new Uint8Array([1, 2, 3]),
        previousCount: 2,
        messageNumber: 7,
      },
    });

    await useMessageStore.getState().sendMessage('chat-secret', 'Секретный текст');

    expect(mockSendMessage).toHaveBeenCalledWith(
      'chat-secret',
      'CIPHERTEXT',
      'text',
      30,
      {
        nonce: 'NONCE',
        algorithm: 'XSalsa20-Poly1305',
        header: {
          dh_public_key: 'AQID',
          previous_count: 2,
          message_number: 7,
        },
      },
    );

    const msgs = useMessageStore.getState().getMessages('chat-secret');
    const last = msgs[msgs.length - 1];
    expect(last.content).toBe('Секретный текст');
    expect(last.status).toBe('sent');
  });

  it('sendMessage для секретного чата помечает failed без активной сессии', async () => {
    await useMessageStore.getState().sendMessage('chat-secret', 'Не отправится');

    expect(mockSendMessage).not.toHaveBeenCalled();
    const msgs = useMessageStore.getState().getMessages('chat-secret');
    expect(msgs[msgs.length - 1].status).toBe('failed');
  });

  it('fetchMessages расшифровывает входящее секретное сообщение', async () => {
    mockGetMessages.mockResolvedValue({
      messages: [{
        id: 'msg-incoming',
        chat_id: 'chat-secret',
        sender_id: 'user-other',
        sender_name: 'Алексей',
        content: 'CIPH',
        type: 'text',
        status: 'delivered',
        created_at: '2026-03-21T12:00:00Z',
        e2ee_nonce: 'NONCE',
        e2ee_algorithm: 'XSalsa20-Poly1305',
        e2ee_header: {
          dh_public_key: 'AQID',
          previous_count: 0,
          message_number: 0,
        },
      }],
    });
    secretStoreState.decryptReceived.mockResolvedValue('Расшифровано');

    await useMessageStore.getState().fetchMessages('chat-secret');

    const msgs = useMessageStore.getState().getMessages('chat-secret');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('Расшифровано');
    expect(secretStoreState.decryptReceived).toHaveBeenCalledTimes(1);
  });

  it('addServerMessage добавляет расшифрованное сообщение', async () => {
    secretStoreState.decryptReceived.mockResolvedValue('Текст после дешифровки');

    await useMessageStore.getState().addServerMessage({
      id: 'msg-live-1',
      chat_id: 'chat-secret',
      sender_id: 'user-other',
      sender_name: 'Алексей',
      content: 'CIPH',
      type: 'text',
      created_at: '2026-03-21T12:01:00Z',
      e2ee_nonce: 'NONCE',
      e2ee_algorithm: 'XSalsa20-Poly1305',
      e2ee_header: {
        dh_public_key: 'AQID',
        previous_count: 0,
        message_number: 1,
      },
    });

    const msgs = useMessageStore.getState().getMessages('chat-secret');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('Текст после дешифровки');
  });
});
