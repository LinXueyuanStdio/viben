# ACP Registry Integration Design

## Overview

Integrate the official ACP Registry (CDN) as the source of truth for discovering, installing, and managing ACP-compatible agents in Viben. Replace the current manual agent configuration in `config.json` with a dedicated `AgentCatalog` service layer backed by `~/.viben/agents.json`.

## Goals

- Use the ACP Registry CDN (`cdn.agentclientprotocol.com/registry/v1/latest/registry.json`) as the canonical agent catalog
- Support all 3 distribution types: npx, uvx, binary
- Auto-migrate existing `config.agents` users to the new `agents.json` store
- Agent selection from CLI (setup + commands) and Telegram (per-session)
- Dependency checking for agents that require base CLIs (e.g., claude-acp needs `claude`)
- Progress reporting for installs in both CLI and Telegram
- Bundle a registry snapshot for offline use, cache with TTL for online

## Architecture

```
Sources:
  1. Registry CDN (fetched + cached)
  2. Bundled registry-snapshot.json (offline fallback)
  3. ~/.viben/agents.json (installed agents — single source of truth)

Flow:
  CLI / Telegram
       ↓
  AgentCatalog (registry, cache, install, resolve)
       ↓
  AgentManager (spawn, resume — unchanged interface)
       ↓
  AgentInstance (subprocess + ACP protocol — unchanged)
```

## Data Architecture

### Agent Key Identity

**The agent key used throughout Viben is the user-facing name (e.g., `"claude"`, `"gemini"`, `"cursor"`), NOT the registry ID (e.g., `"claude-acp"`, `"gemini"`).**

- `agents.json` keys = user-facing names (same as old `config.agents` keys)
- `registryId` is stored as metadata for registry lookups, but never used as the primary key
- Session records (`agentName`), `defaultAgent`, CLI commands, Telegram commands — all use user-facing names
- This preserves backward compatibility with existing session records in `sessions.json`

Registry ID → user-facing name mapping is maintained in a `REGISTRY_AGENT_ALIASES` map:

```typescript
const REGISTRY_AGENT_ALIASES: Record<string, string> = {
  "claude-acp": "claude",
  "codex-acp": "codex",
  "gemini": "gemini",       // same
  "cursor": "cursor",       // same
  "github-copilot-cli": "copilot",
  "cline": "cline",         // same
  // ... auto-generated for agents where id === name
};
```

### `~/.viben/agents.json`

Single source of truth for installed agents. Replaces `config.agents`.

```json
{
  "version": 1,
  "installed": {
    "claude": {
      "registryId": "claude-acp",
      "name": "Claude Agent",
      "version": "0.22.2",
      "distribution": "npx",
      "command": "npx",
      "args": ["@zed-industries/claude-agent-acp@0.22.2"],
      "env": {},
      "installedAt": "2026-03-22T00:00:00.000Z",
      "binaryPath": null
    },
    "cursor": {
      "registryId": "cursor",
      "name": "Cursor",
      "version": "0.1.0",
      "distribution": "binary",
      "command": "/Users/user/.viben/agents/cursor/dist-package/cursor-agent",
      "args": ["acp"],
      "env": {},
      "installedAt": "2026-03-22T00:00:00.000Z",
      "binaryPath": "/Users/user/.viben/agents/cursor/"
    }
  }
}
```

Note: All paths are stored as **absolute paths** (expanded from `~`). The `expandHome()` utility is applied at install time, not at resolve time. This avoids issues with `child_process.spawn()` which does not expand `~`.

### `~/.viben/registry-cache.json` (separate file)

Registry cache lives in its own file to avoid unnecessary I/O when updating installed agents:

```json
{
  "fetchedAt": "2026-03-22T00:00:00.000Z",
  "ttlHours": 24,
  "data": { /* full registry.json from CDN */ }
}
```

### `config.json` changes

- **Make optional**: `agents` field becomes `.optional().default({})` in Zod schema (not removed entirely — old configs with `agents` still parse correctly)
- **Keep**: `defaultAgent` (user preference)
- After migration, `agents` will be empty `{}` in config, but its presence won't cause errors

### Migration

On startup, if `config.json` has a non-empty `agents` field AND `agents.json` does not exist:

1. Create `agents.json`
2. Map each config agent to `InstalledAgent` format, **preserving the original key name**:
   - `claude: { command: "claude-agent-acp" }` → key `"claude"`, `{ registryId: "claude-acp", distribution: "npx", command: "npx", args: ["@zed-industries/claude-agent-acp"] }`
   - `codex: { command: "codex", args: ["--acp"] }` → key `"codex"`, `{ registryId: "codex-acp", distribution: "npx", command: "npx", args: ["@zed-industries/codex-acp"] }`
   - Unknown agents → key preserved, `{ registryId: null, distribution: "custom", command: <original>, args: <original> }`
3. Set `config.agents` to `{}` (empty, not deleted — Zod schema still expects the field to be parseable)
4. `defaultAgent` value stays unchanged (keys are preserved, so no dangling reference)
5. Save both files
6. Log: `"Migrated X agents to new agent store"`

**Idempotency**: Migration only runs if `agents.json` does not exist AND `config.agents` is non-empty. Concurrent starts writing identical content is benign.

**Ordering**: This migration must be appended AFTER the existing `fix-agent-commands` migration in the migrations array, so legacy command names are corrected before being migrated to `agents.json`.

### Bundled registry snapshot

- File: `src/data/registry-snapshot.json` (committed, generated at build time via script)
- Used when: no cache file exists AND fetch fails (offline)
- Updated periodically by maintainers or CI

### Custom agents

Users can add agents not in the registry by editing `agents.json` directly or via a future `viben agents add --name <name> --command <cmd> --args <args>` CLI command. These have `registryId: null` and `distribution: "custom"`.

## Dependency Map

Hard-coded in `src/core/agent-dependencies.ts`.

This file also takes over `AgentCapability` and `getAgentCapabilities` from the current `agent-registry.ts`, consolidating all agent metadata (dependencies + capabilities) in one place.

```typescript
interface AgentDependency {
  command: string;       // CLI to check in PATH
  label: string;         // Human-readable name
  installHint: string;   // How to install
}

interface AgentCapability {
  supportsResume: boolean;
  resumeCommand?: (sessionId: string) => string;
}

// Keyed by registry ID
const AGENT_DEPENDENCIES: Record<string, AgentDependency[]> = {
  "claude-acp": [
    { command: "claude", label: "Claude CLI", installHint: "npm install -g @anthropic-ai/claude-code" }
  ],
  "codex-acp": [
    { command: "codex", label: "Codex CLI", installHint: "npm install -g @openai/codex" }
  ],
};

// Keyed by user-facing agent name (for backward compat with existing callers)
const AGENT_CAPABILITIES: Record<string, AgentCapability> = {
  claude: { supportsResume: true, resumeCommand: (sid) => `claude --resume ${sid}` },
};

export function getAgentCapabilities(agentName: string): AgentCapability { ... }
export function getAgentDependencies(registryId: string): AgentDependency[] { ... }
```

`agent-registry.ts` is removed. Its exports are re-exported from `agent-dependencies.ts` for backward compat during transition.

Agents not in the dependency map have no dependencies. New dependencies are added as needed via code updates.

## AgentCatalog Service Layer

### Interface

```typescript
class AgentCatalog {
  // Registry
  async fetchRegistry(): Promise<void>
  getRegistryAgents(): RegistryAgent[]

  // Installed
  getInstalled(): InstalledAgent[]
  getInstalledAgent(id: string): InstalledAgent | undefined

  // Discovery
  getAvailable(): AgentListItem[]              // installed ✅ + registry ⬇️
  checkAvailability(id: string): AvailabilityResult

  // Install/Uninstall
  async install(id: string, progress?: InstallProgress): Promise<InstallResult>
  async uninstall(id: string): Promise<void>

  // Resolution
  resolve(id: string): AgentDefinition | undefined

  // Cache
  async refreshRegistryIfStale(): Promise<void>
}
```

### Integration with existing code

`AgentManager` constructor changes from `Config` to `AgentCatalog`:

```typescript
// Before:
class AgentManager {
  constructor(private config: Config) {}
  getAgent(name: string) { return this.config.agents[name]; }
}

// After:
class AgentManager {
  constructor(private catalog: AgentCatalog) {}
  getAgent(name: string) { return this.catalog.resolve(name); }
}
```

`AgentManager` keeps its public interface (`spawn`, `resume`, `getAgent`, `getAvailableAgents`) unchanged. Only the data source changes.

### VibenCore lifecycle

```typescript
// constructor:
this.agentCatalog = new AgentCatalog();
this.agentManager = new AgentManager(this.agentCatalog);

// startup:
await this.agentCatalog.refreshRegistryIfStale();
```

### `handleNewSession` update

Current code accesses `config.agents[resolvedAgent]?.workingDirectory` directly. This must change to use `AgentCatalog`:

```typescript
// Before:
const resolvedWorkspace = this.configManager.resolveWorkspace(
  workspacePath || config.agents[resolvedAgent]?.workingDirectory,
);

// After:
const agentDef = this.agentCatalog.resolve(resolvedAgent);
const resolvedWorkspace = this.configManager.resolveWorkspace(
  workspacePath || agentDef?.workingDirectory,
);
```

### Version updates

No `viben agents update` command in v1. Users reinstall to update:
```
viben agents install <id> --force
```

The `--force` flag bypasses the "already installed" check and overwrites with the latest registry version. A dedicated `update` command may be added later.

## Distribution Resolution

### npx agents

```
Registry: { distribution: { npx: { package: "@google/gemini-cli@0.34.0", args: ["--acp"] } } }
→ InstalledAgent: { command: "npx", args: ["@google/gemini-cli@0.34.0", "--acp"] }
→ AgentDefinition: { command: "npx", args: ["@google/gemini-cli@0.34.0", "--acp"] }
```

No download needed. npx fetches package on first run.

### uvx agents

```
Registry: { distribution: { uvx: { package: "crow-cli", args: ["acp"] } } }
→ InstalledAgent: { command: "uvx", args: ["crow-cli", "acp"] }
```

Requires `uvx` in PATH. Error with install hint if missing.

### binary agents

```
Registry: { distribution: { binary: { "darwin-aarch64": { archive: "https://...", cmd: "./cursor-agent", args: ["acp"] } } } }
→ Download archive → extract to ~/.viben/agents/<id>/
→ InstalledAgent: { command: "/Users/user/.viben/agents/cursor/cursor-agent", args: ["acp"], binaryPath: "/Users/user/.viben/agents/cursor/" }
```

All paths are stored as absolute (expanded via `expandHome()` at install time). `child_process.spawn()` does not expand `~`.

Platform detection: `${process.platform}-${process.arch}` mapped to registry keys (`darwin-aarch64`, `linux-x86_64`, etc.).

## Availability Check

```
AgentCatalog.checkAvailability(id):
  1. Check distribution runtime:
     - npx → check "npx" in PATH (almost always available)
     - uvx → check "uvx" in PATH
     - binary → check platform supported in registry entry
  2. Check dependencies (AGENT_DEPENDENCIES map):
     - claude-acp → check "claude" in PATH
     - Missing → return { available: false, missing: [...], installHint: "..." }
  3. Return { available: true } or { available: false, reason, installHint }
```

## Install Progress Reporting

### Shared interface

```typescript
interface InstallProgress {
  onStart(agentId: string, agentName: string): void;
  onStep(step: string): void;
  onDownloadProgress(percent: number): void;
  onSuccess(agent: InstalledAgent): void;
  onError(error: string, hint?: string): void;
}
```

### CLI output

```
⏳ Installing Cursor (v0.1.0)...
  ✓ Checking dependencies
  ⬇ Downloading binary for darwin-aarch64... 45%
  ⬇ Downloading binary for darwin-aarch64... 100%
  ✓ Extracting to ~/.viben/agents/cursor/
  ✓ Verifying binary
✅ Cursor installed successfully

⏳ Installing Gemini CLI (v0.34.0)...
  ✓ Checking dependencies
  ✓ Registered (npx — no download needed)
✅ Gemini CLI installed successfully
```

### Telegram output

Uses `editMessageText` on a single message to update progress:

```
"⏳ Installing Cursor..."
→ "⏳ Installing Cursor... Downloading 45%"
→ "⏳ Installing Cursor... Extracting..."
→ "✅ Cursor installed (v0.1.0)"
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Offline, no cache | Use bundled snapshot. Binary install fails with error |
| Dependency missing | Show missing deps + install hints |
| Platform not supported | Error: "No binary for <platform>" |
| uvx not installed | Error: "Requires uvx. Install: pip install uv" |
| Download fails | Retry 1x, then error with URL for manual download |
| Registry fetch fails | Use stale cache or bundled snapshot, log warning |
| Agent ID not found | Error: "Agent not found in registry" |
| Already installed | Info: "Already installed. Use --force to reinstall" |

## CLI Commands

### New commands

```
viben agents                    # List all (installed ✅ + available ⬇️)
viben agents install <id>       # Install agent from registry
viben agents uninstall <id>     # Remove agent
viben agents refresh            # Force fetch fresh registry
viben agents info <id>          # Agent details (version, deps, distribution)
```

### `viben agents` output

```
  Installed:
  ✅ claude            Claude Agent         v0.22.2   npx
  ✅ gemini            Gemini CLI           v0.34.0   npx

  Available:
  ⬇️  cline             Cline                v2.9.0    npx
  ⬇️  cursor            Cursor               v0.1.0    binary
  ⬇️  goose             goose                v1.28.0   binary
  ⚠️  codex             Codex CLI            v0.10.0   npx    (requires: codex CLI)
```

All names shown are user-facing names (not registry IDs).

### Setup flow changes

`viben setup` rewritten:

1. Fetch registry (or use bundled snapshot if offline)
2. Show agent list by popularity (Claude, Gemini, Copilot, Cursor first)
3. User multi-selects agents to install (claude pre-selected)
4. Check dependencies for each
5. Install selected agents (with progress)
6. Choose default agent
7. Write to `agents.json`

## Telegram Integration

### New commands

```
/agents                          # Show agent picker (installed + available)
/install <id>                    # Install agent from chat
/new [agent]                     # Create session with specific agent
```

### `/agents` flow

Shows inline keyboard with installed and available agents:

```
🤖 Available Agents:

[Claude Agent ✅] [Gemini CLI ✅] [Cline ⬇️]
[Cursor ⬇️] [Copilot ⬇️] [Goose ⬇️]
[More... ▶]
```

Callback prefix: `ag:`. Tapping an uninstalled agent triggers install confirmation.

### `/new` flow (per-session agent selection)

```
/new              → show agent picker (installed only), select → create session
/new claude       → create session directly with claude
/new gemini       → create session with gemini
```

Agent picker uses inline keyboard with `na:` callback prefix.

Session topic title reflects agent: `🔄 gemini — New Session`

### Menu integration

- `m:agents` → triggers `/agents` flow
- `m:new:<agentId>` → quick-create session with specific agent

### Install progress in Telegram

Single message, edited with progress updates via `editMessageText`. Edits are throttled (max 1 edit/second) to respect Telegram rate limits, similar to existing `MessageDraft` batching in `streaming.ts`.

## Uninstall

- npx/uvx: remove from `agents.json` only (package cache managed by npx/uvx)
- binary: remove from `agents.json` + delete `~/.viben/agents/<id>/` directory

## File Changes

### New files

| File | Purpose |
|------|---------|
| `src/core/agent-catalog.ts` | AgentCatalog class — registry fetch, cache, install, resolve |
| `src/core/agent-dependencies.ts` | Hard-coded dependency map + check logic |
| `src/core/agent-installer.ts` | Install logic per distribution type (npx, uvx, binary) |
| `src/core/agent-store.ts` | Read/write `~/.viben/agents.json` with Zod validation |
| `src/data/registry-snapshot.json` | Bundled registry snapshot |

### Modified files

| File | Changes |
|------|---------|
| `src/core/agent-manager.ts` | Constructor takes `AgentCatalog` instead of `Config` |
| `src/core/agent-registry.ts` | **Removed** — exports moved to `agent-dependencies.ts` |
| `src/core/config.ts` | Make `agents` field `.optional().default({})`, keep `defaultAgent` |
| `src/core/config-migrations.ts` | Add `migrate-agents-to-store` migration |
| `src/core/core.ts` | Create `AgentCatalog`, pass to `AgentManager`. Update `handleNewSession` to use catalog |
| `src/core/setup.ts` | Rewrite `setupAgents()` to use registry |
| `src/core/types.ts` | Add `InstalledAgent`, `RegistryAgent`, `AgentListItem`, `AvailabilityResult` types |
| `src/cli.ts` | Add `agents` command routing |
| `src/cli/commands.ts` | Add `cmdAgents()` |
| `src/adapters/telegram/` | Add `/agents`, `/install`, modify `/new` for agent picker |
| `tsup.config.ts` / `package.json` | Bundle `registry-snapshot.json` |

### Unchanged files

| File | Reason |
|------|--------|
| `src/core/agent-instance.ts` | Still receives `AgentDefinition`, unaware of registry |
| `src/core/session.ts` | No changes needed |
| `src/core/session-bridge.ts` | No changes needed |
| `src/core/plugin-manager.ts` | Remains for channel adapters only |
