/**
 * Claude Sandbox Provider
 *
 * Uses Anthropic's sandbox-runtime (srt) for process-level isolation.
 * Supports network access.
 */
import { spawn, execSync, type ChildProcess } from "child_process";
import { platform, homedir } from "os";
import * as path from "path";
import type {
  ISandboxProvider,
  SandboxProviderType,
  SandboxCapabilities,
  SandboxExecOptions,
  SandboxExecResult,
  ScriptOptions,
} from "../types";

/**
 * Find the srt executable path
 */
async function getSrtPath(): Promise<string | undefined> {

  // Try common locations
  const candidates = [
    // npm global
    "srt",
    // Local node_modules
    "./node_modules/.bin/srt",
    // User's npm bin
    `${homedir()}/.npm-global/bin/srt`,
    // Homebrew on macOS
    "/opt/homebrew/bin/srt",
    "/usr/local/bin/srt",
  ];

  for (const candidate of candidates) {
    try {
      const result = execSync(`which ${candidate} 2>/dev/null || where ${candidate} 2>nul`, {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      if (result) {
        return result.split("\n")[0];
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Try direct which/where
  try {
    const result = execSync(platform() === "win32" ? "where srt" : "which srt", {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (result) {
      return result.split("\n")[0];
    }
  } catch {
    // Not found
  }

  return undefined;
}

export class ClaudeProvider implements ISandboxProvider {
  readonly type: SandboxProviderType = "claude";
  readonly name = "Claude Sandbox";

  private srtPath: string | undefined;
  private currentProcess: ChildProcess | null = null;

  async isAvailable(): Promise<boolean> {
    this.srtPath = await getSrtPath();
    return this.srtPath !== undefined;
  }

  async init(_config?: Record<string, unknown>): Promise<void> {
    if (!this.srtPath) {
      this.srtPath = await getSrtPath();
    }
  }

  private async spawnAndWait(
    executable: string,
    spawnArgs: string[],
    options: SandboxExecOptions
  ): Promise<SandboxExecResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const proc = spawn(executable, spawnArgs, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        shell: false,
        timeout: options.timeout || 120000,
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
          provider: { type: "claude", name: this.name },
        });
      });

      proc.on("error", (err) => {
        this.currentProcess = null;
        resolve({
          stdout,
          stderr: stderr + `\nError: ${err.message}`,
          exitCode: 1,
          duration: Date.now() - startTime,
          provider: { type: "claude", name: this.name },
        });
      });
    });
  }

  async exec(options: SandboxExecOptions): Promise<SandboxExecResult> {
    if (!this.srtPath) {
      return {
        stdout: "",
        stderr: "srt (sandbox-runtime) not installed",
        exitCode: 1,
        duration: 0,
        provider: { type: "claude", name: this.name },
      };
    }

    // srt run -- command args
    const spawnArgs = ["run", "--", options.command, ...(options.args || [])];

    return this.spawnAndWait(this.srtPath, spawnArgs, options);
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

    // Note: Package installation should happen before sandbox execution
    // Claude sandbox supports network but package installation may be slow

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
      isolation: "process",
      supportedRuntimes: ["node", "python", "bun"],
      supportsPooling: false,
    };
  }
}
