import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/globals.css'
import App from './App.tsx'
import { initSentry, SentryErrorBoundary } from '@/lib/sentry'
import { ErrorFallback } from '@/components/ErrorFallback'
import { toast } from '@/components/ui/Toast'

initSentry()

// Глобальный fail-safe: любые необработанные промис-ошибки и runtime-ошибки
// показываем пользователю через toast, чтобы не «глотать» сбои молча.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : 'Произошла непредвиденная ошибка';
    // Не спамим пользователя служебными AbortError/NetworkError от отменённых fetch
    if (/Abort|cancel/i.test(message)) return;
    console.error('[unhandledrejection]', reason);
    toast.error(message);
  });

  window.addEventListener('error', (event) => {
    // Игнорируем ошибки загрузки ресурсов (картинки, чанки) — они отдельно обрабатываются
    if (event.target && event.target !== window) return;
    console.error('[window.error]', event.error ?? event.message);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SentryErrorBoundary>
  </StrictMode>,
)

// Регистрация Service Worker для offline-режима + оповещение о новой версии
if ('serviceWorker' in navigator) {
  let isReloading = false;
  // Если controller меняется — активировалась новая версия; предлагаем перезагрузку
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading) return;
    isReloading = true;
    // Мягкое уведомление — пользователь сам перезагрузит; при желании можно forced reload
    toast.info('Доступна новая версия. Обновите страницу, чтобы применить изменения.');
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Проверка обновлений каждый час
        setInterval(() => { void reg.update(); }, 60 * 60 * 1000);

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              // Новая версия установлена, старая ещё контролирует страницу
              toast.info('Обновление загружено. Перезагрузите страницу.');
            }
          });
        });
      })
      .catch(() => {
        // Service Worker не поддерживается или не удалось зарегистрировать
      });
  });
}
