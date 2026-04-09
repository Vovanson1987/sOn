/**
 * Sentry integration для sOn API.
 *
 * Инициализируется ДО всех других require (нужно для корректного
 * инструментирования express/http), поэтому вызывается в самом
 * начале index.js через require('./sentry').init().
 *
 * Если SENTRY_DSN не задан — Sentry не инициализируется, init() —
 * no-op. Это позволяет запускать сервер в dev/test без Sentry-аккаунта.
 */
const Sentry = require('@sentry/node');

let initialized = false;

function init() {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // Sentry disabled — ок в dev/test

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Release можно прокидывать из CI через SENTRY_RELEASE (например
    // коммит sha или тег). Если нет — Sentry сам сгруппирует ошибки.
    release: process.env.SENTRY_RELEASE || undefined,

    // Sampling — в prod 10% транзакций, в dev 100%.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Автоматическая инструментация http/express.
    // Для v10 Sentry SDK нужно настраивать integrations через tracesSampleRate.
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],

    // Не слать body запросов — может содержать чувствительные данные.
    sendDefaultPii: false,

    // beforeSend — последний шанс отфильтровать или обогатить событие.
    beforeSend(event) {
      // Удаляем потенциально чувствительные заголовки если они пролезли.
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-auth-token'];
      }
      return event;
    },
  });
  initialized = true;
  // Логируем через pino вне этого модуля, чтобы не создать circular import.
  process.nextTick(() => {
    try {
      const { logger } = require('./logger');
      logger.info({ env: process.env.NODE_ENV }, 'Sentry инициализирован');
    } catch {
      // Silent — logger может быть не готов
    }
  });
}

/** Захватить ошибку вручную. Если Sentry не init — no-op. */
function captureException(err, context = {}) {
  if (!initialized) return;
  Sentry.captureException(err, { extra: context });
}

/** Захватить произвольное сообщение. */
function captureMessage(message, level = 'info') {
  if (!initialized) return;
  Sentry.captureMessage(message, level);
}

/** Подключить Express error handler (должен быть после всех роутов). */
function setupExpressErrorHandler(app) {
  if (!initialized) return;
  // В Sentry SDK v10 для Express используется setupExpressErrorHandler.
  if (typeof Sentry.setupExpressErrorHandler === 'function') {
    Sentry.setupExpressErrorHandler(app);
  }
}

/**
 * Закрыть клиент при shutdown.
 * Возвращает true если все events flushed, false при таймауте.
 */
async function close(timeout = 2000) {
  if (!initialized) return true;
  try {
    return await Sentry.close(timeout);
  } catch {
    return false;
  }
}

module.exports = {
  init,
  captureException,
  captureMessage,
  setupExpressErrorHandler,
  close,
  Sentry,
};
