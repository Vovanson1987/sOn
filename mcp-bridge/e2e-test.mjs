import assert from "node:assert/strict";

const BASE_URL = process.env.E2E_MCP_URL || "http://127.0.0.1:4100/mcp";
const TOKEN = process.env.E2E_MCP_TOKEN || process.env.MCP_BRIDGE_AUTH_TOKEN || "";

function authHeaders(extra = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...extra,
  };
  if (TOKEN) {
    headers.Authorization = `Bearer ${TOKEN}`;
  }
  return headers;
}

async function initializeSession(backend) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: authHeaders({ "X-Agent-Backend": backend }),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "e2e-client", version: "1.0.0" },
      },
    }),
  });

  const body = await res.json();
  return {
    status: res.status,
    body,
    sessionId: res.headers.get("mcp-session-id"),
  };
}

async function toolsList(sessionId, backend = null) {
  const headers = authHeaders({
    "Mcp-Session-Id": sessionId,
  });
  if (backend) headers["X-Agent-Backend"] = backend;

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });

  return {
    status: res.status,
    body: await res.json(),
  };
}

async function closeSession(sessionId) {
  if (!sessionId) return 0;
  const res = await fetch(BASE_URL, {
    method: "DELETE",
    headers: authHeaders({ "Mcp-Session-Id": sessionId }),
  });
  return res.status;
}

async function run() {
  const sessions = [];
  try {
    const claude = await initializeSession("claude");
    assert.equal(claude.status, 200, "claude initialize must return 200");
    assert.ok(claude.sessionId, "claude initialize must return session id");
    sessions.push(claude.sessionId);

    const claudeTools = await toolsList(claude.sessionId);
    assert.equal(claudeTools.status, 200, "claude tools/list must return 200");
    assert.ok(Array.isArray(claudeTools.body?.result?.tools), "claude tools/list must return tools array");

    const codex = await initializeSession("codex");
    assert.equal(codex.status, 200, "codex initialize must return 200");
    assert.ok(codex.sessionId, "codex initialize must return session id");
    sessions.push(codex.sessionId);

    const codexTools = await toolsList(codex.sessionId);
    assert.equal(codexTools.status, 200, "codex tools/list must return 200");
    assert.ok(Array.isArray(codexTools.body?.result?.tools), "codex tools/list must return tools array");

    const unknown = await initializeSession("unknown-backend");
    assert.equal(unknown.status, 200, "unknown backend initialize should return JSON-RPC error envelope");
    assert.equal(unknown.body?.error?.code, -32010, "unknown backend should map to upstream rejection code -32010");

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      ok: true,
      baseUrl: BASE_URL,
      claudeTools: claudeTools.body.result.tools.length,
      codexTools: codexTools.body.result.tools.length,
      unknownErrorCode: unknown.body.error.code,
    }));
  } finally {
    for (const sessionId of sessions) {
      await closeSession(sessionId);
    }
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("E2E failed:", err.message);
  process.exitCode = 1;
});
