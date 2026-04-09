/**
 * Sentry integration для webApp.
 *
 * Инициализируется в main.tsx как можно раньше.
 * Если VITE_SENTRY_DSN не задан — Sentry не подключается (no-op).
 * Это позволяет запускать dev без Sentry-аккаунта.
 */
import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // Sentry disabled — ок в dev

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,

    // Sampling для Performance — в prod 10%, в dev 100%
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Session Replay: 0% нормальных сессий, 100% сессий с ошибкой.
    // Это даёт экономию квоты при максимальной отладочной ценности.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],

    // Не отправлять PII по умолчанию.
    sendDefaultPii: false,

    beforeSend(event) {
      // Вырезаем Authorization header и cookie если они попали в breadcrumbs.
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, string>).authorization;
        delete (event.request.headers as Record<string, string>).cookie;
      }
      // Фильтруем breadcrumbs от fetch-ов, которые содержат son-token или секреты.
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          if (b.data && 'url' in b.data && typeof b.data.url === 'string') {
            // Не логируем URL /api/auth/* — там могут быть токены в query
            if (b.data.url.includes('/api/auth/')) {
              b.data = { ...b.data, url: '[REDACTED]' };
            }
          }
          return b;
        });
      }
      return event;
    },

    // Игнорируем известный мусор: отменённые fetch, ошибки расширений браузера.
    ignoreErrors: [
      'AbortError',
      'NetworkError when attempting to fetch resource',
      'Non-Error promise rejection captured',
      // Chrome extensions
      'chrome-extension://',
      'moz-extension://',
    ],
  });
  initialized = true;
  console.info('[Sentry] initialized');
}

/** Захватить ошибку вручную. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(error, { extra: context });
}

/** Привязать пользователя к текущим событиям Sentry. */
export function setSentryUser(user: { id: string; email?: string } | null): void {
  if (!initialized) return;
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email });
  } else {
    Sentry.setUser(null);
  }
}

/** ErrorBoundary из @sentry/react (re-export для удобства). */
export { ErrorBoundary as SentryErrorBoundary } from '@sentry/react';
