import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { ContextResult } from "./context-provider.js";

// Building context from checkpoints or history involves disk reads and markdown rendering.
// Cache results on disk for 1 hour so repeated agent switches to the same context are fast.
const DEFAULT_TTL_MS = 60 * 60 * 1000;

/**
 * Disk-backed cache for built ContextResult objects.
 *
 * Cache keys are a hash of (repoPath + queryKey) so different repos and query
 * parameters never collide. TTL is enforced on read — stale files are deleted lazily.
 * Callers can bypass the cache via `ContextOptions.noCache` for live agent switches
 * where history was just written and would otherwise be served stale.
 */
export class ContextCache {
  constructor(private cacheDir: string, private ttlMs: number = DEFAULT_TTL_MS) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  private keyHash(repoPath: string, queryKey: string): string {
    return crypto.createHash("sha256").update(`${repoPath}:${queryKey}`).digest("hex").slice(0, 16);
  }

  private filePath(repoPath: string, queryKey: string): string {
    return path.join(this.cacheDir, `${this.keyHash(repoPath, queryKey)}.json`);
  }

  get(repoPath: string, queryKey: string): ContextResult | null {
    const fp = this.filePath(repoPath, queryKey);
    try {
      const stat = fs.statSync(fp);
      if (Date.now() - stat.mtimeMs > this.ttlMs) { fs.unlinkSync(fp); return null; }
      return JSON.parse(fs.readFileSync(fp, "utf-8")) as ContextResult;
    } catch { return null; }
  }

  set(repoPath: string, queryKey: string, result: ContextResult): void {
    fs.writeFileSync(this.filePath(repoPath, queryKey), JSON.stringify(result));
  }
}
