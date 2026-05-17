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
const MAX_CONCURRENT_PREVIEWS = 5;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const HEALTH_CHECK_INTERVAL_MS = 10 * 1000; // 10 seconds
const STARTUP_TIMEOUT_MS = 120 * 1000; // 120 seconds (2 minutes) for npm install + vite start

/**
 * PreviewManager - Manages Vite dev server instances
 *
 * Features:
 * - Port management in range 5173-5273
 * - Auto-allocation of available ports
 * - Health monitoring with periodic checks
 * - Idle timeout for automatic cleanup
 * - Zero-config support (auto-generates package.json and vite.config.js)
 * - Maximum concurrent previews limit
 */
export class PreviewManager {
  private instances: Map<string, PreviewInstance> = new Map();
  private usedPorts: Set<number> = new Set();
  private cleanupRegistered = false;

  constructor() {
    // Cleanup on process exit (only register once)
    if (!this.cleanupRegistered) {
      process.on("SIGTERM", () => this.stopAll());
      process.on("SIGINT", () => this.stopAll());
      this.cleanupRegistered = true;
    }
  }

  /**
   * Start a Vite preview server for the given task
   */
  async startPreview(config: PreviewConfig): Promise<PreviewStatus> {
    const { taskId, workDir, port: preferredPort, command, readyPattern, timeout } = config;

    // Check if already running
    const existing = this.instances.get(taskId);
    if (existing && existing.status === "running") {
      existing.last_accessed_at = new Date();
      this.resetIdleTimeout(existing);
      return this.getStatusForInstance(existing);
    }

    // Check max concurrent previews
    const runningCount = Array.from(this.instances.values()).filter(
      (i) => i.status === "running" || i.status === "starting"
    ).length;

    if (runningCount >= MAX_CONCURRENT_PREVIEWS) {
      // Try to stop the oldest idle preview
      const oldestIdle = this.findOldestIdlePreview();
      if (oldestIdle) {
        await this.stopPreview(oldestIdle.task_id);
      } else {
        return {
          id: `preview-${taskId}`,
          task_id: taskId,
          status: "error",
          error: `Maximum concurrent previews (${MAX_CONCURRENT_PREVIEWS}) reached. Please stop an existing preview first.`,
        };
      }
    }

    // Allocate port
    const port = this.allocatePort(preferredPort);
    if (!port) {
      return {
        id: `preview-${taskId}`,
        task_id: taskId,
        status: "error",
        error: "No available ports in range 5173-5273",
      };
    }

    // Check if port is already in use before starting
    const portBusy = await this.isPortInUse(port);
    if (portBusy) {
      this.releasePort(port);
      return {
        id: `preview-${taskId}`,
        task_id: taskId,
        status: "error",
        error: `PORT_IN_USE:${port}`,
      };
    }

    // Create instance
    const instance: PreviewInstance = {
      id: `preview-${taskId}`,
      task_id: taskId,
      port,
      status: "starting",
      started_at: new Date(),
      last_accessed_at: new Date(),
    };

    this.instances.set(taskId, instance);

    // Start the server asynchronously
    this.startServer(instance, workDir, { command, readyPattern, timeout }).catch((error) => {
      log.error({ err: error, taskId }, "Failed to start preview");
      instance.status = "error";
      instance.error = error instanceof Error ? error.message : String(error);
      this.releasePort(port);
    });

    return this.getStatusForInstance(instance);
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
    options: { command?: string; readyPattern?: string; timeout?: number }
  ): Promise<void> {
    try {
      if (options.command) {
        // Use custom command from SKILL.md
        log.info({ taskId: instance.task_id, port: instance.port, command: options.command }, "Starting custom server");
        await this.startCustomProcess(instance, workDir, options);
      } else {
        // Default: Vite zero-config
        await this.ensureProjectFiles(workDir, instance.port);
        log.info({ taskId: instance.task_id, port: instance.port }, "Starting Vite server");
        await this.startViteProcess(instance, workDir, options.timeout);
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
    options: { command?: string; readyPattern?: string; timeout?: number }
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
      await new Promise<void>((resolve, reject) => {
        const npmInstall = spawn("npm", ["install"], {
          cwd: workDir,
          shell: true,
          stdio: "pipe",
        });

        let stderr = "";
        npmInstall.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });

        const installTimeout = setTimeout(() => {
          npmInstall.kill();
          reject(new Error("npm install timed out after 2 minutes"));
        }, 120000);

        npmInstall.on("close", (code) => {
          clearTimeout(installTimeout);
          if (code === 0) {
            log.info("npm install completed");
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

    childProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        log.info({ output }, "server stdout");
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
        if (readyRegex && readyRegex.test(output)) {
          readyDetected = true;
        }
      }
    });

    childProcess.on("close", (code) => {
      processExited = true;
      processExitCode = code;
      if (instance.status === "running" || instance.status === "starting") {
        log.info({ code, stderr: stderrOutput }, "Custom server process exited");
        instance.status = "stopped";
        this.cleanup(instance);
      }
    });

    childProcess.on("error", (error) => {
      processExited = true;
      log.error({ err: error }, "Custom server process error");
      instance.status = "error";
      instance.error = error.message;
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
      } else {
        const errMsg = processExited
          ? `Process exited with code ${processExitCode}: ${stderrOutput}`
          : "Server failed to emit ready pattern within timeout";
        instance.status = "error";
        instance.error = errMsg;
        if (!processExited) childProcess.kill();
        this.cleanup(instance);
      }
    } else {
      // Fall back to HTTP polling (with process alive check)
      const isReady = await this.waitForServerReady(instance.port, timeout, isProcessAlive);
      if (isReady && !processExited) {
        instance.status = "running";
        this.startHealthCheck(instance);
        this.resetIdleTimeout(instance);
        log.info({ port: instance.port, url: `http://localhost:${instance.port}` }, "Custom server running");
      } else {
        const errMsg = processExited
          ? `Process exited with code ${processExitCode}: ${stderrOutput}`
          : "Server failed to start within timeout";
        instance.status = "error";
        instance.error = errMsg;
        if (!processExited) childProcess.kill();
        this.cleanup(instance);
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
    timeout?: number
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
        const timeout = setTimeout(() => {
          npmInstall.kill();
          reject(new Error("npm install timed out after 2 minutes"));
        }, 120000);

        npmInstall.on("close", (code) => {
          clearTimeout(timeout);
          const elapsed = ((Date.now() - installStart) / 1000).toFixed(1);
          if (code === 0) {
            log.info({ elapsed }, "npm install completed");
            resolve();
          } else {
            reject(
              new Error(`npm install failed (exit code ${code}): ${stderr}`)
            );
          }
        });

        npmInstall.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }

    // Start Vite
    log.info({ port: instance.port }, "Starting Vite dev server");

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
      }
    });

    viteProcess.stderr?.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        log.debug({ output }, "vite stderr");
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
      this.cleanup(instance);
    });

    // Wait for server to be ready
    const isReady = await this.waitForServerReady(instance.port, timeout ?? STARTUP_TIMEOUT_MS);
    if (isReady) {
      instance.status = "running";
      this.startHealthCheck(instance);
      this.resetIdleTimeout(instance);
      log.info({ port: instance.port, url: `http://localhost:${instance.port}` }, "Vite server running");
    } else {
      instance.status = "error";
      instance.error = "Server failed to start within timeout";
      viteProcess.kill();
      this.cleanup(instance);
    }
  }

  /**
   * Check if a port is already in use
   */
  private async isPortInUse(port: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const response = await fetch(`http://localhost:${port}`, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok || response.status === 404;
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
      if (preferred >= PORT_RANGE_START && preferred <= PORT_RANGE_END) {
        this.usedPorts.add(preferred);
        return preferred;
      }
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
    }

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
