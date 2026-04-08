import { create } from 'zustand';
import { MCP_URL } from '@/api/config';

export type McpBackend = 'claude' | 'codex';

export interface McpProbeResult {
  ok: boolean;
  status: number;
  backend: McpBackend;
  toolCount: number;
  serverName?: string;
  serverVersion?: string;
  message: string;
  checkedAt: string;
}

interface McpStoreState {
  url: string;
  token: string;
  backend: McpBackend;
  lastProbe: McpProbeResult | null;
  setConfig: (patch: Partial<Pick<McpStoreState, 'url' | 'token' | 'backend'>>) => void;
  setLastProbe: (result: McpProbeResult | null) => void;
  resetConfig: () => void;
}

const STORAGE_KEY = 'son-mcp-config';
const DEFAULT_CONFIG = {
  url: MCP_URL,
  token: '',
  backend: 'claude' as McpBackend,
};

function readStoredConfig() {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_CONFIG>;

    return {
      url: typeof parsed.url === 'string' && parsed.url.trim() ? parsed.url.trim() : DEFAULT_CONFIG.url,
      token: typeof parsed.token === 'string' ? parsed.token : DEFAULT_CONFIG.token,
      backend: parsed.backend === 'codex' ? 'codex' : DEFAULT_CONFIG.backend,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function persistConfig(config: typeof DEFAULT_CONFIG) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

const initialConfig = readStoredConfig();

export const useMcpStore = create<McpStoreState>((set, get) => ({
  ...initialConfig,
  lastProbe: null,

  setConfig: (patch) => {
    const next = {
      url: (patch.url ?? get().url).trim(),
      token: (patch.token ?? get().token).trim(),
      backend: patch.backend ?? get().backend,
    };

    persistConfig(next);
    set(next);
  },

  setLastProbe: (result) => {
    set({ lastProbe: result });
  },

  resetConfig: () => {
    persistConfig(DEFAULT_CONFIG);
    set({
      ...DEFAULT_CONFIG,
      lastProbe: null,
    });
  },
}));
