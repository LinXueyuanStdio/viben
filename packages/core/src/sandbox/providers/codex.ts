/**
 * Codex Sandbox Provider
 *
 * Uses OpenAI Codex CLI's sandbox functionality for OS-level isolation.
 * macOS uses Seatbelt, Linux uses Landlock.
 * Network access is disabled for security.
 */
import { spawn, type ChildProcess } from "child_process";
import { platform } from "os";
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
 * Find the codex executable path
 */
async function getCodexPath(): Promise<string | undefined> {
  const { execSync } = await import("child_process");

  // Try common locations
  const candidates = [
    // npm global
    "codex",
    // Local node_modules
    "./node_modules/.bin/codex",
    // User's npm bin
    `${process.env.HOME}/.npm-global/bin/codex`,
    // Homebrew on macOS
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex",
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
    const result = execSync(platform() === "win32" ? "where codex" : "which codex", {
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

export class CodexProvider implements ISandboxProvider {
  readonly type: SandboxProviderType = "codex";
  readonly name = "Codex CLI Sandbox";

  private codexPath: string | undefined;
  private currentProcess: ChildProcess | null = null;

  async isAvailable(): Promise<boolean> {
    this.codexPath = await getCodexPath();
    return this.codexPath !== undefined;
  }

  async init(_config?: Record<string, unknown>): Promise<void> {
    if (!this.codexPath) {
      this.codexPath = await getCodexPath();
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
          provider: { type: "codex", name: this.name },
        });
      });

      proc.on("error", (err) => {
        this.currentProcess = null;
        resolve({
          stdout,
          stderr: stderr + `\nError: ${err.message}`,
          exitCode: 1,
          duration: Date.now() - startTime,
          provider: { type: "codex", name: this.name },
        });
      });
    });
  }

  async exec(options: SandboxExecOptions): Promise<SandboxExecResult> {
    if (!this.codexPath) {
      return {
        stdout: "",
        stderr: "Codex CLI not installed",
        exitCode: 1,
        duration: 0,
        provider: { type: "codex", name: this.name },
      };
    }

    const os = platform();
    const sandboxSubcommand = os === "darwin" ? "macos" : "linux";

    // codex sandbox macos/linux --full-auto -- command args
    const spawnArgs = [
      "sandbox",
      sandboxSubcommand,
      "--full-auto",
      "--",
      options.command,
      ...(options.args || []),
    ];

    return this.spawnAndWait(this.codexPath, spawnArgs, options);
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

    // Note: Package installation would need to happen outside sandbox
    // since sandbox has no network access

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
      supportsNetworking: false, // Security priority
      isolation: "process",
      supportedRuntimes: ["node", "python", "bun"],
      supportsPooling: false,
    };
  }
}
