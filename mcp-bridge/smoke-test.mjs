import http from "node:http";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildBridge } from "./index.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function backendFromReq(req, url, fallback = "claude") {
  const rawHeader = req.headers["x-agent-backend"];
  const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (header && String(header).trim()) {
    return String(header).trim().toLowerCase();
  }
  const query = url.searchParams.get("backend");
  if (query && String(query).trim()) {
    return String(query).trim().toLowerCase();
  }
  return fallback;
}

async function startMockLegacyServer() {
  const streams = new Map();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/sse") {
      const backend = backendFromReq(req, url);
      if (!["claude", "codex"].includes(backend)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Unsupported backend ${backend}` }));
        return;
      }

      const streamId = crypto.randomUUID();
      streams.set(streamId, { res, backend });

      const origin = `http://127.0.0.1:${server.address().port}`;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`event: endpoint\ndata: ${origin}/messages?streamId=${encodeURIComponent(streamId)}\n\n`);

      req.on("close", () => {
        streams.delete(streamId);
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/messages") {
      const streamId = url.searchParams.get("streamId");
      const stream = streamId ? streams.get(streamId) : null;
      if (!stream) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unknown stream" }));
        return;
      }

      const backend = backendFromReq(req, url, stream.backend);
      const payload = await parseJsonBody(req);
      const list = Array.isArray(payload) ? payload : [payload];
      const responses = [];

      for (const msg of list) {
        if (!msg || typeof msg !== "object" || msg.id === undefined) continue;

        if (msg.method === "initialize") {
          responses.push({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              protocolVersion: "2025-03-26",
              capabilities: { tools: {} },
              serverInfo: {
                name: backend === "codex" ? "mock-codex-wrapper" : "mock-claude-wrapper",
                version: "0.2.0",
              },
            },
          });
          continue;
        }

        if (msg.method === "tools/list") {
          responses.push({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              tools: [
                {
                  name: backend === "codex" ? "codex_exec" : "claude_code_exec",
                  description: backend === "codex" ? "Execute Codex prompt" : "Execute Claude Code prompt",
                  inputSchema: {
                    type: "object",
                    properties: { prompt: { type: "string" } },
                    required: ["prompt"],
                  },
                },
              ],
            },
          });
          continue;
        }

        if (msg.method === "tools/call") {
          responses.push({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              content: [{ type: "text", text: `ok-${backend}` }],
              isError: false,
            },
          });
          continue;
        }

        responses.push({
          jsonrpc: "2.0",
          id: msg.id,
          error: {
            code: -32601,
            message: "Method not found",
          },
        });
      }

      if (responses.length > 0) {
        const payloadOut = responses.length === 1 ? responses[0] : responses;
        stream.res.write(`event: message\ndata: ${JSON.stringify(payloadOut)}\n\n`);
      }

      res.writeHead(202).end();
      return;
    }

    res.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    port: server.address().port,
  };
}

async function initialize(baseUrl, sessionBackend, asQuery = false) {
  const requestUrl = asQuery ? `${baseUrl}?backend=${encodeURIComponent(sessionBackend)}` : baseUrl;
  const headers = {
    Authorization: "Bearer test-token",
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (!asQuery) {
    headers["X-Agent-Backend"] = sessionBackend;
  }

  const res = await fetch(requestUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "smoke-client", version: "1.0.0" },
      },
    }),
  });

  const body = await res.json();
  return {
    res,
    body,
    sessionId: res.headers.get("mcp-session-id"),
  };
}

async function toolsList(baseUrl, sessionId, backendHeader = null, id = 2) {
  const headers = {
    Authorization: "Bearer test-token",
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "Mcp-Session-Id": sessionId,
  };
  if (backendHeader) headers["X-Agent-Backend"] = backendHeader;

  const res = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/list",
      params: {},
    }),
  });

  const body = await res.json();
  return { res, body };
}

async function run() {
  const mock = await startMockLegacyServer();

  const bridge = buildBridge(
    {
      host: "127.0.0.1",
      port: 0,
      mcpPath: "/mcp",
      healthPath: "/health",
      defaultAgentBackend: "claude",
      requestTimeoutMs: 15000,
      maxBodyBytes: 1024 * 1024,
      sessionTtlMs: 5 * 60 * 1000,
      sessionCleanupIntervalMs: 60 * 1000,
      connectTimeoutMs: 5000,
      upstreamTransport: "legacy-sse",
      upstreamSseUrl: `http://127.0.0.1:${mock.port}/sse`,
      upstreamHttpUrl: "",
      upstreamAuthBearer: "",
      upstreamHeadersJson: "",
      authToken: "test-token",
      allowedOrigins: [],
      strictOriginCheck: false,
      insecureTls: false,
      logLevel: "error",
    },
    () => {}
  );

  await new Promise((resolve) => bridge.server.listen(0, "127.0.0.1", resolve));
  const bridgePort = bridge.server.address().port;
  const baseUrl = `http://127.0.0.1:${bridgePort}/mcp`;

  const claudeInit = await initialize(baseUrl, "claude");
  assert.equal(claudeInit.res.status, 200);
  assert.ok(claudeInit.sessionId, "Bridge must return Mcp-Session-Id for claude init");
  assert.equal(claudeInit.body?.result?.serverInfo?.name, "mock-claude-wrapper");

  const claudeTools = await toolsList(baseUrl, claudeInit.sessionId, null, 2);
  assert.equal(claudeTools.res.status, 200);
  assert.equal(claudeTools.body?.result?.tools?.[0]?.name, "claude_code_exec");

  const codexInit = await initialize(baseUrl, "codex", true);
  assert.equal(codexInit.res.status, 200);
  assert.ok(codexInit.sessionId, "Bridge must return Mcp-Session-Id for codex init");
  assert.equal(codexInit.body?.result?.serverInfo?.name, "mock-codex-wrapper");

  const codexTools = await toolsList(baseUrl, codexInit.sessionId, null, 3);
  assert.equal(codexTools.res.status, 200);
  assert.equal(codexTools.body?.result?.tools?.[0]?.name, "codex_exec");

  const mismatch = await toolsList(baseUrl, codexInit.sessionId, "claude", 4);
  assert.equal(mismatch.res.status, 200);
  assert.equal(mismatch.body?.error?.code, -32012);

  const unknownInit = await initialize(baseUrl, "unknown-backend");
  assert.equal(unknownInit.res.status, 200);
  assert.equal(unknownInit.body?.error?.code, -32010);
  assert.equal(unknownInit.body?.error?.data?.status, 400);

  const notifRes = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      "Mcp-Session-Id": claudeInit.sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  });
  assert.equal(notifRes.status, 202);

  const deleteClaude = await fetch(baseUrl, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer test-token",
      "Mcp-Session-Id": claudeInit.sessionId,
    },
  });
  assert.equal(deleteClaude.status, 204);

  const deleteCodex = await fetch(baseUrl, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer test-token",
      "Mcp-Session-Id": codexInit.sessionId,
    },
  });
  assert.equal(deleteCodex.status, 204);

  await bridge.close();
  await new Promise((resolve) => mock.server.close(resolve));
  await sleep(50);
  // eslint-disable-next-line no-console
  console.log("Smoke test passed (claude+codex+errors)");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Smoke test failed:", err);
  process.exitCode = 1;
});
