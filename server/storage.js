/** MinIO (S3-совместимое хранилище) — загрузка и скачивание файлов */
const Minio = require('minio');
const { v4: uuid } = require('uuid');

const BUCKET = 'son-files';

const minio = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

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
  const ext = originalName.split('.').pop() || 'bin';
  const objectName = `${folder}/${uuid()}.${ext}`;

  await minio.putObject(BUCKET, objectName, buffer, buffer.length, {
    'Content-Type': mimeType,
  });

  return {
    objectName,
    url: `http://localhost:9000/${BUCKET}/${objectName}`,
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

module.exports = { ensureBucket, uploadFile, getDownloadUrl, getUploadUrl, deleteFile, BUCKET };
