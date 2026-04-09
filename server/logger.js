/**
 * Pino structured logger для sOn API.
 *
 * Основной экспорт — logger (можно импортировать напрямую и писать
 * logger.info({...}, 'сообщение')).
 * Для HTTP request-логирования используется pino-http middleware,
 * который автоматически привязывает req-id к каждому запросу и
 * вешает req.log на объект запроса.
 */
const pino = require('pino');
const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// В тестах полностью отключаем вывод, чтобы не загрязнять stdout.
const level = isTest ? 'silent' : (process.env.LOG_LEVEL || 'info');

// В production — JSON логи для агрегаторов (Sentry/Loki/etc).
// В dev — человекочитаемый вывод через pino-pretty (если установлен).
const transport = !isProd && !isTest && process.env.LOG_PRETTY !== 'false'
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

const logger = pino({
  level,
  transport,
  base: {
    service: 'son-api',
    env: process.env.NODE_ENV || 'development',
  },
  // Стандартные поля не пишем автоматически — пусть caller решает,
  // что логировать.
  redact: {
    // Не логируем чувствительные поля если они случайно попали в контекст.
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.token',
      '*.JWT_SECRET',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Express middleware для request-логирования.
 * Автоматически генерирует req.id (если нет X-Request-Id заголовка),
 * логирует входящие запросы и их ответы, вешает req.log на объект.
 */
const httpLogger = pinoHttp({
  logger,
  // Использовать заголовок X-Request-Id если есть, иначе сгенерировать.
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = typeof existing === 'string' && existing.length < 200
      ? existing
      : randomUUID();
    // Проксируем ID обратно клиенту для корреляции
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // Не логируем health checks — они засоряют логи.
  autoLogging: {
    ignore: (req) => req.url?.startsWith('/health'),
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

module.exports = { logger, httpLogger };
