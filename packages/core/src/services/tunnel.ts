/**
 * Tunnel Service
 *
 * Manages cloudflared tunnels for exposing local services to the internet.
 * Used primarily for Telegram webhook configuration.
 */
import { EventEmitter } from "node:events";
import type { Tunnel as CloudflaredTunnel, Connection } from "cloudflared";

// Dynamically import cloudflared to avoid issues if not installed
let cloudflaredModule: typeof import("cloudflared") | null = null;

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
  startedAt: number | null;
  lastConnectedAt: number | null;
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
    startedAt: null,
    lastConnectedAt: null,
  };

  private tunnel: CloudflaredTunnel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

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
      startedAt: Date.now(),
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
          reject(new Error("Tunnel connection timeout (30s)"));
        }, 30000);

        // Handle URL event (tunnel is ready)
        tunnel.on("url", (url: string) => {
          clearTimeout(timeout);
          console.log(`[TunnelService] Tunnel URL received: ${url}`);

          this.updateState({
            status: "connected",
            url,
            lastConnectedAt: Date.now(),
          });

          this.emit("connected", url);
          this.startHealthCheck();
          resolve(url);
        });

        // Handle connection events
        tunnel.on("connected", (connection: Connection) => {
          console.log(`[TunnelService] Connection established: ${connection.location} (${connection.ip})`);
          const connections = [...this.state.connections, {
            id: connection.id,
            ip: connection.ip,
            location: connection.location,
          }];
          this.updateState({ connections });
        });

        tunnel.on("disconnected", (connection: Connection) => {
          console.log(`[TunnelService] Connection lost: ${connection.location}`);
          const connections = this.state.connections.filter(c => c.id !== connection.id);
          this.updateState({ connections });
        });

        // Handle errors
        tunnel.on("error", (err: Error) => {
          console.error("[TunnelService] Tunnel error:", err.message);
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
          console.log(`[TunnelService] Tunnel process exited with code ${code}, signal ${signal}`);

          if (this.state.status !== "stopped") {
            this.handleDisconnect();
          }
        });
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[TunnelService] Failed to start tunnel:", errorMsg);

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
    console.log("[TunnelService] Stopping tunnel...");

    this.clearTimers();

    if (this.tunnel) {
      try {
        this.tunnel.stop();
      } catch (e) {
        console.warn("[TunnelService] Error stopping tunnel:", e);
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
    console.log("[TunnelService] Tunnel stopped");
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

    console.log("[TunnelService] Tunnel disconnected, will attempt to reconnect...");

    this.updateState({
      status: "reconnecting",
      url: null,
      connections: [],
    });

    this.emit("disconnected");

    // Attempt to reconnect after a delay
    this.reconnectTimer = setTimeout(async () => {
      if (this.state.status === "reconnecting") {
        try {
          await this.start(this.state.port);
        } catch (e) {
          console.error("[TunnelService] Reconnection failed:", e);
          // Will retry on next health check
        }
      }
    }, 5000);
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

          const response = await fetch(this.state.url, {
            method: "HEAD",
            signal: controller.signal,
          }).catch(() => null);

          clearTimeout(timeout);

          if (!response || !response.ok) {
            console.warn("[TunnelService] Health check failed, tunnel may be down");
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
