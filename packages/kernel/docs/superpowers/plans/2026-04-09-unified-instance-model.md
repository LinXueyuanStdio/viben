# Unified Instance Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "global instance" concept — every instance lives in `<workspace>/.viben/`, and `~/.viben/` becomes a lightweight shared store only.

**Architecture:** Eliminate `isGlobal`, `workspace.baseDir`, and all `?? ~/.viben` fallbacks. Instance resolution uses CWD detection + walk-up (bounded by $HOME) + interactive prompt. Auto-migrate existing global instances on first run.

**Tech Stack:** TypeScript, Zod, Node.js fs, @clack/prompts

**Spec:** `docs/superpowers/specs/2026-04-09-unified-instance-model-design.md`

---

## File Map

### New Files
- `src/core/instance/migration.ts` — Auto-migrate global instance to workspace directory

### Delete Files
- `src/core/setup/setup-workspace.ts` — No longer needed (workspace = parent of .viben)

### Modified Files (by task group)

**Core Instance (Task 1):**
- `src/core/instance/instance-context.ts` — Remove `isGlobal`, update resolve algorithm, shared paths
- `src/core/instance/instance-copy.ts` — Stop copying `workspace.baseDir`, skip shared dirs

**Config (Task 2):**
- `src/core/config/config.ts` — Remove `workspace.baseDir`, update `resolveWorkspace()`
- `src/core/config/config-registry.ts` — Remove `workspace.baseDir` entry
- `src/core/config/config-editor.ts` — Remove workspace edit function

**Agent System + Core Orchestrator (Task 3):**
- `src/core/agents/agent-catalog.ts` — Remove global fallback store
- `src/core/agents/agent-store.ts` — Remove default path fallback
- `src/core/core.ts` — Remove hardcoded `~/.viben` fallbacks, require ctx
- `src/main.ts` — Replace global fallback with CWD detection + error
- `src/cli/post-upgrade.ts` — Fix SettingsManager path and AgentStore path

**CLI Entry + Daemon (Task 4):**
- `src/cli.ts` — Remove `--global`, deprecate `--workspace`
- `src/cli/daemon.ts` — Remove `DEFAULT_ROOT`
- `src/cli/instance-prompt.ts` — Remove auto-select, remove global fallback

**CLI Commands (Task 5):**
- `src/cli/commands/start.ts`, `stop.ts`, `default.ts`, `restart.ts`, `attach.ts`, `install.ts`, `uninstall.ts`, `plugins.ts`, `reset.ts`, `setup.ts`, `instances.ts` — Remove fallbacks

**Setup Wizard (Task 6):**
- `src/core/setup/wizard.ts` — Remove workspace step, remove `isGlobal`, fix `runReconfigure()`
- `src/core/setup/helpers.ts` — Remove workspace display
- `src/core/setup/types.ts` — Remove "workspace" from `ONBOARD_SECTION_OPTIONS`
- `src/core/setup/setup-workspace.ts` — Delete file (moved here from Task 2)

**Plugins + Docs (Task 7):**
- `src/plugins/telegram/commands/new-session.ts`, `resume.ts`, `index.ts` — Replace `baseDir` refs
- `src/plugins/file-service/index.ts` — Remove fallback
- `src/plugins/api-server/routes/plugins.ts` — Remove fallback
- `src/core/doctor/checks/workspace.ts` — Derive from instance root
- `src/core/assistant/prompt-constants.ts`, `sections/config.ts` — Remove baseDir refs
- `src/data/product-guide.ts` — Update docs

**Migration (Task 8):**
- `src/core/instance/migration.ts` — New file

**Tests (Task 9):**
- 17 test files — see task details

---

## Task 1: Core Instance Context

Remove `isGlobal` from interfaces, update resolution algorithm, point shared paths to `~/.viben/`.

**Files:**
- Modify: `src/core/instance/instance-context.ts`
- Test: `src/core/instance/__tests__/instance-context.test.ts`

- [ ] **Step 1: Update InstanceContext interface — remove `isGlobal`**

```typescript
// instance-context.ts — Remove isGlobal from both interfaces

export interface InstanceContext {
  id: string
  root: string
  // isGlobal: boolean  ← REMOVE
  paths: {
    config: string
    sessions: string
    agents: string
    registryCache: string
    plugins: string
    pluginsData: string
    pluginRegistry: string
    logs: string
    pid: string
    running: string
    apiPort: string
    apiSecret: string
    bin: string
    cache: string
    tunnels: string
    agentsDir: string
  }
}

export interface CreateInstanceContextOpts {
  id: string
  root: string
  // isGlobal: boolean  ← REMOVE
}
```

- [ ] **Step 2: Update `createInstanceContext()` — shared paths point to `~/.viben/`**

```typescript
export function createInstanceContext(opts: CreateInstanceContextOpts): InstanceContext {
  const { id, root } = opts
  const globalRoot = getGlobalRoot()
  return {
    id, root,
    paths: {
      config: path.join(root, 'config.json'),
      sessions: path.join(root, 'sessions.json'),
      agents: path.join(root, 'agents.json'),
      registryCache: path.join(globalRoot, 'cache', 'registry-cache.json'),  // SHARED
      plugins: path.join(root, 'plugins'),
      pluginsData: path.join(root, 'plugins', 'data'),
      pluginRegistry: path.join(root, 'plugins.json'),
      logs: path.join(root, 'logs'),
      pid: path.join(root, 'viben.pid'),
      running: path.join(root, 'running'),
      apiPort: path.join(root, 'api.port'),
      apiSecret: path.join(root, 'api-secret'),
      bin: path.join(globalRoot, 'bin'),         // SHARED
      cache: path.join(root, 'cache'),
      tunnels: path.join(root, 'tunnels.json'),
      agentsDir: path.join(globalRoot, 'agents'), // SHARED
    },
  }
}
```

- [ ] **Step 3: Update `ResolveOpts` — remove `global`, walk-up stops at $HOME**

```typescript
export interface ResolveOpts {
  dir?: string
  local?: boolean
  // global?: boolean  ← REMOVE
  cwd?: string
}

export function resolveInstanceRoot(opts: ResolveOpts): string | null {
  const cwd = opts.cwd ?? process.cwd()
  const home = os.homedir()
  const globalRoot = getGlobalRoot()

  if (opts.dir) return path.join(expandHome(opts.dir), '.viben')
  if (opts.local) return path.join(cwd, '.viben')

  // Check CWD
  const localRoot = path.join(cwd, '.viben')
  if (fs.existsSync(path.join(localRoot, 'config.json'))) return localRoot

  // Walk-up parent dirs, stop at $HOME (inclusive)
  let dir = path.dirname(cwd)
  while (true) {
    const candidate = path.join(dir, '.viben')
    // Skip ~/.viben (shared store, not an instance)
    if (candidate !== globalRoot && fs.existsSync(path.join(candidate, 'config.json'))) {
      return candidate
    }
    if (dir === home) break  // Stop at $HOME
    const parent = path.dirname(dir)
    if (parent === dir) break // filesystem root
    dir = parent
  }

  // Inherit instance root from parent process (daemon respawn)
  if (process.env.VIBEN_INSTANCE_ROOT) return process.env.VIBEN_INSTANCE_ROOT
  return null
}
```

- [ ] **Step 4: Update `resolveRunningInstance()` — stop at $HOME**

```typescript
export async function resolveRunningInstance(cwd: string): Promise<string | null> {
  const globalRoot = getGlobalRoot()
  const home = os.homedir()
  let dir = path.resolve(cwd)

  while (true) {
    const candidate = path.join(dir, '.viben')
    // Skip ~/.viben (shared store, not an instance)
    if (candidate !== globalRoot && fs.existsSync(candidate)) {
      if (await isInstanceRunning(candidate)) return candidate
    }
    if (dir === home) break  // Stop at $HOME
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return null
}
```

- [ ] **Step 5: Update `instance-copy.ts` — strip `baseDir`, skip shared dirs**

In `src/core/instance/instance-copy.ts`, in the config copying section where fields are stripped:
- Add `delete config.workspace?.baseDir` to strip the old field from copied configs
- The copy of `agents/` and `bin/` directories is now harmless (new instances won't have them locally), but for cleanliness, add a comment noting they are shared at `~/.viben/`

- [ ] **Step 6: Update tests**

Update `src/core/instance/__tests__/instance-context.test.ts`:
- Remove all `isGlobal` assertions from `createInstanceContext` tests
- Remove `isGlobal` from `CreateInstanceContextOpts` in test calls
- Verify `paths.agentsDir`, `paths.bin`, `paths.registryCache` point to global
- Add test: walk-up stops at $HOME
- Add test: `~/.viben` is skipped during walk-up

Update `src/core/instance/__tests__/multi-instance-flows.test.ts`:
- Remove "global instance always has id main" test
- Remove all `isGlobal` assertions
- Keep instance creation/coexistence tests but without global concept

- [ ] **Step 6: Run tests and verify**

Run: `pnpm test -- --run src/core/instance/__tests__/`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/core/instance/
git commit -m "refactor(instance): remove isGlobal, walk-up stops at HOME, shared paths to ~/.viben"
```

---

## Task 2: Config Schema — Remove `workspace.baseDir`

**Files:**
- Modify: `src/core/config/config.ts`
- Modify: `src/core/config/config-registry.ts`
- Modify: `src/core/config/config-editor.ts`
- Delete: `src/core/setup/setup-workspace.ts`
- Test: `src/core/config/__tests__/resolve-workspace.test.ts`
- Test: `src/__tests__/config-workspace.test.ts`

- [ ] **Step 1: Remove `baseDir` from ConfigSchema and DEFAULT_CONFIG**

In `src/core/config/config.ts`:

```typescript
// Before (line 29-40):
workspace: z
  .object({
    baseDir: z.string().default("~/viben-workspace"),
    allowExternalWorkspaces: z.boolean().default(true),
    security: z.object({ ... }).default({}),
  })
  .default({}),

// After:
workspace: z
  .object({
    allowExternalWorkspaces: z.boolean().default(true),
    security: z.object({
      allowedPaths: z.array(z.string()).default([]),
      envWhitelist: z.array(z.string()).default([]),
    }).default({}),
  })
  .default({}),
```

Update DEFAULT_CONFIG (line 73-77):
```typescript
const DEFAULT_CONFIG = {
  defaultAgent: "claude",
  // workspace: { baseDir: "~/viben-workspace" },  ← REMOVE
  sessionStore: { ttlDays: 30 },
};
```

- [ ] **Step 2: Rewrite `resolveWorkspace()` to derive base from configPath**

In `src/core/config/config.ts`, replace the `resolveWorkspace` method (lines 191-237):

```typescript
resolveWorkspace(input?: string): string {
  // Derive workspace base from config path:
  // configPath = /x/y/.viben/config.json → workspace = /x/y/
  const workspaceBase = path.dirname(path.dirname(this.configPath));

  if (!input) {
    fs.mkdirSync(workspaceBase, { recursive: true });
    return workspaceBase;
  }

  // Absolute or tilde path
  const expanded = input.startsWith("~") ? expandHome(input) : input;
  if (path.isAbsolute(expanded)) {
    // Check if internal (under workspaceBase)
    const resolved = path.resolve(expanded);
    const base = path.resolve(workspaceBase);
    const isInternal = resolved === base || resolved.startsWith(base + path.sep);

    if (!isInternal) {
      if (!this.config.workspace.allowExternalWorkspaces) {
        throw new Error(
          `Workspace path "${input}" is outside base directory "${workspaceBase}". Set allowExternalWorkspaces: true to allow this.`,
        );
      }
      if (!fs.existsSync(resolved)) {
        throw new Error(`Workspace path "${resolved}" does not exist.`);
      }
      return resolved;
    }

    // Internal paths: auto-create
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }

  // Named workspace: validate and resolve under workspaceBase
  if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
    throw new Error(
      `Invalid workspace name: "${input}". Only alphanumeric characters, hyphens, and underscores are allowed.`,
    );
  }
  const namedPath = path.join(workspaceBase, input.toLowerCase());
  fs.mkdirSync(namedPath, { recursive: true });
  return namedPath;
}
```

- [ ] **Step 3: Remove `workspace.baseDir` from config registry**

In `src/core/config/config-registry.ts`, delete lines 50-57:

```typescript
// DELETE this entire entry:
{
  path: "workspace.baseDir",
  displayName: "Workspace Directory",
  group: "workspace",
  type: "string",
  scope: "safe",
  hotReload: true,
},
```

- [ ] **Step 4: Remove workspace edit from config editor**

In `src/core/config/config-editor.ts`, remove the `editWorkspace` function (lines 248-265) and remove "workspace" from the section picker options. Replace references to `editWorkspace` with nothing (remove the case from the section handler).

- [ ] **Step 5: Rewrite resolve-workspace tests**

Rewrite `src/core/config/__tests__/resolve-workspace.test.ts` to test deriving workspace from configPath instead of `config.workspace.baseDir`. The test setup creates a temp dir with `.viben/config.json` and verifies `resolveWorkspace()` returns the parent dir.

Rewrite `src/__tests__/config-workspace.test.ts` similarly.

- [ ] **Step 6: Run tests**

Run: `pnpm test -- --run src/core/config/__tests__/ src/__tests__/config-workspace`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(config): remove workspace.baseDir, derive workspace from instance root"
```

---

## Task 3: Agent System + Core Orchestrator + Server Startup

These are merged into one task because making `AgentStore` and `AgentCatalog` constructors strict requires updating all their consumers (`core.ts`, `post-upgrade.ts`) in the same commit to avoid compile failures.

**Files:**
- Modify: `src/core/agents/agent-catalog.ts`
- Modify: `src/core/agents/agent-store.ts`
- Modify: `src/core/core.ts`
- Modify: `src/main.ts`
- Modify: `src/cli/post-upgrade.ts`
- Modify: `src/cli/commands/setup.ts` (write agents.json)

- [ ] **Step 1: Remove global fallback from AgentCatalog**

In `src/core/agents/agent-catalog.ts`:

Remove `globalStore` field (line 31) and constructor fallback logic (lines 41-46):
```typescript
// DELETE these lines:
private globalStore: AgentStore | null = null;
// ...
const globalPath = path.join(os.homedir(), ".viben", "agents.json");
const storePath = this.store.filePath;
if (path.resolve(storePath) !== path.resolve(globalPath)) {
  this.globalStore = new AgentStore(globalPath);
}
```

Remove `os` import if no longer used.

Update `load()` — remove `this.globalStore?.load()` (line 51).

Update `getInstalled()` (line 101-103):
```typescript
getInstalled(): InstalledAgent[] {
  return Object.values(this.store.getInstalled());
}
```

Update `getInstalledEntries()` (line 106-108):
```typescript
getInstalledEntries(): Record<string, InstalledAgent> {
  return this.store.getInstalled();
}
```

Update `getInstalledAgent()` (line 110-112):
```typescript
getInstalledAgent(key: string): InstalledAgent | undefined {
  return this.store.getAgent(key);
}
```

Update `uninstall()` (lines 212-221) — remove the global check block:
```typescript
async uninstall(key: string): Promise<{ ok: boolean; error?: string }> {
  if (this.store.hasAgent(key)) {
    await uninstallAgent(key, this.store);
    return { ok: true };
  }
  return { ok: false, error: `"${key}" is not installed.` };
}
```

Update `resolve()` (line 226):
```typescript
resolve(key: string): AgentDefinition | undefined {
  const agent = this.store.getAgent(key);
  // ... rest unchanged
}
```

Remove hardcoded cachePath fallback (line 38):
```typescript
// Before:
this.cachePath = cachePath ?? path.join(os.homedir(), ".viben", "registry-cache.json");
// After:
if (!cachePath) throw new Error('AgentCatalog requires cachePath')
this.cachePath = cachePath;
```

- [ ] **Step 2: Remove default path from AgentStore**

In `src/core/agents/agent-store.ts` line 34-35:
```typescript
// Before:
constructor(filePath?: string) {
  this.filePath = filePath ?? path.join(os.homedir(), ".viben", "agents.json");
// After:
constructor(filePath: string) {
  this.filePath = filePath;
```

Remove `os` import if no longer used.

- [ ] **Step 3: Update `cmdSetup` to write agents.json**

In `src/cli/commands/setup.ts`, after writing config.json (line 67), add agents.json creation:

```typescript
// Write agents.json with the specified agent(s)
const agentsJsonPath = path.join(instanceRoot, 'agents.json');
if (!fs.existsSync(agentsJsonPath)) {
  const agents = agentRaw.split(',').map(a => a.trim());
  const installed: Record<string, unknown> = {};
  for (const agentName of agents) {
    installed[agentName] = {
      registryId: null,
      name: agentName.charAt(0).toUpperCase() + agentName.slice(1),
      version: 'unknown',
      distribution: 'custom',
      command: agentName,
      args: [],
      env: {},
      installedAt: new Date().toISOString(),
      binaryPath: null,
    };
  }
  fs.writeFileSync(agentsJsonPath, JSON.stringify({ version: 1, installed }, null, 2));
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --run src/core/agents/`
Expected: All pass (some tests may need mock updates for required filePath param)

- [ ] **Step 5: Remove hardcoded fallbacks in core.ts**

In `src/core/core.ts`:

Line 93 — make `ctx` required:
```typescript
// Before:
constructor(configManager: ConfigManager, ctx?: InstanceContext) {
// After:
constructor(configManager: ConfigManager, ctx: InstanceContext) {
```

Line 97-100 — remove conditional:
```typescript
// Before:
this.agentCatalog = new AgentCatalog(
  ctx ? new AgentStore(ctx.paths.agents) : undefined,
  ctx?.paths.registryCache,
  ctx?.paths.agentsDir,
);
// After:
this.agentCatalog = new AgentCatalog(
  new AgentStore(ctx.paths.agents),
  ctx.paths.registryCache,
  ctx.paths.agentsDir,
);
```

Line 105 — remove sessions fallback:
```typescript
// Before:
const storePath = ctx?.paths.sessions ?? path.join(os.homedir(), ".viben", "sessions.json");
// After:
const storePath = ctx.paths.sessions;
```

Line 122 — update SessionFactory:
```typescript
// Before:
ctx?.root,
// After:
ctx.root,
```

Line 134 — remove pluginsData fallback:
```typescript
// Before:
storagePath: ctx?.paths.pluginsData ?? path.join(os.homedir(), ".viben", "plugins", "data"),
// After:
storagePath: ctx.paths.pluginsData,
```

Line 135:
```typescript
// Before:
instanceRoot: ctx?.root,
// After:
instanceRoot: ctx.root,
```

- [ ] **Step 6: Update `startServer()` in main.ts — CWD detection + error**

Replace lines 32-39 in `src/main.ts`:

```typescript
export async function startServer(opts?: StartServerOptions) {
  if (!opts?.instanceContext) {
    // Dev direct execution: try CWD detection
    const { resolveInstanceRoot } = await import('./core/instance/instance-context.js')
    const root = process.env.VIBEN_INSTANCE_ROOT
      ?? resolveInstanceRoot({ cwd: process.cwd() })

    if (!root) {
      console.error(`
  \x1b[31m\u2717\x1b[0m No Viben instance found.

  startServer() requires an instance context. Options:

    1. cd into a workspace directory:
       cd ~/viben-workspace && node dist/main.js

    2. Set VIBEN_INSTANCE_ROOT:
       VIBEN_INSTANCE_ROOT=~/viben-workspace/.viben node dist/main.js

    3. Use the CLI (recommended):
       viben start --dir ~/viben-workspace
`)
      process.exit(1)
    }

    const { InstanceRegistry } = await import('./core/instance/instance-registry.js')
    const globalRoot = getGlobalRoot()
    const reg = new InstanceRegistry(path.join(globalRoot, 'instances.json'))
    reg.load()
    const entry = reg.getByRoot(root)
    opts = {
      ...opts,
      instanceContext: createInstanceContext({
        id: entry?.id ?? randomUUID(),
        root,
      }),
    }
  }
  const ctx = opts.instanceContext!
```

- [ ] **Step 7: Fix post-upgrade.ts — pass pluginsData path**

In `src/main.ts`, update the `runPostUpgradeChecks` call (line 116) to pass instance context:
```typescript
await runPostUpgradeChecks(config, ctx)
```

In `src/cli/post-upgrade.ts`, update signature and fix SettingsManager path:
```typescript
// Before:
export async function runPostUpgradeChecks(config: Config): Promise<void> {
  // ...
  const sm = new SettingsManager(config.workspace?.baseDir ?? "~/.viben/plugins/data");

// After:
import type { InstanceContext } from "../core/instance/instance-context.js";

export async function runPostUpgradeChecks(config: Config, ctx?: InstanceContext): Promise<void> {
  // ...
  const pluginsDataPath = ctx?.paths.pluginsData ?? path.join(os.homedir(), '.viben', 'plugins', 'data')
  const sm = new SettingsManager(pluginsDataPath);
```

Also fix AgentStore usage at line 84-86:
```typescript
// Before:
const store = new AgentStore();
// After:
const store = new AgentStore(ctx?.paths.agents ?? path.join(os.homedir(), '.viben', 'agents.json'));
```

- [ ] **Step 8: Run tests**

Run: `pnpm test -- --run src/core/agents/ src/core/__tests__/core-orchestrator`
Expected: Pass (may need mock updates for required ctx and filePath params)

- [ ] **Step 9: Commit**

```bash
git add src/core/agents/ src/core/core.ts src/main.ts src/cli/post-upgrade.ts src/cli/commands/setup.ts
git commit -m "refactor(agents,core): remove global fallback store, require InstanceContext and explicit paths"
```

---

## Task 4: CLI Entry + Daemon + Instance Prompt

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/cli/daemon.ts`
- Modify: `src/cli/instance-prompt.ts`

- [ ] **Step 1: Update cli.ts — remove `--global`, deprecate `--workspace`**

In `src/cli.ts`:

Update InstanceFlags interface (lines 38-44):
```typescript
export interface InstanceFlags {
  local: boolean
  // global: boolean  ← REMOVE
  dir?: string
  from?: string
  name?: string
}
```

Update `extractInstanceFlags` (lines 46-59):
```typescript
function extractInstanceFlags(args: string[]): { flags: InstanceFlags; remaining: string[] } {
  const flags: InstanceFlags = { local: false }
  const remaining: string[] = []
  let i = 0
  while (i < args.length) {
    if (args[i] === '--local') { flags.local = true; i++ }
    else if (args[i] === '--global') {
      console.warn('Warning: --global is deprecated. Viben no longer has a global instance. Use --dir <path> instead.')
      i++
    }
    else if (args[i] === '--dir' && args[i + 1]) { flags.dir = args[i + 1]; i += 2 }
    else if (args[i] === '--from' && args[i + 1]) { flags.from = args[i + 1]; i += 2 }
    else if (args[i] === '--name' && args[i + 1]) { flags.name = args[i + 1]; i += 2 }
    else { remaining.push(args[i]!); i++ }
  }
  return { flags, remaining }
}
```

Update `resolveInstanceRoot` call (lines 78-83) — remove `global`:
```typescript
resolvedInstanceRoot = resolveInstanceRoot({
  dir: flags.dir,
  local: flags.local,
  cwd: process.cwd(),
})
```

Update daemon-child block (lines 130-134) — remove `isGlobal`:
```typescript
const ctx = createInstanceContext({
  id,
  root: envRoot,
})
```

- [ ] **Step 2: Remove DEFAULT_ROOT from daemon.ts**

In `src/cli/daemon.ts`, remove line 7 and make `root` required in utility functions:

```typescript
// DELETE:
const DEFAULT_ROOT = path.join(os.homedir(), '.viben')

// Update functions — root is now required:
export function getPidPath(root: string): string {
  return path.join(root, 'viben.pid')
}

export function getLogDir(root: string): string {
  return path.join(root, 'logs')
}

export function getRunningMarker(root: string): string {
  return path.join(root, 'running')
}
```

Update `markRunning`, `clearRunning`, `shouldAutoStart` — make root required:
```typescript
export function markRunning(root: string): void { ... }
export function clearRunning(root: string): void { ... }
export function shouldAutoStart(root: string): boolean { ... }
```

**IMPORTANT:** Also update functions that use `getPidPath()` as a default parameter value. These will break because `getPidPath` now requires `root`:
- `startDaemon(pidPath: string = getPidPath(), ...)` → make `pidPath` required
- `stopDaemon(pidPath: string = getPidPath(), ...)` → make `pidPath` required
- Any other function using `getPidPath()` as default — search for `= getPidPath()` in daemon.ts

All callers of `startDaemon` and `stopDaemon` in CLI commands already pass explicit `pidPath` via `getPidPath(root)`, so making the params required is safe.

- [ ] **Step 3: Update instance-prompt.ts — remove auto-select, remove global fallback**

In `src/cli/instance-prompt.ts`:

Replace the early return for no global config (line 26):
```typescript
// Before:
if (!globalConfigExists) return detectedParent ?? globalRoot
// After:
if (!globalConfigExists && !detectedParent) {
  // No instances at all — check registry
  const instances = registry.list().filter(e => fs.existsSync(e.root))
  if (instances.length === 0) {
    if (opts.allowCreate) return localRoot  // Will trigger setup wizard
    console.error('No Viben instances found. Run `viben` in your workspace directory to set up.')
    process.exit(1)
  }
}
```

Replace non-interactive fallback (line 31):
```typescript
// Before:
if (!isTTY) return detectedParent ?? globalRoot
// After:
if (!isTTY) {
  if (detectedParent) return detectedParent
  const instances = registry.list().filter(e => fs.existsSync(e.root))
  if (instances.length === 1) return instances[0]!.root
  console.error('Cannot determine instance in non-interactive mode. Use --dir <path>.')
  process.exit(1)
}
```

Remove auto-select for single instance (lines 73-76):
```typescript
// DELETE these lines:
if (instanceOptions.length === 1 && !opts.allowCreate) {
  return instanceOptions[0]!.value
}
```

Remove "global"/"local" labels — use just name + path:
```typescript
const displayPath = e.root.replace(os.homedir(), '~')
return { value: e.root, label: `${name} (${displayPath})` }
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --run src/cli/`
Expected: Pass

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts src/cli/daemon.ts src/cli/instance-prompt.ts
git commit -m "refactor(cli): remove --global flag, remove DEFAULT_ROOT, always prompt for instance"
```

---

## Task 5: CLI Commands — Remove Fallbacks

**Files:**
- Modify: `src/cli/commands/start.ts`, `stop.ts`, `default.ts`, `restart.ts`, `attach.ts`, `install.ts`, `uninstall.ts`, `plugins.ts`, `reset.ts`, `setup.ts`, `instances.ts`

- [ ] **Step 1: Remove `?? ~/.viben` from all commands**

The pattern is identical in each file. Change:
```typescript
const root = instanceRoot ?? path.join(os.homedir(), '.viben')
```
To:
```typescript
const root = instanceRoot!
```

Files and lines:
- `stop.ts:10`
- `restart.ts:14`
- `attach.ts:6`
- `install.ts:12`
- `uninstall.ts:12`
- `reset.ts:20`
- `start.ts:13`
- `default.ts:17`
- `plugins.ts:28, 196, 227, 252, 413`

Remove unused `os` and `path` imports where applicable.

- [ ] **Step 2: Update `setup.ts` — `--workspace` deprecated to `--dir`**

In `src/cli/commands/setup.ts`:

```typescript
export async function cmdSetup(args: string[], instanceRoot: string): Promise<void> {
  const workspace = parseFlag(args, '--workspace');
  const dir = parseFlag(args, '--dir');
  const agentRaw = parseFlag(args, '--agent');
  const json = args.includes('--json');
  if (json) await muteForJson()

  // --workspace is deprecated alias for --dir
  let targetDir = dir;
  if (workspace && !dir) {
    console.warn('Warning: --workspace is deprecated. Use --dir instead.')
    targetDir = workspace;
  }

  if (!targetDir) {
    // Use instanceRoot passed from CLI resolution
    targetDir = path.dirname(instanceRoot);
  }

  // ... rest uses targetDir instead of workspace
  // Remove workspace.baseDir from config write
  const config = {
    ...existing,
    channels,
    defaultAgent,
    runMode,
    autoStart: false,
  };
  // NOTE: no workspace.baseDir in config anymore
```

- [ ] **Step 3: Update `instances.ts` — remove "global"/"local" labels**

In `src/cli/commands/instances.ts`, find all `isGlobal` checks and remove them. Replace labels:
```typescript
// Before:
const isGlobal = root === getGlobalRoot()
const label = isGlobal ? 'global' : 'local'
// After: just show the path
const displayPath = root.replace(os.homedir(), '~')
```

Remove all `workspace.baseDir` references in the `move` subcommand.

- [ ] **Step 4: Run full test suite**

Run: `pnpm test -- --run`
Expected: Many tests may fail (mock configs), but no runtime errors in the command files themselves.

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/
git commit -m "refactor(cli-commands): remove all ~/.viben fallbacks and global labels"
```

---

## Task 6: Setup Wizard — Remove Workspace Step

**Files:**
- Modify: `src/core/setup/wizard.ts`
- Modify: `src/core/setup/helpers.ts`
- Modify: `src/core/setup/types.ts`
- Delete: `src/core/setup/setup-workspace.ts`

- [ ] **Step 1: Remove workspace step from wizard**

In `src/core/setup/wizard.ts`:

Remove import of `setupWorkspace` (line 13):
```typescript
// DELETE: import { setupWorkspace } from "./setup-workspace.js";
```

Remove `isGlobal` logic (lines 94-100):
```typescript
// Before:
const instanceRoot = opts?.instanceRoot ?? getGlobalRoot();
const isGlobal = instanceRoot === getGlobalRoot();
// ...
const locationHint = isGlobal ? 'global (~/.viben)' : `local (${...})`;

// After:
const instanceRoot = opts?.instanceRoot!;
const locationHint = instanceRoot.replace(/\/.viben$/, '').replace(os.homedir(), '~');
```

Remove workspace setup step (around line 412):
```typescript
// DELETE:
currentStep++;
const workspace = await setupWorkspace({ stepNum: currentStep, totalSteps, isGlobal });
```

Update config construction — remove workspace.baseDir:
```typescript
const config: Config = {
  instanceName,
  defaultAgent,
  workspace: { allowExternalWorkspaces: true, security: { allowedPaths: [], envWhitelist: [] } },
  // ... rest unchanged
};
```

Update totalSteps calculation (remove the +1 for workspace):
```typescript
const totalSteps = channelSteps + runModeSteps; // removed workspace step
```

Remove `isGlobal` from `protectLocalInstance` check:
```typescript
// Before:
const isLocal = instanceRoot !== path.join(getGlobalRoot());
if (isLocal) { ... }
// After: always protect (every instance is "local" now)
const projectDir = path.dirname(instanceRoot)
protectLocalInstance(projectDir)
```

- [ ] **Step 2: Fix `runReconfigure()` — remove workspace section**

In `src/core/setup/wizard.ts`, in the `runReconfigure()` function (around line 588-594), remove the workspace case:
```typescript
// DELETE this entire block:
if (choice === "workspace") {
  const { baseDir } = await setupWorkspace({
    existing: config.workspace.baseDir,
  });
  await configManager.save({ workspace: { baseDir } });
  config = configManager.get();
}
```

- [ ] **Step 3: Remove "workspace" from ONBOARD_SECTION_OPTIONS**

In `src/core/setup/types.ts`, remove the workspace entry from `ONBOARD_SECTION_OPTIONS` array:
```typescript
// DELETE:
{ value: "workspace", label: "Workspace", hint: "Base directory" },
```

Also remove `"workspace"` from the `OnboardSection` type union if it exists.

- [ ] **Step 4: Delete `src/core/setup/setup-workspace.ts` and remove its import**

```bash
git rm src/core/setup/setup-workspace.ts
```

Remove the import from `wizard.ts`:
```typescript
// DELETE:
import { setupWorkspace } from "./setup-workspace.js";
```

- [ ] **Step 5: Remove workspace line from helpers.ts**

In `src/core/setup/helpers.ts`, remove the line displaying workspace:
```typescript
// DELETE:
lines.push(`Workspace: ${config.workspace.baseDir}`);
```

- [ ] **Step 6: Update setup integration tests**

Update `src/__tests__/setup-integration.test.ts`:
- Remove workspace prompt step from test flow
- Remove `workspace.baseDir` assertion

- [ ] **Step 7: Run tests**

Run: `pnpm test -- --run src/core/setup/ src/__tests__/setup-integration`
Expected: Pass

- [ ] **Step 8: Commit**

```bash
git add src/core/setup/ src/__tests__/setup-integration.test.ts
git commit -m "refactor(setup): remove workspace step, remove isGlobal, fix runReconfigure, delete setup-workspace.ts"
```

---

## Task 7: Plugins + Docs — Replace baseDir References

**Files:**
- Modify: `src/plugins/telegram/commands/new-session.ts`
- Modify: `src/plugins/telegram/commands/resume.ts`
- Modify: `src/plugins/telegram/commands/index.ts`
- Modify: `src/plugins/file-service/index.ts`
- Modify: `src/plugins/api-server/routes/plugins.ts`
- Modify: `src/core/doctor/checks/workspace.ts`
- Modify: `src/core/assistant/prompt-constants.ts`
- Modify: `src/core/assistant/sections/config.ts`
- Modify: `src/data/product-guide.ts`

- [ ] **Step 1: Fix telegram plugin commands**

In `src/plugins/telegram/commands/new-session.ts` line 337:
```typescript
// Before:
const baseDir = config.workspace.baseDir
const resolvedBaseDir = core.configManager.resolveWorkspace(baseDir)
// After:
const resolvedBaseDir = core.configManager.resolveWorkspace()
```

In `src/plugins/telegram/commands/resume.ts` line 213:
```typescript
// Before:
const baseDir = config.workspace.baseDir;
const resolved = core.configManager.resolveWorkspace(baseDir);
// After:
const resolved = core.configManager.resolveWorkspace();
```

In `src/plugins/telegram/commands/index.ts` line 63:
```typescript
// Before:
core.configManager.get().workspace.baseDir,
// After:
core.configManager.resolveWorkspace(),
```

- [ ] **Step 2: Remove fallbacks from plugins**

In `src/plugins/file-service/index.ts` lines 16 and 28:
```typescript
// Before:
const defaultFilesDir = path.join(ctx.instanceRoot ?? path.join(os.homedir(), '.viben'), 'files')
// After:
const defaultFilesDir = path.join(ctx.instanceRoot, 'files')
```

In `src/plugins/api-server/routes/plugins.ts` lines 99-102:
```typescript
// Before:
const instanceRoot = lifecycleManager.instanceRoot ?? path.join(os.homedir(), '.viben')
// After:
const instanceRoot = lifecycleManager.instanceRoot!
```

- [ ] **Step 3: Fix doctor workspace check**

Rewrite `src/core/doctor/checks/workspace.ts`:
```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { DoctorCheck, CheckResult } from "../types.js";

export const workspaceCheck: DoctorCheck = {
  name: "Workspace",
  order: 5,
  async run(ctx) {
    const results: CheckResult[] = [];

    if (!ctx.instanceRoot) {
      results.push({ status: "fail", message: "Cannot check workspace — instance root not available" });
      return results;
    }

    // Workspace = parent of .viben directory
    const workspaceDir = path.dirname(ctx.instanceRoot);

    if (!fs.existsSync(workspaceDir)) {
      results.push({
        status: "warn",
        message: `Workspace directory does not exist: ${workspaceDir}`,
        fixable: true,
        fixRisk: "safe",
        fix: async () => {
          fs.mkdirSync(workspaceDir, { recursive: true });
          return { success: true, message: "created directory" };
        },
      });
    } else {
      try {
        fs.accessSync(workspaceDir, fs.constants.W_OK);
        results.push({ status: "pass", message: `Workspace directory exists: ${workspaceDir}` });
      } catch {
        results.push({ status: "fail", message: `Workspace directory not writable: ${workspaceDir}` });
      }
    }

    return results;
  },
};
```

Note: verify `ctx.instanceRoot` exists in the DoctorCheck context type. If not, it may be available as `ctx.root` or needs to be added.

- [ ] **Step 4: Fix assistant/prompt references**

In `src/core/assistant/prompt-constants.ts` line 45:
```typescript
// Before:
${baseCmd} config set workspace.baseDir ~/code
// After:
${baseCmd} config set logging.level debug
```

In `src/core/assistant/sections/config.ts`:
```typescript
// Before:
export function createConfigSection(core: {
  configManager: { get(): { workspace: { baseDir: string } } }
// After:
export function createConfigSection(core: {
  configManager: { resolveWorkspace(): string; get(): Record<string, unknown> }
```

Update buildContext (line 15-17):
```typescript
// Before:
`Workspace base: ${config.workspace.baseDir}\n` +
// After:
`Workspace: ${core.configManager.resolveWorkspace()}\n` +
```

- [ ] **Step 5: Update product-guide.ts**

In `src/data/product-guide.ts`, find and update the `workspace.baseDir` reference:
```typescript
// Before:
- **workspace.baseDir** — Base directory for project folders (default: `~/viben-workspace`)
// After:
- Workspace directory is the parent of `.viben/` (where you ran `viben` setup)
```

- [ ] **Step 6: Commit**

```bash
git add src/plugins/ src/core/doctor/ src/core/assistant/ src/data/
git commit -m "refactor(plugins,docs): replace workspace.baseDir with derived workspace"
```

---

## Task 8: Migration — Auto-Migrate Global Instance

**Files:**
- Create: `src/core/instance/migration.ts`
- Modify: `src/cli.ts` (call migration early)

- [ ] **Step 1: Write migration module**

Create `src/core/instance/migration.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { getGlobalRoot } from './instance-context.js'
import { InstanceRegistry } from './instance-registry.js'

/**
 * Migrate a legacy global instance from ~/.viben/ to <workspace>/.viben/.
 * Called once on first CLI invocation after upgrade.
 * Returns the new instance root if migration happened, null otherwise.
 */
export async function migrateGlobalInstance(): Promise<string | null> {
  const globalRoot = getGlobalRoot()
  const globalConfig = path.join(globalRoot, 'config.json')

  if (!fs.existsSync(globalConfig)) return null

  // Read old config to find workspace.baseDir
  let baseDir = path.join(os.homedir(), 'viben-workspace')
  try {
    const raw = JSON.parse(fs.readFileSync(globalConfig, 'utf-8'))
    if (raw.workspace?.baseDir) {
      const configured = raw.workspace.baseDir as string
      baseDir = configured.startsWith('~')
        ? path.join(os.homedir(), configured.slice(1))
        : configured
    }
  } catch {
    // Use default
  }

  const targetRoot = path.join(baseDir, '.viben')

  // Instance files to move (NOT shared files)
  const instanceFiles = [
    'config.json', 'sessions.json', 'agents.json', 'plugins.json',
    'tunnels.json', 'api-secret',
  ]
  const instanceDirs = [
    'plugins', 'logs', 'history', 'files',
  ]
  // Skip: instances.json (shared), bin/ (shared), agents/ (shared binaries),
  //        viben.pid, api.port, running (runtime, regenerated)

  // Create target
  fs.mkdirSync(targetRoot, { recursive: true })

  // Move files
  for (const file of instanceFiles) {
    const src = path.join(globalRoot, file)
    const dst = path.join(targetRoot, file)
    if (fs.existsSync(src)) {
      fs.cpSync(src, dst, { force: true })
      fs.rmSync(src)
    }
  }

  // Move directories
  for (const dir of instanceDirs) {
    const src = path.join(globalRoot, dir)
    const dst = path.join(targetRoot, dir)
    if (fs.existsSync(src)) {
      fs.cpSync(src, dst, { recursive: true, force: true })
      fs.rmSync(src, { recursive: true, force: true })
    }
  }

  // Move instance-specific cache (not registry-cache which stays shared)
  const srcCache = path.join(globalRoot, 'cache')
  const dstCache = path.join(targetRoot, 'cache')
  if (fs.existsSync(srcCache)) {
    // Move everything except registry-cache.json (keep shared)
    fs.mkdirSync(dstCache, { recursive: true })
    for (const entry of fs.readdirSync(srcCache)) {
      if (entry === 'registry-cache.json') continue
      const s = path.join(srcCache, entry)
      const d = path.join(dstCache, entry)
      fs.cpSync(s, d, { recursive: true, force: true })
      fs.rmSync(s, { recursive: true, force: true })
    }
  }

  // Strip workspace.baseDir from migrated config
  const migratedConfigPath = path.join(targetRoot, 'config.json')
  try {
    const config = JSON.parse(fs.readFileSync(migratedConfigPath, 'utf-8'))
    if (config.workspace?.baseDir) {
      delete config.workspace.baseDir
    }
    fs.writeFileSync(migratedConfigPath, JSON.stringify(config, null, 2))
  } catch {
    // Non-critical
  }

  // Update instance registry
  const registryPath = path.join(globalRoot, 'instances.json')
  try {
    const registry = new InstanceRegistry(registryPath)
    registry.load()
    const oldEntry = registry.getByRoot(globalRoot)
    if (oldEntry) {
      registry.remove(oldEntry.id)
      registry.register(oldEntry.id, targetRoot)
    } else {
      registry.register(randomUUID(), targetRoot)
    }
    await registry.save()
  } catch {
    // Non-critical
  }

  console.log(`\x1b[32m\u2713\x1b[0m Migrated global instance \u2192 ${baseDir.replace(os.homedir(), '~')}/.viben`)

  return targetRoot
}
```

Note: `InstanceRegistry.save()` is async and `randomUUID` uses dynamic import, so `migrateGlobalInstance` must be `async`. Update the signature to `export async function migrateGlobalInstance(): Promise<string | null>`.
```

Note: This function uses top-level `await` inside a try-catch for the registry. Since this is ESM, convert to synchronous `registry.load()` and `registry.save()` if `save()` is async (check the actual API). If `InstanceRegistry.save()` is async, make `migrateGlobalInstance` async.

- [ ] **Step 2: Wire migration into CLI entry**

In `src/cli.ts`, add migration call before command execution (after line 83):

```typescript
// Auto-migrate global instance on first run after upgrade
import { migrateGlobalInstance } from './core/instance/migration.js'
const migrated = await migrateGlobalInstance()
if (migrated && !resolvedInstanceRoot) {
  // If we just migrated and haven't resolved an instance yet, use the new location
  resolvedInstanceRoot = migrated
}
```

- [ ] **Step 3: Write migration tests**

Create `src/core/instance/__tests__/migration.test.ts` with tests:
- Migrates global instance files to workspace/.viben
- Uses config.workspace.baseDir as target
- Falls back to ~/viben-workspace when baseDir missing
- Strips workspace.baseDir from migrated config
- Updates instances.json registry
- Keeps shared files (instances.json, bin/, agents/) in ~/.viben
- No-op when ~/.viben/config.json doesn't exist
- Overwrites existing target files

- [ ] **Step 4: Run migration tests**

Run: `pnpm test -- --run src/core/instance/__tests__/migration`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/core/instance/migration.ts src/core/instance/__tests__/migration.test.ts src/cli.ts
git commit -m "feat(migration): auto-migrate global instance to workspace directory"
```

---

## Task 9: Update Remaining Tests

**Files:** All test files listed in the spec.

- [ ] **Step 1: Update mock configs — remove workspace.baseDir**

Files with mock configs that include `workspace: { baseDir: ... }`:

- `src/core/setup/__tests__/helpers.test.ts`
- `src/core/setup/__tests__/setup-channels.test.ts`
- `src/__tests__/config-new-methods.test.ts`
- `src/core/__tests__/core-orchestrator.test.ts`
- `src/__tests__/api-server.test.ts`
- `src/core/assistant/sections/__tests__/config-section.test.ts`

In each: remove `baseDir` from the workspace object in mock configs. If the workspace object becomes `{}`, keep it as `workspace: {}` or remove it entirely if the test doesn't need it.

- [ ] **Step 2: Update instance copy tests**

In `src/core/__tests__/instance-copy.test.ts` and `src/core/instance/__tests__/instance-copy.test.ts`:
- Remove `expect(copied.workspace.baseDir).toBe(...)` assertions
- Keep other assertions unchanged

- [ ] **Step 3: Update config registry tests**

In `src/core/config/__tests__/config-registry.test.ts`:
- Remove `workspace.baseDir` from the expected paths list

In `src/core/config/__tests__/config-registry-extended.test.ts`:
- Remove `getConfigValue(config, 'workspace.baseDir')` test line
- Update mock config

- [ ] **Step 4: Update/rewrite config editor tests**

In `src/__tests__/config-editor.test.ts`:
- Remove the "saves changes when user edits workspace" test
- Update remaining tests to not include `workspace.baseDir` in mock

- [ ] **Step 5: Update CLI setup tests**

In `src/cli/commands/__tests__/setup.test.ts`:
- Change `--workspace` to `--dir` in test commands
- Remove `config.workspace.baseDir` assertions
- Add assertion for agents.json creation

- [ ] **Step 6: Update multi-instance plumbing tests**

In `src/core/__tests__/multi-instance-plumbing.test.ts`:
- Remove any `isGlobal` references in InstanceContext creation

- [ ] **Step 7: Run full test suite**

Run: `pnpm test -- --run`
Expected: ALL tests pass

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: update all tests for unified instance model"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: No TypeScript errors

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 3: Manual smoke test**

```bash
# Verify setup creates .viben in specified dir
node dist/cli.js setup --dir /tmp/test-viben --agent claude --json

# Verify config.json has no workspace.baseDir
cat /tmp/test-viben/.viben/config.json | grep baseDir
# Expected: no output

# Verify agents.json was created
cat /tmp/test-viben/.viben/agents.json
# Expected: JSON with "claude" entry

# Verify registry updated
cat ~/.viben/instances.json
# Expected: entry pointing to /tmp/test-viben/.viben

# Cleanup
rm -rf /tmp/test-viben
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
