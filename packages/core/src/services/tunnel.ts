/**
 * Tunnel Service
 *
 * Manages cloudflared tunnels for exposing local services to the internet.
 * Used primarily for Telegram webhook configuration.
 */
import { EventEmitter } from "node:events";
import type { Tunnel as CloudflaredTunnel, Connection } from "cloudflared";
import type * as CloudflaredTypes from "cloudflared";
import { logger as globalLogger } from "../telemetry";
import { proxyFetch } from "../http";

// Module-level logger
const log = globalLogger.child({ module: "tunnel" });

// Dynamically import cloudflared to avoid issues if not installed
let cloudflaredModule: typeof CloudflaredTypes | null = null;

async function getCloudflared() {
  if (!cloudflaredModule) {
    try {
      cloudflaredModule = await import("cloudflared");
    } catch (e) {
      throw new Error("cloudflared package not installed. Run: pnpm add cloudflared");
    }
  }
  return cloudflaredModule;
}

/**
 * Tunnel status
 */
export type TunnelStatus = "stopped" | "starting" | "connected" | "error" | "reconnecting";

/**
 * Tunnel connection info
 */
export interface TunnelConnection {
  id: string;
  ip: string;
  location: string;
}

/**
 * Tunnel state
 */
export interface TunnelState {
  status: TunnelStatus;
  url: string | null;
  port: number;
  connections: TunnelConnection[];
  error: string | null;
  started_at: number | null;
  last_connected_at: number | null;
}

/**
 * Tunnel events
 */
export interface TunnelServiceEvents {
  "status-change": (status: TunnelStatus, state: TunnelState) => void;
  connected: (url: string) => void;
  disconnected: () => void;
  error: (error: string) => void;
}

/**
 * Tunnel Service
 *
 * Manages a single cloudflared tunnel instance.
 */
export class TunnelService extends EventEmitter {
  private state: TunnelState = {
    status: "stopped",
    url: null,
    port: 18790,
    connections: [],
    error: null,
    started_at: null,
    last_connected_at: null,
  };

  private tunnel: CloudflaredTunnel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private static readonly MAX_RECONNECT_ATTEMPTS = 3;

  constructor() {
    super();
    this.setMaxListeners(20);
  }

  /**
   * Get current tunnel state
   */
  getState(): TunnelState {
    return { ...this.state };
  }

  /**
   * Start the tunnel
   */
  async start(port: number = 18790): Promise<string> {
    if (this.state.status === "connected" || this.state.status === "starting") {
      if (this.state.url) {
        return this.state.url;
      }
      throw new Error("Tunnel is already starting");
    }

    this.updateState({
      status: "starting",
      port,
      error: null,
      started_at: Date.now(),
      connections: [],
    });

    try {
      const cloudflared = await getCloudflared();

      // Create tunnel with port option
      const tunnel = cloudflared.tunnel({ port });
      this.tunnel = tunnel;

      // Return a promise that resolves when we get the URL
      return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Tunnel connection timeout (60s)"));
        }, 60000);

        // Handle URL event (tunnel is ready)
        tunnel.on("url", (url: string) => {
          clearTimeout(timeout);
          log.info({ url }, "Tunnel URL received");

          this.updateState({
            status: "connected",
            url,
            last_connected_at: Date.now(),
          });

          this.emit("connected", url);
          this.startHealthCheck();
          resolve(url);
        });

        // Handle connection events
        tunnel.on("connected", (connection: Connection) => {
          log.info({ location: connection.location, ip: connection.ip }, "Connection established");
          const connections = [...this.state.connections, {
            id: connection.id,
            ip: connection.ip,
            location: connection.location,
          }];
          this.updateState({ connections });
        });

        tunnel.on("disconnected", (connection: Connection) => {
          log.info({ location: connection.location }, "Connection lost");
          const connections = this.state.connections.filter(c => c.id !== connection.id);
          this.updateState({ connections });
        });

        // Handle errors
        tunnel.on("error", (err: Error) => {
          log.error({ err }, "Tunnel error");
          clearTimeout(timeout);

          this.updateState({
            status: "error",
            error: err.message,
          });

          this.emit("error", err.message);
          reject(err);
        });

        // Handle exit
        tunnel.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
          log.info({ exitCode: code, signal }, "Tunnel process exited");

          if (this.state.status !== "stopped") {
            this.handleDisconnect();
          }
        });
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ err }, "Failed to start tunnel");

      this.updateState({
        status: "error",
        error: errorMsg,
      });

      this.emit("error", errorMsg);
      throw err;
    }
  }

  /**
   * Stop the tunnel
   */
  stop(): void {
    log.info("Stopping tunnel...");

    this.clearTimers();

    if (this.tunnel) {
      try {
        this.tunnel.stop();
      } catch (e) {
        log.warn({ err: e }, "Error stopping tunnel");
      }
      this.tunnel = null;
    }

    this.updateState({
      status: "stopped",
      url: null,
      connections: [],
      error: null,
    });

    this.emit("disconnected");
    log.info("Tunnel stopped");
  }

  /**
   * Restart the tunnel
   */
  async restart(): Promise<string> {
    this.stop();
    // Wait a bit before restarting
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return this.start(this.state.port);
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    if (this.state.status === "stopped") return;

    this.reconnectAttempts++;

    if (this.reconnectAttempts > TunnelService.MAX_RECONNECT_ATTEMPTS) {
      log.error({ maxAttempts: TunnelService.MAX_RECONNECT_ATTEMPTS }, "Max reconnection attempts exceeded, giving up");
      this.updateState({
        status: "error",
        url: null,
        connections: [],
        error: `Failed to connect after ${TunnelService.MAX_RECONNECT_ATTEMPTS} attempts. Please try again later or check your network connection.`,
      });
      this.emit("error", this.state.error);
      return;
    }

    log.info({ attempt: this.reconnectAttempts, maxAttempts: TunnelService.MAX_RECONNECT_ATTEMPTS }, "Tunnel disconnected, will attempt to reconnect...");

    this.updateState({
      status: "reconnecting",
      url: null,
      connections: [],
    });

    this.emit("disconnected");

    // Attempt to reconnect after a delay (with exponential backoff)
    const delay = 5000 * Math.pow(2, this.reconnectAttempts - 1);
    this.reconnectTimer = setTimeout(async () => {
      if (this.state.status === "reconnecting") {
        try {
          await this.start(this.state.port);
          // Reset attempts on successful connection
          this.reconnectAttempts = 0;
        } catch (e) {
          log.error({ err: e }, "Reconnection failed");
          // Will be called again by handleDisconnect
        }
      }
    }, delay);
  }

  /**
   * Start health check timer
   */
  private startHealthCheck(): void {
    this.clearTimers();

    // Check tunnel health every 30 seconds
    this.healthCheckTimer = setInterval(async () => {
      if (this.state.status === "connected" && this.state.url) {
        try {
          // Simple health check - try to fetch the tunnel URL
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await proxyFetch(this.state.url, {
            method: "HEAD",
            signal: controller.signal,
          }).catch(() => null);

          clearTimeout(timeout);

          if (!response || !response.ok) {
            log.warn("Health check failed, tunnel may be down");
            // Don't immediately reconnect, let the process exit handler deal with it
          }
        } catch (e) {
          // Ignore health check errors
        }
      }
    }, 30000);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Update state and emit event
   */
  private updateState(update: Partial<TunnelState>): void {
    const oldStatus = this.state.status;
    this.state = { ...this.state, ...update };

    if (update.status && update.status !== oldStatus) {
      this.emit("status-change", this.state.status, this.getState());
    }
  }
}

// Singleton instance
let tunnelService: TunnelService | null = null;

/**
 * Get the tunnel service singleton
 */
export function getTunnelService(): TunnelService {
  if (!tunnelService) {
    tunnelService = new TunnelService();
  }
  return tunnelService;
}

/**
 * Check if cloudflared is available
 */
export async function isCloudflaredAvailable(): Promise<boolean> {
  try {
    await getCloudflared();
    return true;
  } catch {
    return false;
  }
}
