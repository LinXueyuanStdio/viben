import { readFile, appendFile, readdir, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { nanoid } from "nanoid";
import type { SessionEvent } from "./types";

const SESSIONS_DIR = join(process.cwd(), "sessions");

async function ensureSessionsDir() {
  if (!existsSync(SESSIONS_DIR)) {
    await mkdir(SESSIONS_DIR, { recursive: true });
  }
}

export function generateSessionId(): string {
  return `ses_${nanoid(8)}`;
}

export function sessionFilePath(sessionId: string): string {
  return join(SESSIONS_DIR, `${sessionId}.jsonl`);
}

export async function appendEvent(sessionId: string, event: SessionEvent): Promise<void> {
  await ensureSessionsDir();
  const filePath = sessionFilePath(sessionId);
  const line = JSON.stringify(event) + "\n";
  await appendFile(filePath, line, "utf-8");

  // Broadcast to WebSocket clients
  try {
    const { broadcastToSession } = await import("./ws-server");
    const total = await countLines(sessionId);
    broadcastToSession(sessionId, total - 1);
  } catch {
    // WS server may not be initialized yet
  }
}

export async function readAllEvents(sessionId: string): Promise<SessionEvent[]> {
  const filePath = sessionFilePath(sessionId);
  if (!existsSync(filePath)) return [];
  const content = await readFile(filePath, "utf-8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionEvent);
}

export async function readEventsFrom(sessionId: string, fromLine: number): Promise<SessionEvent[]> {
  const all = await readAllEvents(sessionId);
  return all.slice(fromLine);
}

export async function countLines(sessionId: string): Promise<number> {
  const filePath = sessionFilePath(sessionId);
  if (!existsSync(filePath)) return 0;
  const content = await readFile(filePath, "utf-8");
  return content.trim().split("\n").filter(Boolean).length;
}

export async function listSessions(): Promise<string[]> {
  await ensureSessionsDir();
  const files = await readdir(SESSIONS_DIR);
  return files
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => f.replace(".jsonl", ""));
}

export async function getLatestSessionId(): Promise<string | null> {
  const sessions = await listSessions();
  if (sessions.length === 0) return null;
  const withMtime = await Promise.all(
    sessions.map(async (id) => ({
      id,
      mtime: (await stat(sessionFilePath(id))).mtimeMs,
    }))
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);
  return withMtime[0].id;
}

export interface SessionSummary {
  id: string;
  name: string;
  status: "running" | "paused" | "ended";
  mtime: number;
}

export async function listSessionSummaries(): Promise<SessionSummary[]> {
  const sessions = await listSessions();
  if (sessions.length === 0) return [];

  const summaries = await Promise.all(
    sessions.map(async (id) => {
      const events = await readAllEvents(id);
      let status: "running" | "paused" | "ended" = "running";
      let name = id;
      for (const e of events) {
        if (e.type === "session_init") name = e.session_name;
        if (e.type === "session_end") status = "ended";
        else if (e.type === "session_pause") status = "paused";
        else if (e.type === "session_resume") status = "running";
      }
      const mtime = (await stat(sessionFilePath(id))).mtimeMs;
      return { id, name, status, mtime };
    })
  );

  const priority = { running: 0, paused: 1, ended: 2 };
  summaries.sort((a, b) => {
    const p = priority[a.status] - priority[b.status];
    if (p !== 0) return p;
    return b.mtime - a.mtime;
  });

  return summaries;
}

export async function getActiveSessionId(): Promise<string | null> {
  const sessions = await listSessions();
  if (sessions.length === 0) return null;

  const withStatus = await Promise.all(
    sessions.map(async (id) => {
      const events = await readAllEvents(id);
      let status: "running" | "paused" | "ended" = "running";
      for (const e of events) {
        if (e.type === "session_end") status = "ended";
        else if (e.type === "session_pause") status = "paused";
        else if (e.type === "session_resume") status = "running";
      }
      const mtime = (await stat(sessionFilePath(id))).mtimeMs;
      return { id, status, mtime };
    })
  );

  const priority = { running: 0, paused: 1, ended: 2 };
  withStatus.sort((a, b) => {
    const p = priority[a.status] - priority[b.status];
    if (p !== 0) return p;
    return b.mtime - a.mtime;
  });

  return withStatus[0]?.id ?? null;
}
