/**
 * OpenClaw Connection Manager
 *
 * Direct WebSocket connection to OpenClaw gateway using protocol v3.
 * No SDK dependency — implements the JSON-over-WebSocket RPC protocol directly.
 *
 * Protocol frames:
 * - REQ: { type: "req", id, method, params? }     client → gateway
 * - RES: { type: "res", id, ok, payload?, error? } gateway → client
 * - EVENT: { type: "event", event, payload?, seq? } gateway → client
 *
 * Features:
 * - Exponential backoff reconnection (1s → 30s, max 10 attempts)
 * - Tick heartbeat monitoring (close + reconnect if 2x tickInterval passes)
 * - Sequence gap detection with warnings
 * - expectFinal support for chat.send (wait past "accepted" response)
 * - URL normalization (http/https → ws/wss)
 */

import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type { OpenClawGatewayConfig } from "./types";
import {
  loadOrCreateDeviceIdentity,
  signDevicePayload,
  publicKeyToBase64Url,
  buildDeviceAuthPayload,
} from "./device-identity";
import { loadDeviceAuthToken, storeDeviceAuthToken, clearDeviceAuthToken } from "./device-auth-store";

const PROTOCOL_VERSION = 3;
const CHALLENGE_TIMEOUT_MS = 750;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024;

// Reconnection constants
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;

// ============================================================================
// Protocol Frame Types
// ============================================================================

interface ReqFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

interface ResFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code?: string; message: string; details?: unknown; retryable?: boolean };
}

interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: unknown;
}

type GatewayFrame = ResFrame | EventFrame;

// ============================================================================
// Connect Params
// ============================================================================

interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName: string;
    version: string;
    platform: string;
    mode: string;
    instanceId?: string;
  };
  caps: string[];
  role: string;
  scopes: string[];
  auth?: {
    token?: string;
    password?: string;
  };
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce?: string;
  };
}

// ============================================================================
// Pending Request
// ============================================================================

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  expectFinal: boolean;
}

// ============================================================================
// URL Normalization
// ============================================================================

/**
 * Ensure the URL uses a WebSocket protocol scheme.
 * - ws:// / wss:// -> kept as-is
 * - http:// -> replaced with ws://
 * - https:// -> replaced with wss://
 * - no protocol (e.g. "127.0.0.1:42617") -> prepend ws://
 */
function normalizeWsUrl(raw: string): string {
  if (/^wss?:\/\//i.test(raw)) return raw;
  if (/^https:\/\//i.test(raw)) return raw.replace(/^https:\/\//i, "wss://");
  if (/^http:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, "ws://");
  return `ws://${raw}`;
}

// ============================================================================
// OpenClawClient (replaces SDK's OpenClaw class)
// ============================================================================

export interface OpenClawSession {
  key: string;
  sessionId?: string;
}

export interface ChatSendResult {
  status: string;
}

export interface RequestOptions {
  /** If true, wait past the initial "accepted" response for the final response */
  expectFinal?: boolean;
  /** Override the default request timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Lightweight OpenClaw gateway client using raw WebSocket.
 *
 * Features:
 * - Exponential backoff reconnection
 * - Tick heartbeat monitoring
 * - Sequence gap detection
 * - expectFinal support for long-running requests
 */
export class OpenClawClient {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private eventListeners: Array<(frame: EventFrame) => void> = [];
  private connectionPromise: Promise<void> | null = null;
  private config: OpenClawGatewayConfig;

  // Reconnection state
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  // Tick heartbeat state
  private lastTick: number | null = null;
  private tickIntervalMs = 30_000;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  // Sequence gap tracking
  private lastSeq: number | null = null;

  // Handshake state
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private handshakeResolve: (() => void) | null = null;
  private handshakeReject: ((err: Error) => void) | null = null;

  constructor(config: OpenClawGatewayConfig) {
    this.config = config;
  }

  /**
   * Connect to the gateway and perform handshake
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.closed = false;
    this.connectionPromise = this._doConnect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _doConnect(): Promise<void> {
    const url = normalizeWsUrl(`${this.config.host}:${this.config.port}`);
    const ws = new WebSocket(url, {
      maxPayload: MAX_PAYLOAD_BYTES,
    });
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", (err) => reject(err));
    });

    // Set up message handling
    ws.on("message", (data) => {
      try {
        const raw = this._rawDataToString(data);
        const frame = JSON.parse(raw) as GatewayFrame;
        if (frame.type === "res") {
          this._handleResponse(frame);
        } else if (frame.type === "event") {
          this._handleEvent(frame);
        }
      } catch {
        // Ignore malformed frames
      }
    });

    // Set up close handler for reconnection
    ws.on("close", (code, reason) => {
      const reasonText = this._rawDataToString(reason);
      this.ws = null;
      this._stopTickWatch();

      // Flush all pending requests with error
      this._flushPendingErrors(new Error(`Gateway closed (${code}): ${reasonText}`));

      // Reject handshake if in progress
      if (this.handshakeReject) {
        this.handshakeReject(new Error(`Gateway closed during handshake (${code}): ${reasonText}`));
        this.handshakeResolve = null;
        this.handshakeReject = null;
      }

      // Schedule reconnect unless intentionally closed
      this._scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error("[OpenClawClient] WebSocket error:", err.message);
    });

    // Queue the connect handshake (wait for challenge or timeout)
    this.connectNonce = null;
    this.connectSent = false;

    await new Promise<void>((resolve, reject) => {
      this.handshakeResolve = resolve;
      this.handshakeReject = reject;

      // Wait for challenge event, then send connect; if no challenge, send after timeout
      if (this.connectTimer) clearTimeout(this.connectTimer);
      this.connectTimer = setTimeout(() => {
        this._sendConnect();
      }, CHALLENGE_TIMEOUT_MS);
    });
  }

  private _sendConnect(): void {
    if (this.connectSent) return;
    this.connectSent = true;

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const role = "operator";
    const scopes = ["operator.admin"];
    const clientId = "gateway-client";
    const clientMode = "backend";
    const signedAtMs = Date.now();
    const nonce = this.connectNonce ?? undefined;

    const params: ConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: clientId,
        displayName: "Viben",
        version: "1.0.0",
        platform: process.platform,
        mode: clientMode,
      },
      caps: ["tool-events"],
      role,
      scopes,
    };

    // Auth
    let authToken: string | undefined;
    if (this.config.auth.mode === "token" && this.config.auth.token) {
      authToken = this.config.auth.token;
    } else if (this.config.auth.mode === "password" && this.config.auth.password) {
      params.auth = { password: this.config.auth.password };
    }

    // Device identity
    try {
      const identity = loadOrCreateDeviceIdentity();

      // Try cached device token first
      const cachedEntry = loadDeviceAuthToken({ deviceId: identity.deviceId, role });
      const storedToken = cachedEntry?.token;
      const effectiveToken = storedToken ?? authToken;
      const canFallbackToShared = Boolean(storedToken && authToken);

      if (effectiveToken) {
        params.auth = { ...params.auth, token: effectiveToken };
      }

      const payload = buildDeviceAuthPayload({
        deviceId: identity.deviceId,
        clientId,
        clientMode,
        role,
        scopes,
        signedAtMs,
        token: effectiveToken ?? null,
        nonce: nonce ?? null,
      });

      const signature = signDevicePayload(identity.privateKeyPem, payload);
      const publicKey = publicKeyToBase64Url(identity.publicKeyPem);

      params.device = {
        id: identity.deviceId,
        publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      };

      // Perform handshake request
      this._sendRequest("connect", params, { expectFinal: false, timeoutMs: REQUEST_TIMEOUT_MS })
        .then((result) => {
          const helloOk = result as Record<string, unknown>;

          // Cache device token if provided
          if (helloOk?.auth && typeof helloOk.auth === "object") {
            const auth = helloOk.auth as { deviceToken?: string; role?: string; scopes?: string[] };
            if (auth.deviceToken && params.device) {
              storeDeviceAuthToken({
                deviceId: params.device.id,
                role: auth.role ?? role,
                token: auth.deviceToken,
                scopes: auth.scopes,
              });
            }
          }

          // Extract tick interval from policy if available
          const policy = helloOk?.policy as { tickIntervalMs?: number } | undefined;
          if (typeof policy?.tickIntervalMs === "number") {
            this.tickIntervalMs = policy.tickIntervalMs;
          }

          // Connection successful - reset reconnect state
          this.backoffMs = INITIAL_BACKOFF_MS;
          this.reconnectAttempts = 0;
          this.lastTick = Date.now();
          this._startTickWatch();

          // Resolve the handshake promise
          if (this.handshakeResolve) {
            this.handshakeResolve();
            this.handshakeResolve = null;
            this.handshakeReject = null;
          }
        })
        .catch((err) => {
          // Clear stored token if it was invalid and we can fall back
          if (canFallbackToShared) {
            clearDeviceAuthToken({ deviceId: identity.deviceId, role });
          }

          console.error("[OpenClawClient] Connect failed:", err.message);
          if (this.handshakeReject) {
            this.handshakeReject(err instanceof Error ? err : new Error(String(err)));
            this.handshakeResolve = null;
            this.handshakeReject = null;
          }
          this.ws?.close(1008, "connect failed");
        });
    } catch {
      // Device identity not available, send without device auth
      if (authToken) {
        params.auth = { ...params.auth, token: authToken };
      }

      this._sendRequest("connect", params, { expectFinal: false, timeoutMs: REQUEST_TIMEOUT_MS })
        .then(() => {
          this.backoffMs = INITIAL_BACKOFF_MS;
          this.reconnectAttempts = 0;
          this.lastTick = Date.now();
          this._startTickWatch();

          if (this.handshakeResolve) {
            this.handshakeResolve();
            this.handshakeResolve = null;
            this.handshakeReject = null;
          }
        })
        .catch((err) => {
          console.error("[OpenClawClient] Connect failed:", err.message);
          if (this.handshakeReject) {
            this.handshakeReject(err instanceof Error ? err : new Error(String(err)));
            this.handshakeResolve = null;
            this.handshakeReject = null;
          }
          this.ws?.close(1008, "connect failed");
        });
    }
  }

  /**
   * Send a request and wait for response.
   * Supports `expectFinal` option to wait past "accepted" for the final response.
   */
  async request(method: string, params?: unknown, opts?: RequestOptions): Promise<unknown> {
    return this._sendRequest(method, params, opts);
  }

  private _sendRequest(method: string, params?: unknown, opts?: RequestOptions): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("WebSocket not connected"));
    }

    const id = randomUUID();
    const frame: ReqFrame = { type: "req", id, method, params };
    const expectFinal = opts?.expectFinal === true;
    const timeoutMs = opts?.timeoutMs ?? REQUEST_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer, expectFinal });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  /**
   * Subscribe to events with a handler
   */
  onEvent(handler: (frame: EventFrame) => void): () => void {
    this.eventListeners.push(handler);
    return () => {
      const idx = this.eventListeners.indexOf(handler);
      if (idx >= 0) this.eventListeners.splice(idx, 1);
    };
  }

  /**
   * Create an async iterable of events matching a filter
   */
  events(filter?: (frame: EventFrame) => boolean): AsyncIterable<EventFrame> {
    const queue: EventFrame[] = [];
    let resolver: ((value: IteratorResult<EventFrame>) => void) | null = null;
    let done = false;

    const unsubscribe = this.onEvent((frame) => {
      if (filter && !filter(frame)) return;
      if (resolver) {
        resolver({ value: frame, done: false });
        resolver = null;
      } else {
        queue.push(frame);
      }
    });

    return {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<EventFrame>> {
            if (done) return Promise.resolve({ value: undefined, done: true });
            if (queue.length > 0) {
              return Promise.resolve({ value: queue.shift()!, done: false });
            }
            return new Promise((resolve) => { resolver = resolve; });
          },
          return(): Promise<IteratorResult<EventFrame>> {
            done = true;
            unsubscribe();
            if (resolver) {
              resolver({ value: undefined, done: true });
              resolver = null;
            }
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };
  }

  /**
   * Close the connection intentionally (no reconnect)
   */
  async close(): Promise<void> {
    this.closed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this._stopTickWatch();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Reject all pending requests
    this._flushPendingErrors(new Error("Connection closed"));
    this.eventListeners = [];
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // === Session helpers (mirror SDK API surface) ===

  get sessions() {
    return {
      reset: async (params: { key: string; reason?: string }): Promise<OpenClawSession> => {
        const result = await this.request("sessions.reset", params) as OpenClawSession;
        return result;
      },
      resolve: async (params: { key?: string; sessionId?: string }): Promise<OpenClawSession> => {
        const result = await this.request("sessions.resolve", params) as OpenClawSession;
        return result;
      },
      list: async (): Promise<OpenClawSession[]> => {
        const result = await this.request("sessions.list") as OpenClawSession[];
        return result;
      },
    };
  }

  get chat() {
    return {
      send: async (params: { sessionKey: string; message: string; idempotencyKey?: string; expectFinal?: boolean }): Promise<ChatSendResult> => {
        const { expectFinal, ...sendParams } = params;
        const result = await this.request("chat.send", {
          ...sendParams,
          idempotencyKey: sendParams.idempotencyKey ?? randomUUID(),
        }, { expectFinal }) as ChatSendResult;
        return result;
      },
      abort: async (params: { sessionKey: string; runId?: string }): Promise<void> => {
        await this.request("chat.abort", params);
      },
      history: async (params: { sessionKey: string; limit?: number }): Promise<unknown[]> => {
        const result = await this.request("chat.history", params);
        if (Array.isArray(result)) return result;
        if (result && typeof result === "object" && "messages" in result) {
          return (result as { messages: unknown[] }).messages;
        }
        return [];
      },
    };
  }

  // === Private: Response Handling ===

  private _handleResponse(frame: ResFrame): void {
    const pending = this.pendingRequests.get(frame.id);
    if (!pending) return;

    // If expecting final and got "accepted" status, keep waiting
    if (pending.expectFinal) {
      const payload = frame.payload as { status?: string } | undefined;
      if (payload?.status === "accepted") {
        return; // Do not resolve yet, wait for final response
      }
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(frame.id);

    if (frame.ok) {
      pending.resolve(frame.payload);
    } else {
      const errMsg = frame.error?.message ?? "Request failed";
      const err = new Error(errMsg);
      (err as Error & { code?: string; details?: unknown }).code = frame.error?.code;
      (err as Error & { details?: unknown }).details = frame.error?.details;
      pending.reject(err);
    }
  }

  // === Private: Event Handling ===

  private _handleEvent(frame: EventFrame): void {
    // Handle connect challenge
    if (frame.event === "connect.challenge") {
      const payload = frame.payload as { nonce?: string } | undefined;
      if (payload?.nonce) {
        this.connectNonce = payload.nonce;
        this._sendConnect();
      }
      return;
    }

    // Handle tick heartbeat
    if (frame.event === "tick") {
      this.lastTick = Date.now();
      return;
    }

    // Sequence gap detection
    const seq = typeof frame.seq === "number" ? frame.seq : null;
    if (seq !== null) {
      if (this.lastSeq !== null && seq > this.lastSeq + 1) {
        console.warn(`[OpenClawClient] Event sequence gap: expected ${this.lastSeq + 1}, got ${seq}`);
      }
      this.lastSeq = seq;
    }

    // Forward to listeners
    for (const listener of this.eventListeners) {
      try {
        listener(frame);
      } catch {
        // Ignore listener errors
      }
    }
  }

  // === Private: Reconnection ===

  private _scheduleReconnect(): void {
    if (this.closed) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      console.error(`[OpenClawClient] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`);
      return;
    }

    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);

    console.warn(`[OpenClawClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.lastSeq = null; // Reset seq tracking for fresh connection
      this._doConnect().catch((err) => {
        console.error("[OpenClawClient] Reconnection failed:", err.message);
        this._scheduleReconnect();
      });
    }, delay);
  }

  // === Private: Tick Heartbeat ===

  private _startTickWatch(): void {
    this._stopTickWatch();
    const interval = Math.max(this.tickIntervalMs, 1000);
    this.tickTimer = setInterval(() => {
      if (this.closed || !this.lastTick) return;
      const gap = Date.now() - this.lastTick;
      if (gap > this.tickIntervalMs * 2) {
        console.warn("[OpenClawClient] Tick timeout, closing connection for reconnect");
        this.ws?.close(4000, "tick timeout");
      }
    }, interval);
  }

  private _stopTickWatch(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  // === Private: Utilities ===

  private _flushPendingErrors(err: Error): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }

  private _rawDataToString(data: unknown): string {
    if (typeof data === "string") return data;
    if (Buffer.isBuffer(data)) return data.toString("utf-8");
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf-8");
    if (Array.isArray(data)) return Buffer.concat(data.map((b) => Buffer.from(b))).toString("utf-8");
    return String(data);
  }
}

// ============================================================================
// Connection Manager (wraps OpenClawClient lifecycle)
// ============================================================================

export class OpenClawConnectionManager {
  private client: OpenClawClient | null = null;
  private config: OpenClawGatewayConfig;

  constructor(config: OpenClawGatewayConfig) {
    this.config = config;
  }

  async connect(): Promise<OpenClawClient> {
    if (this.client?.isConnected()) {
      return this.client;
    }

    this.client = new OpenClawClient(this.config);
    await this.client.connect();
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  getClient(): OpenClawClient {
    if (!this.client || !this.client.isConnected()) {
      throw new Error("OpenClaw client not connected. Call connect() first.");
    }
    return this.client;
  }

  isConnected(): boolean {
    return this.client?.isConnected() ?? false;
  }
}
