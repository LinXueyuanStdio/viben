/**
 * Terminal WebSocket Route
 *
 * Provides WebSocket endpoint for PTY terminal emulation.
 * Supports input, resize, and output streaming with base64 encoding.
 *
 * Note: This module requires node-pty as an optional dependency.
 * If node-pty is not available, terminal routes will be disabled.
 */
import type { FastifyInstance } from "fastify";
import type { AppState } from "../state";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";

/**
 * Query parameters for terminal WebSocket connection
 */
interface TerminalQuery {
  /** Working directory for the terminal session */
  cwd?: string;
  /** Number of columns (default: 80) */
  cols?: number;
  /** Number of rows (default: 24) */
  rows?: number;
  /** Shell to use (default: system default) */
  shell?: string;
}

/**
 * Commands sent from client to terminal
 */
interface TerminalCommand {
  type: "input" | "resize";
  /** Base64 encoded input data (for type: "input") */
  data?: string;
  /** Number of columns (for type: "resize") */
  cols?: number;
  /** Number of rows (for type: "resize") */
  rows?: number;
}

/**
 * Messages sent from terminal to client
 */
interface TerminalMessage {
  type: "output" | "exit" | "error" | "connected";
  /** Base64 encoded output data (for type: "output") */
  data?: string;
  /** Exit code (for type: "exit") */
  code?: number;
  /** Error message (for type: "error") */
  message?: string;
  /** Session ID (for type: "connected") */
  sessionId?: string;
}

/**
 * PTY session information
 */
interface PtySession {
  id: string;
  pty: IPty;
  createdAt: Date;
}

/**
 * node-pty IPty interface (minimal subset we use)
 */
interface IPty {
  pid: number;
  cols: number;
  rows: number;
  process: string;
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (e: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
}

/**
 * node-pty spawn function interface
 */
interface NodePtyModule {
  spawn: (
    shell: string,
    args: string[],
    options: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string>;
    }
  ) => IPty;
}

/** Active PTY sessions */
const sessions = new Map<string, PtySession>();

/**
 * Get the default shell for the current platform
 */
function getDefaultShell(): string {
  if (os.platform() === "win32") {
    return process.env.COMSPEC || "cmd.exe";
  }
  return process.env.SHELL || "/bin/bash";
}

/**
 * Base64 encode a string
 */
function base64Encode(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

/**
 * Base64 decode a string
 */
function base64Decode(str: string): string {
  return Buffer.from(str, "base64").toString("utf-8");
}

/**
 * Register terminal WebSocket routes
 *
 * Note: @fastify/websocket plugin must be registered at the gateway level before calling this function.
 * This prevents ERR_HTTP_SOCKET_ASSIGNED errors from multiple registrations.
 *
 * @param fastify - Fastify instance
 * @param _state - Application state (unused but kept for consistency)
 */
export function registerTerminalRoutes(fastify: FastifyInstance, _state?: AppState): void {
  // Check if websocket plugin is registered
  if (!fastify.hasDecorator("websocketServer")) {
    console.warn("[Terminal] @fastify/websocket not registered, terminal WebSocket routes disabled");
    return;
  }

  // Register WebSocket route dynamically if node-pty is available
  fastify.register(async (instance) => {
    let nodePty: NodePtyModule | null = null;

    // Try to load node-pty
    try {
      nodePty = (await import("node-pty")) as unknown as NodePtyModule;
    } catch {
      console.warn("[Terminal] node-pty not available, terminal WebSocket routes disabled");
      console.warn("[Terminal] Install node-pty to enable: npm install node-pty");
      return;
    }

    // WebSocket endpoint for terminal
    instance.get<{
      Querystring: TerminalQuery;
    }>("/ws/terminal", { websocket: true }, (socket, req) => {
      const query = req.query;
      const cols = query.cols ?? 80;
      const rows = query.rows ?? 24;
      const shell = query.shell ?? getDefaultShell();
      const cwd = query.cwd ?? process.cwd();

      // Validate working directory
      if (query.cwd && !fs.existsSync(query.cwd)) {
        const errorMsg: TerminalMessage = {
          type: "error",
          message: `Working directory does not exist: ${query.cwd}`,
        };
        socket.send(JSON.stringify(errorMsg));
        socket.close();
        return;
      }

      // Generate session ID
      const sessionId = randomUUID();

      // Create PTY process
      let pty: IPty;
      try {
        pty = nodePty!.spawn(shell, [], {
          name: "xterm-256color",
          cols,
          rows,
          cwd,
          env: process.env as Record<string, string>,
        });
      } catch (err) {
        const errorMsg: TerminalMessage = {
          type: "error",
          message: `Failed to spawn PTY: ${err instanceof Error ? err.message : String(err)}`,
        };
        socket.send(JSON.stringify(errorMsg));
        socket.close();
        return;
      }

      // Store session
      const session: PtySession = {
        id: sessionId,
        pty,
        createdAt: new Date(),
      };
      sessions.set(sessionId, session);

      // Send connected message
      const connectedMsg: TerminalMessage = {
        type: "connected",
        sessionId,
      };
      socket.send(JSON.stringify(connectedMsg));

      // Handle PTY output
      const dataDisposable = pty.onData((data: string) => {
        const outputMsg: TerminalMessage = {
          type: "output",
          data: base64Encode(data),
        };
        try {
          socket.send(JSON.stringify(outputMsg));
        } catch {
          // Socket might be closed
        }
      });

      // Handle PTY exit
      const exitDisposable = pty.onExit((e: { exitCode: number; signal?: number }) => {
        const exitMsg: TerminalMessage = {
          type: "exit",
          code: e.exitCode,
        };
        try {
          socket.send(JSON.stringify(exitMsg));
          socket.close();
        } catch {
          // Socket might already be closed
        }
        cleanup();
      });

      // Cleanup function
      const cleanup = () => {
        dataDisposable.dispose();
        exitDisposable.dispose();
        sessions.delete(sessionId);
        try {
          pty.kill();
        } catch {
          // PTY might already be dead
        }
      };

      // Handle incoming messages
      socket.on("message", (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as TerminalCommand;

          switch (msg.type) {
            case "input": {
              if (msg.data) {
                const decoded = base64Decode(msg.data);
                pty.write(decoded);
              }
              break;
            }

            case "resize": {
              const newCols = msg.cols ?? cols;
              const newRows = msg.rows ?? rows;
              if (newCols > 0 && newRows > 0) {
                pty.resize(newCols, newRows);
              }
              break;
            }
          }
        } catch {
          const errorMsg: TerminalMessage = {
            type: "error",
            message: "Failed to parse message",
          };
          socket.send(JSON.stringify(errorMsg));
        }
      });

      // Handle WebSocket close
      socket.on("close", () => {
        cleanup();
        console.log(`[Terminal] WebSocket connection closed for session ${sessionId}`);
      });

      // Handle WebSocket error
      socket.on("error", (err) => {
        console.error(`[Terminal] WebSocket error for session ${sessionId}:`, err);
        cleanup();
      });
    });

    console.log("[Terminal] Terminal WebSocket routes registered at /ws/terminal");
  });
}

/**
 * Get active terminal sessions count
 */
export function getActiveSessionCount(): number {
  return sessions.size;
}

/**
 * Kill all active terminal sessions
 */
export function killAllSessions(): void {
  for (const [sessionId, session] of sessions) {
    try {
      session.pty.kill();
    } catch {
      // Ignore errors
    }
    sessions.delete(sessionId);
  }
}
