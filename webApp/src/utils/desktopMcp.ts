import type { McpBackend } from '@stores/mcpStore';

export interface McpProbeRequest {
  url: string;
  token: string;
  backend: McpBackend;
}

export interface McpProbeResponse {
  ok: boolean;
  status: number;
  backend: McpBackend;
  toolCount: number;
  serverName?: string;
  serverVersion?: string;
  message: string;
}

function getWindowRuntime() {
  return typeof window === 'undefined' ? null : (window as unknown as Window & Record<string, unknown>);
}

export function isDesktopRuntime(): boolean {
  const runtimeWindow = getWindowRuntime();
  if (!runtimeWindow) return false;
  return '__TAURI_INTERNALS__' in runtimeWindow || '__TAURI__' in runtimeWindow;
}

export async function probeMcpConnection(request: McpProbeRequest): Promise<McpProbeResponse> {
  if (!isDesktopRuntime()) {
    throw new Error('Native MCP probe доступен только внутри desktop приложения.');
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<McpProbeResponse>('probe_mcp_connection', {
    request: {
      url: request.url.trim(),
      token: request.token.trim(),
      backend: request.backend,
    },
  });
}
