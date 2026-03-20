import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { API_URL } from '@/api/config';

interface AuthScreenProps {
  onAuth: (token: string, user: { id: string; email: string; display_name: string }) => void;
}

/** Экран авторизации (вход / регистрация) */
export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);

  // ME-12: Живой обратный отсчёт блокировки
  const [lockRemaining, setLockRemaining] = useState(0);
  useEffect(() => {
    if (lockUntil <= Date.now()) { setLockRemaining(0); return; }
    setLockRemaining(Math.ceil((lockUntil - Date.now()) / 1000));
    const id = setInterval(() => {
      const rem = Math.ceil((lockUntil - Date.now()) / 1000);
      if (rem <= 0) { setLockRemaining(0); clearInterval(id); }
      else setLockRemaining(rem);
    }, 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();

    // ME-11: Валидация email на клиенте
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Введите корректный email');
      return;
    }

    // Защита от brute-force: экспоненциальная задержка
    const now = Date.now();
    if (now < lockUntil) {
      setError(`Подождите ${Math.ceil((lockUntil - now) / 1000)} сек. перед повторной попыткой`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin
        ? { email, password }
        : { email, display_name: displayName, password };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      setFailedAttempts(0);
      onAuth(data.token, data.user);
    } catch (err) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      // Экспоненциальная задержка: 3→5с, 5→15с, 7→30с
      if (newAttempts >= 3) {
        const delay = Math.min(5000 * Math.pow(2, newAttempts - 3), 60000);
        setLockUntil(Date.now() + delay);
      }
      setError(err instanceof Error ? err.message : 'Ошибка подключения');
    } finally {
      setLoading(false);
    }
  }, [isLogin, email, displayName, password, onAuth, failedAttempts, lockUntil]);

  return (
    <div className="flex items-center justify-center h-full w-full bg-black">
      <div className="w-full max-w-[360px] px-6">
        {/* Логотип */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-[64px] h-[64px] rounded-[16px] flex items-center justify-center mb-4"
            style={{ background: '#007AFF' }}
          >
            <Lock size={32} color="white" />
          </div>
          <h1 className="text-[34px] font-bold text-white">sOn</h1>
          <p className="text-[14px] mt-1" style={{ color: '#ABABAF' }}>
            Защищённый мессенджер
          </p>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Имя"
              aria-label="Имя"
              required={!isLogin}
              className="w-full px-4 py-[12px] rounded-[10px] text-[15px] text-white placeholder-[#636366] outline-none"
              style={{ background: '#1C1C1E', border: '0.5px solid #38383A' }}
            />
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            required
            autoComplete="email"
            className="w-full px-4 py-[12px] rounded-[10px] text-[15px] text-white placeholder-[#636366] outline-none"
            style={{ background: '#1C1C1E', border: '0.5px solid #38383A' }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            aria-label="Пароль"
            required
            minLength={8}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            className="w-full px-4 py-[12px] rounded-[10px] text-[15px] text-white placeholder-[#636366] outline-none"
            style={{ background: '#1C1C1E', border: '0.5px solid #38383A' }}
          />

          {error && (
            <p className="text-[13px] text-center" style={{ color: '#FF453A' }} role="alert">{error}</p>
          )}
          {lockRemaining > 0 && (
            <p className="text-[13px] text-center" style={{ color: '#FF9F0A' }} role="timer" aria-live="polite">
              Повторная попытка через {lockRemaining} сек.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-[12px] rounded-[10px] text-[16px] font-semibold text-white"
            style={{ background: loading ? '#636366' : '#007AFF' }}
          >
            {loading ? 'Подождите...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        {/* Переключение вход/регистрация */}
        <p className="text-center mt-4 text-[14px]" style={{ color: '#ABABAF' }}>
          {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="font-semibold"
            style={{ color: '#007AFF' }}
          >
            {isLogin ? 'Регистрация' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
}
