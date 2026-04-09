/** Sentry ErrorBoundary fallback — показывается при crash React-дерева */

export function ErrorFallback() {
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
  );
}
