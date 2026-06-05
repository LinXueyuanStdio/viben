import fs from "node:fs";
import path from "node:path";
import type { SessionHistory } from "./types.js";

/**
 * Persists session history to disk as one JSON file per session.
 *
 * Files are stored as `<dir>/<sessionId>.json`. The path is validated to prevent
 * directory traversal — session IDs that resolve outside `dir` are rejected.
 */
export class HistoryStore {
  constructor(private readonly dir: string) {}

  async write(history: SessionHistory): Promise<void> {
    await fs.promises.mkdir(this.dir, { recursive: true });
    const filePath = this.filePath(history.sessionId);
    await fs.promises.writeFile(filePath, JSON.stringify(history, null, 2));
  }

  async read(sessionId: string): Promise<SessionHistory | null> {
    const filePath = this.filePath(sessionId);
    try {
      const raw = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(raw) as SessionHistory;
    } catch {
      return null;
    }
  }

  async exists(sessionId: string): Promise<boolean> {
    try {
      await fs.promises.access(this.filePath(sessionId));
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.dir);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""));
    } catch {
      return [];
    }
  }

  async delete(sessionId: string): Promise<void> {
    try {
      await fs.promises.unlink(this.filePath(sessionId));
    } catch {
      // file may not exist — safe to ignore
    }
  }

  private filePath(sessionId: string): string {
    // Use basename to strip any path components from the session ID, then
    // verify the resolved path stays within the store directory.
    const basename = path.basename(sessionId);
    const resolved = path.join(this.dir, `${basename}.json`);
    if (!resolved.startsWith(this.dir)) {
      throw new Error(`Invalid session ID: ${sessionId}`);
    }
    return resolved;
  }
}
