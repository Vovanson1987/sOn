/**
 * Утилиты для загрузки файлов, сжатия изображений и записи голосовых.
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

/** Максимальный размер файла: 25 МБ (совпадает с nginx client_max_body_size) */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Загрузить файл на сервер через multipart/form-data */
export async function uploadFile(file: File, folder = 'attachments', messageId?: string): Promise<UploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Файл слишком большой (макс. ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} МБ)`);
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  if (messageId) formData.append('message_id', messageId);

  // C8: используем credentials:'include' для cookie-auth.
  // Bearer header добавляется как fallback если memoryToken доступен.
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/media/upload`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });

  if (res.status === 401) {
    throw new Error('Сессия истекла. Войдите заново.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка загрузки файла' }));
    throw new Error(err.error || 'Ошибка загрузки файла');
  }
  return res.json();
}

/** Сжать изображение перед отправкой (макс 1920px, качество 0.8) */
export async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Битой файл — вернуть оригинал
    };

    img.onload = () => {
      URL.revokeObjectURL(objectUrl); // Освободить память

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      // Вычислить размеры
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
          // Если сжатый файл больше оригинала — вернуть оригинал
          resolve(compressed.size < file.size ? compressed : file);
        },
        'image/jpeg',
        quality,
      );
    };

    img.src = objectUrl;
  });
}

/** Загрузить изображение (со сжатием) */
export async function uploadImage(file: File, messageId?: string): Promise<UploadResult> {
  const compressed = await compressImage(file);
  return uploadFile(compressed, 'images', messageId);
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
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
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
          const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
          // Остановить микрофон
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

/** Загрузить голосовое сообщение */
export async function uploadVoice(blob: Blob, messageId?: string): Promise<UploadResult> {
  const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
  return uploadFile(file, 'voice', messageId);
}
