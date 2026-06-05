# ACP Registry Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the official ACP Registry CDN so users can discover, install, and use any ACP-compatible agent from CLI and Telegram — replacing manual config with an auto-managed agent store.

**Architecture:** A new `AgentCatalog` service layer sits between UI surfaces (CLI, Telegram) and the existing `AgentManager`. It reads from `~/.viben/agents.json` (installed agents), fetches registry from CDN (cached + bundled fallback), and handles install/uninstall across 3 distribution types (npx, uvx, binary). Config migration moves existing `config.agents` into the new store on first startup.

**Tech Stack:** TypeScript (ESM), Zod validation, Node.js fetch API, tar/unzip for binary extraction, Vitest for tests, grammY for Telegram UI.

**Spec:** `docs/superpowers/specs/2026-03-22-acp-registry-integration-design.md`

**UX Requirement:** All user-facing text must be friendly for non-technical users. Clear language, helpful hints, no jargon.

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `src/core/agent-store.ts` | Read/write `~/.viben/agents.json` with Zod schema |
| `src/core/agent-dependencies.ts` | Dependency map, capability map, check functions |
| `src/core/agent-installer.ts` | Install logic per distribution type (npx, uvx, binary) |
| `src/core/agent-catalog.ts` | Orchestrator: registry + store + installer + dependency checks |
| `src/data/registry-snapshot.json` | Bundled registry snapshot for offline fallback |
| `src/core/__tests__/agent-store.test.ts` | Tests for agent store |
| `src/core/__tests__/agent-dependencies.test.ts` | Tests for dependency/capability checks |
| `src/core/__tests__/agent-installer.test.ts` | Tests for installer logic |
| `src/core/__tests__/agent-catalog.test.ts` | Tests for catalog orchestration |
| `src/adapters/telegram/commands/agents.ts` | Telegram /agents, /install commands |

### Modified files

| File | What changes |
|------|--------------|
| `src/core/types.ts` | Add InstalledAgent, RegistryAgent, AgentListItem, AvailabilityResult, InstallProgress types |
| `src/core/config.ts` | Make `agents` field `.optional().default({})` |
| `src/core/config-migrations.ts` | Add `migrate-agents-to-store` migration |
| `src/core/agent-manager.ts` | Constructor takes `AgentCatalog` instead of `Config` |
| `src/core/core.ts` | Create AgentCatalog, wire to AgentManager, update handleNewSession |
| `src/core/setup.ts` | Rewrite setupAgents() to use registry + multi-select |
| `src/core/config-registry.ts` | Update defaultAgent options to read from AgentCatalog |
| `src/cli.ts` | Add `agents` command routing |
| `src/cli/commands.ts` | Add `cmdAgents()` with list/install/uninstall/refresh/info subcommands |
| `src/adapters/telegram/commands/index.ts` | Register /agents, /install commands + ag: callbacks |
| `src/adapters/telegram/commands/new-session.ts` | Add agent picker to /new flow |
| `tsup.config.ts` | Include registry-snapshot.json in bundle |

---

## Task 1: Types & Interfaces

**Files:**
- Modify: `src/core/types.ts:90-96` (after existing AgentDefinition)

- [ ] **Step 1: Add new type definitions to types.ts**

Add after the existing `AgentDefinition` interface (line 96):

```typescript
// --- Agent Registry Types ---

export type AgentDistribution = "npx" | "uvx" | "binary" | "custom";

export interface InstalledAgent {
  registryId: string | null;
  name: string;
  version: string;
  distribution: AgentDistribution;
  command: string;
  args: string[];
  env: Record<string, string>;
  workingDirectory?: string;
  installedAt: string;
  binaryPath: string | null;
}

export interface RegistryBinaryTarget {
  archive: string;
  cmd: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface RegistryDistribution {
  npx?: { package: string; args?: string[]; env?: Record<string, string> };
  uvx?: { package: string; args?: string[]; env?: Record<string, string> };
  binary?: Record<string, RegistryBinaryTarget>;
}

export interface RegistryAgent {
  id: string;
  name: string;
  version: string;
  description: string;
  repository?: string;
  website?: string;
  authors?: string[];
  license?: string;
  icon?: string;
  distribution: RegistryDistribution;
}

export interface AgentListItem {
  key: string;              // user-facing name ("claude", "gemini")
  registryId: string;       // registry id ("claude-acp", "gemini")
  name: string;             // display name ("Claude Agent")
  version: string;
  distribution: AgentDistribution;
  installed: boolean;
  available: boolean;       // can be installed (deps met, platform ok)
  missingDeps?: string[];   // human-readable missing dependency names
}

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  missing?: Array<{ label: string; installHint: string }>;
}

export interface InstallProgress {
  onStart(agentId: string, agentName: string): void | Promise<void>;
  onStep(step: string): void | Promise<void>;
  onDownloadProgress(percent: number): void | Promise<void>;
  onSuccess(agentName: string): void | Promise<void>;
  onError(error: string, hint?: string): void | Promise<void>;
}

export interface InstallResult {
  ok: boolean;
  agentKey: string;
  error?: string;
  hint?: string;
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Success (types are just declarations, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(registry): add agent registry type definitions"
```

---

## Task 2: Agent Dependencies & Capabilities

**Files:**
- Create: `src/core/agent-dependencies.ts`
- Create: `src/core/__tests__/agent-dependencies.test.ts`
- Modify: `src/core/agent-registry.ts` (kept as re-export shim)

- [ ] **Step 1: Write tests for dependency checking**

```typescript
// src/core/__tests__/agent-dependencies.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getAgentDependencies,
  getAgentCapabilities,
  checkDependencies,
  REGISTRY_AGENT_ALIASES,
  getAgentAlias,
} from "../agent-dependencies.js";

describe("agent-dependencies", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  describe("getAgentDependencies", () => {
    it("returns dependencies for known agent", () => {
      const deps = getAgentDependencies("claude-acp");
      expect(deps).toHaveLength(1);
      expect(deps[0].command).toBe("claude");
      expect(deps[0].label).toBe("Claude CLI");
      expect(deps[0].installHint).toContain("npm");
    });

    it("returns empty array for agent with no deps", () => {
      expect(getAgentDependencies("gemini")).toEqual([]);
    });

    it("returns empty array for unknown agent", () => {
      expect(getAgentDependencies("nonexistent")).toEqual([]);
    });
  });

  describe("getAgentCapabilities", () => {
    it("returns capabilities for claude", () => {
      const caps = getAgentCapabilities("claude");
      expect(caps.supportsResume).toBe(true);
      expect(caps.resumeCommand).toBeDefined();
    });

    it("returns default for unknown agent", () => {
      const caps = getAgentCapabilities("unknown");
      expect(caps.supportsResume).toBe(false);
    });
  });

  describe("REGISTRY_AGENT_ALIASES", () => {
    it("maps claude-acp to claude", () => {
      expect(getAgentAlias("claude-acp")).toBe("claude");
    });

    it("maps codex-acp to codex", () => {
      expect(getAgentAlias("codex-acp")).toBe("codex");
    });

    it("returns registry id as-is when no alias", () => {
      expect(getAgentAlias("cline")).toBe("cline");
    });

    it("maps github-copilot-cli to copilot", () => {
      expect(getAgentAlias("github-copilot-cli")).toBe("copilot");
    });
  });

  describe("checkDependencies", () => {
    it("returns available for agent with no deps", () => {
      const result = checkDependencies("gemini");
      expect(result.available).toBe(true);
    });

    it("returns available when required command exists", () => {
      vi.mock("node:child_process", () => ({
        execFileSync: vi.fn(), // which succeeds
      }));
      const result = checkDependencies("claude-acp");
      expect(result.available).toBe(true);
    });

    it("returns missing when required command not found", () => {
      vi.mock("node:child_process", () => ({
        execFileSync: vi.fn().mockImplementation(() => { throw new Error("not found"); }),
      }));
      const result = checkDependencies("claude-acp");
      expect(result.available).toBe(false);
      expect(result.missing).toHaveLength(1);
      expect(result.missing![0].label).toBe("Claude CLI");
      expect(result.missing![0].installHint).toContain("npm");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/core/__tests__/agent-dependencies.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create agent-dependencies.ts**

```typescript
// src/core/agent-dependencies.ts
import { execFileSync } from "node:child_process";
import type { AvailabilityResult } from "./types.js";

export interface AgentDependency {
  command: string;
  label: string;
  installHint: string;
}

export interface AgentCapability {
  supportsResume: boolean;
  resumeCommand?: (sessionId: string) => string;
}

// Keyed by registry ID
const AGENT_DEPENDENCIES: Record<string, AgentDependency[]> = {
  "claude-acp": [
    {
      command: "claude",
      label: "Claude CLI",
      installHint: "npm install -g @anthropic-ai/claude-code",
    },
  ],
  "codex-acp": [
    {
      command: "codex",
      label: "Codex CLI",
      installHint: "npm install -g @openai/codex",
    },
  ],
};

// Keyed by user-facing agent name
const AGENT_CAPABILITIES: Record<string, AgentCapability> = {
  claude: {
    supportsResume: true,
    resumeCommand: (sid) => `claude --resume ${sid}`,
  },
};

// Registry ID → user-facing name
export const REGISTRY_AGENT_ALIASES: Record<string, string> = {
  "claude-acp": "claude",
  "codex-acp": "codex",
  "gemini": "gemini",
  "cursor": "cursor",
  "github-copilot-cli": "copilot",
  "cline": "cline",
  "goose": "goose",
  "kilo": "kilo",
  "qwen-code": "qwen",
};

export function getAgentAlias(registryId: string): string {
  return REGISTRY_AGENT_ALIASES[registryId] ?? registryId;
}

export function getAgentDependencies(registryId: string): AgentDependency[] {
  return AGENT_DEPENDENCIES[registryId] ?? [];
}

export function getAgentCapabilities(agentName: string): AgentCapability {
  return AGENT_CAPABILITIES[agentName] ?? { supportsResume: false };
}

function commandExists(cmd: string): boolean {
  try {
    execFileSync("which", [cmd], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function checkDependencies(registryId: string): AvailabilityResult {
  const deps = getAgentDependencies(registryId);
  if (deps.length === 0) return { available: true };

  const missing = deps.filter((d) => !commandExists(d.command));
  if (missing.length === 0) return { available: true };

  return {
    available: false,
    reason: `Requires: ${missing.map((m) => m.label).join(", ")}`,
    missing: missing.map((m) => ({ label: m.label, installHint: m.installHint })),
  };
}

export function checkRuntimeAvailable(runtime: "npx" | "uvx"): boolean {
  return commandExists(runtime);
}
```

- [ ] **Step 4: Update agent-registry.ts to re-export from agent-dependencies.ts**

Replace the entire content of `src/core/agent-registry.ts` with:

```typescript
// Re-export from new consolidated module for backward compatibility
export { getAgentCapabilities } from "./agent-dependencies.js";
export type { AgentCapability } from "./agent-dependencies.js";
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- src/core/__tests__/agent-dependencies.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite to check nothing broke**

Run: `pnpm test`
Expected: All existing tests PASS (agent-registry.ts still exports same interface)

- [ ] **Step 7: Commit**

```bash
git add src/core/agent-dependencies.ts src/core/__tests__/agent-dependencies.test.ts src/core/agent-registry.ts
git commit -m "feat(registry): add agent dependency map and capability registry"
```

---

## Task 3: Agent Store

**Files:**
- Create: `src/core/agent-store.ts`
- Create: `src/core/__tests__/agent-store.test.ts`

- [ ] **Step 1: Write tests for agent store**

```typescript
// src/core/__tests__/agent-store.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { AgentStore } from "../agent-store.js";

vi.mock("node:fs");
vi.mock("node:os", () => ({ homedir: () => "/home/testuser" }));

describe("AgentStore", () => {
  let store: AgentStore;

  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    store = new AgentStore();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  describe("load", () => {
    it("creates empty store if file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      store.load();
      expect(store.getInstalled()).toEqual({});
    });

    it("loads existing agents from file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        version: 1,
        installed: {
          claude: {
            registryId: "claude-acp",
            name: "Claude Agent",
            version: "0.22.2",
            distribution: "npx",
            command: "npx",
            args: ["@zed-industries/claude-agent-acp@0.22.2"],
            env: {},
            installedAt: "2026-03-22T00:00:00.000Z",
            binaryPath: null,
          },
        },
      }));
      store.load();
      const installed = store.getInstalled();
      expect(installed["claude"]).toBeDefined();
      expect(installed["claude"].name).toBe("Claude Agent");
    });
  });

  describe("addAgent / removeAgent", () => {
    it("adds agent and persists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
      store.load();
      store.addAgent("gemini", {
        registryId: "gemini",
        name: "Gemini CLI",
        version: "0.34.0",
        distribution: "npx",
        command: "npx",
        args: ["@google/gemini-cli@0.34.0", "--acp"],
        env: {},
        installedAt: new Date().toISOString(),
        binaryPath: null,
      });
      expect(store.getAgent("gemini")).toBeDefined();
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled();
    });

    it("removes agent and persists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
      store.load();
      store.addAgent("gemini", {
        registryId: "gemini",
        name: "Gemini CLI",
        version: "0.34.0",
        distribution: "npx",
        command: "npx",
        args: ["@google/gemini-cli@0.34.0", "--acp"],
        env: {},
        installedAt: new Date().toISOString(),
        binaryPath: null,
      });
      store.removeAgent("gemini");
      expect(store.getAgent("gemini")).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/core/__tests__/agent-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create agent-store.ts**

```typescript
// src/core/agent-store.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { z } from "zod";
import type { InstalledAgent } from "./types.js";
import { createChildLogger } from "./log.js";

const log = createChildLogger({ module: "agent-store" });

const InstalledAgentSchema = z.object({
  registryId: z.string().nullable(),
  name: z.string(),
  version: z.string(),
  distribution: z.enum(["npx", "uvx", "binary", "custom"]),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  workingDirectory: z.string().optional(),
  installedAt: z.string(),
  binaryPath: z.string().nullable().default(null),
});

const AgentStoreSchema = z.object({
  version: z.number().default(1),
  installed: z.record(z.string(), InstalledAgentSchema).default({}),
});

type AgentStoreData = z.infer<typeof AgentStoreSchema>;

export class AgentStore {
  private data: AgentStoreData = { version: 1, installed: {} };
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(os.homedir(), ".viben", "agents.json");
  }

  load(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      this.data = { version: 1, installed: {} };
      return;
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
      const result = AgentStoreSchema.safeParse(raw);
      if (result.success) {
        this.data = result.data;
      } else {
        log.warn({ errors: result.error.issues }, "Invalid agents.json, starting fresh");
        this.data = { version: 1, installed: {} };
      }
    } catch (err) {
      log.warn({ err }, "Failed to read agents.json, starting fresh");
      this.data = { version: 1, installed: {} };
    }
  }

  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  getInstalled(): Record<string, InstalledAgent> {
    return this.data.installed;
  }

  getAgent(key: string): InstalledAgent | undefined {
    return this.data.installed[key];
  }

  addAgent(key: string, agent: InstalledAgent): void {
    this.data.installed[key] = agent;
    this.save();
  }

  removeAgent(key: string): void {
    delete this.data.installed[key];
    this.save();
  }

  hasAgent(key: string): boolean {
    return key in this.data.installed;
  }

  private save(): void {
    const tmpPath = this.filePath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmpPath, this.filePath);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- src/core/__tests__/agent-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/agent-store.ts src/core/__tests__/agent-store.test.ts
git commit -m "feat(registry): add agent store for ~/.viben/agents.json"
```

---

## Task 4: Agent Installer

**Files:**
- Create: `src/core/agent-installer.ts`
- Create: `src/core/__tests__/agent-installer.test.ts`

- [ ] **Step 1: Write tests for installer**

```typescript
// src/core/__tests__/agent-installer.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveDistribution,
  getPlatformKey,
  buildInstalledAgent,
} from "../agent-installer.js";
import type { RegistryAgent } from "../types.js";

describe("agent-installer", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  describe("getPlatformKey", () => {
    it("returns correct key for darwin arm64", () => {
      vi.stubGlobal("process", { ...process, platform: "darwin", arch: "arm64" });
      expect(getPlatformKey()).toBe("darwin-aarch64");
    });

    it("returns correct key for linux x64", () => {
      vi.stubGlobal("process", { ...process, platform: "linux", arch: "x64" });
      expect(getPlatformKey()).toBe("linux-x86_64");
    });
  });

  describe("resolveDistribution", () => {
    it("prefers npx when available", () => {
      const agent: RegistryAgent = {
        id: "test",
        name: "Test",
        version: "1.0.0",
        description: "test",
        distribution: {
          npx: { package: "test@1.0.0", args: ["--acp"] },
          binary: { "darwin-aarch64": { archive: "https://example.com/test.tar.gz", cmd: "./test" } },
        },
      };
      const result = resolveDistribution(agent);
      expect(result?.type).toBe("npx");
    });

    it("falls back to binary when no npx/uvx", () => {
      const agent: RegistryAgent = {
        id: "test",
        name: "Test",
        version: "1.0.0",
        description: "test",
        distribution: {
          binary: { "darwin-aarch64": { archive: "https://example.com/test.tar.gz", cmd: "./test" } },
        },
      };
      const result = resolveDistribution(agent);
      expect(result?.type).toBe("binary");
    });
  });

  describe("buildInstalledAgent", () => {
    it("builds npx agent correctly", () => {
      const result = buildInstalledAgent(
        "claude-acp",
        "Claude Agent",
        "0.22.2",
        { type: "npx", package: "@zed-industries/claude-agent-acp@0.22.2", args: [] },
      );
      expect(result.command).toBe("npx");
      expect(result.args).toEqual(["@zed-industries/claude-agent-acp@0.22.2"]);
      expect(result.distribution).toBe("npx");
    });

    it("builds uvx agent correctly", () => {
      const result = buildInstalledAgent(
        "crow-cli",
        "crow-cli",
        "0.1.14",
        { type: "uvx", package: "crow-cli", args: ["acp"] },
      );
      expect(result.command).toBe("uvx");
      expect(result.args).toEqual(["crow-cli", "acp"]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/core/__tests__/agent-installer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create agent-installer.ts**

```typescript
// src/core/agent-installer.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createChildLogger } from "./log.js";
import type { InstalledAgent, RegistryAgent, InstallProgress, InstallResult } from "./types.js";
import { expandHome } from "./config.js";
import { getAgentAlias, checkDependencies, checkRuntimeAvailable } from "./agent-dependencies.js";
import { AgentStore } from "./agent-store.js";

const log = createChildLogger({ module: "agent-installer" });

const AGENTS_DIR = path.join(os.homedir(), ".viben", "agents");

const ARCH_MAP: Record<string, string> = {
  arm64: "aarch64",
  x64: "x86_64",
};

const PLATFORM_MAP: Record<string, string> = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows",
};

export function getPlatformKey(): string {
  const platform = PLATFORM_MAP[process.platform] ?? process.platform;
  const arch = ARCH_MAP[process.arch] ?? process.arch;
  return `${platform}-${arch}`;
}

export type ResolvedDistribution =
  | { type: "npx"; package: string; args: string[]; env?: Record<string, string> }
  | { type: "uvx"; package: string; args: string[]; env?: Record<string, string> }
  | { type: "binary"; archive: string; cmd: string; args: string[]; env?: Record<string, string> };

export function resolveDistribution(agent: RegistryAgent): ResolvedDistribution | null {
  const dist = agent.distribution;

  // Prefer npx > uvx > binary
  if (dist.npx) {
    return {
      type: "npx",
      package: dist.npx.package,
      args: dist.npx.args ?? [],
      env: dist.npx.env,
    };
  }

  if (dist.uvx) {
    return {
      type: "uvx",
      package: dist.uvx.package,
      args: dist.uvx.args ?? [],
      env: dist.uvx.env,
    };
  }

  if (dist.binary) {
    const platformKey = getPlatformKey();
    const target = dist.binary[platformKey];
    if (!target) return null;
    return {
      type: "binary",
      archive: target.archive,
      cmd: target.cmd,
      args: target.args ?? [],
      env: target.env,
    };
  }

  return null;
}

export function buildInstalledAgent(
  registryId: string,
  name: string,
  version: string,
  dist: ResolvedDistribution,
  binaryPath?: string,
): InstalledAgent {
  if (dist.type === "npx") {
    return {
      registryId,
      name,
      version,
      distribution: "npx",
      command: "npx",
      args: [dist.package, ...dist.args],
      env: dist.env ?? {},
      installedAt: new Date().toISOString(),
      binaryPath: null,
    };
  }

  if (dist.type === "uvx") {
    return {
      registryId,
      name,
      version,
      distribution: "uvx",
      command: "uvx",
      args: [dist.package, ...dist.args],
      env: dist.env ?? {},
      installedAt: new Date().toISOString(),
      binaryPath: null,
    };
  }

  // binary
  const absCmd = path.resolve(binaryPath!, dist.cmd);
  return {
    registryId,
    name,
    version,
    distribution: "binary",
    command: absCmd,
    args: dist.args,
    env: dist.env ?? {},
    installedAt: new Date().toISOString(),
    binaryPath: binaryPath!,
  };
}

export async function installAgent(
  agent: RegistryAgent,
  store: AgentStore,
  progress?: InstallProgress,
): Promise<InstallResult> {
  const agentKey = getAgentAlias(agent.id);
  await progress?.onStart(agent.id, agent.name);

  // 1. Check dependencies
  await progress?.onStep("Checking requirements...");
  const depResult = checkDependencies(agent.id);
  if (!depResult.available) {
    const hints = depResult.missing!.map((m) => `  ${m.label}: ${m.installHint}`).join("\n");
    const msg = `${agent.name} needs some tools installed first:\n${hints}`;
    await progress?.onError(msg);
    return { ok: false, agentKey, error: msg };
  }

  // 2. Resolve distribution
  const dist = resolveDistribution(agent);
  if (!dist) {
    const platformKey = getPlatformKey();
    const msg = `${agent.name} is not available for your system (${platformKey}). Check their website for other install options.`;
    await progress?.onError(msg);
    return { ok: false, agentKey, error: msg };
  }

  // 3. Check runtime
  if (dist.type === "uvx" && !checkRuntimeAvailable("uvx")) {
    const msg = `${agent.name} requires Python's uvx tool.\nInstall it with: pip install uv`;
    await progress?.onError(msg, "pip install uv");
    return { ok: false, agentKey, error: msg, hint: "pip install uv" };
  }

  // 4. Install based on type
  let binaryPath: string | undefined;

  if (dist.type === "binary") {
    try {
      binaryPath = await downloadAndExtract(agent.id, dist.archive, progress);
    } catch (err) {
      const msg = `Failed to download ${agent.name}. Please try again or install manually.`;
      await progress?.onError(msg);
      return { ok: false, agentKey, error: msg };
    }
  } else {
    await progress?.onStep("Setting up... (will download on first use)");
  }

  // 5. Save to store
  const installed = buildInstalledAgent(agent.id, agent.name, agent.version, dist, binaryPath);
  store.addAgent(agentKey, installed);

  await progress?.onSuccess(agent.name);
  return { ok: true, agentKey };
}

async function downloadAndExtract(
  agentId: string,
  archiveUrl: string,
  progress?: InstallProgress,
): Promise<string> {
  const destDir = path.join(AGENTS_DIR, agentId);
  fs.mkdirSync(destDir, { recursive: true });

  await progress?.onStep("Downloading...");
  log.info({ agentId, url: archiveUrl }, "Downloading agent binary");

  const response = await fetch(archiveUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const buffer = await readResponseWithProgress(response, contentLength, progress);

  await progress?.onStep("Extracting...");

  if (archiveUrl.endsWith(".zip")) {
    await extractZip(buffer, destDir);
  } else {
    await extractTarGz(buffer, destDir);
  }

  await progress?.onStep("Ready!");
  return destDir;
}

async function readResponseWithProgress(
  response: Response,
  contentLength: number,
  progress?: InstallProgress,
): Promise<Buffer> {
  if (!response.body || contentLength === 0) {
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (contentLength > 0) {
      progress?.onDownloadProgress(Math.round((received / contentLength) * 100));
    }
  }

  return Buffer.concat(chunks);
}

async function extractTarGz(buffer: Buffer, destDir: string): Promise<void> {
  const { execFileSync } = await import("node:child_process");
  const tmpFile = path.join(destDir, "_archive.tar.gz");
  fs.writeFileSync(tmpFile, buffer);
  try {
    execFileSync("tar", ["xzf", tmpFile, "-C", destDir], { stdio: "pipe" });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

async function extractZip(buffer: Buffer, destDir: string): Promise<void> {
  const { execFileSync } = await import("node:child_process");
  const tmpFile = path.join(destDir, "_archive.zip");
  fs.writeFileSync(tmpFile, buffer);
  try {
    execFileSync("unzip", ["-o", tmpFile, "-d", destDir], { stdio: "pipe" });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

export async function uninstallAgent(
  agentKey: string,
  store: AgentStore,
): Promise<void> {
  const agent = store.getAgent(agentKey);
  if (!agent) return;

  // Delete binary files if applicable
  if (agent.binaryPath && fs.existsSync(agent.binaryPath)) {
    fs.rmSync(agent.binaryPath, { recursive: true, force: true });
    log.info({ agentKey, binaryPath: agent.binaryPath }, "Deleted agent binary");
  }

  store.removeAgent(agentKey);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- src/core/__tests__/agent-installer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/agent-installer.ts src/core/__tests__/agent-installer.test.ts
git commit -m "feat(registry): add agent installer with npx/uvx/binary support"
```

---

## Task 5: Registry Snapshot & Cache

**Files:**
- Create: `src/data/registry-snapshot.json`
- Modify: `tsup.config.ts`

- [ ] **Step 1: Fetch current registry and save as snapshot**

Run: `curl -s https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json > src/data/registry-snapshot.json`

- [ ] **Step 2: Verify snapshot is valid JSON**

Run: `node -e "const d = JSON.parse(require('fs').readFileSync('./src/data/registry-snapshot.json')); console.log(d.agents.length + ' agents')"`

- [ ] **Step 3: Update tsup.config.ts to copy snapshot into bundle**

Add `registry-snapshot.json` to the build so it ships with the npm package. In `tsup.config.ts`, add a `copy` plugin or handle via the existing `scripts/build-publish.ts` script. Check the script first:

Read `scripts/build-publish.ts` to understand the build process, then add a step to copy `src/data/registry-snapshot.json` to `dist-publish/dist/data/registry-snapshot.json`.

- [ ] **Step 4: Verify build includes snapshot**

Run: `pnpm build:publish && ls dist-publish/dist/data/`
Expected: `registry-snapshot.json` present

- [ ] **Step 5: Commit**

```bash
git add src/data/registry-snapshot.json tsup.config.ts scripts/build-publish.ts
git commit -m "feat(registry): bundle registry snapshot for offline fallback"
```

---

## Task 6: Agent Catalog

**Files:**
- Create: `src/core/agent-catalog.ts`
- Create: `src/core/__tests__/agent-catalog.test.ts`

- [ ] **Step 1: Write tests for catalog**

```typescript
// src/core/__tests__/agent-catalog.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentCatalog } from "../agent-catalog.js";

// Mock dependencies
vi.mock("node:fs");
vi.mock("node:os", () => ({ homedir: () => "/home/testuser" }));

describe("AgentCatalog", () => {
  let catalog: AgentCatalog;

  beforeEach(() => {
    catalog = new AgentCatalog();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  describe("resolve", () => {
    it("returns AgentDefinition for installed agent", () => {
      // Pre-populate store via mock fs
      const storeData = {
        version: 1,
        installed: {
          claude: {
            registryId: "claude-acp",
            name: "Claude Agent",
            version: "0.22.2",
            distribution: "npx",
            command: "npx",
            args: ["@zed-industries/claude-agent-acp@0.22.2"],
            env: {},
            installedAt: "2026-03-22T00:00:00.000Z",
            binaryPath: null,
          },
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storeData));
      catalog.load();

      const def = catalog.resolve("claude");
      expect(def).toBeDefined();
      expect(def!.name).toBe("claude");
      expect(def!.command).toBe("npx");
      expect(def!.args).toContain("@zed-industries/claude-agent-acp@0.22.2");
    });

    it("returns undefined for unknown agent", () => {
      catalog.load();
      expect(catalog.resolve("nonexistent")).toBeUndefined();
    });
  });

  describe("getAvailable", () => {
    it("marks installed agents and registry-only agents correctly", () => {
      // Setup store with claude installed
      const storeData = {
        version: 1,
        installed: {
          claude: {
            registryId: "claude-acp", name: "Claude Agent", version: "0.22.2",
            distribution: "npx", command: "npx", args: [], env: {},
            installedAt: "2026-03-22T00:00:00.000Z", binaryPath: null,
          },
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storeData));
      catalog.load();

      const items = catalog.getAvailable();
      const claudeItem = items.find((i) => i.key === "claude");
      expect(claudeItem?.installed).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/core/__tests__/agent-catalog.test.ts`
Expected: FAIL

- [ ] **Step 3: Create agent-catalog.ts**

```typescript
// src/core/agent-catalog.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
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
} from "./types.js";
import { expandHome } from "./config.js";
import { createChildLogger } from "./log.js";

const log = createChildLogger({ module: "agent-catalog" });

const REGISTRY_URL = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";
const CACHE_PATH = path.join(os.homedir(), ".viben", "registry-cache.json");
const DEFAULT_TTL_HOURS = 24;

interface RegistryCache {
  fetchedAt: string;
  ttlHours: number;
  data: { agents: RegistryAgent[] };
}

export class AgentCatalog {
  private store: AgentStore;
  private registryAgents: RegistryAgent[] = [];

  constructor(store?: AgentStore) {
    this.store = store ?? new AgentStore();
  }

  /** Load store + registry (cache or snapshot) */
  load(): void {
    this.store.load();
    this.loadRegistryFromCacheOrSnapshot();
  }

  // --- Registry ---

  async fetchRegistry(): Promise<void> {
    try {
      log.info("Fetching agent registry from CDN...");
      const response = await fetch(REGISTRY_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { agents: RegistryAgent[] };
      this.registryAgents = data.agents ?? [];

      // Save cache
      const cache: RegistryCache = {
        fetchedAt: new Date().toISOString(),
        ttlHours: DEFAULT_TTL_HOURS,
        data,
      };
      fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
      log.info({ count: this.registryAgents.length }, "Registry updated");
    } catch (err) {
      log.warn({ err }, "Failed to fetch registry, using cached data");
    }
  }

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

  /** Find registry agent by user-facing key or registry ID */
  findRegistryAgent(keyOrId: string): RegistryAgent | undefined {
    // Try registry ID first
    const byId = this.registryAgents.find((a) => a.id === keyOrId);
    if (byId) return byId;
    // Try matching by alias
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

  getAvailable(): AgentListItem[] {
    const installed = this.store.getInstalled();
    const items: AgentListItem[] = [];
    const seenKeys = new Set<string>();

    // Add installed agents first
    for (const [key, agent] of Object.entries(installed)) {
      seenKeys.add(key);
      const availability = agent.registryId
        ? checkDependencies(agent.registryId)
        : { available: true };
      items.push({
        key,
        registryId: agent.registryId ?? key,
        name: agent.name,
        version: agent.version,
        distribution: agent.distribution,
        installed: true,
        available: availability.available,
        missingDeps: availability.missing?.map((m) => m.label),
      });
    }

    // Add registry agents not yet installed
    for (const agent of this.registryAgents) {
      const alias = getAgentAlias(agent.id);
      if (seenKeys.has(alias)) continue;
      seenKeys.add(alias);

      const dist = resolveDistribution(agent);
      const availability = checkDependencies(agent.id);

      items.push({
        key: alias,
        registryId: agent.id,
        name: agent.name,
        version: agent.version,
        distribution: dist?.type ?? "binary",
        installed: false,
        available: dist !== null && availability.available,
        missingDeps: availability.missing?.map((m) => m.label),
      });
    }

    return items;
  }

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

  async install(keyOrId: string, progress?: InstallProgress, force?: boolean): Promise<InstallResult> {
    const agent = this.findRegistryAgent(keyOrId);
    if (!agent) {
      const msg = `"${keyOrId}" was not found in the agent registry. Run "viben agents" to see what's available.`;
      progress?.onError(msg);
      return { ok: false, agentKey: keyOrId, error: msg };
    }

    const agentKey = getAgentAlias(agent.id);
    if (this.store.hasAgent(agentKey) && !force) {
      const existing = this.store.getAgent(agentKey)!;
      const msg = `${agent.name} is already installed (v${existing.version}). Use --force to reinstall.`;
      progress?.onError(msg);
      return { ok: false, agentKey, error: msg };
    }

    return installAgent(agent, this.store, progress);
  }

  async uninstall(key: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.store.hasAgent(key)) {
      return { ok: false, error: `"${key}" is not installed.` };
    }
    await uninstallAgent(key, this.store);
    return { ok: true };
  }

  // --- Resolution (for AgentManager) ---

  resolve(key: string): AgentDefinition | undefined {
    const agent = this.store.getAgent(key);
    if (!agent) return undefined;
    return {
      name: key,
      command: agent.command,
      args: agent.args,
      workingDirectory: agent.workingDirectory,
      env: agent.env,
    };
  }

  // --- Internal ---

  private isCacheStale(): boolean {
    if (!fs.existsSync(CACHE_PATH)) return true;
    try {
      const raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as RegistryCache;
      const fetchedAt = new Date(raw.fetchedAt).getTime();
      const ttlMs = (raw.ttlHours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000;
      return Date.now() - fetchedAt > ttlMs;
    } catch {
      return true;
    }
  }

  private loadRegistryFromCacheOrSnapshot(): void {
    // Try cache first
    if (fs.existsSync(CACHE_PATH)) {
      try {
        const raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as RegistryCache;
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
      const snapshotPath = path.join(import.meta.dirname, "data", "registry-snapshot.json");
      // Also try alternate path for tsc builds
      const altPath = path.join(import.meta.dirname, "..", "data", "registry-snapshot.json");
      const actualPath = fs.existsSync(snapshotPath) ? snapshotPath : altPath;

      if (fs.existsSync(actualPath)) {
        const raw = JSON.parse(fs.readFileSync(actualPath, "utf-8"));
        this.registryAgents = raw.agents ?? [];
        log.debug({ count: this.registryAgents.length }, "Loaded registry from bundled snapshot");
      } else {
        log.warn("No registry data available (no cache, no snapshot)");
      }
    } catch {
      log.warn("Failed to load bundled registry snapshot");
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- src/core/__tests__/agent-catalog.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/agent-catalog.ts src/core/__tests__/agent-catalog.test.ts
git commit -m "feat(registry): add AgentCatalog service layer"
```

---

## Task 7: Config Migration

**Files:**
- Modify: `src/core/config.ts:60-63` (make agents optional)
- Modify: `src/core/config-migrations.ts` (add migration)
- Modify: `src/core/__tests__/config-migrations.test.ts` (add test)

- [ ] **Step 1: Write test for migration**

Add to `src/core/__tests__/config-migrations.test.ts`:

```typescript
describe("migrate-agents-to-store", () => {
  it("clears config.agents when agents.json does not exist", () => {
    vi.mock("node:fs", async () => {
      const actual = await vi.importActual("node:fs");
      return { ...actual, existsSync: vi.fn().mockReturnValue(false) };
    });

    const raw = {
      agents: {
        claude: { command: "claude-agent-acp", args: [], env: {} },
        codex: { command: "codex", args: ["--acp"], env: {} },
      },
      defaultAgent: "claude",
    };
    const migration = migrations.find((m) => m.name === "migrate-agents-to-store");
    expect(migration).toBeDefined();
    // Migration should return true (changed)
    // After migration, raw.agents should be {}
  });

  it("does not run if agents.json already exists", () => {
    vi.mock("node:fs", async () => {
      const actual = await vi.importActual("node:fs");
      return { ...actual, existsSync: vi.fn().mockReturnValue(true) };
    });

    const raw = {
      agents: {
        claude: { command: "claude-agent-acp", args: [], env: {} },
      },
    };
    const migration = migrations.find((m) => m.name === "migrate-agents-to-store");
    const changed = migration!.apply(raw);
    expect(changed).toBe(false);
    expect(raw.agents).toHaveProperty("claude"); // Not cleared
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/__tests__/config-migrations.test.ts`
Expected: FAIL — migration not found

- [ ] **Step 3: Make agents optional in ConfigSchema**

In `src/core/config.ts`, change line 62:

```typescript
// Before:
agents: z.record(z.string(), AgentSchema),

// After:
agents: z.record(z.string(), AgentSchema).optional().default({}),
```

- [ ] **Step 4: Add migration to config-migrations.ts**

Append to the `migrations` array (after `fix-agent-commands`):

```typescript
{
  name: "migrate-agents-to-store",
  apply(raw) {
    // Only migrate if agents.json does not already exist
    const agentsJsonPath = path.join(os.homedir(), ".viben", "agents.json");
    if (fs.existsSync(agentsJsonPath)) return false;

    const agents = raw.agents as Record<string, any> | undefined;
    if (!agents || Object.keys(agents).length === 0) return false;

    // Known command → registry ID mapping
    const COMMAND_TO_REGISTRY: Record<string, string> = {
      "claude-agent-acp": "claude-acp",
      "codex": "codex-acp",
    };

    const installed: Record<string, any> = {};
    for (const [key, cfg] of Object.entries(agents)) {
      const registryId = COMMAND_TO_REGISTRY[cfg.command] ?? null;
      // Use "custom" distribution for migrated agents — they use the old
      // command resolution path (PATH/node_modules), not npx/uvx.
      installed[key] = {
        registryId,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        version: "unknown",
        distribution: "custom",
        command: cfg.command,
        args: cfg.args ?? [],
        env: cfg.env ?? {},
        workingDirectory: cfg.workingDirectory ?? undefined,
        installedAt: new Date().toISOString(),
        binaryPath: null,
      };
    }

    // Write agents.json
    fs.mkdirSync(path.dirname(agentsJsonPath), { recursive: true });
    fs.writeFileSync(agentsJsonPath, JSON.stringify({ version: 1, installed }, null, 2));

    // Clear agents from config
    raw.agents = {};
    return true;
  },
},
```

Add the required imports at the top of `config-migrations.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- src/core/__tests__/config-migrations.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: All PASS (config schema still accepts old configs with agents field)

- [ ] **Step 7: Commit**

```bash
git add src/core/config.ts src/core/config-migrations.ts src/core/__tests__/config-migrations.test.ts
git commit -m "feat(registry): add config migration to move agents to agents.json"
```

---

## Task 8: Wire AgentCatalog into Core

**Files:**
- Modify: `src/core/agent-manager.ts`
- Modify: `src/core/core.ts`
- Modify: `src/core/config-registry.ts`

- [ ] **Step 1: Refactor AgentManager to use AgentCatalog**

Replace `src/core/agent-manager.ts`:

```typescript
import type { AgentDefinition } from "./types.js";
import { AgentInstance } from "./agent-instance.js";
import type { AgentCatalog } from "./agent-catalog.js";

export class AgentManager {
  constructor(private catalog: AgentCatalog) {}

  getAvailableAgents(): AgentDefinition[] {
    const installed = this.catalog.getInstalledEntries();
    return Object.entries(installed).map(([key, agent]) => ({
      name: key,
      command: agent.command,
      args: agent.args,
      env: agent.env,
    }));
  }

  getAgent(name: string): AgentDefinition | undefined {
    return this.catalog.resolve(name);
  }

  async spawn(
    agentName: string,
    workingDirectory: string,
  ): Promise<AgentInstance> {
    const agentDef = this.getAgent(agentName);
    if (!agentDef) throw new Error(`Agent "${agentName}" is not installed. Run "viben agents install ${agentName}" to add it.`);
    return AgentInstance.spawn(agentDef, workingDirectory);
  }

  async resume(
    agentName: string,
    workingDirectory: string,
    agentSessionId: string,
  ): Promise<AgentInstance> {
    const agentDef = this.getAgent(agentName);
    if (!agentDef) throw new Error(`Agent "${agentName}" is not installed. Run "viben agents install ${agentName}" to add it.`);
    return AgentInstance.resume(agentDef, workingDirectory, agentSessionId);
  }
}
```

- [ ] **Step 2: Update core.ts to create AgentCatalog**

In `src/core/core.ts`:

Add import:
```typescript
import { AgentCatalog } from "./agent-catalog.js";
```

In the constructor (after `configManager` setup, before `agentManager`):
```typescript
this.agentCatalog = new AgentCatalog();
this.agentCatalog.load();
this.agentManager = new AgentManager(this.agentCatalog);
```

Add property:
```typescript
agentCatalog: AgentCatalog;
```

Remove old line:
```typescript
// Remove: this.agentManager = new AgentManager(config);
```

Update `handleNewSession` (around line 251-268):
```typescript
async handleNewSession(
  channelId: string,
  agentName?: string,
  workspacePath?: string,
): Promise<Session> {
  const config = this.configManager.get();
  const resolvedAgent = agentName || config.defaultAgent;
  log.info({ channelId, agentName: resolvedAgent }, "New session request");
  const agentDef = this.agentCatalog.resolve(resolvedAgent);
  const resolvedWorkspace = this.configManager.resolveWorkspace(
    workspacePath || agentDef?.workingDirectory,
  );

  return this.createSession({
    channelId,
    agentName: resolvedAgent,
    workingDirectory: resolvedWorkspace,
  });
}
```

Add startup method or add to existing start():
```typescript
async start(): Promise<void> {
  // Refresh registry if stale (non-blocking — use cached/snapshot if fetch fails)
  this.agentCatalog.refreshRegistryIfStale().catch((err) => {
    log.warn({ err }, "Background registry refresh failed");
  });

  for (const adapter of this.adapters.values()) {
    await adapter.start();
  }
}
```

- [ ] **Step 3: Update config-registry.ts defaultAgent options**

In `src/core/config-registry.ts`, the `defaultAgent` field uses `options: (config) => Object.keys(config.agents)`. This needs to read from the agent store instead. Since config-registry doesn't have access to the catalog, change to:

```typescript
// line 20-21: change options function
options: (config) => {
  // Read from agents.json if it exists, fallback to config.agents
  try {
    const agentsPath = path.join(os.homedir(), ".viben", "agents.json");
    if (fs.existsSync(agentsPath)) {
      const data = JSON.parse(fs.readFileSync(agentsPath, "utf-8"));
      return Object.keys(data.installed ?? {});
    }
  } catch { /* fallback */ }
  return Object.keys(config.agents ?? {});
},
```

Add imports for `fs`, `path`, `os` if not already present.

- [ ] **Step 4: Build and run full tests**

Run: `pnpm build && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/agent-manager.ts src/core/core.ts src/core/config-registry.ts
git commit -m "feat(registry): wire AgentCatalog into core and agent manager"
```

---

## Task 9: CLI Commands

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/cli/commands.ts`

- [ ] **Step 1: Add agents command routing in cli.ts**

In `src/cli.ts`, add to the commands record:

```typescript
'agents': () => cmdAgents(args),
```

Add import:
```typescript
import { ..., cmdAgents } from './cli/commands.js'
```

- [ ] **Step 2: Implement cmdAgents in commands.ts**

Add to `src/cli/commands.ts`:

```typescript
export async function cmdAgents(args: string[]): Promise<void> {
  const subcommand = args[1];

  switch (subcommand) {
    case "install":
      return agentsInstall(args[2], args.includes("--force"));
    case "uninstall":
      return agentsUninstall(args[2]);
    case "refresh":
      return agentsRefresh();
    case "info":
      return agentsInfo(args[2]);
    default:
      return agentsList();
  }
}

async function agentsList(): Promise<void> {
  const { AgentCatalog } = await import("../core/agent-catalog.js");
  const catalog = new AgentCatalog();
  catalog.load();
  await catalog.refreshRegistryIfStale();

  const items = catalog.getAvailable();
  const installed = items.filter((i) => i.installed);
  const available = items.filter((i) => !i.installed);

  console.log("");
  if (installed.length > 0) {
    console.log("  \x1b[1mInstalled agents:\x1b[0m");
    for (const item of installed) {
      const deps = item.missingDeps?.length
        ? `  \x1b[33m(needs: ${item.missingDeps.join(", ")})\x1b[0m`
        : "";
      console.log(
        `  \x1b[32m✓\x1b[0m ${item.key.padEnd(18)} ${item.name.padEnd(22)} v${item.version.padEnd(10)} ${item.distribution}${deps}`,
      );
    }
    console.log("");
  }

  if (available.length > 0) {
    console.log("  \x1b[1mAvailable to install:\x1b[0m");
    for (const item of available) {
      const icon = item.available ? "\x1b[2m⬇\x1b[0m" : "\x1b[33m⚠\x1b[0m";
      const deps = item.missingDeps?.length
        ? `  \x1b[33m(needs: ${item.missingDeps.join(", ")})\x1b[0m`
        : "";
      console.log(
        `  ${icon} ${item.key.padEnd(18)} ${item.name.padEnd(22)} v${item.version.padEnd(10)} ${item.distribution}${deps}`,
      );
    }
    console.log("");
  }

  console.log(
    `  \x1b[2mInstall an agent: viben agents install <name>\x1b[0m`,
  );
  console.log("");
}

async function agentsInstall(nameOrId: string | undefined, force: boolean): Promise<void> {
  if (!nameOrId) {
    console.log("Usage: viben agents install <name>");
    console.log("  Run 'viben agents' to see available agents.");
    return;
  }

  const { AgentCatalog } = await import("../core/agent-catalog.js");
  const catalog = new AgentCatalog();
  catalog.load();
  await catalog.refreshRegistryIfStale();

  const progress: import("../core/types.js").InstallProgress = {
    onStart(id, name) {
      process.stdout.write(`\n  ⏳ Installing ${name}...\n`);
    },
    onStep(step) {
      process.stdout.write(`  ✓ ${step}\n`);
    },
    onDownloadProgress(percent) {
      process.stdout.write(`\r  ⬇ Downloading... ${percent}%`);
      if (percent >= 100) process.stdout.write("\n");
    },
    onSuccess(name) {
      console.log(`  \x1b[32m✓ ${name} installed successfully!\x1b[0m\n`);
    },
    onError(error) {
      console.log(`  \x1b[31m✗ ${error}\x1b[0m\n`);
    },
  };

  const result = await catalog.install(nameOrId, progress, force);
  if (!result.ok) {
    process.exit(1);
  }
}

async function agentsUninstall(name: string | undefined): Promise<void> {
  if (!name) {
    console.log("Usage: viben agents uninstall <name>");
    return;
  }

  const { AgentCatalog } = await import("../core/agent-catalog.js");
  const catalog = new AgentCatalog();
  catalog.load();

  const result = await catalog.uninstall(name);
  if (result.ok) {
    console.log(`\n  \x1b[32m✓ ${name} removed.\x1b[0m\n`);
  } else {
    console.log(`\n  \x1b[31m✗ ${result.error}\x1b[0m\n`);
  }
}

async function agentsRefresh(): Promise<void> {
  const { AgentCatalog } = await import("../core/agent-catalog.js");
  const catalog = new AgentCatalog();
  catalog.load();
  console.log("\n  Updating agent list...");
  await catalog.fetchRegistry();
  console.log("  \x1b[32m✓ Agent list updated.\x1b[0m\n");
}

async function agentsInfo(nameOrId: string | undefined): Promise<void> {
  if (!nameOrId) {
    console.log("Usage: viben agents info <name>");
    return;
  }

  const { AgentCatalog } = await import("../core/agent-catalog.js");
  const { checkDependencies } = await import("../core/agent-dependencies.js");
  const catalog = new AgentCatalog();
  catalog.load();

  // Check installed first
  const installed = catalog.getInstalledAgent(nameOrId);
  if (installed) {
    console.log(`\n  \x1b[1m${installed.name}\x1b[0m`);
    console.log(`  Version:      ${installed.version}`);
    console.log(`  Type:         ${installed.distribution}`);
    console.log(`  Command:      ${installed.command} ${installed.args.join(" ")}`);
    console.log(`  Installed:    ${new Date(installed.installedAt).toLocaleDateString()}`);
    if (installed.binaryPath) console.log(`  Binary path:  ${installed.binaryPath}`);
    console.log("");
    return;
  }

  // Check registry
  const regAgent = catalog.findRegistryAgent(nameOrId);
  if (regAgent) {
    const availability = catalog.checkAvailability(nameOrId);
    console.log(`\n  \x1b[1m${regAgent.name}\x1b[0m \x1b[2m(not installed)\x1b[0m`);
    console.log(`  ${regAgent.description}`);
    console.log(`  Version:    ${regAgent.version}`);
    console.log(`  License:    ${regAgent.license ?? "unknown"}`);
    if (regAgent.website) console.log(`  Website:    ${regAgent.website}`);
    if (regAgent.repository) console.log(`  Source:     ${regAgent.repository}`);
    console.log(`  Available:  ${availability.available ? "\x1b[32mYes\x1b[0m" : `\x1b[33mNo\x1b[0m — ${availability.reason}`}`);
    console.log(`\n  Install: viben agents install ${nameOrId}\n`);
    return;
  }

  console.log(`\n  \x1b[31m"${nameOrId}" not found.\x1b[0m Run 'viben agents' to see available agents.\n`);
}
```

- [ ] **Step 3: Build and verify**

Run: `pnpm build`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts src/cli/commands.ts
git commit -m "feat(registry): add viben agents CLI commands"
```

---

## Task 10: Update Setup Flow

**Files:**
- Modify: `src/core/setup.ts`

- [ ] **Step 1: Rewrite setupAgents() to use registry**

Replace the `setupAgents` function and related constants in `src/core/setup.ts`:

```typescript
export async function setupAgents(): Promise<{
  defaultAgent: string;
}> {
  const { AgentCatalog } = await import("./agent-catalog.js");
  const { select, checkbox } = await import("@inquirer/prompts");

  const catalog = new AgentCatalog();
  catalog.load();

  // Try to fetch latest registry
  console.log(dim("  Checking available agents..."));
  await catalog.refreshRegistryIfStale();

  const available = catalog.getAvailable();
  const installable = available.filter((a) => !a.installed && a.available);

  // Claude is always pre-installed (bundled dependency)
  if (!catalog.getInstalledAgent("claude")) {
    // Auto-install claude from registry or fallback to bundled
    const claudeRegistry = catalog.findRegistryAgent("claude-acp");
    if (claudeRegistry) {
      await catalog.install("claude-acp");
    } else {
      // Fallback: register bundled claude-agent-acp
      const { AgentStore } = await import("./agent-store.js");
      const store = new AgentStore();
      store.load();
      store.addAgent("claude", {
        registryId: "claude-acp",
        name: "Claude Agent",
        version: "bundled",
        distribution: "npx",
        command: "npx",
        args: ["@zed-industries/claude-agent-acp"],
        env: {},
        installedAt: new Date().toISOString(),
        binaryPath: null,
      });
    }
  }
  console.log(ok("Claude Agent ready"));

  // Offer additional agents
  if (installable.length > 0) {
    const choices = installable.slice(0, 10).map((a) => ({
      name: `${a.name} (${a.distribution})`,
      value: a.key,
      checked: false,
    }));

    const selected = await checkbox({
      message: "Install additional agents? (Space to select, Enter to continue)",
      choices,
    });

    for (const key of selected) {
      const regAgent = catalog.findRegistryAgent(key);
      if (regAgent) {
        process.stdout.write(`  Installing ${regAgent.name}... `);
        const result = await catalog.install(key);
        if (result.ok) {
          console.log(ok("done"));
        } else {
          console.log(warn(`skipped: ${result.error}`));
        }
      }
    }
  }

  // Choose default agent
  const installedAgents = Object.keys(catalog.getInstalledEntries());
  let defaultAgent = "claude";

  if (installedAgents.length > 1) {
    defaultAgent = await select({
      message: "Which agent should be the default?",
      choices: installedAgents.map((key) => {
        const agent = catalog.getInstalledAgent(key)!;
        return { name: `${agent.name} (${key})`, value: key };
      }),
      default: "claude",
    });
  }

  console.log(ok(`Default agent: \x1b[1m${defaultAgent}\x1b[0m`));
  return { defaultAgent };
}
```

Update `runSetup()` to not write agents to config:

```typescript
// In runSetup(), replace:
//   const { agents, defaultAgent } = await setupAgents();
// With:
const { defaultAgent } = await setupAgents();

// And in the config object, remove agents field:
const config: Config = {
  channels: { telegram },
  agents: {},  // Empty — agents now live in agents.json
  defaultAgent,
  // ... rest stays the same
};
```

Remove or keep `KNOWN_AGENTS`, `commandExists`, `detectAgents`, `validateAgentCommand` — keep them for backward compat since they may be imported elsewhere, but they won't be called from setup anymore.

- [ ] **Step 2: Build and verify**

Run: `pnpm build`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git add src/core/setup.ts
git commit -m "feat(registry): rewrite setup flow to use agent registry"
```

---

## Task 11: Telegram Agent Commands

**Files:**
- Create: `src/adapters/telegram/commands/agents.ts`
- Modify: `src/adapters/telegram/commands/index.ts`
- Modify: `src/adapters/telegram/commands/new-session.ts`

- [ ] **Step 1: Create agents command handler**

```typescript
// src/adapters/telegram/commands/agents.ts
import type { Context } from "grammy";
import type { VibenCore } from "../../../core/core.js";
import { InlineKeyboard } from "grammy";

export async function handleAgents(ctx: Context, core: VibenCore): Promise<void> {
  const catalog = core.agentCatalog;
  const items = catalog.getAvailable();

  const installed = items.filter((i) => i.installed);
  const available = items.filter((i) => !i.installed);

  let text = "<b>🤖 Agents</b>\n\n";

  if (installed.length > 0) {
    text += "<b>Installed:</b>\n";
    for (const item of installed) {
      text += `✅ <b>${item.name}</b> — ${item.distribution}\n`;
    }
    text += "\n";
  }

  if (available.length > 0) {
    text += "<b>Available to install:</b>\n";
    const shown = available.slice(0, 12);
    for (const item of shown) {
      if (item.available) {
        text += `⬇️ ${item.name}\n`;
      } else {
        const deps = item.missingDeps?.join(", ") ?? "requirements not met";
        text += `⚠️ ${item.name} <i>(needs: ${deps})</i>\n`;
      }
    }
    if (available.length > 12) {
      text += `\n<i>...and ${available.length - 12} more. Use /install &lt;name&gt; to add any agent.</i>\n`;
    }
  }

  // Build inline keyboard for available agents
  const keyboard = new InlineKeyboard();
  const installable = available.filter((i) => i.available).slice(0, 6);
  for (let i = 0; i < installable.length; i += 3) {
    const row = installable.slice(i, i + 3);
    for (const item of row) {
      keyboard.text(`Install ${item.name}`, `ag:install:${item.key}`);
    }
    keyboard.row();
  }

  await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
}

export async function handleInstall(ctx: Context, core: VibenCore): Promise<void> {
  const text = (ctx.message?.text ?? "").trim();
  const parts = text.split(/\s+/);
  const nameOrId = parts[1];

  if (!nameOrId) {
    await ctx.reply(
      "To install an agent, use:\n<code>/install gemini</code>\n\nUse /agents to see what's available.",
      { parse_mode: "HTML" },
    );
    return;
  }

  await installAgentWithProgress(ctx, core, nameOrId);
}

export async function handleAgentInstallCallback(ctx: Context, core: VibenCore): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const nameOrId = data.replace("ag:install:", "");
  await ctx.answerCallbackQuery();
  await installAgentWithProgress(ctx, core, nameOrId);
}

async function installAgentWithProgress(ctx: Context, core: VibenCore, nameOrId: string): Promise<void> {
  const catalog = core.agentCatalog;
  const msg = await ctx.reply(`⏳ Installing ${nameOrId}...`);

  let lastEdit = 0;
  const EDIT_THROTTLE_MS = 1000;

  const progress: import("../../../core/types.js").InstallProgress = {
    onStart(_id, name) {
      // Already sent initial message
    },
    async onStep(step) {
      const now = Date.now();
      if (now - lastEdit > EDIT_THROTTLE_MS) {
        lastEdit = now;
        try {
          await ctx.api.editMessageText(msg.chat.id, msg.message_id, `⏳ ${nameOrId}: ${step}`);
        } catch { /* rate limit or message unchanged */ }
      }
    },
    async onDownloadProgress(percent) {
      const now = Date.now();
      if (now - lastEdit > EDIT_THROTTLE_MS) {
        lastEdit = now;
        try {
          await ctx.api.editMessageText(msg.chat.id, msg.message_id, `⏳ ${nameOrId}: Downloading... ${percent}%`);
        } catch { /* rate limit */ }
      }
    },
    async onSuccess(name) {
      try {
        const keyboard = new InlineKeyboard().text(`Start session with ${name}`, `na:${nameOrId}`);
        await ctx.api.editMessageText(msg.chat.id, msg.message_id, `✅ ${name} installed!`, { reply_markup: keyboard });
      } catch { /* ignore */ }
    },
    async onError(error) {
      try {
        await ctx.api.editMessageText(msg.chat.id, msg.message_id, `❌ ${error}`);
      } catch { /* ignore */ }
    },
  };

  await catalog.install(nameOrId, progress);
}
```

- [ ] **Step 2: Register commands in index.ts**

In `src/adapters/telegram/commands/index.ts`:

**IMPORTANT:** Remove the old `handleAgents` import from `./menu.js` and its registration in `setupCommands()`. The new `handleAgents` from `./agents.js` replaces it.

Add imports:
```typescript
import { handleAgents, handleInstall, handleAgentInstallCallback } from "./agents.js";
```

Remove from the `menu.js` import line:
```typescript
// Remove: handleAgents from the import { ... } from "./menu.js" line
```

In `setupCommands()`, replace the old agents handler:
```typescript
// Remove: bot.command("agents", (ctx) => handleAgents(ctx, core));  // old menu.js version
// Add:
bot.command("agents", (ctx) => handleAgents(ctx, core));  // new agents.js version
bot.command("install", (ctx) => handleInstall(ctx, core));
```

In `setupAllCallbacks()`, before the broad `m:` handler:
```typescript
bot.callbackQuery(/^ag:/, (ctx) => handleAgentInstallCallback(ctx, core));
bot.callbackQuery(/^na:/, async (ctx) => {
  const agentKey = ctx.callbackQuery.data!.replace("na:", "");
  await ctx.answerCallbackQuery();
  // Import and use the session creation flow
  const { executeNewSession } = await import("./new-session.js");
  await executeNewSession(ctx, core, chatId, agentKey);
});
```

In the broad `m:` switch, replace:
```typescript
case "m:agents": await handleAgents(ctx, core); break;
```

**Verify:** Confirm that `src/core/api-server.ts` and `src/adapters/telegram/adapter.ts` still work with the `agent-registry.ts` re-export shim (they import `getAgentCapabilities` which is re-exported from `agent-dependencies.ts`).

- [ ] **Step 3: Add agent picker to /new flow**

In `src/adapters/telegram/commands/new-session.ts`, modify the section that handles multiple agents. When user has multiple installed agents and does not specify one:

```typescript
// Show agent picker with installed agents only
const installedEntries = core.agentCatalog.getInstalledEntries();
const agentKeys = Object.keys(installedEntries);

if (agentKeys.length > 1 && !agentName) {
  const keyboard = new InlineKeyboard();
  for (const key of agentKeys) {
    const agent = installedEntries[key];
    keyboard.text(agent.name, `na:${key}`).row();
  }
  await ctx.reply("Which agent should handle this session?", { reply_markup: keyboard });
  return;
}
```

Add callback handler for `na:` prefix — create session with selected agent:

```typescript
bot.callbackQuery(/^na:/, async (ctx) => {
  const agentKey = ctx.callbackQuery.data.replace("na:", "");
  await ctx.answerCallbackQuery();
  // Create session with the selected agent
  // ... (use existing createSessionDirect or core.handleNewSession with agentKey)
});
```

- [ ] **Step 4: Update STATIC_COMMANDS**

In `src/adapters/telegram/commands/index.ts`, update `STATIC_COMMANDS` to include:
```typescript
{ command: "install", description: "Install a new agent" },
```

The `/agents` command should already be in the list. If not, add it.

- [ ] **Step 5: Build and verify**

Run: `pnpm build`
Expected: Success

- [ ] **Step 6: Commit**

```bash
git add src/adapters/telegram/commands/agents.ts src/adapters/telegram/commands/index.ts src/adapters/telegram/commands/new-session.ts
git commit -m "feat(registry): add Telegram agent browse, install, and per-session selection"
```

---

## Task 12: Update Help Text & Exports

**Files:**
- Modify: `src/cli/commands.ts` (help text)
- Modify: `src/index.ts` (public API exports)

- [ ] **Step 1: Update printHelp() in commands.ts**

Add agents commands to the help output:

```
  agents                List available agents
  agents install <name> Install an agent from the registry
  agents uninstall <name> Remove an installed agent
  agents refresh        Update the agent list
  agents info <name>    Show agent details
```

- [ ] **Step 2: Export AgentCatalog from index.ts**

Add to `src/index.ts`:

```typescript
export { AgentCatalog } from "./core/agent-catalog.js";
export { AgentStore } from "./core/agent-store.js";
export type { InstalledAgent, RegistryAgent, AgentListItem } from "./core/types.js";
```

- [ ] **Step 3: Build and full test**

Run: `pnpm build && pnpm test`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands.ts src/index.ts
git commit -m "feat(registry): update help text and public API exports"
```

---

## Task 13: Copy registry snapshot in build

**Files:**
- Modify: `scripts/build-publish.ts` (or equivalent build script)

- [ ] **Step 1: Read build-publish.ts to understand the build pipeline**

Read `scripts/build-publish.ts` and determine how to add a step to copy `src/data/registry-snapshot.json` into the output directory.

- [ ] **Step 2: Add copy step for registry snapshot**

Ensure `src/data/registry-snapshot.json` → `dist/data/registry-snapshot.json` (for tsc build) and `dist-publish/dist/data/registry-snapshot.json` (for tsup bundle).

For the tsc build, add to `tsconfig.json` (if not already copying assets):
```json
"include": ["src/**/*.ts", "src/data/*.json"]
```

Or add a simple copy step in the build script.

- [ ] **Step 3: Verify both builds include the snapshot**

Run: `pnpm build && ls dist/data/`
Run: `pnpm build:publish && ls dist-publish/dist/data/`
Expected: `registry-snapshot.json` present in both

- [ ] **Step 4: Commit**

```bash
git add scripts/build-publish.ts tsconfig.json
git commit -m "build: include registry snapshot in dist output"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 2: Build both targets**

Run: `pnpm build && pnpm build:publish`
Expected: Success

- [ ] **Step 3: Manual smoke test — CLI agents list**

Run: `node dist/cli.js agents`
Expected: Shows installed + available agents with friendly formatting

- [ ] **Step 4: Manual smoke test — CLI agents info**

Run: `node dist/cli.js agents info claude`
Expected: Shows Claude agent details

- [ ] **Step 5: Manual smoke test — config migration**

Create a test config with old-style agents and verify migration:
1. Backup `~/.viben/config.json`
2. Add `agents` field back to config
3. Delete `~/.viben/agents.json`
4. Run `node dist/cli.js agents`
5. Verify `agents.json` was created and `config.json` agents is now `{}`
6. Restore backup

- [ ] **Step 6: Commit any fixes from smoke testing**

```bash
git add -A
git commit -m "fix(registry): fixes from end-to-end testing"
```
