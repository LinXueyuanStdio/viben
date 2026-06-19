import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type {
  CodexJsonRpcId,
  CodexJsonRpcMessage,
  CodexNotification,
  CodexServerRequest,
} from "./codex-app-server-protocol";
import {
  isCodexFailure,
  isCodexNotification,
  isCodexServerRequest,
  isCodexSuccess,
} from "./codex-app-server-protocol";

export interface CodexAppServerProcess {
  stdin: Writable;
  stdout: Readable;
  stderrText: string;
  command: string;
  args: string[];
  cwd: string;
  failure?: Promise<never>;
  close(): void;
}

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

type NotificationHandler = (message: CodexNotification) => void | Promise<void>;
type ServerRequestHandler = (message: CodexServerRequest) => Promise<unknown>;

export class CodexJsonRpcResponseError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message);
  }
}

export class CodexAppServerJsonRpcClient {
  private nextId = 1;
  private readonly pending = new Map<CodexJsonRpcId, PendingRequest>();
  private readonly notificationHandlers = new Set<NotificationHandler>();
  private serverRequestHandler: ServerRequestHandler | undefined;
  private closed = false;

  constructor(private readonly processHandle: CodexAppServerProcess) {
    const lines = createInterface({ input: processHandle.stdout });
    lines.on("line", (line) => this.handleLine(line));
    lines.once("close", () => {
      if (!this.closed) {
        this.rejectAll(new Error("Codex app-server stdout closed"));
      }
    });
    processHandle.failure?.catch((error: unknown) => {
      const base = error instanceof Error ? error : new Error(String(error));
      this.rejectAll(base);
    });
  }

  static spawn(
    command: string,
    args: string[],
    cwd: string,
    env: Record<string, string | undefined>
  ): CodexAppServerProcess {
    let closeRequested = false;
    let rejectFailure: (error: Error) => void = () => {};
    const failure = new Promise<never>((_resolve, reject) => {
      rejectFailure = reject;
    });
    failure.catch(() => {});
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderrText = "";
    child.stderr.setEncoding("utf-8");
    child.stderr.on("data", (chunk: string) => {
      stderrText = `${stderrText}${chunk}`.slice(-16_000);
    });
    child.once("error", (error) => {
      rejectFailure(error);
    });
    child.once("exit", (code, signal) => {
      if (closeRequested || code === 0) return;
      rejectFailure(new Error(`Codex app-server exited unexpectedly with code ${code ?? "null"} signal ${signal ?? "null"}`));
    });

    return {
      stdin: child.stdin,
      stdout: child.stdout,
      get stderrText() {
        return stderrText;
      },
      command,
      args,
      cwd,
      failure,
      close() {
        if (child.exitCode !== null || child.killed) return;
        closeRequested = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null && !child.killed) {
            child.kill("SIGKILL");
          }
        }, 2_000).unref();
      },
    };
  }

  request(method: string, params?: unknown): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new Error("Codex app-server client is closed"));
    }
    const id = this.nextId++;
    const message = params === undefined ? { id, method } : { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.write(message);
    });
  }

  notify(method: string, params?: unknown): void {
    if (this.closed) return;
    this.write(params === undefined ? { method } : { method, params });
  }

  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(handler: ServerRequestHandler): void {
    this.serverRequestHandler = handler;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.rejectAll(new Error("Codex app-server client closed"));
    this.processHandle.close();
  }

  private write(message: unknown): void {
    this.processHandle.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    let message: CodexJsonRpcMessage;
    try {
      message = JSON.parse(line) as CodexJsonRpcMessage;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.rejectAll(new Error(`Failed to parse Codex app-server JSON line: ${detail}`));
      return;
    }

    if (isCodexSuccess(message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      pending.resolve(message.result);
      return;
    }

    if (isCodexFailure(message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      pending.reject(new Error(message.error.message));
      return;
    }

    if (isCodexServerRequest(message)) {
      this.handleServerRequest(message);
      return;
    }

    if (isCodexNotification(message)) {
      for (const handler of this.notificationHandlers) {
        void handler(message);
      }
    }
  }

  private handleServerRequest(message: CodexServerRequest): void {
    if (!this.serverRequestHandler) {
      this.write({ id: message.id, error: { code: -32601, message: `No handler for ${message.method}` } });
      return;
    }
    this.serverRequestHandler(message)
      .then((result) => this.write({ id: message.id, result: result ?? {} }))
      .catch((error: unknown) => {
        const messageText = error instanceof Error ? error.message : String(error);
        const code = error instanceof CodexJsonRpcResponseError ? error.code : -32000;
        this.write({ id: message.id, error: { code, message: messageText } });
      });
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

export function addCodexProcessDiagnostics(
  error: unknown,
  processHandle: CodexAppServerProcess
): Error {
  const base = error instanceof Error ? error : new Error(String(error));
  const diagnostic = base as Error & Record<string, unknown>;
  diagnostic.stderr = diagnostic.stderr ?? processHandle.stderrText;
  diagnostic.command = diagnostic.command ?? processHandle.command;
  diagnostic.args = diagnostic.args ?? processHandle.args;
  diagnostic.cwd = diagnostic.cwd ?? processHandle.cwd;
  diagnostic.hint = diagnostic.hint ?? "Install Codex CLI and ensure `codex app-server` works for the Gateway process.";
  return base;
}
