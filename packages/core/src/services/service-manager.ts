/**
 * Service Manager for Viben
 *
 * Unified service management for background services including:
 * - MCP servers (`mcp:<name>`)
 * - Viben Gateway (`gateway`)
 * - Viben sync service (`viben:sync`)
 * - Viben index service (`viben:index`)
 * - Custom services
 *
 * Provides start/stop/restart/status/logs functionality.
 *
 * Service state is stored in ~/.viben/services/ directory with:
 * - services.yaml - Service registry
 * - logs/ - Service log files
 */
import { existsSync, statSync, openSync, readSync, closeSync, watch } from "node:fs";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import { getStateDir } from "../config/paths";
import { ServiceError } from "../error";

/**
 * Service types
 */
export type ServiceType = "mcp" | "gateway" | "viben" | "custom";

/**
 * Service status
 */
export type ServiceStatus = "running" | "stopped" | "failed" | "unknown";

/**
 * Service information
 */
export interface ServiceInfo {
  /** Service name (e.g., "mcp:filesystem", "gateway", "viben:sync") */
  name: string;
  /** Service type */
  type: ServiceType;
  /** Current status */
  status: ServiceStatus;
  /** Process ID if running */
  pid?: number;
  /** Uptime string (e.g., "2h 30m") */
  uptime?: string;
  /** ISO timestamp when started */
  started_at?: string;
  /** Error message if status is failed */
  error?: string;
  /** Command used to start the service */
  command?: string;
  /** Arguments passed to the command */
  args?: string[];
}

/**
 * Service process storage record
 */
export interface ServiceProcess {
  /** Service name */
  name: string;
  /** Service type */
  type: ServiceType;
  /** Process ID */
  pid: number;
  /** Command used to start */
  command: string;
  /** Arguments passed to the command */
  args?: string[];
  /** ISO timestamp when started */
  started_at: string;
}

/**
 * Services state file structure
 */
interface ServicesState {
  version: number;
  services: ServiceProcess[];
}

/**
 * Options for starting a service
 */
export interface StartServiceOptions {
  /** Service name */
  name: string;
  /** Command to run */
  command: string;
  /** Arguments to pass */
  args?: string[];
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
}

/**
 * Options for log watching
 */
export interface WatchLogsOptions {
  /** Service name */
  name: string;
  /** Callback for each new line */
  onLine: (line: string) => void;
}

/**
 * Default commands for known services
 */
export interface ServiceDefaults {
  /** Command to run */
  command: string;
  /** Arguments to pass */
  args: string[];
}

/**
 * ServiceManager - Manages background services
 *
 * @example
 * ```typescript
 * const manager = new ServiceManager();
 *
 * // List all services
 * const services = await manager.list();
 *
 * // Start a service
 * await manager.start({ name: "mcp:filesystem", command: "npx", args: ["-y", "@anthropic-ai/mcp-server-filesystem"] });
 *
 * // Get status
 * const info = await manager.status("mcp:filesystem");
 *
 * // Stop a service
 * await manager.stop("mcp:filesystem");
 *
 * // Read logs
 * const logs = await manager.readLogs("mcp:filesystem", 100);
 * ```
 */
export class ServiceManager {
  private stateDir: string;
  private servicesFile: string;
  private logsDir: string;

  constructor(stateDir?: string) {
    this.stateDir = stateDir || getStateDir();
    this.servicesFile = join(this.stateDir, "services.yaml");
    this.logsDir = join(this.stateDir, "logs");
  }

  /**
   * Initialize the service manager (ensure directories exist)
   */
  async initialize(): Promise<void> {
    await mkdir(this.logsDir, { recursive: true });
  }

  /**
   * Get services state file path
   */
  getServicesFilePath(): string {
    return this.servicesFile;
  }

  /**
   * Get logs directory path
   */
  getLogsDir(): string {
    return this.logsDir;
  }

  /**
   * Get log file path for a service
   */
  getLogPath(serviceName: string): string {
    // Sanitize service name for file path
    const sanitized = serviceName.replace(/[^a-zA-Z0-9-_]/g, "-");
    return join(this.logsDir, `${sanitized}.log`);
  }

  /**
   * Parse service name to get type and identifier
   */
  parseServiceName(name: string): { type: ServiceType; identifier: string } {
    if (name.startsWith("mcp:")) {
      return { type: "mcp", identifier: name.slice(4) };
    }
    if (name === "gateway") {
      return { type: "gateway", identifier: "gateway" };
    }
    if (name.startsWith("viben:")) {
      return { type: "viben", identifier: name.slice(6) };
    }
    if (name.startsWith("custom:")) {
      return { type: "custom", identifier: name.slice(7) };
    }
    // Default to custom type for unknown prefixes
    return { type: "custom", identifier: name };
  }

  /**
   * Get default command for a known service
   */
  getDefaultCommand(serviceName: string): ServiceDefaults | null {
    const { type, identifier } = this.parseServiceName(serviceName);

    if (type === "mcp") {
      // MCP servers are typically started via npx
      return {
        command: "npx",
        args: ["-y", `@anthropic-ai/mcp-server-${identifier}`],
      };
    }

    if (type === "gateway") {
      // Viben Gateway
      return {
        command: "viben",
        args: ["gateway", "start"],
      };
    }

    if (type === "viben") {
      switch (identifier) {
        case "sync":
          return {
            command: "viben",
            args: ["sync", "--daemon"],
          };
        case "index":
          return {
            command: "viben",
            args: ["index", "--daemon"],
          };
        default:
          return null;
      }
    }

    // Custom services have no defaults
    return null;
  }

  /**
   * Read services state from file
   */
  private async readState(): Promise<ServiceProcess[]> {
    if (!existsSync(this.servicesFile)) {
      return [];
    }

    try {
      const content = await readFile(this.servicesFile, "utf-8");
      const data = this.parseYaml(content);
      return data?.services || [];
    } catch {
      return [];
    }
  }

  /**
   * Write services state to file
   */
  private async writeState(services: ServiceProcess[]): Promise<void> {
    const dir = dirname(this.servicesFile);
    await mkdir(dir, { recursive: true });

    const content = this.toYaml({ version: 1, services });
    await writeFile(this.servicesFile, content, "utf-8");
  }

  /**
   * Check if a process is running by PID
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Signal 0 tests if process exists without killing it
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate uptime string from ISO timestamp
   */
  private calculateUptime(startedAt: string): string {
    const startTime = new Date(startedAt).getTime();
    const now = Date.now();
    const diff = now - startTime;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }

  /**
   * Get status of a single service
   */
  async status(name: string): Promise<ServiceInfo> {
    const services = await this.readState();
    const service = services.find((s) => s.name === name);

    if (!service) {
      return {
        name,
        type: this.parseServiceName(name).type,
        status: "stopped",
      };
    }

    const running = this.isProcessRunning(service.pid);

    if (!running) {
      // Clean up stale entry
      const updated = services.filter((s) => s.name !== name);
      await this.writeState(updated);

      return {
        name,
        type: service.type,
        status: "stopped",
      };
    }

    return {
      name,
      type: service.type,
      status: "running",
      pid: service.pid,
      uptime: this.calculateUptime(service.started_at),
      started_at: service.started_at,
      command: service.command,
      args: service.args,
    };
  }

  /**
   * List all services with their status
   */
  async list(): Promise<ServiceInfo[]> {
    const services = await this.readState();
    const result: ServiceInfo[] = [];

    // Check actual status of each tracked service
    for (const service of services) {
      const info = await this.status(service.name);
      result.push(info);
    }

    // Add known services that might not be tracked
    const knownServices: Array<{ name: string; type: ServiceType }> = [
      { name: "gateway", type: "gateway" },
      { name: "viben:sync", type: "viben" },
      { name: "viben:index", type: "viben" },
    ];

    for (const { name, type } of knownServices) {
      if (!result.find((s) => s.name === name)) {
        result.push({
          name,
          type,
          status: "stopped",
        });
      }
    }

    return result;
  }

  /**
   * Start a service
   */
  async start(options: StartServiceOptions): Promise<ServiceInfo> {
    const { name } = options;
    let { command, args = [] } = options;

    // Check if already running
    const current = await this.status(name);
    if (current.status === "running") {
      return current;
    }

    // Get default command if not provided
    if (!command) {
      const defaults = this.getDefaultCommand(name);
      if (defaults) {
        command = defaults.command;
        args = defaults.args;
      } else {
        return {
          name,
          type: this.parseServiceName(name).type,
          status: "failed",
          error: `No command specified for service ${name} and no default is configured`,
        };
      }
    }

    // Ensure logs directory exists
    await mkdir(this.logsDir, { recursive: true });

    const logPath = this.getLogPath(name);

    // Open log file synchronously to get a proper file descriptor
    // spawn() requires a file descriptor, not a WriteStream
    const logFd = fs.openSync(logPath, "a");

    return new Promise((resolve, reject) => {
      try {
        const env = options.env || process.env;
        const child = spawn(command, args, {
          detached: true,
          stdio: ["ignore", logFd, logFd],
          env,
        });

        // Close the file descriptor in the parent process
        // The child process has inherited its own copy
        fs.closeSync(logFd);

        // Allow parent to exit independently
        child.unref();

        if (!child.pid) {
          reject(new Error("Failed to start service: no PID"));
          return;
        }

        const pid = child.pid;

        // Record the service
        this.readState().then((services) => {
          const existing = services.findIndex((s) => s.name === name);

          const serviceProcess: ServiceProcess = {
            name,
            type: this.parseServiceName(name).type,
            pid,
            command,
            args,
            started_at: new Date().toISOString(),
          };

          if (existing >= 0) {
            services[existing] = serviceProcess;
          } else {
            services.push(serviceProcess);
          }

          this.writeState(services).then(() => {
            // Wait a bit to check if process started successfully
            setTimeout(async () => {
              const status = await this.status(name);
              resolve(status);
            }, 500);
          });
        });
      } catch (failed) {
        // Ensure fd is closed on error
        try {
          fs.closeSync(logFd);
        } catch {
          // Ignore close errors
        }
        reject(failed);
      }
    });
  }

  /**
   * Stop a service
   */
  async stop(name: string): Promise<ServiceInfo> {
    const services = await this.readState();
    const service = services.find((s) => s.name === name);

    if (!service) {
      return {
        name,
        type: this.parseServiceName(name).type,
        status: "stopped",
      };
    }

    // Try to kill the process
    try {
      process.kill(service.pid, "SIGTERM");

      // Wait for process to terminate
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const check = () => {
          if (!this.isProcessRunning(service.pid) || attempts >= 10) {
            resolve();
            return;
          }
          attempts++;
          setTimeout(check, 200);
        };
        check();
      });

      // Force kill if still running
      if (this.isProcessRunning(service.pid)) {
        process.kill(service.pid, "SIGKILL");
      }
    } catch {
      // Process might already be dead
    }

    // Remove from services state
    const updated = services.filter((s) => s.name !== name);
    await this.writeState(updated);

    return {
      name,
      type: service.type,
      status: "stopped",
    };
  }

  /**
   * Restart a service
   */
  async restart(name: string, command?: string, args?: string[]): Promise<ServiceInfo> {
    const current = await this.status(name);

    // Stop if running
    if (current.status === "running") {
      await this.stop(name);
    }

    // Start with the provided command or the last known command
    const cmd = command || current.command;
    const cmdArgs = args || current.args || [];

    if (!cmd) {
      return {
        name,
        type: this.parseServiceName(name).type,
        status: "failed",
        error: "No command specified and no previous command found",
      };
    }

    return this.start({ name, command: cmd, args: cmdArgs });
  }

  /**
   * Read service logs
   */
  async readLogs(name: string, lines: number = 100): Promise<string[]> {
    const logPath = this.getLogPath(name);

    if (!existsSync(logPath)) {
      return [];
    }

    try {
      const content = await readFile(logPath, "utf-8");
      const allLines = content.split("\n").filter((line) => line.trim());

      // Return last N lines
      return allLines.slice(-lines);
    } catch {
      return [];
    }
  }

  /**
   * Clear service logs
   */
  async clearLogs(name: string): Promise<void> {
    const logPath = this.getLogPath(name);

    if (existsSync(logPath)) {
      await writeFile(logPath, "", "utf-8");
    }
  }

  /**
   * Watch service logs (returns a function to stop watching)
   */
  watchLogs(options: WatchLogsOptions): () => void {
    const { name, onLine } = options;
    const logPath = this.getLogPath(name);

    // Ensure log file exists
    if (!existsSync(logPath)) {
      const logsDir = dirname(logPath);
      if (!existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      fs.writeFileSync(logPath, "", "utf-8");
    }

    // Track file position
    let position = statSync(logPath).size;

    const watcher = watch(logPath, (eventType) => {
      if (eventType === "change") {
        const stat = statSync(logPath);
        if (stat.size > position) {
          const fd = openSync(logPath, "r");
          const buffer = Buffer.alloc(stat.size - position);
          readSync(fd, buffer, 0, buffer.length, position);
          closeSync(fd);

          const newContent = buffer.toString("utf-8");
          const lines = newContent.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            onLine(line);
          }

          position = stat.size;
        }
      }
    });

    return () => {
      watcher.close();
    };
  }

  /**
   * Parse YAML (simple implementation)
   */
  private parseYaml(yaml: string): ServicesState {
    try {
      // Simple YAML parser for our format
      const lines = yaml.split("\n");
      const state: ServicesState = { version: 1, services: [] };
      let currentService: Partial<ServiceProcess> | null = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        // Version line
        if (trimmed.startsWith("version:")) {
          const value = trimmed.slice(8).trim();
          state.version = parseInt(value, 10) || 1;
          continue;
        }

        // Services array start
        if (trimmed === "services:") {
          continue;
        }

        // Service entry start (- name: ...)
        if (trimmed.startsWith("- name:")) {
          if (currentService && currentService.name) {
            state.services.push(currentService as ServiceProcess);
          }
          currentService = {
            name: String(this.parseYamlValue(trimmed.slice(7))),
          };
          continue;
        }

        // Service property
        if (currentService && line.startsWith("    ")) {
          const match = trimmed.match(/^([\w_]+):\s*(.*)$/);
          if (match) {
            const [, key, value] = match;
            const parsed = this.parseYamlValue(value);
            if (key === "pid") {
              currentService.pid = parseInt(parsed as string, 10);
            } else if (key === "args") {
              currentService.args = JSON.parse(parsed as string);
            } else if (key === "startedAt" || key === "started_at") {
              // Handle both old and new field names
              currentService.started_at = parsed as string;
            } else {
              (currentService as Record<string, unknown>)[key] = parsed;
            }
          }
        }
      }

      // Add last service
      if (currentService && currentService.name) {
        state.services.push(currentService as ServiceProcess);
      }

      return state;
    } catch {
      return { version: 1, services: [] };
    }
  }

  /**
   * Parse YAML value
   */
  private parseYamlValue(value: string): string | number | boolean {
    const trimmed = value.trim();

    // Handle quoted strings
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Handle booleans
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;

    // Handle numbers
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== "") return num;

    return trimmed;
  }

  /**
   * Convert to YAML
   */
  private toYaml(state: ServicesState): string {
    const lines: string[] = [];
    lines.push(`version: ${state.version}`);
    lines.push("services:");

    for (const service of state.services) {
      lines.push(`  - name: "${service.name}"`);
      lines.push(`    type: "${service.type}"`);
      lines.push(`    pid: ${service.pid}`);
      lines.push(`    command: "${service.command}"`);
      if (service.args && service.args.length > 0) {
        lines.push(`    args: ${JSON.stringify(service.args)}`);
      }
      lines.push(`    started_at: "${service.started_at}"`);
    }

    return lines.join("\n") + "\n";
  }

  // ============================================================
  // Convenience methods (aliases for CLI compatibility)
  // ============================================================

  /**
   * List all managed services with status
   * Alias for list() - matches CLI interface
   */
  async listServices(): Promise<ServiceInfo[]> {
    return this.list();
  }

  /**
   * Start a service by name
   * If no command is provided, uses default command for known services
   *
   * @throws {ServiceError} If service cannot be started
   */
  async startService(
    name: string,
    command?: string,
    args?: string[]
  ): Promise<ServiceInfo> {
    // Get default command if not provided
    let cmd = command;
    let cmdArgs = args || [];

    if (!cmd) {
      const defaults = this.getDefaultCommand(name);
      if (defaults) {
        cmd = defaults.command;
        cmdArgs = defaults.args;
      }
    }

    if (!cmd) {
      throw ServiceError.noCommand(name);
    }

    const result = await this.start({ name, command: cmd, args: cmdArgs });

    if (result.status === "failed" && result.error) {
      throw ServiceError.startFailed(name, result.error);
    }

    return result;
  }

  /**
   * Stop a service by name
   *
   * @throws {ServiceError} If service stop fails
   */
  async stopService(name: string): Promise<ServiceInfo> {
    return this.stop(name);
  }

  /**
   * Restart a service by name
   *
   * @throws {ServiceError} If service restart fails
   */
  async restartService(
    name: string,
    command?: string,
    args?: string[]
  ): Promise<ServiceInfo> {
    const result = await this.restart(name, command, args);

    if (result.status === "failed" && result.error) {
      throw ServiceError.startFailed(name, result.error);
    }

    return result;
  }

  /**
   * Get status of a service by name
   * Alias for status() - matches CLI interface
   */
  async getServiceStatus(name: string): Promise<ServiceInfo> {
    return this.status(name);
  }

  /**
   * Get service logs
   * Alias for readLogs() - matches CLI interface
   *
   * @param name Service name
   * @param lines Number of lines to return (default: 100)
   */
  async getServiceLogs(name: string, lines?: number): Promise<string[]> {
    return this.readLogs(name, lines);
  }

  /**
   * Check if a service exists in the state
   */
  async serviceExists(name: string): Promise<boolean> {
    const services = await this.readState();
    return services.some((s) => s.name === name);
  }

  /**
   * Remove a service from tracking (without stopping it)
   * Useful for cleaning up stale entries
   */
  async removeService(name: string): Promise<void> {
    const services = await this.readState();
    const updated = services.filter((s) => s.name !== name);
    await this.writeState(updated);
  }

  /**
   * Get list of known service names (built-in services)
   */
  getKnownServices(): string[] {
    return ["gateway", "viben:sync", "viben:index"];
  }

  /**
   * Check if a service is a known/built-in service
   */
  isKnownService(name: string): boolean {
    return this.getKnownServices().includes(name);
  }

  /**
   * Get the PID file path for a service
   */
  getPidFilePath(serviceName: string): string {
    const sanitized = serviceName.replace(/[^a-zA-Z0-9-_]/g, "-");
    return join(this.stateDir, "services", `${sanitized}.pid`);
  }

  /**
   * Write PID file for a service
   */
  async writePidFile(serviceName: string, pid: number): Promise<void> {
    const pidPath = this.getPidFilePath(serviceName);
    const pidDir = dirname(pidPath);
    await mkdir(pidDir, { recursive: true });
    await writeFile(pidPath, String(pid), "utf-8");
  }

  /**
   * Read PID from file for a service
   */
  async readPidFile(serviceName: string): Promise<number | null> {
    const pidPath = this.getPidFilePath(serviceName);
    if (!existsSync(pidPath)) {
      return null;
    }

    try {
      const content = await readFile(pidPath, "utf-8");
      const pid = parseInt(content.trim(), 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  /**
   * Remove PID file for a service
   */
  async removePidFile(serviceName: string): Promise<void> {
    const pidPath = this.getPidFilePath(serviceName);
    if (existsSync(pidPath)) {
      try {
        await unlink(pidPath);
      } catch {
        // Ignore removal faileds
      }
    }
  }

  /**
   * Stop all running services
   */
  async stopAll(): Promise<ServiceInfo[]> {
    const services = await this.list();
    const results: ServiceInfo[] = [];

    for (const service of services) {
      if (service.status === "running") {
        const result = await this.stop(service.name);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get all running services
   */
  async getRunningServices(): Promise<ServiceInfo[]> {
    const services = await this.list();
    return services.filter((s) => s.status === "running");
  }

  /**
   * Check if any service is running
   */
  async hasRunningServices(): Promise<boolean> {
    const running = await this.getRunningServices();
    return running.length > 0;
  }
}

/**
 * Singleton instance
 */
export const serviceManager = new ServiceManager();
