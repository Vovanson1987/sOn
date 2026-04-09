/** MinIO (S3-совместимое хранилище) — загрузка и скачивание файлов */
const Minio = require('minio');
const { v4: uuid } = require('uuid');

const BUCKET = 'son-files';

// Публичный URL для объектов (используется при генерации публичных URL аватаров).
// В production должен указывать на внешний домен (через Cloudflare Tunnel / CDN),
// иначе клиенты получат битые ссылки на localhost:9000.
const PUBLIC_URL = (
  process.env.MINIO_PUBLIC_URL ||
  `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`
).replace(/\/+$/, '');

const minio = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

// Whitelist допустимых папок хранения. Любое другое значение отвергается,
// чтобы предотвратить path injection в MinIO.
const ALLOWED_FOLDERS = new Set([
  'attachments',
  'images',
  'voice',
  'audio',
  'video',
  'files',
  'avatars',
]);

// Whitelist допустимых MIME-типов для загрузки.
// Исполняемые форматы (.html, .js, .php и т. п.) отсутствуют намеренно.
const ALLOWED_MIME_TYPES = new Set([
  // Изображения
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  // Аудио / голосовые
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  // Видео
  'video/mp4',
  'video/webm',
  'video/quicktime',
  // Документы
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

function isAllowedFolder(folder) {
  return typeof folder === 'string' && ALLOWED_FOLDERS.has(folder);
}

function isAllowedMime(mimeType) {
  return typeof mimeType === 'string' && ALLOWED_MIME_TYPES.has(mimeType);
}

/**
 * Очистить и валидировать расширение файла.
 * Возвращает безопасное расширение (a-z0-9, до 10 символов) или 'bin'.
 */
function sanitizeExt(fileName) {
  if (!fileName || typeof fileName !== 'string') return 'bin';
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1 || lastDot === fileName.length - 1) return 'bin';
  const rawExt = fileName.slice(lastDot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,10}$/.test(rawExt)) return 'bin';
  return rawExt;
}

/** Создать бакет если не существует */
async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET);
  if (!exists) {
    await minio.makeBucket(BUCKET);
    // Политика: публичное чтение для аватаров
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/avatars/*`],
      }],
    });
    await minio.setBucketPolicy(BUCKET, policy);
    console.log(`✅ Бакет '${BUCKET}' создан`);
  }
}

/** Загрузить файл и вернуть URL */
async function uploadFile(buffer, originalName, mimeType, folder = 'attachments') {
  // Нормализация folder: невалидное значение → attachments
  const safeFolder = isAllowedFolder(folder) ? folder : 'attachments';
  const ext = sanitizeExt(originalName);
  const objectName = `${safeFolder}/${uuid()}.${ext}`;

  await minio.putObject(BUCKET, objectName, buffer, buffer.length, {
    'Content-Type': mimeType,
  });

  return {
    objectName,
    url: `${PUBLIC_URL}/${BUCKET}/${objectName}`,
    size: buffer.length,
    mimeType,
  };
}

/** Получить pre-signed URL для скачивания (15 минут) */
async function getDownloadUrl(objectName) {
  return minio.presignedGetObject(BUCKET, objectName, 15 * 60);
}

/** Получить pre-signed URL для загрузки (15 минут) */
async function getUploadUrl(objectName) {
  return minio.presignedPutObject(BUCKET, objectName, 15 * 60);
}

/** Удалить файл */
async function deleteFile(objectName) {
  await minio.removeObject(BUCKET, objectName);
}

module.exports = {
  ensureBucket,
  uploadFile,
  getDownloadUrl,
  getUploadUrl,
  deleteFile,
  isAllowedFolder,
  isAllowedMime,
  sanitizeExt,
  ALLOWED_FOLDERS,
  ALLOWED_MIME_TYPES,
  BUCKET,
  PUBLIC_URL,
};
