"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { URL } = require("node:url");

const HOST = process.env.CLAUDE_WRAPPER_HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.CLAUDE_WRAPPER_PORT || "8790", 10);
const DEFAULT_BACKEND = normalizeBackendName(process.env.MCP_BACKEND_DEFAULT || "claude");
const IDLE_TIMEOUT_MS = Number.parseInt(process.env.CLAUDE_WRAPPER_IDLE_TIMEOUT_MS || "900000", 10);
const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase();

const CLAUDE_ENABLED = toBool(process.env.CLAUDE_ENABLED, true);
const CLAUDE_BIN = process.env.CLAUDE_BIN || "/home/son/.local/bin/claude";
const CLAUDE_ARGS = parseArgString(process.env.CLAUDE_ARGS || "mcp serve");
const CLAUDE_CWD = process.env.CLAUDE_CWD || process.cwd();

const CODEX_REMOTE_ENABLED = toBool(process.env.CODEX_REMOTE_ENABLED, true);
const CODEX_SSH_BIN = process.env.CODEX_SSH_BIN || "ssh";
const CODEX_SSH_TARGET = process.env.CODEX_SSH_TARGET || "mac";
const CODEX_REMOTE_CMD = process.env.CODEX_REMOTE_CMD || "/opt/homebrew/bin/codex mcp-server";
const CODEX_REMOTE_CONNECT_TIMEOUT_MS = Number.parseInt(process.env.CODEX_REMOTE_CONNECT_TIMEOUT_MS || "8000", 10);

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const logLevelNumber = LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.info;

function toBool(raw, fallback = false) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function parseArgString(raw) {
  return String(raw || "")
    .split(" ")
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeBackendName(raw) {
  const value = String(raw || "").trim().toLowerCase();
  return value || "claude";
}

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildCodexSshArgs(command) {
  const connectTimeoutSec = Math.max(1, Math.ceil(CODEX_REMOTE_CONNECT_TIMEOUT_MS / 1000));
  return [
    "-o",
    "BatchMode=yes",
    "-o",
    `ConnectTimeout=${connectTimeoutSec}`,
    CODEX_SSH_TARGET,
    `bash -lc ${shellSingleQuote(command)}`,
  ];
}

function backendSelectionFromRequest(req, url) {
  const headerRaw = req.headers["x-agent-backend"];
  const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  if (header && String(header).trim()) {
    return {
      backend: normalizeBackendName(header),
      source: "header",
    };
  }

  const query = url.searchParams.get("backend");
  if (query && String(query).trim()) {
    return {
      backend: normalizeBackendName(query),
      source: "query",
    };
  }

  return {
    backend: DEFAULT_BACKEND,
    source: "default",
  };
}

function log(level, message, meta = undefined) {
  if ((LOG_LEVELS[level] ?? LOG_LEVELS.info) > logLevelNumber) return;
  const parts = [new Date().toISOString(), level.toUpperCase(), message];
  if (meta !== undefined) {
    parts.push(typeof meta === "string" ? meta : JSON.stringify(meta));
  }
  // eslint-disable-next-line no-console
  console.log(parts.join(" "));
}

function idKey(id) {
  return JSON.stringify(id);
}

function normalizePayload(payload) {
  return Array.isArray(payload) ? payload : [payload];
}

class Deferred {
  constructor() {
    this.settled = false;
    this.promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  resolve(value) {
    if (this.settled) return;
    this.settled = true;
    this._resolve(value);
  }

  reject(err) {
    if (this.settled) return;
    this.settled = true;
    this._reject(err);
  }
}

function buildSpawnSpec(backend) {
  if (backend === "claude") {
    if (!CLAUDE_ENABLED) {
      throw new Error("Backend claude is disabled by CLAUDE_ENABLED=false");
    }
    return {
      command: CLAUDE_BIN,
      args: CLAUDE_ARGS,
      cwd: CLAUDE_CWD,
      env: {
        ...process.env,
        PATH: `${process.env.PATH || ""}:/home/son/.local/bin:/home/son/.npm-global/bin`,
      },
      display: {
        command: CLAUDE_BIN,
        args: CLAUDE_ARGS,
      },
    };
  }

  if (backend === "codex") {
    if (!CODEX_REMOTE_ENABLED) {
      throw new Error("Backend codex is disabled by CODEX_REMOTE_ENABLED=false");
    }

    return {
      command: CODEX_SSH_BIN,
      args: buildCodexSshArgs(CODEX_REMOTE_CMD),
      cwd: process.cwd(),
      env: {
        ...process.env,
      },
      display: {
        command: CODEX_SSH_BIN,
        args: [`${CODEX_SSH_TARGET}: ${CODEX_REMOTE_CMD}`],
      },
    };
  }

  throw new Error(`Unsupported backend \"${backend}\". Allowed: claude, codex`);
}

function extractCodexBinaryHint() {
  const firstToken = String(CODEX_REMOTE_CMD || "").trim().split(/\s+/)[0] || "codex";
  return firstToken;
}

async function runProbe(command, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try {
        child.kill("SIGTERM");
      } catch {
        // no-op
      }
      resolve({ ok: false, reason: `timeout ${timeoutMs}ms` });
    }, timeoutMs);

    child.once("error", (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: false, reason: err.message });
    });

    child.once("exit", (code, signal) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, reason: "ok" });
      } else {
        resolve({ ok: false, reason: `exit code=${code} signal=${signal || "none"}` });
      }
    });
  });
}

async function getBackendAvailability() {
  const claudeInfo = {
    enabled: CLAUDE_ENABLED,
    available: false,
    reason: CLAUDE_ENABLED ? "checking" : "disabled",
    mode: "local",
  };

  if (CLAUDE_ENABLED) {
    try {
      if (CLAUDE_BIN.includes("/")) {
        fs.accessSync(CLAUDE_BIN, fs.constants.X_OK);
        claudeInfo.available = true;
        claudeInfo.reason = "binary is executable";
      } else {
        const probe = await runProbe("bash", ["-lc", `command -v ${CLAUDE_BIN} >/dev/null 2>&1`], 2500);
        claudeInfo.available = probe.ok;
        claudeInfo.reason = probe.reason;
      }
    } catch (err) {
      claudeInfo.available = false;
      claudeInfo.reason = err.message;
    }
  }

  const codexInfo = {
    enabled: CODEX_REMOTE_ENABLED,
    available: false,
    reason: CODEX_REMOTE_ENABLED ? "checking" : "disabled",
    mode: "ssh-remote",
    sshTarget: CODEX_SSH_TARGET,
  };

  if (CODEX_REMOTE_ENABLED) {
    const codexBinary = extractCodexBinaryHint();
    const probeCommand = `command -v ${codexBinary} >/dev/null 2>&1`;
    const probe = await runProbe(CODEX_SSH_BIN, buildCodexSshArgs(probeCommand), CODEX_REMOTE_CONNECT_TIMEOUT_MS);
    codexInfo.available = probe.ok;
    codexInfo.reason = probe.reason;
  }

  return {
    claude: claudeInfo,
    codex: codexInfo,
  };
}

class BackendSession {
  constructor(id, backend) {
    this.id = id;
    this.backend = backend;
    this.createdAt = Date.now();
    this.lastUsedAt = Date.now();
    this.pending = new Map();
    this.bufferedById = new Map();
    this.sse = null;
    this.closed = false;

    const spec = buildSpawnSpec(backend);
    this.child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: spec.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.displayCommand = spec.display.command;
    this.displayArgs = spec.display.args;

    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    this._bindProcess();
  }

  _bindProcess() {
    this.child.on("spawn", () => {
      log("info", "Backend session spawned", {
        session: this.id,
        backend: this.backend,
        pid: this.child.pid,
        command: this.displayCommand,
        args: this.displayArgs,
      });
    });

    this.child.on("error", (err) => {
      log("error", "Backend session process error", {
        session: this.id,
        backend: this.backend,
        error: err.message,
      });
      this._rejectAll(err);
      this.close();
    });

    this.child.on("exit", (code, signal) => {
      log("warn", "Backend session exited", {
        session: this.id,
        backend: this.backend,
        code,
        signal,
      });
      this._rejectAll(new Error(`Backend process exited: code=${code}, signal=${signal}`));
      this.close();
    });

    this.child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      this.stderrBuffer += text;
      const lines = this.stderrBuffer.split(/\r?\n/);
      this.stderrBuffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) {
          log("debug", "Backend stderr", {
            session: this.id,
            backend: this.backend,
            line,
          });
        }
      }
    });

    this.child.stdout.on("data", (chunk) => {
      this.stdoutBuffer += chunk.toString("utf8");
      const lines = this.stdoutBuffer.split(/\r?\n/);
      this.stdoutBuffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this._handleStdoutLine(trimmed);
      }
    });
  }

  _handleStdoutLine(line) {
    let payload;
    try {
      payload = JSON.parse(line);
    } catch {
      log("debug", "Non-JSON stdout from backend ignored", {
        session: this.id,
        backend: this.backend,
      });
      return;
    }
    this._routeIncomingPayload(payload);
  }

  _routeIncomingPayload(payload) {
    const list = normalizePayload(payload);
    for (const message of list) {
      if (!message || typeof message !== "object") continue;

      if (this.sse) {
        this._sendSseEvent("message", message);
      }

      if (message.id === undefined) continue;
      const key = idKey(message.id);
      const queue = this.pending.get(key);
      if (queue && queue.length > 0) {
        const deferred = queue.shift();
        deferred.resolve(message);
        if (queue.length === 0) this.pending.delete(key);
      } else {
        const buffered = this.bufferedById.get(key) || [];
        buffered.push(message);
        this.bufferedById.set(key, buffered);
      }
    }
  }

  _sendSseEvent(name, payload) {
    if (!this.sse) return;
    try {
      this.sse.write(`event: ${name}\n`);
      this.sse.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      log("warn", "Failed to write SSE event", {
        session: this.id,
        backend: this.backend,
        error: err.message,
      });
    }
  }

  attachSse(res, endpointUrl) {
    this.sse = res;
    try {
      this.sse.write("event: endpoint\n");
      this.sse.write(`data: ${endpointUrl}\n\n`);
    } catch (err) {
      log("warn", "Failed to write endpoint event", {
        session: this.id,
        backend: this.backend,
        error: err.message,
      });
    }

    for (const [, messages] of this.bufferedById.entries()) {
      for (const message of messages) {
        this._sendSseEvent("message", message);
      }
    }
  }

  detachSse() {
    this.sse = null;
  }

  _takeBufferedResponse(id) {
    const key = idKey(id);
    const queue = this.bufferedById.get(key);
    if (!queue || queue.length === 0) return null;
    const value = queue.shift();
    if (queue.length === 0) this.bufferedById.delete(key);
    return value;
  }

  _awaitResponse(id, timeoutMs) {
    const buffered = this._takeBufferedResponse(id);
    if (buffered) return Promise.resolve(buffered);

    const key = idKey(id);
    const deferred = new Deferred();
    const queue = this.pending.get(key) || [];
    queue.push(deferred);
    this.pending.set(key, queue);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const current = this.pending.get(key) || [];
        const next = current.filter((entry) => entry !== deferred);
        if (next.length === 0) this.pending.delete(key);
        else this.pending.set(key, next);
        reject(new Error(`Timed out waiting for JSON-RPC response id=${String(id)}`));
      }, timeoutMs);

      deferred.promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  _rejectAll(error) {
    for (const [, queue] of this.pending.entries()) {
      for (const deferred of queue) deferred.reject(error);
    }
    this.pending.clear();
  }

  async handlePost(payload) {
    if (this.closed) throw new Error("Session is closed");
    this.lastUsedAt = Date.now();

    const list = normalizePayload(payload);
    const requestIds = [];
    for (const msg of list) {
      if (msg && typeof msg === "object" && msg.id !== undefined && typeof msg.method === "string") {
        requestIds.push(msg.id);
      }
    }

    const line = `${JSON.stringify(payload)}\n`;
    await new Promise((resolve, reject) => {
      this.child.stdin.write(line, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (requestIds.length === 0) return null;
    const responses = [];
    for (const id of requestIds) {
      responses.push(await this._awaitResponse(id, 120000));
    }
    return responses.length === 1 ? responses[0] : responses;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.detachSse();
    this._rejectAll(new Error("Session closed"));
    try {
      this.child.kill("SIGTERM");
    } catch {
      // no-op
    }
  }
}

const sessions = new Map();

function createSession(backend) {
  const id = crypto.randomUUID();
  const session = new BackendSession(id, backend);
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id) || null;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastUsedAt > IDLE_TIMEOUT_MS) {
      log("info", "Closing idle backend session", {
        session: id,
        backend: session.backend,
      });
      session.close();
      sessions.delete(id);
    }
  }
}

setInterval(cleanupExpired, 60_000).unref();

function sessionsByBackend() {
  const counts = {
    claude: 0,
    codex: 0,
  };
  for (const session of sessions.values()) {
    if (session.backend === "claude") counts.claude += 1;
    if (session.backend === "codex") counts.codex += 1;
  }
  return counts;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

function ensureBackendAllowed(backend) {
  if (!["claude", "codex"].includes(backend)) {
    return {
      ok: false,
      error: `Unsupported backend \"${backend}\". Allowed: claude, codex`,
    };
  }
  if (backend === "claude" && !CLAUDE_ENABLED) {
    return {
      ok: false,
      error: "Backend claude is disabled",
    };
  }
  if (backend === "codex" && !CODEX_REMOTE_ENABLED) {
    return {
      ok: false,
      error: "Backend codex is disabled",
    };
  }
  return { ok: true };
}

function startFromEnv() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/health") {
        const availability = await getBackendAvailability();
        return sendJson(res, 200, {
          status: "ok",
          sessions: sessions.size,
          sessionsByBackend: sessionsByBackend(),
          defaultBackend: DEFAULT_BACKEND,
          backends: availability,
          config: {
            host: HOST,
            port: PORT,
            idleTimeoutMs: IDLE_TIMEOUT_MS,
          },
        });
      }

      if (req.method === "GET" && url.pathname === "/sse") {
        const selection = backendSelectionFromRequest(req, url);
        const allowed = ensureBackendAllowed(selection.backend);
        if (!allowed.ok) {
          return sendJson(res, 400, {
            error: allowed.error,
            backend: selection.backend,
            source: selection.source,
          });
        }

        let session;
        try {
          session = createSession(selection.backend);
        } catch (err) {
          return sendJson(res, 503, {
            error: "Failed to start backend session",
            backend: selection.backend,
            details: err.message,
          });
        }

        const endpoint = `/messages?sessionId=${encodeURIComponent(session.id)}&backend=${encodeURIComponent(
          selection.backend
        )}`;

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        session.attachSse(res, endpoint);

        req.on("close", () => {
          const current = getSession(session.id);
          if (!current) return;
          current.detachSse();
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/messages") {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) {
          return sendJson(res, 400, { error: "Missing sessionId query parameter" });
        }

        const session = getSession(sessionId);
        if (!session) {
          return sendJson(res, 404, { error: "Session not found" });
        }

        const selection = backendSelectionFromRequest(req, url);
        if (selection.source !== "default" && selection.backend !== session.backend) {
          return sendJson(res, 409, {
            error: "Backend mismatch for session",
            expectedBackend: session.backend,
            requestedBackend: selection.backend,
            source: selection.source,
          });
        }

        const payload = await readJson(req);
        await session.handlePost(payload);
        res.writeHead(202).end();
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      log("error", "Wrapper request failed", { error: err.message });
      sendJson(res, 500, { error: err.message });
    }
  });

  server.listen(PORT, HOST, () => {
    log("info", "Multi-backend legacy wrapper started", {
      host: HOST,
      port: PORT,
      defaultBackend: DEFAULT_BACKEND,
      claudeEnabled: CLAUDE_ENABLED,
      codexRemoteEnabled: CODEX_REMOTE_ENABLED,
      codexSshTarget: CODEX_SSH_TARGET,
    });
  });

  const shutdown = (signal) => {
    log("info", `Received ${signal}, shutting down...`);
    for (const [, session] of sessions.entries()) {
      session.close();
    }
    sessions.clear();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

if (require.main === module) {
  startFromEnv();
}

module.exports = {
  startFromEnv,
  backendSelectionFromRequest,
  normalizeBackendName,
};
