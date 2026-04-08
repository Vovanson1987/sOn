# MCP Bridge (Desktop/Msty ↔ Claude + Codex)

`mcp-bridge` exposes a single Streamable HTTP MCP endpoint (`/mcp`) and proxies requests to upstream MCP backends.

## Architecture

```text
Desktop app / Msty Studio
        |
        | POST /mcp + Authorization + optional X-Agent-Backend
        v
mcp-bridge/index.js (streamable HTTP)
        |
        | legacy-sse upstream
        v
multi-backend-wrapper.js
   |- backend=claude -> local `claude mcp serve`
   \- backend=codex  -> SSH to Mac `codex mcp-server`
```

## Backend routing

Priority for backend selection:

1. `X-Agent-Backend` header
2. `backend` query parameter
3. `MCP_BACKEND_DEFAULT` (default: `claude`)

The selected backend is bound to the MCP session. If later requests on the same `Mcp-Session-Id` specify a different backend, bridge returns JSON-RPC error `-32012`.

## Run wrapper

```bash
cd mcp-bridge
node multi-backend-wrapper.js
```

Codex backend relies on SSH alias (default `mac`) and login shell on remote host:

```bash
ssh mac 'bash -lc "/opt/homebrew/bin/codex --version"'
```

## Run bridge

```bash
cd mcp-bridge
cp .env.example .env
node index.js
```

## Desktop/Msty connection

- URL: `https://your-domain.example.com/mcp`
- Header: `Authorization: Bearer <BRIDGE_AUTH_TOKEN>`
- Optional routing header: `X-Agent-Backend: claude` or `X-Agent-Backend: codex`

## Health

- Bridge: `GET /health` -> session count + sessions by backend
- Wrapper: `GET /health` -> per-backend availability

## Tests

```bash
cd mcp-bridge
node smoke-test.mjs
```

Optional end-to-end check against running endpoint:

```bash
cd mcp-bridge
E2E_MCP_URL=http://127.0.0.1:4100/mcp E2E_MCP_TOKEN=<token> node e2e-test.mjs
```

## Security notes

- Always set `BRIDGE_AUTH_TOKEN`.
- Restrict `ALLOWED_ORIGINS`.
- Use HTTPS in production.
- Do not log or commit secrets.
- Rotate existing leaked tokens before production rollout.
