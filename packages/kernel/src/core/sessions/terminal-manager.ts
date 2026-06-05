import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { MiddlewareChain } from "../plugin/middleware-chain.js";
import { filterEnv } from "../security/env-filter.js";
import { Hook } from "../events.js";

interface TerminalState {
  process: ChildProcess;
  output: string;
  exitStatus: { exitCode: number | null; signal: string | null } | null;
  command: string;
  startTime: number;
}

interface CreateTerminalParams {
  command: string;
  args?: string[] | Array<{ name: string; value: string }>;
  env?: Array<{ name: string; value: string }>;
  cwd?: string;
  outputByteLimit?: number;
}

interface TerminalOutputResult {
  output: string;
  truncated: boolean;
  exitStatus?: { exitCode: number | null; signal: string | null };
}

interface WaitForExitResult {
  exitCode: number | null;
  signal: string | null;
}

/**
 * Manages child-process terminals for agents that need interactive command execution.
 *
 * Agents request terminals via ACP's terminal_create method. Each terminal is a
 * spawned child process whose stdout/stderr is captured into a ring buffer
 * (capped at maxOutputBytes). The agent can poll output, wait for exit, or kill
 * the process. Terminals are auto-cleaned up 30s after the process exits to allow
 * final output retrieval.
 */
export class TerminalManager {
  private terminals: Map<string, TerminalState> = new Map();
  private maxOutputBytes: number;

  constructor(maxOutputBytes = 1024 * 1024) {
    this.maxOutputBytes = maxOutputBytes;
  }

  /**
   * Spawn a new terminal process. Runs terminal:beforeCreate middleware first
   * (which can modify command/args/env or block creation entirely).
   * Returns a terminalId for subsequent output/wait/kill operations.
   */
  async createTerminal(
    sessionId: string,
    params: CreateTerminalParams,
    middlewareChain?: MiddlewareChain,
  ): Promise<{ terminalId: string }> {
    let termCommand = params.command;
    let termArgs = params.args ?? [];
    let termEnvArr = params.env ?? [];
    let termCwd = params.cwd ?? undefined;

    if (middlewareChain) {
      const envRecord: Record<string, string> = {};
      for (const ev of termEnvArr) { envRecord[ev.name] = ev.value; }
      const result = await middlewareChain.execute(Hook.TERMINAL_BEFORE_CREATE, {
        sessionId,
        command: termCommand,
        args: termArgs as string[],
        env: envRecord,
        cwd: termCwd,
      }, async (p) => p);
      if (!result) return { terminalId: "" }; // blocked by middleware
      termCommand = result.command;
      termArgs = result.args ?? termArgs;
      termCwd = result.cwd ?? termCwd;
      if (result.env) {
        termEnvArr = Object.entries(result.env).map(([name, value]) => ({ name, value }));
      }
    }

    const terminalId = randomUUID();
    const args = termArgs as string[];
    const env: Record<string, string> = {};
    for (const ev of termEnvArr) {
      env[ev.name] = ev.value;
    }

    const childProcess = spawn(termCommand, args, {
      cwd: termCwd,
      env: filterEnv(process.env as Record<string, string>, env),
      shell: false,
    });

    const state: TerminalState = {
      process: childProcess,
      output: "",
      exitStatus: null,
      command: termCommand,
      startTime: Date.now(),
    };
    this.terminals.set(terminalId, state);

    const outputByteLimit = params.outputByteLimit ?? this.maxOutputBytes;

    // Ring buffer: keep only the latest outputByteLimit bytes — oldest output
    // is trimmed from the front when the buffer exceeds the limit.
    const appendOutput = (chunk: string) => {
      state.output += chunk;
      const bytes = Buffer.byteLength(state.output, "utf-8");
      if (bytes > outputByteLimit) {
        const excess = bytes - outputByteLimit;
        state.output = state.output.slice(excess);
      }
    };

    childProcess.stdout?.on("data", (chunk: Buffer) =>
      appendOutput(chunk.toString()),
    );
    childProcess.stderr?.on("data", (chunk: Buffer) =>
      appendOutput(chunk.toString()),
    );

    childProcess.on("exit", (code, signal) => {
      state.exitStatus = { exitCode: code, signal };
      if (middlewareChain) {
        middlewareChain.execute(Hook.TERMINAL_AFTER_EXIT, {
          sessionId,
          terminalId,
          command: state.command,
          exitCode: code ?? -1,
          durationMs: Date.now() - state.startTime,
        }, async (p) => p).catch(() => {});
      }
      // Schedule cleanup of the terminal entry after a grace period to allow
      // output retrieval by the agent after the process has exited.
      setTimeout(() => {
        if (this.terminals.has(terminalId)) {
          this.terminals.delete(terminalId);
        }
      }, 30_000).unref();
    });

    return { terminalId };
  }

  /** Retrieve accumulated stdout/stderr output for a terminal. */
  getOutput(terminalId: string): TerminalOutputResult {
    const state = this.terminals.get(terminalId);
    if (!state) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }
    return {
      output: state.output,
      truncated: false,
      exitStatus: state.exitStatus
        ? {
            exitCode: state.exitStatus.exitCode,
            signal: state.exitStatus.signal,
          }
        : undefined,
    };
  }

  /** Block until the terminal process exits, returning exit code and signal. */
  async waitForExit(terminalId: string): Promise<WaitForExitResult> {
    const state = this.terminals.get(terminalId);
    if (!state) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }
    if (state.exitStatus !== null) {
      return {
        exitCode: state.exitStatus.exitCode,
        signal: state.exitStatus.signal,
      };
    }
    return new Promise((resolve) => {
      state.process.on("exit", (code, signal) => {
        resolve({ exitCode: code, signal });
      });
      // Re-check after attaching the listener to close the TOCTOU race:
      // the process may have exited between the null check above and the
      // listener registration.
      if (state.exitStatus !== null) {
        resolve({
          exitCode: state.exitStatus.exitCode,
          signal: state.exitStatus.signal,
        });
      }
    });
  }

  /** Send SIGTERM to a terminal process (graceful shutdown). */
  kill(terminalId: string): void {
    const state = this.terminals.get(terminalId);
    if (!state) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }
    state.process.kill("SIGTERM");
  }

  /** Force-kill (SIGKILL) and immediately remove a terminal from the registry. */
  release(terminalId: string): void {
    const state = this.terminals.get(terminalId);
    if (!state) {
      return;
    }
    state.process.kill("SIGKILL");
    this.terminals.delete(terminalId);
  }

  /** Force-kill all terminals. Used during session/system teardown. */
  destroyAll(): void {
    for (const [, t] of this.terminals) {
      t.process.kill("SIGKILL");
    }
    this.terminals.clear();
  }
}
