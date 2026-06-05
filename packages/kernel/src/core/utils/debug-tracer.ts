import fs from "node:fs";
import path from "node:path";

export type TraceLayer = "acp" | "core" | "telegram";

// Evaluated once at module load — zero overhead when disabled
const DEBUG_ENABLED = process.env.VIBEN_DEBUG === "true" || process.env.VIBEN_DEBUG === "1";

/**
 * Per-session debug trace logger that writes JSONL files to `<workingDirectory>/.log/`.
 *
 * Only active when `VIBEN_DEBUG=true` is set in the environment.
 * Each trace layer (acp, core, telegram) gets its own file, making it easy
 * to inspect protocol-level, core-level, or adapter-level events separately.
 *
 * Uses appendFileSync for simplicity — this blocks the event loop briefly per write,
 * which is acceptable for a debug-only tool. The DEBUG_ENABLED guard ensures zero
 * overhead in production.
 */
export class DebugTracer {
  private dirCreated = false;
  private logDir: string;

  constructor(
    private sessionId: string,
    private workingDirectory: string,
  ) {
    this.logDir = path.join(workingDirectory, ".log");
  }

  /**
   * Write a timestamped JSONL entry to the trace file for the given layer.
   *
   * Handles circular references gracefully and silently swallows errors —
   * debug logging must never crash the application.
   */
  log(layer: TraceLayer, data: Record<string, unknown>): void {
    try {
      if (!this.dirCreated) {
        fs.mkdirSync(this.logDir, { recursive: true });
        this.dirCreated = true;
      }
      const filePath = path.join(this.logDir, `${this.sessionId}_${layer}.jsonl`);
      // WeakSet tracks seen objects to replace circular references with "[Circular]"
      const seen = new WeakSet();
      const line =
        JSON.stringify({ ts: Date.now(), ...data }, (_key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
          }
          return value;
        }) + "\n";
      fs.appendFileSync(filePath, line);
    } catch {
      // Debug logging must never crash the app
    }
  }

  /** No-op cleanup — establishes the pattern for future async implementations */
  destroy(): void {
    // No file handles to close with appendFileSync
  }
}

/**
 * Create a DebugTracer if debug mode is enabled, otherwise return null.
 *
 * The DEBUG_ENABLED const is evaluated once at module load time from
 * `process.env.VIBEN_DEBUG`, so there is no per-call overhead when disabled.
 */
export function createDebugTracer(sessionId: string, workingDirectory: string): DebugTracer | null {
  if (!DEBUG_ENABLED) return null;
  return new DebugTracer(sessionId, workingDirectory);
}
