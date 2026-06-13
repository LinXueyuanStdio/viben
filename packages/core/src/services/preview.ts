/**
 * Preview Service
 *
 * Manages Vite dev server preview instances for live preview with HMR support.
 * Requires system Node.js/npm - Live Preview is only available when Node.js is installed.
 * Users without Node.js can still use Static Preview.
 */

import { execSync, spawn, type ChildProcess } from "child_process";
import * as fsSync from "fs";
import * as fs from "fs/promises";
import * as net from "net";
import * as path from "path";
import { logger as globalLogger } from "../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "preview" });

/**
 * Configuration for starting a preview server
 */
export interface PreviewConfig {
  /** Task identifier */
  taskId: string;
  /** Working directory path containing the files to preview */
  workDir: string;
  /** Preferred port (auto-assign if unavailable) */
  port?: number;
  /** Custom command to run instead of vite (e.g., "npm run serve") */
  command?: string;
  /** Regex pattern to detect when server is ready (matched against stdout/stderr) */
  readyPattern?: string;
  /** Startup timeout in ms (overrides default) */
  timeout?: number;
}

/**
 * Status of a preview server instance
 */
export interface PreviewStatus {
  /** Unique identifier for this preview instance */
  id: string;
  /** Associated task ID */
  task_id: string;
  /** Current status of the preview server */
  status: "starting" | "running" | "stopped" | "error";
  /** URL to access the preview (e.g., http://localhost:5173) */
  url?: string;
  /** Port number on the host */
  host_port?: number;
  /** Error message if status is 'error' */
  error?: string;
  /** When the server was started */
  started_at?: Date;
  /** Last time the preview was accessed */
  last_accessed_at?: Date;
}

/**
 * SSE event types for preview startup
 */
export type PreviewSSEEventType =
  | "status"      // Status update
  | "log"         // Log message (stdout/stderr)
  | "retry"       // Port retry attempt
  | "port_conflict" // Port is occupied, awaiting user decision
  | "complete"    // Startup complete (success or final error)
  | "error";      // Error during startup

/**
 * SSE event data for preview startup
 */
export interface PreviewSSEEvent {
  type: PreviewSSEEventType;
  data: {
    status?: PreviewStatus["status"];
    message?: string;
    port?: number;
    attempt?: number;
    maxAttempts?: number;
    url?: string;
    error?: string;
    /** Final status object (only for 'complete' event) */
    result?: PreviewStatus;
  };
}

/**
 * Internal representation of a preview instance
 */
interface PreviewInstance {
  id: string;
  task_id: string;
  port: number;
  status: PreviewStatus["status"];
  error?: string;
  started_at: Date;
  last_accessed_at: Date;
  healthCheckInterval?: ReturnType<typeof setInterval>;
  idleTimeout?: ReturnType<typeof setTimeout>;
  process?: ChildProcess;
  /** SSE emitter for startup events */
  sseEmitter?: (event: PreviewSSEEvent) => void;
  /** Whether this instance is connected to an external process (not managed by us) */
  isExternalProcess?: boolean;
}

/**
 * Check if system Node.js is available
 * Live Preview requires system Node.js - it's not bundled with the app
 * Users without Node.js can still use Static Preview
 */
export function isNodeAvailable(): boolean {
  try {
    execSync("node --version", { stdio: "pipe" });
    execSync("npm --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// Default Vite config for zero-config support
const DEFAULT_PACKAGE_JSON = {
  name: "preview",
  type: "module",
  scripts: {
    dev: "vite",
  },
  devDependencies: {
    vite: "~5.4.0", // Pin to Vite 5.4.x to avoid breaking changes
  },
};

// Vite config will be generated dynamically with the correct port
function generateViteConfig(port: number): string {
  return `export default {
  server: {
    host: '0.0.0.0',
    port: ${port},
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
  appType: 'mpa',
}`;
}

// Port range for preview servers
const PORT_RANGE_START = 5173;
const PORT_RANGE_END = 5273;
const CUSTOM_PORT_RANGE_START = 3001;
const CUSTOM_PORT_RANGE_END = 3100;
const MAX_CONCURRENT_PREVIEWS = 5;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const HEALTH_CHECK_INTERVAL_MS = 10 * 1000; // 10 seconds
const STARTUP_TIMEOUT_MS = 120 * 1000; // 120 seconds (2 minutes) for npm install + vite start
const MAX_PORT_RETRY_ATTEMPTS = 10;
const INITIAL_RETRY_DELAY_MS = 100;

/**
 * PreviewManager - Manages Vite dev server instances
 *
 * Features:
 * - Port management in range 5173-5273
 * - Auto-allocation of available ports with exponential backoff retry
 * - Health monitoring with periodic checks
 * - Idle timeout for automatic cleanup
 * - Zero-config support (auto-generates package.json and vite.config.js)
 * - Maximum concurrent previews limit
 * - SSE support for real-time startup feedback
 */
export class PreviewManager {
  private instances: Map<string, PreviewInstance> = new Map();
  private usedPorts: Set<number> = new Set();
  private static cleanupRegistered = false;

  constructor() {
    // Cleanup on process exit (only register once using static flag)
    if (!PreviewManager.cleanupRegistered) {
      process.on("SIGTERM", () => this.stopAll());
      process.on("SIGINT", () => this.stopAll());
      PreviewManager.cleanupRegistered = true;
    }
  }

  /**
   * Start a Vite preview server for the given task (non-SSE version for backward compatibility)
   */
  async startPreview(config: PreviewConfig): Promise<PreviewStatus> {
    return new Promise((resolve) => {
      let finalStatus: PreviewStatus | null = null;

      this.startPreviewWithSSE(config, (event) => {
        if (event.type === "complete" && event.data.result) {
          finalStatus = event.data.result;
          resolve(finalStatus);
        }
      });

      // Fallback timeout in case SSE never completes
      setTimeout(() => {
        if (!finalStatus) {
          resolve({
            id: `preview-${config.taskId}`,
            task_id: config.taskId,
            status: "error",
            error: "Startup timed out",
          });
        }
      }, (config.timeout ?? STARTUP_TIMEOUT_MS) + 5000);
    });
  }

  /**
   * Start a Vite preview server with SSE events for real-time feedback
   */
  startPreviewWithSSE(
    config: PreviewConfig,
    onEvent: (event: PreviewSSEEvent) => void
  ): void {
    const { taskId } = config;

    // Check if already running or starting
    const existing = this.instances.get(taskId);
    if (existing) {
      if (existing.status === "running" || existing.status === "starting") {
        existing.last_accessed_at = new Date();
        if (existing.status === "running") {
          this.resetIdleTimeout(existing);
        }
        const status = this.getStatusForInstance(existing);
        onEvent({ type: "complete", data: { result: status } });
        return;
      }
      // Clean up stale instance (error/stopped) before retrying
      this.cleanup(existing);
    }

    // Check max concurrent previews
    const runningCount = Array.from(this.instances.values()).filter(
      (i) => i.status === "running" || i.status === "starting"
    ).length;

    if (runningCount >= MAX_CONCURRENT_PREVIEWS) {
      // Try to stop the oldest idle preview
      const oldestIdle = this.findOldestIdlePreview();
      if (oldestIdle) {
        this.stopPreview(oldestIdle.task_id);
      } else {
        const errorStatus: PreviewStatus = {
          id: `preview-${taskId}`,
          task_id: taskId,
          status: "error",
          error: `Maximum concurrent previews (${MAX_CONCURRENT_PREVIEWS}) reached. Please stop an existing preview first.`,
        };
        onEvent({ type: "error", data: { error: errorStatus.error } });
        onEvent({ type: "complete", data: { result: errorStatus } });
        return;
      }
    }

    // Start the async startup process
    this.startPreviewAsync(config, onEvent);
  }

  /**
   * Async preview startup with port retry and SSE events
   */
  private async startPreviewAsync(
    config: PreviewConfig,
    onEvent: (event: PreviewSSEEvent) => void
  ): Promise<void> {
    const { taskId, workDir, port: preferredPort, command, readyPattern, timeout } = config;

    onEvent({
      type: "status",
      data: { status: "starting", message: "Initializing preview server..." },
    });

    // If preferred port is specified and already has a running service, try to reuse it
    if (preferredPort) {
      const portBusy = await this.isPortInUse(preferredPort);
      if (portBusy) {
        log.info({ port: preferredPort }, "Preferred port has a running service, verifying it responds...");

        // Verify the service is actually responsive before attaching
        const isResponsive = await this.verifyServiceResponds(preferredPort);

        if (isResponsive) {
          log.info({ port: preferredPort }, "Service is responsive, attaching to existing server");

          // Create instance for the existing server
          const instance: PreviewInstance = {
            id: `preview-${taskId}`,
            task_id: taskId,
            port: preferredPort,
            status: "running",
            started_at: new Date(),
            last_accessed_at: new Date(),
            sseEmitter: onEvent,
            isExternalProcess: true, // Mark as external - we didn't spawn this process
          };

          this.instances.set(taskId, instance);
          this.usedPorts.add(preferredPort);
          this.startHealthCheck(instance);
          this.resetIdleTimeout(instance);

          // Directly send running status (no "starting" status for port reuse)
          onEvent({
            type: "status",
            data: {
              status: "running",
              message: "Attached to existing server",
              url: `http://localhost:${preferredPort}`,
              port: preferredPort,
            },
          });

          const finalStatus = this.getStatusForInstance(instance);
          onEvent({ type: "complete", data: { result: finalStatus } });
          return;
        } else {
          // Service is not responding - notify frontend and stop, let user decide
          log.warn({ port: preferredPort }, "Port is occupied but service is not responding");
          onEvent({
            type: "port_conflict",
            data: {
              port: preferredPort,
              message: `Port ${preferredPort} is occupied by another process that is not responding.`,
            },
          });
          // Send complete with error so the SSE connection closes
          const errorStatus: PreviewStatus = {
            id: `preview-${taskId}`,
            task_id: taskId,
            status: "error",
            error: `Port ${preferredPort} is occupied`,
            host_port: preferredPort,
          };
          onEvent({ type: "complete", data: { result: errorStatus } });
          return;
        }
      }
    }

    // Determine port range based on whether we have a custom command
    const isCustomCommand = Boolean(command);
    const portRangeStart = isCustomCommand ? CUSTOM_PORT_RANGE_START : PORT_RANGE_START;
    const portRangeEnd = isCustomCommand ? CUSTOM_PORT_RANGE_END : PORT_RANGE_END;

    // Try to allocate a port with exponential backoff retry
    let port: number | null = null;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= MAX_PORT_RETRY_ATTEMPTS; attempt++) {
      // Calculate exponential backoff delay
      const delay = attempt > 1 ? INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 2) : 0;

      if (delay > 0) {
        onEvent({
          type: "retry",
          data: {
            attempt,
            maxAttempts: MAX_PORT_RETRY_ATTEMPTS,
            message: `Retrying in ${delay}ms...`,
          },
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Try preferred port first on first attempt
      if (attempt === 1 && preferredPort && !this.usedPorts.has(preferredPort)) {
        port = preferredPort;
        this.usedPorts.add(port);
        break;
      }

      // First attempt with preferred port already handled above
      if (attempt === 1 && preferredPort) {
        onEvent({
          type: "log",
          data: {
            message: `Preferred port ${preferredPort} is reserved by another preview, trying alternative...`,
            port: preferredPort,
          },
        });
      }

      // Try random port in range
      const candidatePort = this.getRandomPort(portRangeStart, portRangeEnd);
      if (candidatePort && !this.usedPorts.has(candidatePort)) {
        const busy = await this.isPortInUse(candidatePort);
        if (!busy) {
          port = candidatePort;
          this.usedPorts.add(port);
          onEvent({
            type: "log",
            data: {
              message: `Found available port: ${port}`,
              port,
            },
          });
          break;
        }
      }

      lastError = `All ports in range ${portRangeStart}-${portRangeEnd} are in use`;
      onEvent({
        type: "retry",
        data: {
          attempt,
          maxAttempts: MAX_PORT_RETRY_ATTEMPTS,
          message: `Port ${candidatePort || "unknown"} is in use (attempt ${attempt}/${MAX_PORT_RETRY_ATTEMPTS})`,
        },
      });
    }

    if (!port) {
      const errorStatus: PreviewStatus = {
        id: `preview-${taskId}`,
        task_id: taskId,
        status: "error",
        error: lastError || "No available ports found",
      };
      onEvent({ type: "error", data: { error: errorStatus.error } });
      onEvent({ type: "complete", data: { result: errorStatus } });
      return;
    }

    // Create instance
    const instance: PreviewInstance = {
      id: `preview-${taskId}`,
      task_id: taskId,
      port,
      status: "starting",
      started_at: new Date(),
      last_accessed_at: new Date(),
      sseEmitter: onEvent,
    };

    this.instances.set(taskId, instance);

    onEvent({
      type: "status",
      data: { status: "starting", message: `Starting server on port ${port}...`, port },
    });

    // Start the server
    try {
      await this.startServer(instance, workDir, { command, readyPattern, timeout }, onEvent);

      // Send completion event
      const finalStatus = this.getStatusForInstance(instance);
      onEvent({ type: "complete", data: { result: finalStatus } });
    } catch (error) {
      log.error({ err: error, taskId }, "Failed to start preview");
      instance.status = "error";
      instance.error = error instanceof Error ? error.message : String(error);
      this.releasePort(port);

      const errorStatus = this.getStatusForInstance(instance);
      onEvent({ type: "error", data: { error: instance.error } });
      onEvent({ type: "complete", data: { result: errorStatus } });
    }
  }

  /**
   * Get a random port in the given range
   */
  private getRandomPort(start: number, end: number): number | null {
    const range = end - start + 1;
    const attempts = Math.min(range, 20); // Try up to 20 random ports

    for (let i = 0; i < attempts; i++) {
      const port = start + Math.floor(Math.random() * range);
      if (!this.usedPorts.has(port)) {
        return port;
      }
    }

    // Fall back to sequential search
    for (let port = start; port <= end; port++) {
      if (!this.usedPorts.has(port)) {
        return port;
      }
    }

    return null;
  }

  /**
   * Kill the process occupying a port
   */
  async killPort(port: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Find PID using the port (macOS/Linux)
      const result = execSync(`lsof -ti :${port}`, { encoding: "utf-8" }).trim();
      if (result) {
        const pids = result.split("\n").map((p) => p.trim()).filter(Boolean);
        for (const pid of pids) {
          log.info({ pid, port }, "Killing process on port");
          execSync(`kill -9 ${pid}`);
        }
        // Wait a moment for port to be released
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { success: true };
      }
      return { success: true }; // No process found, port might be free now
    } catch (error) {
      log.error({ err: error, port }, "Failed to kill port process");
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Start the server (custom command or default Vite)
   */
  private async startServer(
    instance: PreviewInstance,
    workDir: string,
    options: { command?: string; readyPattern?: string; timeout?: number },
    onEvent?: (event: PreviewSSEEvent) => void
  ): Promise<void> {
    try {
      if (options.command) {
        // Use custom command from SKILL.md
        log.info({ taskId: instance.task_id, port: instance.port, command: options.command }, "Starting custom server");
        await this.startCustomProcess(instance, workDir, options, onEvent);
      } else {
        // Default: Vite zero-config
        await this.ensureProjectFiles(workDir, instance.port);
        log.info({ taskId: instance.task_id, port: instance.port }, "Starting Vite server");
        await this.startViteProcess(instance, workDir, options.timeout, onEvent);
      }
    } catch (error) {
      log.error({ err: error }, "Error starting server");
      instance.status = "error";
      instance.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Start a custom command process (e.g., "npm run serve")
   */
  private async startCustomProcess(
    instance: PreviewInstance,
    workDir: string,
    options: { command?: string; readyPattern?: string; timeout?: number },
    onEvent?: (event: PreviewSSEEvent) => void
  ): Promise<void> {
    const command = options.command!;
    // timeout from SKILL.md is in seconds, convert to ms; fallback to default
    const timeout = options.timeout ? options.timeout * 1000 : STARTUP_TIMEOUT_MS;
    const readyPattern = options.readyPattern;

    // Install dependencies if node_modules doesn't exist
    const nodeModulesPath = path.join(workDir, "node_modules");
    let needsInstall = false;
    try {
      await fs.access(nodeModulesPath);
    } catch {
      needsInstall = true;
    }

    if (needsInstall) {
      log.info({ workDir }, "node_modules not found, installing dependencies...");
      onEvent?.({
        type: "log",
        data: { message: "Installing dependencies..." },
      });

      await new Promise<void>((resolve, reject) => {
        const npmInstall = spawn("npm", ["install"], {
          cwd: workDir,
          shell: true,
          stdio: "pipe",
        });

        let stderr = "";
        npmInstall.stderr?.on("data", (data: Buffer) => {
          stderr += data.toString();
          onEvent?.({
            type: "log",
            data: { message: `npm: ${data.toString().trim()}` },
          });
        });

        const installTimeout = setTimeout(() => {
          npmInstall.kill();
          reject(new Error("npm install timed out after 2 minutes"));
        }, 120000);

        npmInstall.on("close", (code) => {
          clearTimeout(installTimeout);
          if (code === 0) {
            log.info("npm install completed");
            onEvent?.({
              type: "log",
              data: { message: "Dependencies installed successfully" },
            });
            resolve();
          } else {
            reject(new Error(`npm install failed (exit code ${code}): ${stderr}`));
          }
        });

        npmInstall.on("error", (err) => {
          clearTimeout(installTimeout);
          reject(err);
        });
      });
    }

    log.info({ command, port: instance.port }, "Running custom command");
    onEvent?.({
      type: "log",
      data: { message: `Running: ${command}`, port: instance.port },
    });

    const childProcess = spawn(command, [], {
      cwd: workDir,
      shell: true,
      stdio: "pipe",
      env: { ...process.env, PORT: String(instance.port), FORCE_COLOR: "0" },
    });

    instance.process = childProcess;

    // Track process alive state
    let processExited = false;
    let processExitCode: number | null = null;
    let stderrOutput = "";

    // If readyPattern provided, use it to detect server ready
    let readyDetected = false;
    const readyRegex = readyPattern ? new RegExp(readyPattern) : null;

    // Detect EADDRINUSE error
    let portInUseDetected = false;

    childProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        log.info({ output }, "server stdout");
        onEvent?.({
          type: "log",
          data: { message: output },
        });
        if (readyRegex && readyRegex.test(output)) {
          readyDetected = true;
        }
      }
    });

    childProcess.stderr?.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        stderrOutput += output + "\n";
        log.info({ output }, "server stderr");
        onEvent?.({
          type: "log",
          data: { message: `[stderr] ${output}` },
        });
        if (readyRegex && readyRegex.test(output)) {
          readyDetected = true;
        }
        // Check for EADDRINUSE
        if (output.includes("EADDRINUSE") || output.includes("address already in use")) {
          portInUseDetected = true;
        }
      }
    });

    childProcess.on("close", (code) => {
      processExited = true;
      processExitCode = code;
      if (instance.status === "running" || instance.status === "starting") {
        log.info({ code, stderr: stderrOutput }, "Custom server process exited");
        if (portInUseDetected) {
          instance.status = "error";
          instance.error = `Port ${instance.port} is already in use (EADDRINUSE)`;
        } else {
          instance.status = "stopped";
        }
        this.cleanup(instance);
      }
    });

    childProcess.on("error", (error) => {
      processExited = true;
      log.error({ err: error }, "Custom server process error");
      instance.status = "error";
      instance.error = error.message;
      onEvent?.({
        type: "error",
        data: { error: error.message },
      });
      this.cleanup(instance);
    });

    const isProcessAlive = () => !processExited;

    // Wait for server to be ready (either via readyPattern or HTTP polling)
    if (readyRegex) {
      // Wait for readyPattern match in output
      const isReady = await this.waitForReadyPattern(() => {
        if (processExited) return false; // short-circuit if process died
        return readyDetected;
      }, timeout);
      if (isReady && !processExited) {
        instance.status = "running";
        this.startHealthCheck(instance);
        this.resetIdleTimeout(instance);
        log.info({ port: instance.port, url: `http://localhost:${instance.port}` }, "Custom server running (pattern matched)");
        onEvent?.({
          type: "status",
          data: {
            status: "running",
            message: "Server is running",
            url: `http://localhost:${instance.port}`,
            port: instance.port,
          },
        });
      } else {
        let errMsg: string;
        if (portInUseDetected) {
          errMsg = `Port ${instance.port} is already in use (EADDRINUSE)`;
        } else if (processExited) {
          errMsg = `Process exited with code ${processExitCode}: ${stderrOutput}`;
        } else {
          errMsg = "Server failed to emit ready pattern within timeout";
        }
        instance.status = "error";
        instance.error = errMsg;
        if (!processExited) childProcess.kill();
        this.cleanup(instance);
        throw new Error(errMsg);
      }
    } else {
      // Fall back to HTTP polling (with process alive check)
      const isReady = await this.waitForServerReady(instance.port, timeout, isProcessAlive);
      if (isReady && !processExited) {
        instance.status = "running";
        this.startHealthCheck(instance);
        this.resetIdleTimeout(instance);
        log.info({ port: instance.port, url: `http://localhost:${instance.port}` }, "Custom server running");
        onEvent?.({
          type: "status",
          data: {
            status: "running",
            message: "Server is running",
            url: `http://localhost:${instance.port}`,
            port: instance.port,
          },
        });
      } else {
        let errMsg: string;
        if (portInUseDetected) {
          errMsg = `Port ${instance.port} is already in use (EADDRINUSE)`;
        } else if (processExited) {
          errMsg = `Process exited with code ${processExitCode}: ${stderrOutput}`;
        } else {
          errMsg = "Server failed to start within timeout";
        }
        instance.status = "error";
        instance.error = errMsg;
        if (!processExited) childProcess.kill();
        this.cleanup(instance);
        throw new Error(errMsg);
      }
    }
  }

  /**
   * Wait for ready pattern to be detected in output
   */
  private async waitForReadyPattern(
    isReady: () => boolean,
    timeout: number
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 500;

    while (Date.now() - startTime < timeout) {
      if (isReady()) return true;
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }
    return false;
  }

  /**
   * Start Vite process
   */
  private async startViteProcess(
    instance: PreviewInstance,
    workDir: string,
    timeout?: number,
    onEvent?: (event: PreviewSSEEvent) => void
  ): Promise<void> {
    // Install dependencies if vite is not installed
    const viteBinPath = path.join(workDir, "node_modules", ".bin", "vite");
    let needsInstall = false;

    try {
      await fs.access(viteBinPath);
      log.debug("Vite already installed, skipping npm install");
    } catch {
      needsInstall = true;
    }

    if (needsInstall) {
      log.info("Vite not found, installing dependencies...");
      onEvent?.({
        type: "log",
        data: { message: "Installing Vite dependencies..." },
      });
      const installStart = Date.now();

      // Use system npm (Live Preview requires Node.js to be installed)
      log.debug("Running: npm install");

      await new Promise<void>((resolve, reject) => {
        const npmInstall = spawn("npm", ["install"], {
          cwd: workDir,
          shell: true,
          stdio: "pipe",
        });

        let stderr = "";

        npmInstall.stdout?.on("data", (data: Buffer) => {
          // Log progress
          const line = data.toString().trim();
          if (line) {
            log.debug({ output: line }, "npm stdout");
          }
        });

        npmInstall.stderr?.on("data", (data: Buffer) => {
          stderr += data.toString();
          // npm often outputs to stderr even for non-errors
          const line = data.toString().trim();
          if (line) {
            log.debug({ output: line }, "npm stderr");
          }
        });

        // Set a timeout for npm install (2 minutes)
        const installTimeoutId = setTimeout(() => {
          npmInstall.kill();
          reject(new Error("npm install timed out after 2 minutes"));
        }, 120000);

        npmInstall.on("close", (code) => {
          clearTimeout(installTimeoutId);
          const elapsed = ((Date.now() - installStart) / 1000).toFixed(1);
          if (code === 0) {
            log.info({ elapsed }, "npm install completed");
            onEvent?.({
              type: "log",
              data: { message: `Dependencies installed in ${elapsed}s` },
            });
            resolve();
          } else {
            reject(
              new Error(`npm install failed (exit code ${code}): ${stderr}`)
            );
          }
        });

        npmInstall.on("error", (err) => {
          clearTimeout(installTimeoutId);
          reject(err);
        });
      });
    }

    // Start Vite
    log.info({ port: instance.port }, "Starting Vite dev server");
    onEvent?.({
      type: "log",
      data: { message: `Starting Vite on port ${instance.port}...`, port: instance.port },
    });

    // Run Vite using system Node.js (Live Preview requires Node.js to be installed)
    const viteCliPath = path.join(
      workDir,
      "node_modules",
      "vite",
      "bin",
      "vite.js"
    );

    let viteCmd: string;
    let viteArgs: string[];

    if (fsSync.existsSync(viteCliPath)) {
      // Run local Vite directly with node
      viteCmd = "node";
      viteArgs = [viteCliPath];
      log.debug({ command: `node ${viteCliPath}` }, "Running Vite");
    } else {
      // Fallback to npx
      viteCmd = "npx";
      viteArgs = ["vite"];
      log.debug({ command: "npx vite" }, "Running Vite");
    }

    const viteProcess = spawn(viteCmd, viteArgs, {
      cwd: workDir,
      shell: true,
      stdio: "pipe",
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    instance.process = viteProcess;

    // Log output for debugging
    viteProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        log.debug({ output }, "vite stdout");
        onEvent?.({
          type: "log",
          data: { message: output },
        });
      }
    });

    viteProcess.stderr?.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        log.debug({ output }, "vite stderr");
        onEvent?.({
          type: "log",
          data: { message: `[stderr] ${output}` },
        });
      }
    });

    viteProcess.on("close", (code) => {
      if (instance.status === "running" || instance.status === "starting") {
        log.info({ code }, "Vite process exited");
        instance.status = "stopped";
        this.cleanup(instance);
      }
    });

    viteProcess.on("error", (error) => {
      log.error({ err: error }, "Vite process error");
      instance.status = "error";
      instance.error = error.message;
      onEvent?.({
        type: "error",
        data: { error: error.message },
      });
      this.cleanup(instance);
    });

    // Wait for server to be ready
    const isReady = await this.waitForServerReady(instance.port, timeout ?? STARTUP_TIMEOUT_MS);
    if (isReady) {
      instance.status = "running";
      this.startHealthCheck(instance);
      this.resetIdleTimeout(instance);
      log.info({ port: instance.port, url: `http://localhost:${instance.port}` }, "Vite server running");
      onEvent?.({
        type: "status",
        data: {
          status: "running",
          message: "Server is running",
          url: `http://localhost:${instance.port}`,
          port: instance.port,
        },
      });
    } else {
      instance.status = "error";
      instance.error = "Server failed to start within timeout";
      viteProcess.kill();
      this.cleanup(instance);
      throw new Error(instance.error);
    }
  }

  /**
   * Check if a port is already in use using TCP connection test
   * This is more reliable than HTTP fetch as it detects any TCP listener
   */
  private async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });

      socket.setTimeout(1000);

      socket.on("connect", () => {
        socket.destroy();
        resolve(true); // Port is in use - something is listening
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(false); // Timeout - port is likely free
      });

      socket.on("error", (err: NodeJS.ErrnoException) => {
        socket.destroy();
        if (err.code === "ECONNREFUSED") {
          resolve(false); // Connection refused - port is free
        } else {
          resolve(false); // Other error - assume free
        }
      });
    });
  }

  /**
   * Verify that a service on a port actually responds to HTTP requests
   * Used to check if an existing server is healthy before attaching
   */
  private async verifyServiceResponds(port: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`http://localhost:${port}`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 200, 404, or any response means server is working
      return response.ok || response.status === 404 || response.status < 500;
    } catch {
      return false;
    }
  }

  /**
   * Wait for the server to be ready
   * @param isProcessAlive - optional function to check if the spawned process is still alive
   */
  private async waitForServerReady(
    port: number,
    timeout: number = STARTUP_TIMEOUT_MS,
    isProcessAlive?: () => boolean
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 1000; // Check every 1 second
    let attempts = 0;

    log.debug({ port, timeoutSeconds: timeout / 1000 }, "Waiting for server");

    while (Date.now() - startTime < timeout) {
      // If the process already exited, no point waiting
      if (isProcessAlive && !isProcessAlive()) {
        log.warn({ port, attempts }, "Process exited before server became ready");
        return false;
      }

      attempts++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`http://localhost:${port}`, {
          method: "GET",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok || response.status === 404) {
          // 404 is OK - means server is running but no index.html
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          log.info({ port, attempts, elapsed }, "Server ready");
          return true;
        }
      } catch {
        // Server not ready yet - only log every 10 attempts
        if (attempts % 10 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          log.debug({ elapsed, attempts }, "Still waiting for server...");
        }
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    log.warn({ timeoutSeconds: timeout / 1000, attempts }, "Server failed to start within timeout");
    return false;
  }

  /**
   * Ensure project has required files for Vite
   */
  private async ensureProjectFiles(
    workDir: string,
    port: number
  ): Promise<void> {
    // Ensure work directory exists
    await fs.mkdir(workDir, { recursive: true });

    // Check and create package.json
    const packageJsonPath = path.join(workDir, "package.json");
    try {
      await fs.access(packageJsonPath);
      log.debug("package.json exists");
    } catch {
      log.debug("Creating default package.json");
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(DEFAULT_PACKAGE_JSON, null, 2)
      );
    }

    // Always write vite.config.js with the correct port
    // First, remove any existing vite.config.ts to avoid conflicts (JS config takes precedence)
    const viteConfigTsPath = path.join(workDir, "vite.config.ts");
    const viteConfigMtsPath = path.join(workDir, "vite.config.mts");
    const viteConfigMjsPath = path.join(workDir, "vite.config.mjs");

    // Remove TypeScript/ESM config files that might override our JS config
    for (const configPath of [
      viteConfigTsPath,
      viteConfigMtsPath,
      viteConfigMjsPath,
    ]) {
      try {
        await fs.unlink(configPath);
        log.debug({ configPath }, "Removed conflicting config");
      } catch {
        // File doesn't exist, ignore
      }
    }

    const viteConfigPath = path.join(workDir, "vite.config.js");
    log.debug({ port }, "Writing vite.config.js");
    await fs.writeFile(viteConfigPath, generateViteConfig(port));

    // Ensure index.html exists - create a minimal one if not
    const indexHtmlPath = path.join(workDir, "index.html");
    try {
      await fs.access(indexHtmlPath);
      log.debug("index.html exists");
    } catch {
      // Look for any HTML file
      const files = await fs.readdir(workDir);
      const htmlFile = files.find((f) => f.endsWith(".html"));
      if (htmlFile && htmlFile !== "index.html") {
        // Create index.html that redirects to the found HTML file
        const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url='./${htmlFile}'">
</head>
<body>
  <p>Redirecting to <a href="./${htmlFile}">${htmlFile}</a>...</p>
</body>
</html>`;
        await fs.writeFile(indexHtmlPath, redirectHtml);
        log.debug({ htmlFile }, "Created index.html redirecting to HTML file");
      } else {
        log.warn("No HTML file found in workDir");
      }
    }
  }

  /**
   * Stop a preview server
   */
  async stopPreview(taskId: string): Promise<PreviewStatus> {
    const instance = this.instances.get(taskId);
    if (!instance) {
      return {
        id: `preview-${taskId}`,
        task_id: taskId,
        status: "stopped",
      };
    }

    log.info({ taskId }, "Stopping preview");
    await this.cleanup(instance);
    instance.status = "stopped";

    return this.getStatusForInstance(instance);
  }

  /**
   * Get status of a preview server
   */
  getStatus(taskId: string): PreviewStatus {
    const instance = this.instances.get(taskId);
    if (!instance) {
      return {
        id: `preview-${taskId}`,
        task_id: taskId,
        status: "stopped",
      };
    }

    // Update last accessed time
    instance.last_accessed_at = new Date();
    this.resetIdleTimeout(instance);

    return this.getStatusForInstance(instance);
  }

  /**
   * Stop all preview servers
   */
  async stopAll(): Promise<void> {
    log.info("Stopping all preview servers...");
    const stopPromises = Array.from(this.instances.keys()).map((taskId) =>
      this.stopPreview(taskId)
    );
    await Promise.all(stopPromises);
    log.info("All preview servers stopped");
  }

  /**
   * Get all active preview instances
   */
  getActiveInstances(): PreviewStatus[] {
    return Array.from(this.instances.values())
      .filter((i) => i.status === "running" || i.status === "starting")
      .map((i) => this.getStatusForInstance(i));
  }

  /**
   * Allocate an available port
   */
  private allocatePort(preferred?: number): number | null {
    if (preferred && !this.usedPorts.has(preferred)) {
      this.usedPorts.add(preferred);
      return preferred;
    }

    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }

    return null;
  }

  /**
   * Release a port
   */
  private releasePort(port: number): void {
    this.usedPorts.delete(port);
  }

  /**
   * Start health check for an instance
   */
  private startHealthCheck(instance: PreviewInstance): void {
    if (instance.healthCheckInterval) {
      clearInterval(instance.healthCheckInterval);
    }

    instance.healthCheckInterval = setInterval(async () => {
      if (instance.status !== "running") {
        return;
      }

      try {
        const response = await fetch(`http://localhost:${instance.port}`, {
          method: "HEAD",
        });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Health check failed: ${response.status}`);
        }
      } catch (error) {
        log.warn({ err: error, taskId: instance.task_id }, "Health check failed");
        instance.status = "error";
        instance.error = "Server health check failed";
        this.cleanup(instance);
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Reset idle timeout for an instance
   */
  private resetIdleTimeout(instance: PreviewInstance): void {
    if (instance.idleTimeout) {
      clearTimeout(instance.idleTimeout);
    }

    instance.idleTimeout = setTimeout(() => {
      log.info({ taskId: instance.task_id }, "Idle timeout reached");
      this.stopPreview(instance.task_id);
    }, IDLE_TIMEOUT_MS);
  }

  /**
   * Find the oldest idle preview
   */
  private findOldestIdlePreview(): PreviewInstance | null {
    let oldest: PreviewInstance | null = null;
    let oldestTime = Date.now();

    for (const instance of this.instances.values()) {
      if (
        instance.status === "running" &&
        instance.last_accessed_at.getTime() < oldestTime
      ) {
        oldest = instance;
        oldestTime = instance.last_accessed_at.getTime();
      }
    }

    return oldest;
  }

  /**
   * Cleanup an instance
   */
  private async cleanup(instance: PreviewInstance): Promise<void> {
    if (instance.healthCheckInterval) {
      clearInterval(instance.healthCheckInterval);
      instance.healthCheckInterval = undefined;
    }

    if (instance.idleTimeout) {
      clearTimeout(instance.idleTimeout);
      instance.idleTimeout = undefined;
    }

    if (instance.process) {
      try {
        instance.process.kill("SIGTERM");
      } catch (error) {
        log.error({ err: error }, "Error killing process");
      }
      instance.process = undefined;
    } else if (instance.isExternalProcess) {
      // For external processes (port reuse), we need to kill the process by port
      log.info({ port: instance.port }, "Killing external process on port");
      try {
        await this.killPort(instance.port);
      } catch (error) {
        log.error({ err: error, port: instance.port }, "Error killing external process on port");
      }
    }

    // Clear SSE emitter reference to prevent memory leak
    instance.sseEmitter = undefined;

    this.releasePort(instance.port);
    this.instances.delete(instance.task_id);
  }

  /**
   * Get status object for an instance
   */
  private getStatusForInstance(instance: PreviewInstance): PreviewStatus {
    return {
      id: instance.id,
      task_id: instance.task_id,
      status: instance.status,
      url:
        instance.status === "running"
          ? `http://localhost:${instance.port}`
          : undefined,
      host_port: instance.port,
      error: instance.error,
      started_at: instance.started_at,
      last_accessed_at: instance.last_accessed_at,
    };
  }
}

// Global preview manager instance
let globalPreviewManager: PreviewManager | null = null;

/**
 * Get the global preview manager instance
 */
export function getPreviewManager(): PreviewManager {
  if (!globalPreviewManager) {
    globalPreviewManager = new PreviewManager();
  }
  return globalPreviewManager;
}
