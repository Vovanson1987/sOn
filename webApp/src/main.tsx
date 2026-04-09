import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/globals.css'
import App from './App.tsx'
import { initSentry, SentryErrorBoundary } from '@/lib/sentry'

// P1.2: Sentry инициализируется максимально рано, до первого рендера.
// Если VITE_SENTRY_DSN не задан — это no-op (ок для dev).
initSentry()

function Fallback() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px',
      textAlign: 'center',
    }}>
      <div>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Что-то пошло не так</h1>
        <p style={{ opacity: 0.7, marginBottom: 16 }}>Попробуйте перезагрузить страницу.</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#0A84FF',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Перезагрузить
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary fallback={<Fallback />}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SentryErrorBoundary>
  </StrictMode>,
)

// Регистрация Service Worker для offline-режима
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service Worker не поддерживается или не удалось зарегистрировать
    });
  });
}
