/**
 * WebSocket Manager with heartbeat and auto-reconnect
 *
 * Provides a stable WebSocket connection with:
 * - Automatic heartbeat (ping/pong)
 * - Auto-reconnect with exponential backoff
 * - Connection state management
 * - Event handling
 */

import i18n from "../i18n";

export type WebSocketState = "connecting" | "connected" | "disconnected" | "reconnecting";

export interface WebSocketManagerOptions {
  /** URL to connect to */
  url: string;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
  /** Heartbeat timeout in ms (default: 10000) */
  heartbeatTimeout?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Max reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Max reconnect attempts (default: Infinity) */
  maxReconnectAttempts?: number;
  /** Whether to auto-connect on creation (default: true) */
  autoConnect?: boolean;
  /** Protocols to use */
  protocols?: string | string[];
  /** Called when connection state changes */
  onStateChange?: (state: WebSocketState) => void;
  /** Called when a message is received */
  onMessage?: (data: unknown) => void;
  /** Called when an error occurs */
  onError?: (error: Event) => void;
  /** Called when connection opens */
  onOpen?: () => void;
  /** Called when connection closes */
  onClose?: (event: CloseEvent) => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private options: Required<Omit<WebSocketManagerOptions, "protocols" | "onStateChange" | "onMessage" | "onError" | "onOpen" | "onClose">> & WebSocketManagerOptions;
  private state: WebSocketState = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPongTime = 0;
  private isManualClose = false;

  constructor(options: WebSocketManagerOptions) {
    this.options = {
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      maxReconnectAttempts: Infinity,
      autoConnect: true,
      ...options,
    };

    if (this.options.autoConnect) {
      this.connect();
    }
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the timestamp of the last pong received
   */
  getLastPongTime(): number {
    return this.lastPongTime;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.isManualClose = false;
    this.setState("connecting");

    try {
      this.ws = this.options.protocols
        ? new WebSocket(this.options.url, this.options.protocols)
        : new WebSocket(this.options.url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error("[WebSocketManager] Failed to create WebSocket:", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();
    this.cancelReconnect();

    if (this.ws) {
      this.ws.close(1000, i18n.t("websocket.closeReason.manualDisconnect"));
      this.ws = null;
    }

    this.setState("disconnected");
  }

  /**
   * Send data through WebSocket
   */
  send(data: string | ArrayBuffer | Blob): boolean {
    if (!this.isConnected()) {
      console.warn("[WebSocketManager] Cannot send - not connected");
      return false;
    }

    try {
      this.ws!.send(data);
      return true;
    } catch (error) {
      console.error("[WebSocketManager] Failed to send:", error);
      return false;
    }
  }

  /**
   * Send JSON data
   */
  sendJSON(data: unknown): boolean {
    return this.send(JSON.stringify(data));
  }

  /**
   * Update URL and reconnect
   */
  updateUrl(url: string): void {
    this.options.url = url;
    if (this.isConnected()) {
      this.disconnect();
      this.connect();
    }
  }

  private setState(state: WebSocketState): void {
    if (this.state !== state) {
      this.state = state;
      this.options.onStateChange?.(state);
    }
  }

  private handleOpen(): void {
    console.log("[WebSocketManager] Connected to", this.options.url);
    this.reconnectAttempts = 0;
    this.setState("connected");
    this.startHeartbeat();
    this.options.onOpen?.();
  }

  private handleClose(event: CloseEvent): void {
    console.log("[WebSocketManager] Connection closed:", event.code, event.reason);
    this.stopHeartbeat();
    this.ws = null;

    this.options.onClose?.(event);

    if (!this.isManualClose) {
      this.scheduleReconnect();
    } else {
      this.setState("disconnected");
    }
  }

  private handleError(event: Event): void {
    console.error("[WebSocketManager] WebSocket error:", event);
    this.options.onError?.(event);
  }

  private handleMessage(event: MessageEvent): void {
    // Reset heartbeat timeout on any message
    this.resetHeartbeatTimeout();
    this.lastPongTime = Date.now();

    // Try to parse JSON first
    let data: unknown = event.data;
    if (typeof event.data === "string") {
      try {
        data = JSON.parse(event.data);
      } catch {
        // Not JSON, use raw data
      }
    }

    // Handle pong messages (check both string and parsed JSON)
    if (
      event.data === "pong" ||
      event.data === '{"type":"pong"}' ||
      event.data === '{"type":"Pong"}' ||
      (typeof data === "object" && data !== null && (data as { type?: string }).type === "Pong")
    ) {
      return;
    }

    this.options.onMessage?.(data);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        // Send JSON ping (server expects { type: "Ping" })
        this.sendJSON({ type: "Ping" });

        // Set timeout for pong response
        this.heartbeatTimeoutTimer = setTimeout(() => {
          console.warn("[WebSocketManager] Heartbeat timeout - reconnecting");
          this.ws?.close(4000, i18n.t("websocket.closeReason.heartbeatTimeout"));
        }, this.options.heartbeatTimeout);
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.resetHeartbeatTimeout();
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error("[WebSocketManager] Max reconnect attempts reached");
      this.setState("disconnected");
      return;
    }

    this.setState("reconnecting");

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.options.maxReconnectDelay
    );

    console.log(`[WebSocketManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }
}

/**
 * Create a WebSocket manager instance
 */
export function createWebSocketManager(options: WebSocketManagerOptions): WebSocketManager {
  return new WebSocketManager(options);
}
