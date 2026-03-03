/**
 * MCP Monitor Service
 *
 * Monitors registered MCP server processes and broadcasts events on status changes.
 * Periodically checks if registered PIDs are still alive.
 */

import { EventService, McpProcessStatusData, McpServerEventData } from "./events";

/** MCP server process status */
export type McpProcessStatus = "running" | "stopped" | "error";

/** Registered MCP server info for monitoring */
export interface McpServerInfo {
  id: string;
  name: string;
  pid?: number;
  port?: number;
  status: McpProcessStatus;
}

/** Configuration for the MCP monitor */
export interface McpMonitorConfig {
  /** Interval between status checks in milliseconds (default: 30000 = 30s) */
  checkInterval?: number;
}

/**
 * Check if a process is alive by PID
 */
async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    // On Unix-like systems, sending signal 0 checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * MCP Monitor Service
 *
 * Monitors MCP server processes and broadcasts events when status changes.
 */
export class McpMonitorService {
  private events: EventService;
  private servers: Map<string, McpServerInfo> = new Map();
  private checkInterval: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(events: EventService, config: McpMonitorConfig = {}) {
    this.events = events;
    this.checkInterval = config.checkInterval ?? 30000; // 30 seconds default
  }

  /**
   * Register an MCP server for monitoring
   */
  register(server: McpServerInfo): void {
    const existing = this.servers.get(server.id);
    this.servers.set(server.id, server);

    // If status changed, broadcast event
    if (existing && existing.status !== server.status) {
      this.events.mcpProcessStatusChanged({
        server_id: server.id,
        server_name: server.name,
        old_status: existing.status,
        new_status: server.status,
        pid: server.pid,
        error: server.status === "error" ? "Status changed to error" : undefined,
      });
    }

    // Broadcast server started if newly running
    if (server.status === "running" && (!existing || existing.status !== "running")) {
      this.events.mcpServerStarted({
        server_id: server.id,
        server_name: server.name,
        pid: server.pid,
        port: server.port,
      });
    }
  }

  /**
   * Unregister an MCP server from monitoring
   */
  unregister(serverId: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      this.servers.delete(serverId);

      // Broadcast server stopped if it was running
      if (server.status === "running") {
        this.events.mcpServerStopped({
          server_id: server.id,
          server_name: server.name,
          pid: server.pid,
          port: server.port,
        });
      }
    }
  }

  /**
   * Update server status (e.g., when manually stopped)
   */
  updateStatus(serverId: string, status: McpProcessStatus, error?: string): void {
    const server = this.servers.get(serverId);
    if (!server) return;

    const oldStatus = server.status;
    if (oldStatus === status) return;

    server.status = status;

    this.events.mcpProcessStatusChanged({
      server_id: server.id,
      server_name: server.name,
      old_status: oldStatus,
      new_status: status,
      pid: server.pid,
      error,
    });

    if (status === "stopped" && oldStatus === "running") {
      this.events.mcpServerStopped({
        server_id: server.id,
        server_name: server.name,
        pid: server.pid,
        port: server.port,
        error,
      });
    } else if (status === "running" && oldStatus !== "running") {
      this.events.mcpServerStarted({
        server_id: server.id,
        server_name: server.name,
        pid: server.pid,
        port: server.port,
      });
    }
  }

  /**
   * Get all registered servers
   */
  getServers(): McpServerInfo[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get a specific server by ID
   */
  getServer(serverId: string): McpServerInfo | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Start the monitoring service
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.intervalHandle = setInterval(() => {
      this.checkAll();
    }, this.checkInterval);

    console.log(`[McpMonitor] Started with ${this.checkInterval}ms check interval`);
  }

  /**
   * Stop the monitoring service
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    console.log("[McpMonitor] Stopped");
  }

  /**
   * Check all registered servers
   */
  async checkAll(): Promise<void> {
    const checks = Array.from(this.servers.values()).map((server) =>
      this.checkServer(server)
    );
    await Promise.all(checks);
  }

  /**
   * Check a single server's process status
   */
  private async checkServer(server: McpServerInfo): Promise<void> {
    // Only check servers that claim to be running and have a PID
    if (server.status !== "running" || !server.pid) return;

    const alive = await isProcessAlive(server.pid);

    if (!alive) {
      // Process is dead, update status
      const oldStatus = server.status;
      server.status = "error";

      this.events.mcpProcessStatusChanged({
        server_id: server.id,
        server_name: server.name,
        old_status: oldStatus,
        new_status: "error",
        pid: server.pid,
        error: "Process terminated unexpectedly",
      });

      this.events.mcpServerStopped({
        server_id: server.id,
        server_name: server.name,
        pid: server.pid,
        port: server.port,
        error: "Process terminated unexpectedly",
      });

      console.log(`[McpMonitor] Server ${server.name} (PID: ${server.pid}) terminated`);
    }
  }

  /**
   * Whether the monitor is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get the check interval in milliseconds
   */
  get interval(): number {
    return this.checkInterval;
  }
}
