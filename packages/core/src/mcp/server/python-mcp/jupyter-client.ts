import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type { ExecutionResult, KernelInfo, OutputItem } from "./types";

export class JupyterClient {
  private baseUrl: string;
  private token: string;
  private wsConnections = new Map<string, WebSocket>();
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `token ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  async createKernel(name = "python3"): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/kernels`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create kernel: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  async listKernels(): Promise<KernelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/kernels`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Failed to list kernels: ${res.status}`);
    }
    return (await res.json()) as KernelInfo[];
  }

  async getKernelStatus(kernelId: string): Promise<"alive" | "dead"> {
    const res = await fetch(`${this.baseUrl}/api/kernels/${kernelId}`, {
      method: "GET",
      headers: this.headers(),
    });
    return res.ok ? "alive" : "dead";
  }

  async deleteKernel(kernelId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/kernels/${kernelId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    this.closeWs(kernelId);
  }

  async interruptKernel(kernelId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/kernels/${kernelId}/interrupt`, {
      method: "POST",
      headers: this.headers(),
    });
  }

  async executeCode(kernelId: string, code: string, timeout = 60_000): Promise<ExecutionResult> {
    const ws = await this.getOrCreateWs(kernelId);
    const msgId = randomUUID();
    const session = randomUUID();

    const executeRequest = JSON.stringify({
      header: {
        msg_id: msgId,
        msg_type: "execute_request",
        session,
        username: "",
        version: "5.3",
      },
      parent_header: {},
      metadata: {},
      content: {
        code,
        silent: false,
        store_history: true,
        allow_stdin: false,
      },
      channel: "shell",
    });

    return new Promise<ExecutionResult>((resolve, reject) => {
      const outputs: OutputItem[] = [];
      let error: ExecutionResult["error"] | undefined;
      let resolved = false;

      const timer = setTimeout(async () => {
        if (resolved) return;
        resolved = true;
        await this.interruptKernel(kernelId).catch(() => {});
        resolve({
          status: "error",
          outputs,
          error: { name: "TimeoutError", value: "Execution timed out", traceback: [] },
        });
      }, timeout);

      const handler = (data: WebSocket.Data) => {
        if (resolved) return;
        const msg = JSON.parse(data.toString());
        if (msg.parent_header?.msg_id !== msgId) return;

        const msgType = msg.header?.msg_type ?? msg.msg_type;
        const content = msg.content;

        switch (msgType) {
          case "stream":
            outputs.push({
              type: "stream",
              stream_name: content.name,
              text: content.text,
            });
            break;
          case "execute_result":
          case "display_data":
            outputs.push({
              type: msgType,
              data: content.data,
            });
            break;
          case "error":
            error = {
              name: content.ename,
              value: content.evalue,
              traceback: content.traceback,
            };
            outputs.push({ type: "error", text: content.traceback.join("\n") });
            break;
          case "status":
            if (content.execution_state === "idle") {
              resolved = true;
              clearTimeout(timer);
              ws.off("message", handler);
              this.resetIdleTimer(kernelId);
              resolve({
                status: error ? "error" : "ok",
                outputs,
                error,
              });
            }
            break;
        }
      };

      ws.on("message", handler);
      ws.send(executeRequest);
    });
  }

  private async getOrCreateWs(kernelId: string): Promise<WebSocket> {
    const existing = this.wsConnections.get(kernelId);
    if (existing && existing.readyState === WebSocket.OPEN) {
      this.resetIdleTimer(kernelId);
      return existing;
    }

    const wsUrl = this.baseUrl.replace(/^http/, "ws");
    const url = `${wsUrl}/api/kernels/${kernelId}/channels?token=${this.token}`;

    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.on("open", () => {
        this.wsConnections.set(kernelId, ws);
        this.resetIdleTimer(kernelId);
        resolve(ws);
      });
      ws.on("error", (err) => {
        this.wsConnections.delete(kernelId);
        reject(err);
      });
      ws.on("close", () => {
        this.wsConnections.delete(kernelId);
        this.clearIdleTimer(kernelId);
      });
    });
  }

  private resetIdleTimer(kernelId: string): void {
    this.clearIdleTimer(kernelId);
    const timer = setTimeout(() => {
      this.closeWs(kernelId);
    }, 60_000);
    this.idleTimers.set(kernelId, timer);
  }

  private clearIdleTimer(kernelId: string): void {
    const timer = this.idleTimers.get(kernelId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(kernelId);
    }
  }

  private closeWs(kernelId: string): void {
    const ws = this.wsConnections.get(kernelId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(kernelId);
    }
    this.clearIdleTimer(kernelId);
  }

  closeAll(): void {
    for (const kernelId of this.wsConnections.keys()) {
      this.closeWs(kernelId);
    }
  }
}
