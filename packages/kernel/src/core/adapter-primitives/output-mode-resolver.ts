// src/core/adapter-primitives/output-mode-resolver.ts
//
// Resolves the effective output mode for a given session by applying
// a cascade of overrides: global -> per-adapter -> per-session.

import type { OutputMode } from "./format-types.js";

interface ConfigManagerLike {
  get(): Record<string, unknown>;
}

interface SessionManagerLike {
  getSessionRecord(id: string): { outputMode?: OutputMode } | undefined;
}

const VALID_MODES = new Set<string>(["low", "medium", "high"]);
function toOutputMode(v: unknown): OutputMode | undefined {
  return typeof v === "string" && VALID_MODES.has(v) ? (v as OutputMode) : undefined;
}

/**
 * Resolves the effective output mode (low/medium/high) for a session.
 *
 * Override cascade (most specific wins):
 * 1. Global config `outputMode` (default: "medium")
 * 2. Per-adapter config `channels.<adapterName>.outputMode`
 * 3. Per-session override stored on the session record
 */
export class OutputModeResolver {
  /** Resolves the effective output mode by walking the override cascade. */
  resolve(
    configManager: ConfigManagerLike,
    adapterName: string,
    sessionId?: string,
    sessionManager?: SessionManagerLike,
  ): OutputMode {
    const config = configManager.get();
    let mode: OutputMode = toOutputMode(config.outputMode) ?? "medium";

    const channels = config.channels as Record<string, unknown> | undefined;
    const channelCfg = channels?.[adapterName] as Record<string, unknown> | undefined;
    const adapterMode = toOutputMode(channelCfg?.outputMode);
    if (adapterMode) mode = adapterMode;

    if (sessionId && sessionManager) {
      const record = sessionManager.getSessionRecord(sessionId);
      const sessionMode = toOutputMode(record?.outputMode);
      if (sessionMode) mode = sessionMode;
    }
    return mode;
  }
}
