/**
 * Утилиты для загрузки файлов, сжатия изображений и записи голосовых.
 * Расширено паттернами из MAX: chunk upload, retry с backoff.
 */

import { getToken } from '@/api/client';
import { API_URL } from '@/api/config';

/** Результат загрузки файла */
export interface UploadResult {
  objectName: string;
  url: string;
  size: number;
  mimeType: string;
}

/** Прогресс загрузки */
export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/** Максимальный размер файла: 25 МБ (совпадает с nginx client_max_body_size) */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Порог для chunk-загрузки: файлы > 5 МБ загружаются чанками */
const CHUNK_THRESHOLD = 5 * 1024 * 1024;

/** Размер одного чанка: 2 МБ */
const CHUNK_SIZE = 2 * 1024 * 1024;

/** Макс. количество retry при ошибках */
const MAX_RETRIES = 3;

/** Таймаут загрузки одного чанка: 20 секунд */
const UPLOAD_TIMEOUT = 20_000;

// ==================== Retry с exponential backoff (паттерн из MAX) ====================

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Не retry для клиентских ошибок (4xx кроме 429)
      if (lastError.message.includes('401') || lastError.message.includes('403')) {
        throw lastError;
      }
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt); // 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError!;
}

// ==================== Авторизованный fetch ====================

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function checkResponse(res: Response): Promise<void> {
  if (res.status === 401) {
    throw new Error('401: Сессия истекла. Войдите заново.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Ошибка загрузки (${res.status})` }));
    throw new Error(err.error || `Ошибка загрузки (${res.status})`);
  }
}

// ==================== Обычная загрузка (multipart) ====================

async function uploadMultipart(
  file: File,
  folder: string,
  messageId?: string,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  if (messageId) formData.append('message_id', messageId);

  const res = await fetch(`${API_URL}/api/media/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
    body: formData,
  });

  await checkResponse(res);
  return res.json();
}

// ==================== Content-Range chunk upload (паттерн из MAX) ====================

async function uploadChunked(
  file: File,
  folder: string,
  messageId?: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  // Шаг 1: Инициировать загрузку — получить upload ID
  const initRes = await fetch(`${API_URL}/api/media/upload/init`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      folder,
      messageId,
    }),
  });

  await checkResponse(initRes);
  const { uploadId, uploadUrl } = await initRes.json();

  // Шаг 2: Загрузить чанками с Content-Range
  const totalSize = file.size;
  let offset = 0;

  while (offset < totalSize) {
    const end = Math.min(offset + CHUNK_SIZE, totalSize);
    const chunk = file.slice(offset, end);

    await withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

      try {
        const res = await fetch(uploadUrl || `${API_URL}/api/media/upload/chunk`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...authHeaders(),
            'Content-Range': `bytes ${offset}-${end - 1}/${totalSize}`,
            'Content-Type': 'application/octet-stream',
            'X-Upload-Id': uploadId,
            'X-File-Name': encodeURIComponent(file.name),
          },
          body: chunk,
          signal: controller.signal,
        });
        await checkResponse(res);
      } finally {
        clearTimeout(timeout);
      }
    });

    offset = end;
    onProgress?.({
      loaded: offset,
      total: totalSize,
      percent: Math.round((offset / totalSize) * 100),
    });
  }

  // Шаг 3: Финализировать загрузку
  const finalRes = await fetch(`${API_URL}/api/media/upload/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId }),
  });

  await checkResponse(finalRes);
  return finalRes.json();
}

// ==================== Публичное API ====================

/** Загрузить файл на сервер (авто-выбор: multipart или chunks) */
export async function uploadFile(
  file: File,
  folder = 'attachments',
  messageId?: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Файл слишком большой (макс. ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} МБ)`);
  }

  // Файлы > 5 МБ загружаются чанками (если endpoint доступен)
  if (file.size > CHUNK_THRESHOLD) {
    try {
      return await uploadChunked(file, folder, messageId, onProgress);
    } catch (err) {
      // Fallback на multipart если chunk endpoint не реализован
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('404') || msg.includes('not found')) {
        return withRetry(() => uploadMultipart(file, folder, messageId));
      }
      throw err;
    }
  }

  return withRetry(() => uploadMultipart(file, folder, messageId));
}

/** Сжать изображение перед отправкой (макс 1920px, качество 0.8) */
export async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name, { type: 'image/jpeg' });
          resolve(compressed.size < file.size ? compressed : file);
        },
        'image/jpeg',
        quality,
      );
    };

    img.src = objectUrl;
  });
}

/** Загрузить изображение (со сжатием + retry) */
export async function uploadImage(
  file: File,
  messageId?: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  const compressed = await compressImage(file);
  return uploadFile(compressed, 'images', messageId, onProgress);
}

/** Состояние записи голосового сообщения */
export interface VoiceRecorderState {
  isRecording: boolean;
  duration: number;
  blob: Blob | null;
}

/** Создать запись голосового сообщения через MediaRecorder API */
export function createVoiceRecorder(): {
  start: () => void;
  stop: () => Promise<Blob>;
  cancel: () => void;
} {
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  return {
    start: async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // H10: Safari не поддерживает audio/webm — fallback на mp4 или дефолт
      const preferredMime = 'audio/webm;codecs=opus';
      const mimeType = typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(preferredMime)
        ? preferredMime
        : typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : undefined;
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.start();
    },

    stop: () => {
      return new Promise<Blob>((resolve) => {
        if (!mediaRecorder) { resolve(new Blob()); return; }

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mediaRecorder!.mimeType || 'audio/webm' });
          mediaRecorder!.stream.getTracks().forEach((t) => t.stop());
          resolve(blob);
        };

        mediaRecorder.stop();
      });
    },

    cancel: () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      }
      chunks = [];
    },
  };
}

/** Загрузить голосовое сообщение (с retry) */
export async function uploadVoice(blob: Blob, messageId?: string): Promise<UploadResult> {
  const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
  return uploadFile(file, 'voice', messageId);
}
