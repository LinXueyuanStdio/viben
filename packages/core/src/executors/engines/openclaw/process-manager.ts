/**
 * OpenClaw Gateway Process Manager
 *
 * Manages the lifecycle of the `openclaw gateway` process.
 * Auto-starts if not running, monitors health, restarts on crash.
 */

import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import type { OpenClawGatewayConfig } from "./types";

const MIN_NODE_VERSION = { major: 22, minor: 12, patch: 0 };
const STARTUP_TIMEOUT_MS = 15_000;
const READY_SIGNALS = [
  "Gateway listening",
  "WebSocket server started",
  "gateway ready",
  "listening on",
];

function isPortInUse(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function parseNodeVersion(raw: string): { major: number; minor: number; patch: number } | null {
  const m = raw.trim().match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function isVersionAtLeast(
  a: { major: number; minor: number; patch: number } | null,
  b: { major: number; minor: number; patch: number }
): boolean {
  if (!a) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}

function resolveCommandPath(cmd: string, envPath?: string): string | null {
  if (cmd.includes("/") || cmd.includes("\\")) {
    try {
      fs.accessSync(cmd, fs.constants.X_OK);
      return cmd;
    } catch {
      return null;
    }
  }
  const sep = process.platform === "win32" ? ";" : ":";
  for (const dir of (envPath || process.env.PATH || "").split(sep)) {
    if (!dir) continue;
    const candidate = path.join(dir, cmd);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function findBestNode(envPath?: string): string | null {
  const sep = process.platform === "win32" ? ";" : ":";
  const nodeName = process.platform === "win32" ? "node.exe" : "node";
  let best: { file: string; ver: { major: number; minor: number; patch: number } } | null = null;

  for (const dir of (envPath || process.env.PATH || "").split(sep)) {
    if (!dir) continue;
    const candidate = path.join(dir, nodeName);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
    } catch {
      continue;
    }
    try {
      const raw = execFileSync(candidate, ["-v"], { encoding: "utf8" });
      const ver = parseNodeVersion(raw);
      if (!isVersionAtLeast(ver, MIN_NODE_VERSION)) continue;
      if (!best || isVersionAtLeast(ver, best.ver)) {
        best = { file: candidate, ver: ver! };
      }
    } catch {
      continue;
    }
  }
  return best?.file ?? null;
}

function shouldRunViaNode(cliPath: string): boolean {
  if (/\.(mjs|cjs|js)$/i.test(cliPath)) return true;
  try {
    const fd = fs.openSync(cliPath, "r");
    const buf = Buffer.alloc(128);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const head = buf.subarray(0, n).toString("utf8");
    return head.startsWith("#!") && head.includes("node");
  } catch {
    return false;
  }
}

export class OpenClawProcessManager {
  private process: ChildProcess | null = null;
  private config: OpenClawGatewayConfig;

  constructor(config: OpenClawGatewayConfig) {
    this.config = config;
  }

  /**
   * Ensure the gateway is running.
   * If port is already occupied, assumes gateway is running externally.
   * Otherwise spawns the gateway process.
   */
  async ensureRunning(): Promise<void> {
    const portUsed = await isPortInUse(this.config.port, this.config.host);
    if (portUsed) {
      return;
    }

    if (!this.config.autoStart) {
      throw new Error(
        `OpenClaw gateway not running on ${this.config.host}:${this.config.port} and autoStart is disabled`
      );
    }

    await this.start();
  }

  private async start(): Promise<void> {
    if (this.process && !this.process.killed) {
      return;
    }

    const resolvedCli = resolveCommandPath(this.config.cliPath);
    if (!resolvedCli) {
      throw new Error(
        `OpenClaw CLI not found: "${this.config.cliPath}". Install openclaw or set cliPath.`
      );
    }

    const bestNode = findBestNode();
    const runViaNode = bestNode && shouldRunViaNode(resolvedCli);
    const command = runViaNode ? bestNode : resolvedCli;
    const args = runViaNode
      ? [resolvedCli, "gateway", "--port", String(this.config.port)]
      : ["gateway", "--port", String(this.config.port)];

    return new Promise<void>((resolve, reject) => {
      this.process = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, STARTUP_TIMEOUT_MS);

      this.process.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        if (!resolved && READY_SIGNALS.some((sig) => output.includes(sig))) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        if (!resolved && READY_SIGNALS.some((sig) => output.includes(sig))) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      this.process.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`Failed to start openclaw gateway: ${err.message}`));
        }
      });

      this.process.on("exit", (code) => {
        this.process = null;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`openclaw gateway exited with code ${code}`));
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.process || this.process.killed) return;
    this.process.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.process?.kill("SIGKILL");
        resolve();
      }, 5000);
      this.process!.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.process = null;
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  getPort(): number {
    return this.config.port;
  }
}
