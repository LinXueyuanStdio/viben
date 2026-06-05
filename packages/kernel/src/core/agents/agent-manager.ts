import type { AgentDefinition } from "../types.js";
import { AgentInstance } from "./agent-instance.js";
import type { AgentCatalog } from "./agent-catalog.js";
import { createChildLogger } from "../utils/log.js";

const log = createChildLogger({ module: "agent-manager" });

const WARM_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface WarmEntry {
  agentName: string;
  workingDir: string;
  /**
   * The allowedPaths set baked into the warm instance's PathGuard at spawn time.
   * Must match the requested set on takeWarm — different paths produce a
   * different security boundary, so a mismatched warm is not safe to claim.
   */
  allowedPaths: readonly string[];
  instance: AgentInstance;
  createdAt: number;
}

/**
 * Order-insensitive equality on two path lists. Used to decide whether a warm
 * instance's PathGuard configuration matches a fresh request.
 */
function pathListsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

/**
 * High-level facade for spawning and resuming agent instances.
 *
 * Resolves agent names to definitions via AgentCatalog, then delegates
 * to AgentInstance for subprocess management. Used by SessionFactory
 * to create the agent backing a session.
 *
 * Maintains a single-slot warm pool: one pre-initialized AgentInstance
 * (subprocess spawned + ACP initialize done) is kept ready so the next
 * createSession only pays for the newSession RPC (~300ms) instead of a
 * full subprocess spawn (~2–3s).
 *
 * Agent switching (swapping the agent mid-session) is coordinated at the
 * Session layer — AgentManager only handles individual spawn/resume calls.
 */
export class AgentManager {
  private warmEntry: WarmEntry | null = null;
  /** In-flight prewarm promise — guards against concurrent prewarm calls. */
  private warming: Promise<void> | null = null;

  constructor(private catalog: AgentCatalog) {}

  /** Return definitions for all installed agents. */
  getAvailableAgents(): AgentDefinition[] {
    const installed = this.catalog.getInstalledEntries();
    return Object.entries(installed).map(([key, agent]) => ({
      name: key,
      command: agent.command,
      args: agent.args,
      env: agent.env,
    }));
  }

  /** Look up a single agent definition by its short name (e.g., "claude", "gemini"). */
  getAgent(name: string): AgentDefinition | undefined {
    return this.catalog.resolve(name);
  }

  /**
   * Spawn-and-initialize one AgentInstance in the background for the given
   * agent/workingDir/allowedPaths. Safe to call repeatedly — a second call
   * while warming is in flight is a no-op (logged at debug), and a call while
   * a valid warm entry with matching params already exists is a no-op.
   *
   * If a warm entry exists with mismatched params, it is evicted and destroyed
   * before the new warm is started — otherwise the async spawn would complete
   * only to find the slot still occupied and destroy itself, wasting a full
   * subprocess spawn + ACP handshake and leaving the wrong entry in place.
   */
  prewarm(agentName: string, workingDir: string, allowedPaths: readonly string[] = []): void {
    if (this.warming) {
      log.debug(
        { requestedAgent: agentName, requestedWorkingDir: workingDir },
        "prewarm: another warm spawn already in flight; request dropped",
      );
      return;
    }
    if (this.warmEntry) {
      const e = this.warmEntry;
      if (
        e.agentName === agentName &&
        e.workingDir === workingDir &&
        pathListsEqual(e.allowedPaths, allowedPaths)
      ) {
        return; // exact match — no-op
      }
      // Mismatched entry — evict before warming with new params.
      this.warmEntry = null;
      e.instance.destroy().catch(() => {});
    }
    const agentDef = this.catalog.resolve(agentName);
    if (!agentDef) {
      log.debug({ agentName }, "prewarm: agent not installed, skipping");
      return;
    }
    this.warming = (async () => {
      try {
        const instance = await AgentInstance.spawnSubprocess(agentDef, workingDir, [...allowedPaths]);
        // If someone else set warmEntry while we were warming (unlikely), destroy ours.
        if (this.warmEntry) {
          await instance.destroy().catch(() => {});
          return;
        }
        this.warmEntry = {
          agentName,
          workingDir,
          allowedPaths: [...allowedPaths],
          instance,
          createdAt: Date.now(),
        };
        log.info({ agentName, workingDir }, "Agent warm-pool: instance ready");
      } catch (err) {
        log.warn({ err, agentName }, "Agent warm-pool: prewarm failed");
      } finally {
        this.warming = null;
      }
    })();
  }

  /**
   * Destroy the warm instance (if any) and clear the slot. Called from the
   * server shutdown path so the warm subprocess does not outlive its parent.
   * Best-effort — errors are swallowed since shutdown should not fail.
   */
  async destroyWarm(): Promise<void> {
    const entry = this.warmEntry;
    this.warmEntry = null;
    if (entry) {
      try { await entry.instance.destroy(); } catch { /* best effort */ }
    }
  }

  /**
   * Take the warm instance if it matches the given agent/workingDir/allowedPaths
   * AND is alive AND has not exceeded its TTL. Clears the slot in every
   * mismatch/discard branch — the caller is responsible for claiming the
   * returned instance (or discarding it if claim fails).
   *
   * `allowedPaths` is part of the match key because it is baked into the
   * subprocess's PathGuard at spawn time and cannot be safely re-applied
   * post-hoc on a warm instance.
   */
  private takeWarm(
    agentName: string,
    workingDir: string,
    allowedPaths: readonly string[],
  ): AgentInstance | null {
    const entry = this.warmEntry;
    if (!entry) return null;
    if (entry.agentName !== agentName || entry.workingDir !== workingDir) return null;
    if (!pathListsEqual(entry.allowedPaths, allowedPaths)) {
      // Security-relevant mismatch: PathGuard differs. Discard and clear.
      log.debug(
        { agentName, workingDir },
        "Warm-pool: allowedPaths mismatch on takeWarm — discarding warm",
      );
      this.warmEntry = null;
      entry.instance.destroy().catch(() => {});
      return null;
    }
    if (Date.now() - entry.createdAt > WARM_TTL_MS) {
      log.debug({ agentName, workingDir }, "Warm-pool: TTL expired — discarding warm");
      this.warmEntry = null;
      entry.instance.destroy().catch(() => {});
      return null;
    }
    if (entry.instance.isDead) {
      log.warn(
        { agentName, workingDir },
        "Warm-pool: instance died before claim — discarding",
      );
      this.warmEntry = null;
      // Subprocess is gone but listeners and StderrCapture are still referenced.
      entry.instance.destroy().catch(() => {});
      return null;
    }
    this.warmEntry = null;
    return entry.instance;
  }

  /**
   * Spawn a new agent subprocess with a fresh session.
   *
   * When a warm instance is available for the requested agent/workingDir, it is
   * claimed (only the newSession RPC is paid) instead of a full subprocess spawn.
   * After a successful warm claim, a background refill is kicked off so the next
   * caller also benefits.
   *
   * @throws If the agent is not installed — includes install instructions in the error message.
   */
  async spawn(
    agentName: string,
    workingDirectory: string,
    allowedPaths?: string[],
  ): Promise<AgentInstance> {
    const agentDef = this.getAgent(agentName);
    if (!agentDef) {
      throw new Error(
        `Agent "${agentName}" is not installed. Run "viben agents install ${agentName}" to add it.`,
      );
    }

    // Fast path: claim the warm instance if it matches (agent + workingDir + allowedPaths).
    const warm = this.takeWarm(agentName, workingDirectory, allowedPaths ?? []);
    if (warm) {
      try {
        await warm.claimForSession(workingDirectory);
        // Refill in background for the next caller.
        this.prewarm(agentName, workingDirectory, allowedPaths ?? []);
        return warm;
      } catch (err) {
        log.warn({ err, agentName }, "Warm claim failed — falling back to fresh spawn");
        warm.destroy().catch(() => {});
        // fall through to regular spawn
      }
    }

    return AgentInstance.spawn(agentDef, workingDirectory, undefined, allowedPaths);
  }

  /**
   * Spawn a subprocess and resume an existing agent session.
   *
   * Falls back to a new session if the agent cannot restore the given session ID.
   * Resume does not use the warm pool — it requires a specific existing session.
   */
  async resume(
    agentName: string,
    workingDirectory: string,
    agentSessionId: string,
    allowedPaths?: string[],
  ): Promise<AgentInstance> {
    const agentDef = this.getAgent(agentName);
    if (!agentDef) {
      throw new Error(
        `Agent "${agentName}" is not installed. Run "viben agents install ${agentName}" to add it.`,
      );
    }
    return AgentInstance.resume(agentDef, workingDirectory, agentSessionId, undefined, allowedPaths);
  }
}
