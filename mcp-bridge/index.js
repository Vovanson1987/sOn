"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const DEFAULTS = {
  host: "0.0.0.0",
  port: 4100,
  mcpPath: "/mcp",
  healthPath: "/health",
  defaultAgentBackend: "claude",
  requestTimeoutMs: 120000,
  maxBodyBytes: 1024 * 1024,
  sessionTtlMs: 30 * 60 * 1000,
  sessionCleanupIntervalMs: 60 * 1000,
  connectTimeoutMs: 15000,
  upstreamTransport: "legacy-sse",
  upstreamSseUrl: "",
  upstreamHttpUrl: "",
  upstreamAuthBearer: "",
  upstreamHeadersJson: "",
  authToken: "",
  allowedOrigins: "",
  strictOriginCheck: "false",
  insecureTls: "false",
  logLevel: "info",
};

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

class UpstreamHttpError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "UpstreamHttpError";
    this.status = status;
    this.body = body;
  }
}

class SessionNotFoundError extends Error {
  constructor(sessionId) {
    super(`Session "${sessionId}" not found`);
    this.name = "SessionNotFoundError";
  }
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

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeOriginList(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function nowIso() {
  return new Date().toISOString();
}

function createLogger(levelName) {
  const level = LOG_LEVELS[levelName] ?? LOG_LEVELS.info;
  return (msgLevel, message, meta = undefined) => {
    const msgValue = LOG_LEVELS[msgLevel] ?? LOG_LEVELS.info;
    if (msgValue > level) return;
    const parts = [`[${nowIso()}]`, msgLevel.toUpperCase(), message];
    if (meta !== undefined) {
      parts.push(typeof meta === "string" ? meta : JSON.stringify(meta));
    }
    // eslint-disable-next-line no-console
    console.log(parts.join(" "));
  };
}

function parseHeadersJson(raw, log) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    log("warn", "UPSTREAM_HEADERS_JSON ignored: expected JSON object");
    return {};
  } catch (err) {
    log("warn", "UPSTREAM_HEADERS_JSON ignored: invalid JSON", { error: err.message });
    return {};
  }
}

function readConfig(env = process.env) {
  const config = {
    host: env.BRIDGE_HOST || DEFAULTS.host,
    port: toInt(env.PORT || env.BRIDGE_PORT, DEFAULTS.port),
    mcpPath: env.MCP_PATH || DEFAULTS.mcpPath,
    healthPath: env.HEALTH_PATH || DEFAULTS.healthPath,
    defaultAgentBackend: (env.MCP_BACKEND_DEFAULT || DEFAULTS.defaultAgentBackend).toLowerCase().trim(),
    requestTimeoutMs: toInt(env.REQUEST_TIMEOUT_MS, DEFAULTS.requestTimeoutMs),
    maxBodyBytes: toInt(env.MAX_BODY_BYTES, DEFAULTS.maxBodyBytes),
    sessionTtlMs: toInt(env.SESSION_TTL_MS, DEFAULTS.sessionTtlMs),
    sessionCleanupIntervalMs: toInt(env.SESSION_CLEANUP_INTERVAL_MS, DEFAULTS.sessionCleanupIntervalMs),
    connectTimeoutMs: toInt(env.CONNECT_TIMEOUT_MS, DEFAULTS.connectTimeoutMs),
    upstreamTransport: (env.UPSTREAM_TRANSPORT || DEFAULTS.upstreamTransport).toLowerCase(),
    upstreamSseUrl: env.UPSTREAM_SSE_URL || DEFAULTS.upstreamSseUrl,
    upstreamHttpUrl: env.UPSTREAM_HTTP_URL || DEFAULTS.upstreamHttpUrl,
    upstreamAuthBearer: env.UPSTREAM_AUTH_BEARER || DEFAULTS.upstreamAuthBearer,
    upstreamHeadersJson: env.UPSTREAM_HEADERS_JSON || DEFAULTS.upstreamHeadersJson,
    authToken: env.BRIDGE_AUTH_TOKEN || DEFAULTS.authToken,
    allowedOrigins: normalizeOriginList(env.ALLOWED_ORIGINS || DEFAULTS.allowedOrigins),
    strictOriginCheck: toBool(env.STRICT_ORIGIN_CHECK || DEFAULTS.strictOriginCheck, false),
    insecureTls: toBool(env.UPSTREAM_INSECURE_TLS || DEFAULTS.insecureTls, false),
    logLevel: (env.LOG_LEVEL || DEFAULTS.logLevel).toLowerCase(),
  };

  if (!config.mcpPath.startsWith("/")) config.mcpPath = `/${config.mcpPath}`;
  if (!config.healthPath.startsWith("/")) config.healthPath = `/${config.healthPath}`;
  return config;
}

function matchOriginPattern(origin, pattern) {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return origin === pattern;

  // Simple wildcard matcher: "https://*.example.com"
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`, "i");
  return regex.test(origin);
}

function verifyOrigin(req, config) {
  const origin = req.headers.origin;
  if (!origin) {
    return !config.strictOriginCheck;
  }
  if (config.allowedOrigins.length === 0) return !config.strictOriginCheck;
  return config.allowedOrigins.some((pattern) => matchOriginPattern(origin, pattern));
}

function verifyAuth(req, config) {
  if (!config.authToken) return true;
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 && token === config.authToken;
}

function jsonRpcError(id, code, message, data = undefined) {
  const payload = {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
    },
  };
  if (data !== undefined) payload.error.data = data;
  return payload;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeIncomingPayload(payload) {
  if (Array.isArray(payload)) return payload;
  return [payload];
}

function isJsonRpcRequest(message) {
  return isObject(message) && typeof message.method === "string";
}

function isInitializeRequest(message) {
  return isJsonRpcRequest(message) && message.method === "initialize" && message.id !== undefined;
}

function requestIdsFromPayload(payload) {
  const list = normalizeIncomingPayload(payload);
  const ids = [];
  for (const message of list) {
    if (isJsonRpcRequest(message) && message.id !== undefined) {
      ids.push(message.id);
    }
  }
  return ids;
}

function sessionHeaderFromReq(req) {
  const raw = req.headers["mcp-session-id"];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function agentBackendHeaderFromReq(req) {
  const raw = req.headers["x-agent-backend"];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function normalizeAgentBackendName(raw) {
  const value = String(raw || "").trim().toLowerCase();
  return value || null;
}

function selectAgentBackend(req, url, defaultBackend) {
  const fromHeader = normalizeAgentBackendName(agentBackendHeaderFromReq(req));
  if (fromHeader) {
    return {
      backend: fromHeader,
      source: "header",
    };
  }

  const fromQuery = normalizeAgentBackendName(url.searchParams.get("backend"));
  if (fromQuery) {
    return {
      backend: fromQuery,
      source: "query",
    };
  }

  return {
    backend: normalizeAgentBackendName(defaultBackend) || DEFAULTS.defaultAgentBackend,
    source: "default",
  };
}

function withTimeout(promise, timeoutMs, onTimeout = undefined) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (typeof onTimeout === "function") {
        try {
          onTimeout();
        } catch {
          // no-op
        }
      }
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function readJsonBody(req, maxBytes) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error(`Request body exceeds ${maxBytes} bytes`);
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) throw new Error("Empty body");
  return JSON.parse(raw);
}

function writeJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function writeNoContent(res, statusCode, extraHeaders = {}) {
  res.writeHead(statusCode, extraHeaders);
  res.end();
}

function idKey(id) {
  return JSON.stringify(id);
}

function extractMessagesFromJsonRpc(payload) {
  if (Array.isArray(payload)) return payload;
  return [payload];
}

function resolveUrl(base, maybeRelative) {
  return new URL(maybeRelative, base).toString();
}

function createFetchOptionsHeaders(config, extra = {}, agentBackend = null) {
  const headers = {
    ...config.upstreamHeaders,
    ...extra,
  };
  if (config.upstreamAuthBearer) {
    headers.Authorization = `Bearer ${config.upstreamAuthBearer}`;
  }
  if (agentBackend) {
    headers["X-Agent-Backend"] = agentBackend;
  }
  return headers;
}

function withBackendQuery(url, agentBackend) {
  if (!agentBackend) return url;
  const parsed = new URL(url);
  if (!parsed.searchParams.has("backend")) {
    parsed.searchParams.set("backend", agentBackend);
  }
  return parsed.toString();
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function tryParseJsonOrText(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function parseSseForResponses(stream, expectedIds, timeoutMs) {
  if (!stream) {
    throw new Error("SSE response has no body");
  }
  const expectedOrder = [...expectedIds];
  const remaining = new Set(expectedOrder.map((id) => idKey(id)));
  const collected = new Map();

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";
  let dataLines = [];

  const processRpcPayload = (payload) => {
    const messages = extractMessagesFromJsonRpc(payload);
    for (const message of messages) {
      if (!isObject(message) || message.id === undefined) continue;
      const key = idKey(message.id);
      if (!remaining.has(key)) continue;
      if (!collected.has(key)) {
        collected.set(key, message);
        remaining.delete(key);
      }
    }
  };

  const flushEvent = () => {
    const data = dataLines.join("\n");
    dataLines = [];
    currentEvent = "message";
    if (!data) return;
    try {
      processRpcPayload(JSON.parse(data));
    } catch {
      // Non-JSON event payload is ignored.
    }
  };

  const readLoop = async () => {
    while (remaining.size > 0) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let lineEnd = buffer.indexOf("\n");
      while (lineEnd !== -1) {
        let line = buffer.slice(0, lineEnd);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        buffer = buffer.slice(lineEnd + 1);
        lineEnd = buffer.indexOf("\n");

        if (line === "") {
          flushEvent();
          continue;
        }
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) {
          currentEvent = line.slice("event:".length).trim() || "message";
          continue;
        }
        if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trimStart());
          continue;
        }
        if (line.startsWith("id:")) {
          continue;
        }
        if (currentEvent && line.trim().length > 0) {
          continue;
        }
      }
    }
    if (dataLines.length > 0) flushEvent();
  };

  await withTimeout(readLoop(), timeoutMs, async () => {
    try {
      await reader.cancel();
    } catch {
      // no-op
    }
  });

  if (remaining.size > 0) {
    throw new Error("SSE stream ended before all JSON-RPC responses were received");
  }
  try {
    await reader.cancel();
  } catch {
    // no-op
  }

  const ordered = expectedOrder.map((id) => collected.get(idKey(id)));
  return ordered.length === 1 ? ordered[0] : ordered;
}

class StreamableHttpUpstream {
  constructor(config, log, options = {}) {
    this.config = config;
    this.log = log;
    this.upstreamSessionId = null;
    this.agentBackend = normalizeAgentBackendName(options.agentBackend);
  }

  async send(payload, requestIds, timeoutMs) {
    const headers = createFetchOptionsHeaders(this.config, {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    }, this.agentBackend);
    if (this.upstreamSessionId) {
      headers["Mcp-Session-Id"] = this.upstreamSessionId;
    }

    const upstreamHttpUrl = withBackendQuery(this.config.upstreamHttpUrl, this.agentBackend);

    const response = await fetchWithTimeout(
      upstreamHttpUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
      timeoutMs
    );

    const responseSession = response.headers.get("mcp-session-id");
    if (responseSession) {
      this.upstreamSessionId = responseSession;
    }

    if (!response.ok) {
      const body = await tryParseJsonOrText(response);
      throw new UpstreamHttpError("Upstream HTTP request failed", response.status, body);
    }

    if (requestIds.length === 0) {
      return { statusCode: 202, body: null };
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const body = await response.json();
      return { statusCode: 200, body };
    }
    if (contentType.includes("text/event-stream")) {
      const body = await parseSseForResponses(response.body, requestIds, timeoutMs);
      return { statusCode: 200, body };
    }

    const fallbackBody = await tryParseJsonOrText(response);
    return { statusCode: 200, body: fallbackBody };
  }

  async close() {
    if (!this.upstreamSessionId) return;
    const headers = createFetchOptionsHeaders(this.config, {}, this.agentBackend);
    headers["Mcp-Session-Id"] = this.upstreamSessionId;
    const upstreamHttpUrl = withBackendQuery(this.config.upstreamHttpUrl, this.agentBackend);
    try {
      await fetchWithTimeout(
        upstreamHttpUrl,
        {
          method: "DELETE",
          headers,
        },
        Math.min(this.config.requestTimeoutMs, 10000)
      );
    } catch {
      // no-op, session cleanup is best-effort.
    }
  }
}

class LegacySseUpstream {
  constructor(config, log, options = {}) {
    this.config = config;
    this.log = log;
    this.agentBackend = normalizeAgentBackendName(options.agentBackend);
    this.closed = false;
    this.connectPromise = null;
    this.reader = null;
    this.connectedSseUrl = null;
    this.endpointReady = null;
    this.postEndpoint = null;
    this.pending = new Map();
    this.bufferedResponses = new Map();
    this.sseReadLoopPromise = null;
  }

  async ensureConnected() {
    if (this.closed) {
      throw new Error("Legacy SSE upstream is closed");
    }
    if (this.postEndpoint && this.reader) return;
    if (this.connectPromise) {
      await this.connectPromise;
      return;
    }

    this.endpointReady = new Deferred();
    this.connectPromise = this._connect().finally(() => {
      this.connectPromise = null;
    });
    await this.connectPromise;
  }

  async _connect() {
    const headers = createFetchOptionsHeaders(this.config, {
      Accept: "text/event-stream",
    }, this.agentBackend);
    const upstreamSseUrl = withBackendQuery(this.config.upstreamSseUrl, this.agentBackend);
    this.connectedSseUrl = upstreamSseUrl;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.connectTimeoutMs);
    let response;
    try {
      response = await fetch(upstreamSseUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await tryParseJsonOrText(response);
      throw new UpstreamHttpError("Failed to establish upstream SSE connection", response.status, body);
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/event-stream")) {
      throw new Error(`Expected text/event-stream, got "${contentType || "unknown"}"`);
    }
    if (!response.body) {
      throw new Error("Upstream SSE stream has no body");
    }

    this.reader = response.body.getReader();
    this.sseReadLoopPromise = this._readSseLoop().catch((err) => {
      this.log("warn", "Upstream SSE stream ended with error", { error: err.message });
      this._rejectAllPending(err);
    });

    await withTimeout(
      this.endpointReady.promise,
      this.config.connectTimeoutMs,
      () => this._shutdownStream(new Error("Timed out waiting for endpoint event"))
    );
  }

  async _readSseLoop() {
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "message";
    let dataLines = [];

    const flushEvent = () => {
      const eventName = currentEvent || "message";
      const payloadRaw = dataLines.join("\n");
      currentEvent = "message";
      dataLines = [];
      if (!payloadRaw) return;

      if (eventName === "endpoint") {
        try {
          this.postEndpoint = resolveUrl(this.connectedSseUrl || this.config.upstreamSseUrl, payloadRaw.trim());
          this.postEndpoint = withBackendQuery(this.postEndpoint, this.agentBackend);
          this.endpointReady.resolve(this.postEndpoint);
          this.log("debug", "Received upstream endpoint", { postEndpoint: this.postEndpoint });
        } catch (err) {
          this.endpointReady.reject(err);
        }
        return;
      }

      try {
        const payload = JSON.parse(payloadRaw);
        this._handleIncomingPayload(payload);
      } catch {
        this.log("debug", "Ignoring non-JSON SSE event", { eventName });
      }
    };

    while (!this.closed) {
      const { done, value } = await this.reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let lineEnd = buffer.indexOf("\n");

      while (lineEnd !== -1) {
        let line = buffer.slice(0, lineEnd);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        buffer = buffer.slice(lineEnd + 1);
        lineEnd = buffer.indexOf("\n");

        if (line === "") {
          flushEvent();
          continue;
        }
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) {
          currentEvent = line.slice("event:".length).trim() || "message";
          continue;
        }
        if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trimStart());
          continue;
        }
      }
    }

    if (dataLines.length > 0) flushEvent();
    if (!this.closed) {
      this.reader = null;
      this.connectedSseUrl = null;
      this.postEndpoint = null;
      const err = new Error("Upstream SSE connection closed");
      this._rejectAllPending(err);
      this.endpointReady.reject(err);
    }
  }

  _handleIncomingPayload(payload) {
    const messages = extractMessagesFromJsonRpc(payload);
    for (const message of messages) {
      if (!isObject(message) || message.id === undefined) continue;
      const key = idKey(message.id);
      const queue = this.pending.get(key);
      if (queue && queue.length > 0) {
        const deferred = queue.shift();
        deferred.resolve(message);
        if (queue.length === 0) this.pending.delete(key);
        continue;
      }
      const buffered = this.bufferedResponses.get(key) || [];
      buffered.push(message);
      this.bufferedResponses.set(key, buffered);
    }
  }

  _dequeueBuffered(id) {
    const key = idKey(id);
    const buffered = this.bufferedResponses.get(key);
    if (!buffered || buffered.length === 0) return null;
    const value = buffered.shift();
    if (buffered.length === 0) this.bufferedResponses.delete(key);
    return value;
  }

  _awaitResponse(id, timeoutMs) {
    const cached = this._dequeueBuffered(id);
    if (cached) return Promise.resolve(cached);

    const key = idKey(id);
    const deferred = new Deferred();
    const queue = this.pending.get(key) || [];
    queue.push(deferred);
    this.pending.set(key, queue);

    return withTimeout(deferred.promise, timeoutMs, () => {
      const currentQueue = this.pending.get(key);
      if (!currentQueue) return;
      const nextQueue = currentQueue.filter((entry) => entry !== deferred);
      if (nextQueue.length === 0) this.pending.delete(key);
      else this.pending.set(key, nextQueue);
    });
  }

  _rejectAllPending(error) {
    for (const [, queue] of this.pending.entries()) {
      for (const deferred of queue) deferred.reject(error);
    }
    this.pending.clear();
  }

  async _shutdownStream(error = null, permanent = false) {
    if (permanent) this.closed = true;
    if (this.reader) {
      try {
        await this.reader.cancel(error || undefined);
      } catch {
        // no-op
      }
      this.reader = null;
    }
    this.connectedSseUrl = null;
    this.postEndpoint = null;
  }

  async send(payload, requestIds, timeoutMs) {
    await this.ensureConnected();
    if (!this.postEndpoint) {
      throw new Error("Legacy SSE upstream did not provide POST endpoint");
    }

    const headers = createFetchOptionsHeaders(this.config, {
      "Content-Type": "application/json",
      Accept: "application/json",
    }, this.agentBackend);
    const postEndpoint = withBackendQuery(this.postEndpoint, this.agentBackend);
    const postResponse = await fetchWithTimeout(
      postEndpoint,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
      timeoutMs
    );

    if (!postResponse.ok) {
      const body = await tryParseJsonOrText(postResponse);
      throw new UpstreamHttpError("Failed to POST JSON-RPC payload to legacy upstream endpoint", postResponse.status, body);
    }

    if (requestIds.length === 0) {
      return { statusCode: 202, body: null };
    }

    const responses = [];
    for (const requestId of requestIds) {
      const response = await this._awaitResponse(requestId, timeoutMs);
      responses.push(response);
    }

    return {
      statusCode: 200,
      body: responses.length === 1 ? responses[0] : responses,
    };
  }

  async close() {
    this._rejectAllPending(new Error("Legacy SSE upstream session closed"));
    await this._shutdownStream(null, true);
  }
}

class BridgeSession {
  constructor(id, config, log, options = {}) {
    this.id = id;
    this.config = config;
    this.log = log;
    this.agentBackend = normalizeAgentBackendName(options.agentBackend);
    this.agentBackendSource = options.agentBackendSource || "default";
    this.lastUsedAt = Date.now();
    this.upstream = config.upstreamTransport === "streamable-http"
      ? new StreamableHttpUpstream(config, log, { agentBackend: this.agentBackend })
      : new LegacySseUpstream(config, log, { agentBackend: this.agentBackend });
  }

  touch() {
    this.lastUsedAt = Date.now();
  }

  async send(payload, requestIds, timeoutMs) {
    this.touch();
    return this.upstream.send(payload, requestIds, timeoutMs);
  }

  async close() {
    if (this.upstream && typeof this.upstream.close === "function") {
      await this.upstream.close();
    }
  }
}

class SessionStore {
  constructor(config, log) {
    this.config = config;
    this.log = log;
    this.sessions = new Map();
  }

  createSession(options = {}) {
    const id = crypto.randomUUID();
    const session = new BridgeSession(id, this.config, this.log, options);
    this.sessions.set(id, session);
    return session;
  }

  getSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new SessionNotFoundError(id);
    session.touch();
    return session;
  }

  async deleteSession(id) {
    const session = this.sessions.get(id);
    if (!session) return false;
    this.sessions.delete(id);
    await session.close();
    return true;
  }

  async cleanupExpired() {
    const now = Date.now();
    const toDelete = [];
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastUsedAt > this.config.sessionTtlMs) {
        toDelete.push(id);
      }
    }
    if (toDelete.length === 0) return 0;
    for (const id of toDelete) {
      await this.deleteSession(id);
    }
    this.log("info", "Expired MCP bridge sessions cleaned", {
      deleted: toDelete.length,
      remaining: this.sessions.size,
    });
    return toDelete.length;
  }

  count() {
    return this.sessions.size;
  }

  countByBackend() {
    const counters = {};
    for (const session of this.sessions.values()) {
      const key = session.agentBackend || "unspecified";
      counters[key] = (counters[key] || 0) + 1;
    }
    return counters;
  }
}

function requiresSession(payloadItems) {
  return !payloadItems.some((message) => isInitializeRequest(message));
}

function ensurePayloadIsValid(payload) {
  if (Array.isArray(payload)) {
    if (payload.length === 0) throw new Error("JSON-RPC batch cannot be empty");
    for (const item of payload) {
      if (!isObject(item)) throw new Error("JSON-RPC batch entries must be objects");
    }
    return;
  }
  if (!isObject(payload)) {
    throw new Error("JSON-RPC payload must be an object or array");
  }
}

function buildBridge(config, log = createLogger(config.logLevel)) {
  const upstreamHeaders = parseHeadersJson(config.upstreamHeadersJson, log);
  const runtimeConfig = {
    ...config,
    upstreamHeaders,
    defaultAgentBackend: normalizeAgentBackendName(config.defaultAgentBackend) || DEFAULTS.defaultAgentBackend,
  };

  if (runtimeConfig.insecureTls) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    log("warn", "UPSTREAM_INSECURE_TLS is enabled. TLS certificates will not be validated.");
  }

  if (!runtimeConfig.authToken) {
    log("warn", "BRIDGE_AUTH_TOKEN is empty. Bridge endpoint is unauthenticated.");
  }
  if (runtimeConfig.allowedOrigins.length === 0 && !runtimeConfig.strictOriginCheck) {
    log("warn", "ALLOWED_ORIGINS is empty and STRICT_ORIGIN_CHECK=false. Origin checks are effectively disabled.");
  }

  if (runtimeConfig.upstreamTransport === "legacy-sse" && !runtimeConfig.upstreamSseUrl) {
    throw new Error("UPSTREAM_SSE_URL is required when UPSTREAM_TRANSPORT=legacy-sse");
  }
  if (runtimeConfig.upstreamTransport === "streamable-http" && !runtimeConfig.upstreamHttpUrl) {
    throw new Error("UPSTREAM_HTTP_URL is required when UPSTREAM_TRANSPORT=streamable-http");
  }
  if (!["legacy-sse", "streamable-http"].includes(runtimeConfig.upstreamTransport)) {
    throw new Error('UPSTREAM_TRANSPORT must be either "legacy-sse" or "streamable-http"');
  }

  const sessions = new SessionStore(runtimeConfig, log);
  const cleanupTimer = setInterval(() => {
    sessions.cleanupExpired().catch((err) => {
      log("warn", "Session cleanup failed", { error: err.message });
    });
  }, runtimeConfig.sessionCleanupIntervalMs);
  cleanupTimer.unref();

  const requestHandler = async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname === runtimeConfig.healthPath && req.method === "GET") {
      writeJson(res, 200, {
        status: "ok",
        uptimeSec: Math.floor(process.uptime()),
        sessions: sessions.count(),
        sessionsByBackend: sessions.countByBackend(),
        transport: runtimeConfig.upstreamTransport,
        defaultAgentBackend: runtimeConfig.defaultAgentBackend,
      });
      return;
    }

    if (url.pathname !== runtimeConfig.mcpPath) {
      writeJson(res, 404, {
        error: "Not Found",
      });
      return;
    }

    if (!verifyAuth(req, runtimeConfig)) {
      writeJson(res, 401, { error: "Unauthorized" }, { "WWW-Authenticate": "Bearer" });
      return;
    }

    if (!verifyOrigin(req, runtimeConfig)) {
      writeJson(res, 403, { error: "Origin not allowed" });
      return;
    }

    if (req.method === "GET") {
      writeJson(res, 405, {
        error: "GET is not supported by this bridge",
        details: "Use HTTP POST for JSON-RPC messages.",
      }, {
        Allow: "POST, DELETE",
      });
      return;
    }

    if (req.method === "DELETE") {
      const sessionId = sessionHeaderFromReq(req);
      if (!sessionId) {
        writeJson(res, 400, { error: "Missing Mcp-Session-Id header" });
        return;
      }
      const deleted = await sessions.deleteSession(sessionId);
      if (!deleted) {
        writeJson(res, 404, { error: "Session not found" });
        return;
      }
      writeNoContent(res, 204);
      return;
    }

    if (req.method !== "POST") {
      writeJson(res, 405, {
        error: `Method ${req.method} not allowed`,
      }, {
        Allow: "POST, DELETE",
      });
      return;
    }

    let payload;
    try {
      payload = await readJsonBody(req, runtimeConfig.maxBodyBytes);
      ensurePayloadIsValid(payload);
    } catch (err) {
      writeJson(res, 400, { error: "Invalid JSON payload", details: err.message });
      return;
    }

    const messages = normalizeIncomingPayload(payload);
    const requestIds = requestIdsFromPayload(payload);
    const hasRequests = requestIds.length > 0;
    const mcpHeaders = {};
    const requestedBackend = selectAgentBackend(req, url, runtimeConfig.defaultAgentBackend);

    let sessionId = sessionHeaderFromReq(req);
    let session = null;
    let createdSession = false;
    const needsExistingSession = requiresSession(messages);

    try {
      if (!sessionId) {
        if (needsExistingSession) {
          writeJson(res, 400, {
            error: "Missing Mcp-Session-Id header",
            details: "Session must be initialized by sending initialize request first.",
          });
          return;
        }
        session = sessions.createSession({
          agentBackend: requestedBackend.backend,
          agentBackendSource: requestedBackend.source,
        });
        sessionId = session.id;
        createdSession = true;
      } else {
        session = sessions.getSession(sessionId);
        if (
          requestedBackend.source !== "default" &&
          session.agentBackend &&
          session.agentBackend !== requestedBackend.backend
        ) {
          if (hasRequests) {
            const mismatch = requestIds.map((requestId) =>
              jsonRpcError(requestId, -32012, "Backend mismatch for existing session", {
                expectedBackend: session.agentBackend,
                requestedBackend: requestedBackend.backend,
                source: requestedBackend.source,
              })
            );
            writeJson(res, 200, mismatch.length === 1 ? mismatch[0] : mismatch);
            return;
          }
          writeJson(res, 409, {
            error: "Backend mismatch for existing session",
            expectedBackend: session.agentBackend,
            requestedBackend: requestedBackend.backend,
            source: requestedBackend.source,
          });
          return;
        }
      }

      mcpHeaders["Mcp-Session-Id"] = sessionId;

      const upstreamResult = await session.send(payload, requestIds, runtimeConfig.requestTimeoutMs);

      if (!hasRequests) {
        writeNoContent(res, 202, mcpHeaders);
        return;
      }

      const body = upstreamResult.body;
      if (body === null || body === undefined) {
        const fallback = requestIds.map((requestId) =>
          jsonRpcError(requestId, -32004, "Bridge did not receive a response from upstream")
        );
        writeJson(res, 200, fallback.length === 1 ? fallback[0] : fallback, mcpHeaders);
        return;
      }

      writeJson(res, 200, body, mcpHeaders);
    } catch (err) {
      if (createdSession && sessionId) {
        try {
          await sessions.deleteSession(sessionId);
        } catch {
          // no-op
        }
      }

      const code = err instanceof SessionNotFoundError ? 404 : 502;
      if (err instanceof SessionNotFoundError) {
        writeJson(res, code, { error: err.message });
        return;
      }

      if (err instanceof UpstreamHttpError) {
        const rawBody = err.body;
        if (hasRequests) {
          const fallback = requestIds.map((requestId) =>
            jsonRpcError(requestId, -32010, "Upstream rejected request", {
              status: err.status,
              upstream: rawBody,
            })
          );
          writeJson(res, 200, fallback.length === 1 ? fallback[0] : fallback, mcpHeaders);
          return;
        }
        writeJson(res, err.status || 502, {
          error: "Upstream request failed",
          details: rawBody,
        }, mcpHeaders);
        return;
      }

      log("error", "Bridge request failed", { error: err.message });
      if (hasRequests) {
        const fallback = requestIds.map((requestId) =>
          jsonRpcError(requestId, -32011, "Bridge internal error", { message: err.message })
        );
        writeJson(res, 200, fallback.length === 1 ? fallback[0] : fallback, mcpHeaders);
        return;
      }
      writeJson(res, code, { error: "Bridge internal error", details: err.message }, mcpHeaders);
    }
  };

  const server = http.createServer((req, res) => {
    requestHandler(req, res).catch((err) => {
      log("error", "Unhandled request error", { error: err.message });
      writeJson(res, 500, { error: "Unhandled bridge error", details: err.message });
    });
  });

  return {
    server,
    sessions,
    close: async () => {
      clearInterval(cleanupTimer);
      const ids = Array.from(sessions.sessions.keys());
      for (const id of ids) {
        await sessions.deleteSession(id);
      }
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}

function startFromEnv() {
  const config = readConfig(process.env);
  const log = createLogger(config.logLevel);
  const bridge = buildBridge(config, log);

  bridge.server.listen(config.port, config.host, () => {
    log("info", "MCP bridge started", {
      host: config.host,
      port: config.port,
      mcpPath: config.mcpPath,
      healthPath: config.healthPath,
      defaultAgentBackend: config.defaultAgentBackend,
      upstreamTransport: config.upstreamTransport,
      upstreamSseUrl: config.upstreamSseUrl || undefined,
      upstreamHttpUrl: config.upstreamHttpUrl || undefined,
    });
  });

  const shutdown = async (signal) => {
    log("info", `Received ${signal}. Shutting down bridge...`);
    try {
      await bridge.close();
    } catch (err) {
      log("error", "Error during shutdown", { error: err.message });
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

if (require.main === module) {
  startFromEnv();
}

module.exports = {
  buildBridge,
  readConfig,
  startFromEnv,
  jsonRpcError,
  requestIdsFromPayload,
  verifyOrigin,
  verifyAuth,
};
