import { mkdir, readdir, readFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { JupyterClient } from "./jupyter-client";
import type { CodeEntry, ResultEntry, KernelHistory, SessionInfo, LogEntry, OutputItem } from "./types";

export class SessionManager {
  private baseDir: string;
  private cache = new Map<string, { kernelId: string; filePath: string; codeCounter: number }>();

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async getActiveKernel(acpSessionId: string, client: JupyterClient): Promise<string> {
    const cached = this.cache.get(acpSessionId);
    if (cached) {
      const status = await client.getKernelStatus(cached.kernelId);
      if (status === "alive") return cached.kernelId;
    }

    const sessionDir = join(this.baseDir, acpSessionId);
    await mkdir(sessionDir, { recursive: true });

    const files = await readdir(sessionDir).catch(() => [] as string[]);
    const jsonlFiles = files
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse();

    if (jsonlFiles.length > 0) {
      const latest = jsonlFiles[0];
      const kernelId = this.parseKernelIdFromFilename(latest);
      if (kernelId) {
        const status = await client.getKernelStatus(kernelId);
        if (status === "alive") {
          const filePath = join(sessionDir, latest);
          const counter = await this.getLastCodeCounter(filePath);
          this.cache.set(acpSessionId, { kernelId, filePath, codeCounter: counter });
          return kernelId;
        }
      }
    }

    const newKernelId = await client.createKernel();
    const timestamp = Date.now();
    const fileName = `${timestamp}-${newKernelId}.jsonl`;
    const filePath = join(sessionDir, fileName);
    await appendFile(filePath, "");
    this.cache.set(acpSessionId, { kernelId: newKernelId, filePath, codeCounter: 0 });
    return newKernelId;
  }

  async recordCode(
    acpSessionId: string,
    kernelId: string,
    entry: { code: string; description: string },
  ): Promise<string> {
    const cached = this.cache.get(acpSessionId);
    if (!cached || cached.kernelId !== kernelId) {
      throw new Error(`No active session file for ${acpSessionId}/${kernelId}`);
    }

    cached.codeCounter++;
    const codeId = `c_${String(cached.codeCounter).padStart(3, "0")}`;

    const logEntry: CodeEntry = {
      type: "code",
      code_id: codeId,
      timestamp: Date.now(),
      code: entry.code,
      description: entry.description,
    };

    await appendFile(cached.filePath, JSON.stringify(logEntry) + "\n");
    return codeId;
  }

  async recordResult(
    acpSessionId: string,
    kernelId: string,
    codeId: string,
    result: { status: "ok" | "error"; outputs?: OutputItem[]; error?: { name: string; value: string; traceback: string[] } },
  ): Promise<void> {
    const cached = this.cache.get(acpSessionId);
    if (!cached || cached.kernelId !== kernelId) {
      throw new Error(`No active session file for ${acpSessionId}/${kernelId}`);
    }

    const logEntry: ResultEntry = {
      type: "result",
      code_id: codeId,
      timestamp: Date.now(),
      status: result.status,
      outputs: result.outputs,
      error: result.error,
    };

    await appendFile(cached.filePath, JSON.stringify(logEntry) + "\n");
  }

  async getHistory(acpSessionId: string): Promise<KernelHistory[]> {
    const sessionDir = join(this.baseDir, acpSessionId);
    const files = await readdir(sessionDir).catch(() => [] as string[]);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl")).sort();

    const histories: KernelHistory[] = [];
    for (const file of jsonlFiles) {
      const kernelId = this.parseKernelIdFromFilename(file);
      const timestamp = this.parseTimestampFromFilename(file);
      if (!kernelId) continue;

      const content = await readFile(join(sessionDir, file), "utf-8");
      const entries: LogEntry[] = content
        .trim()
        .split("\n")
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as LogEntry);

      histories.push({
        kernel_id: kernelId,
        created_at: timestamp ?? 0,
        entries,
      });
    }
    return histories;
  }

  async getAllSessions(): Promise<SessionInfo[]> {
    const dirs = await readdir(this.baseDir).catch(() => [] as string[]);
    const sessions: SessionInfo[] = [];

    for (const dir of dirs) {
      const sessionDir = join(this.baseDir, dir);
      const files = await readdir(sessionDir).catch(() => [] as string[]);
      const jsonlFiles = files.filter((f) => f.endsWith(".jsonl")).sort();
      if (jsonlFiles.length === 0) continue;

      const latest = jsonlFiles[jsonlFiles.length - 1];
      const kernelId = this.parseKernelIdFromFilename(latest) ?? "unknown";
      const createdAt = this.parseTimestampFromFilename(jsonlFiles[0]) ?? 0;
      const lastUsed = this.parseTimestampFromFilename(latest) ?? 0;

      sessions.push({
        acp_session_id: dir,
        current_kernel_id: kernelId,
        kernel_count: jsonlFiles.length,
        created_at: createdAt,
        last_used_at: lastUsed,
      });
    }
    return sessions;
  }

  clearCache(acpSessionId: string): void {
    this.cache.delete(acpSessionId);
  }

  private parseKernelIdFromFilename(filename: string): string | undefined {
    const match = filename.match(/^\d+-(.+)\.jsonl$/);
    return match?.[1];
  }

  private parseTimestampFromFilename(filename: string): number | undefined {
    const match = filename.match(/^(\d+)-/);
    return match ? Number(match[1]) : undefined;
  }

  private async getLastCodeCounter(filePath: string): Promise<number> {
    const content = await readFile(filePath, "utf-8").catch(() => "");
    const lines = content.trim().split("\n").filter((l) => l.length > 0);
    let maxCounter = 0;
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.type === "code" && entry.code_id) {
        const num = parseInt(entry.code_id.replace("c_", ""), 10);
        if (num > maxCounter) maxCounter = num;
      }
    }
    return maxCounter;
  }
}
