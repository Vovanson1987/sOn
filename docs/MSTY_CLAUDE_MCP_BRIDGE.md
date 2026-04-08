# Desktop/Msty ↔ Claude + Codex (VPS) — MCP Bridge Implementation

This repo includes a production-ready MCP gateway in `mcp-bridge/`.

## 1. Architecture

```text
Desktop app or Msty Studio (Streamable HTTP client)
        |
        | HTTPS POST /mcp
        | Authorization: Bearer <token>
        | X-Agent-Backend: claude|codex (optional)
        v
mcp-bridge/index.js (streamable MCP)
        |
        | legacy SSE upstream
        v
mcp-bridge/multi-backend-wrapper.js
        |- backend=claude -> local Claude Code (`claude mcp serve`)
        \- backend=codex  -> SSH to Mac (`bash -lc '/opt/homebrew/bin/codex mcp-server'`)
```

Supported upstream modes in bridge:

- `UPSTREAM_TRANSPORT=legacy-sse` (current path via multi-backend wrapper)
- `UPSTREAM_TRANSPORT=streamable-http` (direct modern MCP upstream)

## 2. Backend routing rules

Backend selection priority:

1. `X-Agent-Backend` header
2. `backend` query parameter
3. `MCP_BACKEND_DEFAULT` (default: `claude`)

Backend is bound to session (`Mcp-Session-Id`). If a later request sends a different backend for the same session, bridge returns JSON-RPC error `-32012`.

## 3. Files and scripts

Core:

- `mcp-bridge/index.js` — streamable MCP bridge
- `mcp-bridge/multi-backend-wrapper.js` — SSE wrapper with backend router
- `mcp-bridge/claude-legacy-wrapper.js` — compatibility shim to multi-backend wrapper
- `mcp-bridge/smoke-test.mjs` — local smoke test (`claude` + `codex` + error paths)
- `mcp-bridge/e2e-test.mjs` — endpoint e2e test against running bridge

Ops:

- `scripts/mcp/restart-services.sh`
- `scripts/mcp/watchdog.sh`
- `scripts/mcp/rotate-token.sh`
- `scripts/mcp/install-watchdog-systemd.sh`

## 4. Environment configuration

```env
# Bridge
MCP_BRIDGE_PORT=4100
MCP_BRIDGE_AUTH_TOKEN=<long-random-token>
MCP_BRIDGE_ALLOWED_ORIGINS=https://studio.msty.app,https://chat.sonchat.uk
MCP_BACKEND_DEFAULT=claude
MCP_BRIDGE_UPSTREAM_TRANSPORT=legacy-sse
MCP_BRIDGE_UPSTREAM_SSE_URL=http://127.0.0.1:8790/sse

# Claude backend
CLAUDE_ENABLED=true
CLAUDE_BIN=/home/son/.local/bin/claude
CLAUDE_ARGS=mcp serve
CLAUDE_CWD=/home/son/sOn
CLAUDE_WRAPPER_PORT=8790
CLAUDE_WRAPPER_IDLE_TIMEOUT_MS=900000

# Codex backend (remote Mac via reverse tunnel alias)
CODEX_REMOTE_ENABLED=true
CODEX_SSH_TARGET=mac
CODEX_REMOTE_CMD=/opt/homebrew/bin/codex mcp-server
CODEX_REMOTE_CONNECT_TIMEOUT_MS=8000
```

## 5. Start on VPS (PM2 path)

```bash
cd /home/son/sOn
./scripts/mcp/restart-services.sh
```

Expected PM2 processes:

- `claude-mcp-wrapper` (multi-backend wrapper)
- `mcp-bridge-host` (streamable bridge)

Health checks:

```bash
curl -s http://127.0.0.1:8790/health
curl -s http://127.0.0.1:4100/health
```

Wrapper health includes `backends.claude.available` and `backends.codex.available`.

## 6. Nginx publish

```nginx
location /mcp {
  proxy_pass http://127.0.0.1:4100/mcp;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
}

location /mcp-health {
  proxy_pass http://127.0.0.1:4100/health;
}
```

## 7. Desktop client usage

Desktop/web client sends standard MCP requests to one endpoint and can choose backend via header.

Example request headers:

- `Authorization: Bearer <MCP_BRIDGE_AUTH_TOKEN>`
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`
- Optional: `X-Agent-Backend: codex`

Example JS fetch:

```js
await fetch("https://mcp.your-domain.com/mcp", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "X-Agent-Backend": "codex",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "desktop-app", version: "1.0.0" },
    },
  }),
});
```

## 8. Validation

Local smoke:

```bash
cd /home/son/sOn/mcp-bridge
node smoke-test.mjs
```

Runtime e2e (against live endpoint):

```bash
cd /home/son/sOn/mcp-bridge
E2E_MCP_URL=http://127.0.0.1:4100/mcp E2E_MCP_TOKEN=<token> node e2e-test.mjs
```

## 9. Operations and watchdog

Install timer:

```bash
cd /home/son/sOn
./scripts/mcp/install-watchdog-systemd.sh
```

Watchdog behavior:

- checks PM2 process presence and online status
- checks bridge/wrapper health endpoints
- validates wrapper backend availability (`claude`, `codex`) when enabled
- triggers restart/self-heal on failure
- sends alert via webhook or Telegram if recovery fails

## 10. Failover runbook (manual)

If Codex path is unstable:

1. Set `CODEX_REMOTE_ENABLED=false` in `.env`
2. Keep `MCP_BACKEND_DEFAULT=claude`
3. Run `./scripts/mcp/restart-services.sh`
4. Verify: `curl -s http://127.0.0.1:8790/health`

If Claude path is unstable:

1. Set `CLAUDE_ENABLED=false`
2. Set `MCP_BACKEND_DEFAULT=codex`
3. Run `./scripts/mcp/restart-services.sh`
4. Verify `backends.codex.available=true` in wrapper health

## 11. Known issues

- `codex` backend requires SSH alias to Mac (`ssh mac`) and reachable reverse tunnel.
- Remote command must run in login shell (`bash -lc`) so `node`/`codex` are in `PATH`.
- Existing MCP session cannot switch backend mid-session; create a new session.

## 12. Secret hygiene

- Do not store long-lived secrets in repository or public docs.
- Do not print auth tokens in logs.
- Rotate any previously exposed values (`MCP_BRIDGE_AUTH_TOKEN`, PATs, DB URLs, bot tokens) before production use.
- Restrict `ALLOWED_ORIGINS` to trusted desktop/web domains only.
