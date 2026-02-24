/**
 * Native Sandbox Provider
 *
 * No isolation - directly spawns processes. Always available as fallback.
 * Supports auto-detection of runtimes (node, python, bash).
 */
import { spawn, type ChildProcess } from "child_process";
import * as path from "path";
import type {
  ISandboxProvider,
  SandboxProviderType,
  SandboxCapabilities,
  SandboxExecOptions,
  SandboxExecResult,
  ScriptOptions,
} from "../types";

export class NativeProvider implements ISandboxProvider {
  readonly type: SandboxProviderType = "native";
  readonly name = "Native (No Isolation)";

  private currentProcess: ChildProcess | null = null;

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  async init(_config?: Record<string, unknown>): Promise<void> {
    // No initialization needed
  }

  async exec(options: SandboxExecOptions): Promise<SandboxExecResult> {
    const startTime = Date.now();
    const { command, args = [], cwd, env, timeout } = options;

    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        shell: true,
        timeout: timeout || 120000,
      });

      this.currentProcess = proc;

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        this.currentProcess = null;
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
          duration: Date.now() - startTime,
          provider: { type: "native", name: this.name },
        });
      });

      proc.on("error", (err) => {
        this.currentProcess = null;
        resolve({
          stdout,
          stderr: stderr + `\nError: ${err.message}`,
          exitCode: 1,
          duration: Date.now() - startTime,
          provider: { type: "native", name: this.name },
        });
      });
    });
  }

  async runScript(
    filePath: string,
    workDir: string,
    options?: ScriptOptions
  ): Promise<SandboxExecResult> {
    // Auto-detect runtime based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let runtime = "node";
    let runtimeArgs: string[] = [];

    switch (ext) {
      case ".py":
        runtime = "python3";
        break;
      case ".ts":
      case ".mts":
        runtime = "npx";
        runtimeArgs = ["tsx"];
        break;
      case ".sh":
        runtime = "bash";
        break;
      case ".js":
      case ".mjs":
        runtime = "node";
        break;
    }

    // Install dependencies if specified
    if (options?.packages?.length) {
      const packageManager = ext === ".py" ? "pip3" : "npm";
      const installArgs =
        ext === ".py"
          ? ["install", ...options.packages]
          : ["install", "--no-save", ...options.packages];

      await this.exec({
        command: packageManager,
        args: installArgs,
        cwd: workDir,
      });
    }

    return this.exec({
      command: runtime,
      args: [...runtimeArgs, filePath, ...(options?.args || [])],
      cwd: workDir,
      env: options?.env,
      timeout: options?.timeout,
    });
  }

  async stop(): Promise<void> {
    if (this.currentProcess) {
      this.currentProcess.kill("SIGTERM");
      this.currentProcess = null;
    }
  }

  async shutdown(): Promise<void> {
    await this.stop();
  }

  getCapabilities(): SandboxCapabilities {
    return {
      supportsVolumeMounts: false,
      supportsNetworking: true,
      isolation: "none",
      supportedRuntimes: ["node", "python", "bun", "bash"],
      supportsPooling: false,
    };
  }
}
