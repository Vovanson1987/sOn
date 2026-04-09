import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile, uploadVoice } from '../fileUpload';

// Мок getToken
vi.mock('@/api/client', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

// Мок fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('отправляет файл через FormData', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        objectName: 'attachments/file.pdf',
        url: '/media/attachments/file.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      }),
    });

    const file = new File(['content'], 'file.pdf', { type: 'application/pdf' });
    const result = await uploadFile(file);

    expect(result.objectName).toBe('attachments/file.pdf');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/media/upload'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('передаёт folder и messageId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ objectName: 'x', url: '/x', size: 0, mimeType: 'text/plain' }),
    });

    const file = new File([''], 'test.txt', { type: 'text/plain' });
    await uploadFile(file, 'images', 'msg-1');

    const body = mockFetch.mock.calls[0][1].body as FormData;
    expect(body.get('folder')).toBe('images');
    expect(body.get('message_id')).toBe('msg-1');
  });

  it('бросает ошибку при неуспешном ответе', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Ошибка загрузки файла' }),
    });
    const file = new File([''], 'test.txt');
    await expect(uploadFile(file)).rejects.toThrow('Ошибка загрузки файла');
  });
});

describe('uploadVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('создаёт файл из Blob и загружает в folder "voice"', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ objectName: 'voice/v.webm', url: '/v', size: 512, mimeType: 'audio/webm' }),
    });

    const blob = new Blob(['audio data'], { type: 'audio/webm' });
    const result = await uploadVoice(blob);

    expect(result.objectName).toBe('voice/v.webm');

    const body = mockFetch.mock.calls[0][1].body as FormData;
    expect(body.get('folder')).toBe('voice');
    const uploadedFile = body.get('file') as File;
    expect(uploadedFile.name).toMatch(/^voice-\d+\.webm$/);
  });
});
