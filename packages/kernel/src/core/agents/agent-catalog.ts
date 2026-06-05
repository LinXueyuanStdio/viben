import * as fs from "node:fs";
import * as path from "node:path";
import { AgentStore } from "./agent-store.js";
import { installAgent, uninstallAgent, resolveDistribution } from "./agent-installer.js";
import { getAgentAlias, checkDependencies } from "./agent-dependencies.js";
import type {
  AgentDefinition,
  RegistryAgent,
  AgentListItem,
  AvailabilityResult,
  InstallProgress,
  InstallResult,
  InstalledAgent,
} from "../types.js";
import { createChildLogger } from "../utils/log.js";

const log = createChildLogger({ module: "agent-catalog" });

const REGISTRY_URL = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";
const DEFAULT_TTL_HOURS = 24;

interface RegistryCache {
  fetchedAt: string;
  ttlHours: number;
  data: { agents: RegistryAgent[] };
}

/**
 * Central catalog of available and installed agents.
 *
 * Combines two data sources:
 *  1. **Registry** — the remote ACP agent registry (CDN-hosted JSON), cached
 *     locally with a 24-hour TTL and a bundled snapshot as fallback.
 *  2. **Store** — locally installed agents persisted in `agents.json`.
 *
 * Provides discovery (list all agents), installation, uninstallation,
 * and resolution (name → AgentDefinition for spawning).
 */
export class AgentCatalog {
  private store: AgentStore;
  /** Agents available in the remote registry (cached in memory after load). */
  private registryAgents: RegistryAgent[] = [];
  private cachePath: string;
  /** Directory where binary agent archives are extracted to. */
  private agentsDir: string | undefined;

  constructor(store: AgentStore, cachePath: string, agentsDir?: string) {
    this.store = store;
    this.cachePath = cachePath;
    this.agentsDir = agentsDir;
  }

  /**
   * Load installed agents from disk and hydrate the registry from cache/snapshot.
   *
   * Also enriches installed agents with registry metadata — fixes agents that
   * were migrated from older config formats with incomplete data.
   */
  load(): void {
    this.store.load();
    this.loadRegistryFromCacheOrSnapshot();
    this.enrichInstalledFromRegistry();
  }

  // --- Registry ---

  /** Fetch the latest agent registry from the CDN and update the local cache. */
  async fetchRegistry(): Promise<void> {
    try {
      log.info("Fetching agent registry from CDN...");
      const response = await fetch(REGISTRY_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { agents: RegistryAgent[] };
      this.registryAgents = data.agents ?? [];

      const cache: RegistryCache = {
        fetchedAt: new Date().toISOString(),
        ttlHours: DEFAULT_TTL_HOURS,
        data,
      };
      fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
      fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), { mode: 0o600 });
      log.info({ count: this.registryAgents.length }, "Registry updated");
    } catch (err) {
      log.warn({ err }, "Failed to fetch registry, using cached data");
    }
  }

  /** Re-fetch registry only if the local cache has expired (24-hour TTL). */
  async refreshRegistryIfStale(): Promise<void> {
    if (this.isCacheStale()) {
      await this.fetchRegistry();
    }
  }

  getRegistryAgents(): RegistryAgent[] {
    return this.registryAgents;
  }

  getRegistryAgent(registryId: string): RegistryAgent | undefined {
    return this.registryAgents.find((a) => a.id === registryId);
  }

  /** Find a registry agent by registry ID or by its short alias (e.g., "claude"). */
  findRegistryAgent(keyOrId: string): RegistryAgent | undefined {
    const byId = this.registryAgents.find((a) => a.id === keyOrId);
    if (byId) return byId;
    return this.registryAgents.find((a) => getAgentAlias(a.id) === keyOrId);
  }

  // --- Installed ---

  getInstalled(): InstalledAgent[] {
    return Object.values(this.store.getInstalled());
  }

  getInstalledEntries(): Record<string, InstalledAgent> {
    return this.store.getInstalled();
  }

  getInstalledAgent(key: string): InstalledAgent | undefined {
    return this.store.getAgent(key);
  }

  // --- Discovery ---

  /**
   * Build the unified list of all agents (installed + registry-only).
   *
   * Installed agents appear first with their live availability status.
   * Registry agents that aren't installed yet show whether a distribution
   * exists for the current platform. Missing external dependencies
   * (e.g., claude CLI) are surfaced as `missingDeps` for UI display
   * but do NOT block installation.
   */
  getAvailable(): AgentListItem[] {
    const installed = this.getInstalledEntries();
    const items: AgentListItem[] = [];
    const seenKeys = new Set<string>();

    for (const [key, agent] of Object.entries(installed)) {
      seenKeys.add(key);
      const availability = agent.registryId
        ? checkDependencies(agent.registryId)
        : { available: true };
      const registryEntry = agent.registryId
        ? this.registryAgents.find((a) => a.id === agent.registryId)
        : undefined;
      items.push({
        key,
        registryId: agent.registryId ?? key,
        name: agent.name,
        version: agent.version,
        description: registryEntry?.description,
        distribution: agent.distribution,
        installed: true,
        available: availability.available,
        missingDeps: availability.missing?.map((m) => m.label),
      });
    }

    for (const agent of this.registryAgents) {
      const alias = getAgentAlias(agent.id);
      if (seenKeys.has(alias)) continue;
      seenKeys.add(alias);

      const dist = resolveDistribution(agent);
      const availability = checkDependencies(agent.id);

      // An uninstalled agent is "available" (shows Install button) as long as a
      // distribution exists for this platform. Missing external dependencies
      // (e.g. claude CLI, codex CLI) are surfaced via missingDeps so the UI can
      // show post-install setup instructions — they should NOT block installation.
      items.push({
        key: alias,
        registryId: agent.id,
        name: agent.name,
        version: agent.version,
        description: agent.description,
        distribution: dist?.type ?? "binary",
        installed: false,
        available: dist !== null,
        missingDeps: availability.missing?.map((m) => m.label),
      });
    }

    return items;
  }

  /** Check if an agent can be installed on this system (platform + dependencies). */
  checkAvailability(keyOrId: string): AvailabilityResult {
    const agent = this.findRegistryAgent(keyOrId);
    if (!agent) return { available: false, reason: "Not found in the agent registry." };

    const dist = resolveDistribution(agent);
    if (!dist) {
      return { available: false, reason: `Not available for your system. Check ${agent.website ?? agent.repository ?? "their website"} for other options.` };
    }

    return checkDependencies(agent.id);
  }

  // --- Install/Uninstall ---

  /**
   * Install an agent from the registry.
   *
   * Resolves the distribution (npx/uvx/binary), downloads binary archives
   * if needed, and persists the agent definition in the store.
   */
  async install(keyOrId: string, progress?: InstallProgress, force?: boolean): Promise<InstallResult> {
    const agent = this.findRegistryAgent(keyOrId);
    if (!agent) {
      const msg = `"${keyOrId}" was not found in the agent registry. Run "viben agents" to see what's available.`;
      await progress?.onError(msg);
      return { ok: false, agentKey: keyOrId, error: msg };
    }

    const agentKey = getAgentAlias(agent.id);
    if (this.store.hasAgent(agentKey) && !force) {
      const existing = this.store.getAgent(agentKey)!;
      const msg = `${agent.name} is already installed (v${existing.version}). Use --force to reinstall.`;
      await progress?.onError(msg);
      return { ok: false, agentKey, error: msg };
    }

    return installAgent(agent, this.store, progress, this.agentsDir);
  }

  /**
   * Register an agent directly into the catalog store without going through
   * the registry installer. Used to pre-register bundled agents (e.g. Claude)
   * when their CLI dependency is not yet installed.
   */
  registerFallbackAgent(key: string, data: InstalledAgent): void {
    this.store.addAgent(key, data);
  }

  /** Remove an installed agent and delete its binary directory if applicable. */
  async uninstall(key: string): Promise<{ ok: boolean; error?: string }> {
    if (this.store.hasAgent(key)) {
      await uninstallAgent(key, this.store);
      return { ok: true };
    }
    return { ok: false, error: `"${key}" is not installed.` };
  }

  // --- Resolution (for AgentManager) ---

  /** Convert an installed agent's short key to an AgentDefinition for spawning. */
  resolve(key: string): AgentDefinition | undefined {
    const agent = this.store.getAgent(key);
    if (!agent) return undefined;
    return {
      name: key,
      command: agent.command,
      args: agent.args,
      workingDirectory: agent.workingDirectory,
      env: agent.env,
      initTimeoutMs: agent.initTimeoutMs,
    };
  }

  // --- Internal ---

  /**
   * Enrich installed agents (especially migrated ones) with registry data.
   * Fixes agents that were migrated with version:"unknown", distribution:"custom",
   * or generic names by matching them to registry entries.
   */
  private enrichInstalledFromRegistry(): void {
    const installed = this.store.getInstalled();
    let changed = false;

    for (const [key, agent] of Object.entries(installed)) {
      const regAgent = agent.registryId
        ? this.registryAgents.find((a) => a.id === agent.registryId)
        : this.registryAgents.find((a) => getAgentAlias(a.id) === key);

      if (!regAgent) continue;

      let updated = false;

      // Enrich name if it's a generic capitalized key (e.g. "Claude" from migration)
      if (agent.name !== regAgent.name) {
        agent.name = regAgent.name;
        updated = true;
      }

      // Enrich version if unknown
      if (agent.version === "unknown") {
        agent.version = regAgent.version;
        updated = true;
      }

      // Enrich registryId if missing
      if (!agent.registryId) {
        agent.registryId = regAgent.id;
        updated = true;
      }

      // Enrich distribution from "custom" to actual type.
      // Also fix command/args — agents.json created by `viben setup` uses the
      // agent name as the command placeholder rather than the real ACP binary.
      // Binary agents can't be enriched here (the archive hasn't been downloaded),
      // so we only fix npx/uvx which need no download.
      if (agent.distribution === "custom") {
        const dist = resolveDistribution(regAgent);
        if (dist) {
          agent.distribution = dist.type;
          if (dist.type === "npx") {
            agent.command = "npx";
            agent.args = [stripNpmVersion(dist.package), ...dist.args];
            updated = true;
          } else if (dist.type === "uvx") {
            agent.command = "uvx";
            agent.args = [stripPythonVersion(dist.package), ...dist.args];
            updated = true;
          }
          // binary: skip — binary must be downloaded via `viben agents install`
        }
      }

      if (updated) {
        this.store.addAgent(key, agent);
        changed = true;
      }
    }

    if (changed) {
      log.info("Enriched installed agents with registry data");
    }
  }

  private isCacheStale(): boolean {
    if (!fs.existsSync(this.cachePath)) return true;
    try {
      const raw = JSON.parse(fs.readFileSync(this.cachePath, "utf-8") as string) as RegistryCache;
      const fetchedAt = new Date(raw.fetchedAt).getTime();
      const ttlMs = (raw.ttlHours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000;
      return Date.now() - fetchedAt > ttlMs;
    } catch {
      return true;
    }
  }

  private loadRegistryFromCacheOrSnapshot(): void {
    // Try cache first
    if (fs.existsSync(this.cachePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.cachePath, "utf-8") as string) as RegistryCache;
        if (raw.data?.agents) {
          this.registryAgents = raw.data.agents;
          log.debug({ count: this.registryAgents.length }, "Loaded registry from cache");
          return;
        }
      } catch {
        log.warn("Failed to load registry cache");
      }
    }

    // Fallback: bundled snapshot
    try {
      // Try multiple paths for tsc and tsup builds
      const candidates = [
        path.join(import.meta.dirname, "data", "registry-snapshot.json"),
        path.join(import.meta.dirname, "..", "data", "registry-snapshot.json"),
        path.join(import.meta.dirname, "..", "..", "data", "registry-snapshot.json"),
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const raw = JSON.parse(fs.readFileSync(candidate, "utf-8") as string);
          this.registryAgents = raw.agents ?? [];
          log.debug({ count: this.registryAgents.length }, "Loaded registry from bundled snapshot");
          return;
        }
      }

      log.warn("No registry data available (no cache, no snapshot)");
    } catch {
      log.warn("Failed to load bundled registry snapshot");
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strip pinned npm version so npx always resolves to latest.
 * Mirrors the logic in agent-installer.ts `stripPackageVersion`.
 * e.g. "@agentclientprotocol/claude-agent-acp@0.26.0" → "@agentclientprotocol/claude-agent-acp"
 *      "cline@2.9.0" → "cline"
 *      "@scope/pkg" → "@scope/pkg"
 */
function stripNpmVersion(pkg: string): string {
  if (pkg.startsWith("@")) {
    const slashIdx = pkg.indexOf("/");
    if (slashIdx === -1) return pkg;
    const versionAt = pkg.indexOf("@", slashIdx + 1);
    return versionAt === -1 ? pkg : pkg.slice(0, versionAt);
  }
  const at = pkg.indexOf("@");
  return at === -1 ? pkg : pkg.slice(0, at);
}

/**
 * Strip pinned Python version so uvx always resolves to latest.
 * Mirrors the logic in agent-installer.ts `stripPythonPackageVersion`.
 * e.g. "fast-agent-acp==0.6.6" → "fast-agent-acp"
 *      "minion-code@0.1.44" → "minion-code"
 */
function stripPythonVersion(pkg: string): string {
  const pyMatch = pkg.match(/^([^=@><!]+)/);
  if (pyMatch && pkg.includes("==")) return pyMatch[1]!;
  const at = pkg.indexOf("@");
  return at === -1 ? pkg : pkg.slice(0, at);
}
