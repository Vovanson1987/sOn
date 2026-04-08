import { useEffect, useMemo, useState } from 'react';
import { Bot, Eye, EyeOff, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { useMcpStore, type McpBackend, type McpProbeResult } from '@stores/mcpStore';
import { probeMcpConnection } from '@/utils/desktopMcp';

const BACKEND_OPTIONS: Array<{ value: McpBackend; label: string; caption: string }> = [
  { value: 'claude', label: 'Claude Code', caption: 'Основной backend на VPS' },
  { value: 'codex', label: 'Codex', caption: 'Удалённый backend через Mac SSH' },
];

function formatCheckedAt(checkedAt: string): string {
  const parsed = new Date(checkedAt);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBanner({
  lastProbe,
  isTesting,
}: {
  lastProbe: McpProbeResult | null;
  isTesting: boolean;
}) {
  if (isTesting) {
    return (
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(0, 122, 255, 0.12)', border: '1px solid rgba(0, 122, 255, 0.24)' }}
      >
        <RefreshCw size={16} className="animate-spin text-[#64B5FF]" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-semibold text-white">Проверяем MCP gateway</p>
          <p className="text-[12px]" style={{ color: '#ABABAF' }}>
            Выполняем `initialize` и `tools/list` через native bridge.
          </p>
        </div>
      </div>
    );
  }

  if (!lastProbe) {
    return (
      <div
        className="rounded-2xl px-4 py-3"
        style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <p className="text-[13px] font-semibold text-white">Конфиг ещё не проверяли</p>
        <p className="text-[12px]" style={{ color: '#ABABAF' }}>
          Проверка пойдёт нативно из desktop приложения, без browser CORS.
        </p>
      </div>
    );
  }

  const accent = lastProbe.ok ? '#30D158' : '#FF453A';
  const subtitle = lastProbe.ok
    ? `${lastProbe.serverName || 'MCP bridge'}${lastProbe.serverVersion ? ` ${lastProbe.serverVersion}` : ''} • tools: ${lastProbe.toolCount}`
    : lastProbe.message;

  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        background: `${accent}14`,
        border: `1px solid ${accent}33`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-white">
            {lastProbe.ok ? 'Подключение подтверждено' : 'Подключение не прошло'}
          </p>
          <p className="text-[12px]" style={{ color: lastProbe.ok ? '#D5FFE0' : '#FFD1CD' }}>
            {subtitle}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ background: `${accent}1F`, color: accent }}
        >
          {lastProbe.backend}
        </span>
      </div>
      {lastProbe.checkedAt && (
        <p className="mt-2 text-[11px]" style={{ color: '#ABABAF' }}>
          Последняя проверка: {formatCheckedAt(lastProbe.checkedAt)}
        </p>
      )}
    </div>
  );
}

export function McpIntegrationCard() {
  const savedUrl = useMcpStore((s) => s.url);
  const savedToken = useMcpStore((s) => s.token);
  const savedBackend = useMcpStore((s) => s.backend);
  const lastProbe = useMcpStore((s) => s.lastProbe);
  const setConfig = useMcpStore((s) => s.setConfig);
  const setLastProbe = useMcpStore((s) => s.setLastProbe);
  const resetConfig = useMcpStore((s) => s.resetConfig);

  const [url, setUrl] = useState(savedUrl);
  const [token, setToken] = useState(savedToken);
  const [backend, setBackend] = useState<McpBackend>(savedBackend);
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setUrl(savedUrl);
    setToken(savedToken);
    setBackend(savedBackend);
  }, [savedUrl, savedToken, savedBackend]);

  const hasUnsavedChanges = useMemo(() => (
    url.trim() !== savedUrl || token !== savedToken || backend !== savedBackend
  ), [backend, savedBackend, savedToken, savedUrl, token, url]);

  const saveDraft = () => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      setLocalError('Укажи URL MCP gateway, например `https://chat.sonchat.uk/mcp`.');
      return;
    }

    setConfig({
      url: normalizedUrl,
      token,
      backend,
    });
    setLocalError('');
  };

  const handleProbe = async () => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      setLocalError('Нужен URL MCP gateway для проверки подключения.');
      return;
    }

    setLocalError('');
    setIsTesting(true);

    try {
      const result = await probeMcpConnection({
        url: normalizedUrl,
        token,
        backend,
      });

      setLastProbe({
        ...result,
        checkedAt: new Date().toISOString(),
      });
    } catch (err) {
      setLastProbe({
        ok: false,
        status: 0,
        backend,
        toolCount: 0,
        message: err instanceof Error ? err.message : 'Не удалось проверить MCP gateway.',
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div
      className="mx-4 rounded-[22px] p-4 flex flex-col gap-4"
      style={{
        background: 'linear-gradient(180deg, rgba(28, 28, 30, 0.98) 0%, rgba(17, 17, 18, 0.98) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.28)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.2), rgba(48, 209, 88, 0.18))' }}
          >
            <Bot size={20} color="#7AC8FF" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-white">MCP integration</h3>
            <p className="mt-1 text-[12px]" style={{ color: '#ABABAF' }}>
              Desktop общается с VPS нативно и может переключать backend между `claude` и `codex`.
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ background: 'rgba(48, 209, 88, 0.14)', color: '#7DFFAA' }}
        >
          desktop
        </span>
      </div>

      <StatusBanner lastProbe={lastProbe} isTesting={isTesting} />

      <label className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#ABABAF' }}>
          MCP URL
        </span>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://chat.sonchat.uk/mcp"
          className="rounded-2xl border px-4 py-3 text-[14px] text-white outline-none transition-colors focus:border-[#007AFF]"
          style={{ background: '#121214', borderColor: 'rgba(255, 255, 255, 0.08)' }}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#ABABAF' }}>
          Bearer token
        </span>
        <div className="relative">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            type={showToken ? 'text' : 'password'}
            placeholder="Оставь пустым, если gateway принимает cookie/auth upstream"
            className="w-full rounded-2xl border px-4 py-3 pr-12 text-[14px] text-white outline-none transition-colors focus:border-[#007AFF]"
            style={{ background: '#121214', borderColor: 'rgba(255, 255, 255, 0.08)' }}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowToken((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1"
            aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}
          >
            {showToken ? <EyeOff size={16} color="#ABABAF" /> : <Eye size={16} color="#ABABAF" />}
          </button>
        </div>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#ABABAF' }}>
          Backend
        </span>
        <div className="grid gap-2 md:grid-cols-2">
          {BACKEND_OPTIONS.map((option) => {
            const active = backend === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setBackend(option.value)}
                className="rounded-2xl border px-4 py-3 text-left transition-all"
                style={{
                  background: active ? 'rgba(0, 122, 255, 0.16)' : '#121214',
                  borderColor: active ? 'rgba(0, 122, 255, 0.42)' : 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-semibold text-white">{option.label}</span>
                  {active && <ShieldCheck size={16} color="#64B5FF" aria-hidden="true" />}
                </div>
                <p className="mt-1 text-[12px]" style={{ color: '#ABABAF' }}>
                  {option.caption}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-2xl px-4 py-3 text-[12px]"
        style={{ background: 'rgba(255, 255, 255, 0.03)', color: '#ABABAF' }}
      >
        Конфиг хранится локально на этом Mac. Проверка подключения идёт через Tauri command, поэтому не зависит от browser CORS.
      </div>

      {localError && (
        <p className="text-[12px]" style={{ color: '#FF7B72' }}>
          {localError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveDraft}
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ background: '#007AFF' }}
        >
          <Save size={16} aria-hidden="true" />
          Сохранить
        </button>
        <button
          type="button"
          onClick={handleProbe}
          disabled={isTesting}
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ background: '#1F7A3E' }}
        >
          <RefreshCw size={16} className={isTesting ? 'animate-spin' : ''} aria-hidden="true" />
          Проверить соединение
        </button>
        <button
          type="button"
          onClick={resetConfig}
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold"
          style={{ background: '#1C1C1E', color: '#ABABAF' }}
        >
          Сбросить
        </button>
        {hasUnsavedChanges && (
          <span className="inline-flex items-center rounded-2xl px-3 py-3 text-[12px]" style={{ color: '#FFD60A' }}>
            Есть несохранённые изменения
          </span>
        )}
      </div>
    </div>
  );
}
