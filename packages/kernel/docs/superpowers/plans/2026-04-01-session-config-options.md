# Session Config Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate session state from separate mode/model/dangerous fields to unified ACP Config Options, with commands, API, and CLI support.

**Architecture:** Replace `currentMode`, `availableModes`, `currentModel`, `availableModels`, `dangerousMode` with `configOptions: ConfigOption[]` + `clientOverrides: { bypassPermissions?: boolean }`. All user surfaces (chat commands, REST API, CLI) read/write config options via `AgentInstance.setConfigOption()`. Permission bypass checks agent config first, falls back to `clientOverrides.bypassPermissions`.

**Tech Stack:** TypeScript, Vitest, ACP SDK (`@agentclientprotocol/sdk`)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/core/types.ts` | Update SessionRecord, remove old AgentEvent variants |
| Modify | `src/core/sessions/session.ts` | Replace fields, add helpers, update methods |
| Modify | `src/core/sessions/session-bridge.ts` | Consolidate event handlers, update permission check |
| Modify | `src/core/sessions/session-factory.ts` | Update resume hydration + data migration |
| Modify | `src/core/sessions/session-manager.ts` | Update registerSession record shape |
| Modify | `src/core/agents/agent-instance.ts` | Remove setMode/setModel |
| Modify | `src/core/plugin/types.ts` | Remove mode:beforeChange, model:beforeChange hooks |
| Create | `src/core/commands/config.ts` | /mode, /model, /thought, /dangerous commands |
| Modify | `src/plugins/api-server/routes/sessions.ts` | Add config endpoints, migrate dangerous endpoint |
| Modify | `src/plugins/api-server/schemas/sessions.ts` | Add config schemas |
| Modify | `src/cli/commands/api.ts` | Add session config CLI commands |
| Modify | `src/cli/plugin-template/claude-md.ts` | Update middleware hooks documentation |
| Modify | `src/cli/plugin-template/plugin-guide.ts` | Update plugin guide hooks list |
| Create | `src/core/sessions/__tests__/session-config-options.test.ts` | Config options unit tests |
| Create | `src/core/commands/__tests__/config-commands.test.ts` | Command tests |
| Modify | `src/core/sessions/__tests__/session-bridge-autoapprove.test.ts` | Update permission tests |
| Modify | `src/core/sessions/__tests__/session-lifecycle.test.ts` | Update field assertions |
| Modify | `src/core/sessions/__tests__/session-bridge-acp.test.ts` | Update ACP event tests |

---

### Task 1: Update Types — SessionRecord & AgentEvent

**Files:**
- Modify: `src/core/types.ts:225-251` (SessionRecord), `src/core/types.ts:70-118` (AgentEvent)

- [ ] **Step 1: Add `clientOverrides` to SessionRecord, simplify `acpState`**

In `src/core/types.ts`, update the `SessionRecord` interface. Add `clientOverrides`, remove `dangerousMode`, simplify `acpState`:

```typescript
// In SessionRecord interface — replace:
//   dangerousMode?: boolean;
// With:
//   clientOverrides?: { bypassPermissions?: boolean };
//
// In acpState — remove:
//   currentMode?, availableModes?, currentModel?, availableModels?
// Keep:
//   configOptions?, agentCapabilities?

export interface SessionRecord<P = Record<string, unknown>> {
  sessionId: string;
  agentSessionId: string;
  originalAgentSessionId?: string;
  agentName: string;
  workingDir: string;
  channelId: string;
  status: SessionStatus;
  createdAt: string;
  lastActiveAt: string;
  name?: string;
  // MIGRATION: old records may still have dangerousMode — handled in session-factory
  dangerousMode?: boolean;
  clientOverrides?: { bypassPermissions?: boolean };
  outputMode?: OutputMode;
  platform: P;
  firstAgent?: string;
  currentPromptCount?: number;
  agentSwitchHistory?: AgentSwitchEntry[];
  acpState?: {
    configOptions?: ConfigOption[];
    agentCapabilities?: AgentCapabilities;
    // MIGRATION: old records may still have these — ignored on load
    currentMode?: string;
    availableModes?: SessionMode[];
    currentModel?: string;
    availableModels?: ModelInfo[];
  };
}
```

Note: Keep old fields as optional in the type for backward compat during migration. They will be ignored when reading.

- [ ] **Step 2: Remove `current_mode_update` and `model_update` from AgentEvent**

In `src/core/types.ts`, remove these two variants from the AgentEvent union:

```typescript
// Remove these lines from AgentEvent:
//   | { type: "current_mode_update"; modeId: string }
//   | { type: "model_update"; modelId: string }
```

The `config_option_update` variant already exists and handles all config changes.

- [ ] **Step 3: Verify build compiles to find all references**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build 2>&1 | head -80`

Expected: Compilation errors pointing to all code that references removed fields/types. This gives us the full list of files to update.

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts
git commit -m "refactor: update SessionRecord and AgentEvent types for config options migration"
```

---

### Task 2: Update Session Class

**Files:**
- Modify: `src/core/sessions/session.ts:39-62` (fields), `src/core/sessions/session.ts:437-502` (methods)
- Test: `src/core/sessions/__tests__/session-config-options.test.ts`

- [ ] **Step 1: Write failing tests for new Session config helpers**

Create `src/core/sessions/__tests__/session-config-options.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session } from "../session.js";
import type { ConfigOption } from "../../types.js";

function createSession(): Session {
  const agent = {
    sessionId: "agent-1",
    prompt: vi.fn(),
    cancel: vi.fn(),
    destroy: vi.fn(),
    onPermissionRequest: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
  } as any;
  return new Session("sess-1", "ch-1", "test-agent", "/ws", agent);
}

const modeOption: ConfigOption = {
  id: "mode",
  name: "Session Mode",
  type: "select",
  category: "mode",
  currentValue: "code",
  options: [
    { value: "code", label: "Code", description: "Full tool access" },
    { value: "architect", label: "Architect", description: "Design only" },
    { value: "bypassPermissions", label: "Bypass", description: "Skip permissions" },
  ],
};

const modelOption: ConfigOption = {
  id: "model",
  name: "Model",
  type: "select",
  category: "model",
  currentValue: "opus-4",
  options: [
    { value: "opus-4", label: "Opus 4" },
    { value: "sonnet-4", label: "Sonnet 4" },
  ],
};

const thoughtOption: ConfigOption = {
  id: "thought_level",
  name: "Thinking",
  type: "select",
  category: "thought_level",
  currentValue: "normal",
  options: [
    { value: "normal", label: "Normal" },
    { value: "extended", label: "Extended" },
  ],
};

describe("Session config options", () => {
  let session: Session;

  beforeEach(() => {
    session = createSession();
  });

  it("starts with empty configOptions and default clientOverrides", () => {
    expect(session.configOptions).toEqual([]);
    expect(session.clientOverrides).toEqual({});
  });

  it("setInitialConfigOptions populates configOptions", () => {
    session.setInitialConfigOptions([modeOption, modelOption]);
    expect(session.configOptions).toHaveLength(2);
    expect(session.configOptions[0].id).toBe("mode");
  });

  it("getConfigOption finds by id", () => {
    session.setInitialConfigOptions([modeOption, modelOption]);
    expect(session.getConfigOption("mode")).toBe(modeOption);
    expect(session.getConfigOption("nonexistent")).toBeUndefined();
  });

  it("getConfigByCategory finds by category", () => {
    session.setInitialConfigOptions([modeOption, modelOption, thoughtOption]);
    expect(session.getConfigByCategory("mode")?.id).toBe("mode");
    expect(session.getConfigByCategory("model")?.id).toBe("model");
    expect(session.getConfigByCategory("thought_level")?.id).toBe("thought_level");
    expect(session.getConfigByCategory("nonexistent")).toBeUndefined();
  });

  it("getConfigValue returns currentValue by id", () => {
    session.setInitialConfigOptions([modeOption, modelOption]);
    expect(session.getConfigValue("mode")).toBe("code");
    expect(session.getConfigValue("model")).toBe("opus-4");
    expect(session.getConfigValue("nonexistent")).toBeUndefined();
  });

  it("updateConfigOptions replaces entire array", async () => {
    session.setInitialConfigOptions([modeOption]);
    const updatedMode: ConfigOption = { ...modeOption, currentValue: "architect" };
    await session.updateConfigOptions([updatedMode, modelOption]);
    expect(session.configOptions).toHaveLength(2);
    expect(session.getConfigValue("mode")).toBe("architect");
    expect(session.getConfigValue("model")).toBe("opus-4");
  });

  it("toAcpStateSnapshot returns configOptions and agentCapabilities", () => {
    session.setInitialConfigOptions([modeOption]);
    const snap = session.toAcpStateSnapshot();
    expect(snap.configOptions).toHaveLength(1);
    expect(snap.configOptions![0].id).toBe("mode");
    expect(snap).not.toHaveProperty("currentMode");
    expect(snap).not.toHaveProperty("availableModes");
    expect(snap).not.toHaveProperty("currentModel");
    expect(snap).not.toHaveProperty("availableModels");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/session-config-options.test.ts 2>&1 | tail -20`

Expected: FAIL — `setInitialConfigOptions` not defined, `clientOverrides` not defined.

- [ ] **Step 3: Update Session class — remove old fields, add new ones**

In `src/core/sessions/session.ts`:

Remove fields:
```typescript
// Remove these lines:
// dangerousMode: boolean = false;
// currentMode?: string;
// availableModes: SessionMode[] = [];
// currentModel?: string;
// availableModels: ModelInfo[] = [];
```

Add/keep fields:
```typescript
configOptions: ConfigOption[] = [];
clientOverrides: { bypassPermissions?: boolean } = {};
```

Replace `setInitialAcpState()` with `setInitialConfigOptions()`:
```typescript
setInitialConfigOptions(options: ConfigOption[]): void {
  this.configOptions = options;
}
```

Keep `agentCapabilities` field and add a separate setter if needed:
```typescript
setAgentCapabilities(caps: AgentCapabilities): void {
  this.agentCapabilities = caps;
}
```

Add helper methods:
```typescript
getConfigOption(id: string): ConfigOption | undefined {
  return this.configOptions.find(o => o.id === id);
}

getConfigByCategory(category: string): ConfigOption | undefined {
  return this.configOptions.find(o => o.category === category);
}

getConfigValue(id: string): string | undefined {
  const opt = this.getConfigOption(id);
  if (!opt) return undefined;
  return typeof opt.currentValue === "string" ? opt.currentValue : String(opt.currentValue);
}
```

Update `updateConfigOptions()` (keep existing middleware hook, just remove mode/model-specific hooks):
```typescript
async updateConfigOptions(options: ConfigOption[]): Promise<void> {
  if (this.middlewareChain) {
    const result = await this.middlewareChain.execute('config:beforeChange', {
      sessionId: this.id, configId: 'options', oldValue: this.configOptions, newValue: options
    }, async (p) => p);
    if (!result) return;
  }
  this.configOptions = options;
}
```

Remove `updateMode()` and `updateModel()` methods entirely.

Update `toAcpStateSnapshot()`:
```typescript
toAcpStateSnapshot(): NonNullable<import("../types.js").SessionRecord["acpState"]> {
  return {
    configOptions: this.configOptions.length > 0 ? this.configOptions : undefined,
    agentCapabilities: this.agentCapabilities,
  };
}
```

Also remove `supportsCapability()` if it references removed fields, or update it to only use `agentCapabilities`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/session-config-options.test.ts 2>&1 | tail -20`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/sessions/session.ts src/core/sessions/__tests__/session-config-options.test.ts
git commit -m "refactor: migrate Session class to unified configOptions"
```

---

### Task 3: Update Session Bridge — Events & Permissions

**Files:**
- Modify: `src/core/sessions/session-bridge.ts:258-277` (event handlers), `src/core/sessions/session-bridge.ts:360-376` (permission check)
- Modify: `src/core/sessions/__tests__/session-bridge-autoapprove.test.ts`
- Modify: `src/core/sessions/__tests__/session-bridge-acp.test.ts`

- [ ] **Step 1: Write failing test for updated permission bypass**

Update `src/core/sessions/__tests__/session-bridge-autoapprove.test.ts` — change `session.dangerousMode = true` to `session.clientOverrides.bypassPermissions = true`:

```typescript
it("auto-approves when bypassPermissions clientOverride is enabled", async () => {
  session.clientOverrides = { bypassPermissions: true };
  const request = makePermissionRequest("Execute rm -rf /important");
  const result = await agent.onPermissionRequest(request);
  expect(result).toBe(request.options.find(o => o.isAllow)!.id);
  expect(adapter.sendPermissionRequest).not.toHaveBeenCalled();
});
```

Add test for agent-side bypass via config option:

```typescript
it("auto-approves when agent mode config is a bypass mode", async () => {
  session.configOptions = [{
    id: "mode", name: "Mode", type: "select", category: "mode",
    currentValue: "bypassPermissions",
    options: [
      { value: "code", label: "Code" },
      { value: "bypassPermissions", label: "Bypass" },
    ],
  }];
  const request = makePermissionRequest("Execute something");
  const result = await agent.onPermissionRequest(request);
  expect(result).toBe(request.options.find(o => o.isAllow)!.id);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/session-bridge-autoapprove.test.ts 2>&1 | tail -20`

Expected: FAIL — `clientOverrides` not checked, bypass keyword matching not implemented.

- [ ] **Step 3: Update session-bridge.ts**

**A) Add bypass detection helper** (top of file or in a utils):

```typescript
const BYPASS_KEYWORDS = ["bypass", "dangerous", "skip", "dontask", "dont_ask", "auto_accept"];

function isPermissionBypass(value: string): boolean {
  const lower = value.toLowerCase();
  return BYPASS_KEYWORDS.some(kw => lower.includes(kw));
}
```

**B) Update permission check** — replace `if (this.session.dangerousMode)` with:

```typescript
// Check agent-side bypass via config option
const modeOption = this.session.getConfigByCategory("mode");
const isAgentBypass = modeOption && isPermissionBypass(modeOption.currentValue);

// Check client-side fallback
const isClientBypass = this.session.clientOverrides.bypassPermissions;

if (isAgentBypass || isClientBypass) {
  const allowOption = permReq.options.find((o) => o.isAllow);
  if (allowOption) {
    // ... existing auto-approve logic
  }
}
```

**C) Remove separate event handlers** — remove `case "current_mode_update"` and `case "model_update"` blocks. Keep only `case "config_option_update"`.

**D) Update persistAcpState()** — no changes needed, it calls `session.toAcpStateSnapshot()` which is already updated.

- [ ] **Step 4: Update session-bridge-acp.test.ts**

Remove tests for `current_mode_update` and `model_update` event handling. Update mock session objects to use `configOptions` and `clientOverrides` instead of `dangerousMode`, `currentMode`, etc.

- [ ] **Step 5: Run all bridge tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/session-bridge 2>&1 | tail -30`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/sessions/session-bridge.ts src/core/sessions/__tests__/session-bridge-autoapprove.test.ts src/core/sessions/__tests__/session-bridge-acp.test.ts
git commit -m "refactor: update session-bridge for unified config options and bypass detection"
```

---

### Task 4: Update Session Factory — Resume & Data Migration

**Files:**
- Modify: `src/core/sessions/session-factory.ts:253-275`

- [ ] **Step 1: Update resume hydration**

In `session-factory.ts`, replace the ACP state hydration block:

```typescript
// OLD: session.dangerousMode = record.dangerousMode ?? false;
// NEW:
session.clientOverrides = record.clientOverrides ?? {};

// MIGRATION: old records with dangerousMode but no clientOverrides
if (!record.clientOverrides && record.dangerousMode) {
  session.clientOverrides = { bypassPermissions: true };
}

// Hydrate cached config options (will be overridden by agent on resume)
if (record.acpState?.configOptions) {
  session.setInitialConfigOptions(record.acpState.configOptions);
}
if (record.acpState?.agentCapabilities) {
  session.setAgentCapabilities(record.acpState.agentCapabilities);
}
```

- [ ] **Step 2: Update new session creation**

Where `setInitialAcpState` was called for new sessions (after `newSession` response), replace with:

```typescript
// Extract configOptions from agent response
if (response.configOptions) {
  session.setInitialConfigOptions(response.configOptions as ConfigOption[]);
}
if (response.agentCapabilities) {
  session.setAgentCapabilities(response.agentCapabilities);
}
```

Also update the `initialSessionResponse` handling that previously extracted modes/models separately.

- [ ] **Step 3: Run factory-related tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/sessions/ 2>&1 | tail -30`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/sessions/session-factory.ts
git commit -m "refactor: update session-factory for config options hydration and data migration"
```

---

### Task 5: Update Session Manager

**Files:**
- Modify: `src/core/sessions/session-manager.ts:40-50`

- [ ] **Step 1: Update registerSession record creation**

Replace `dangerousMode: false` with `clientOverrides: {}` in the initial record:

```typescript
// In the registerSession block where initial record is saved:
// OLD: dangerousMode: false,
// NEW: clientOverrides: {},
```

- [ ] **Step 2: Run session-manager tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/sessions/__tests__/session-manager.test.ts 2>&1 | tail -20`

Expected: PASS (may need to update test fixtures replacing `dangerousMode: false` with `clientOverrides: {}`)

- [ ] **Step 3: Update test fixtures**

In `src/core/sessions/__tests__/session-manager.test.ts`, replace all `dangerousMode: false` with `clientOverrides: {}` in test record objects.

- [ ] **Step 4: Commit**

```bash
git add src/core/sessions/session-manager.ts src/core/sessions/__tests__/session-manager.test.ts
git commit -m "refactor: update session-manager for clientOverrides"
```

---

### Task 6: Clean Up Agent Instance

**Files:**
- Modify: `src/core/agents/agent-instance.ts:645-665`

- [ ] **Step 1: Remove `setMode()` and `setModel()` methods**

Delete:
```typescript
// Remove:
async setMode(modeId: string): Promise<void> {
  await this.connection.setSessionMode({ sessionId: this.sessionId, modeId });
}

// Remove:
async setModel(modelId: string): Promise<void> {
  await this.connection.unstable_setSessionModel({
    sessionId: this.sessionId,
    modelId,
  });
}
```

Keep `setConfigOption()` — it handles all config changes including mode and model.

- [ ] **Step 2: Remove `current_mode_update` and `model_update` case in sessionUpdate handler**

In the `sessionUpdate` method's switch block, remove cases for `current_mode_update` and `model_update` (since we removed those AgentEvent types).

NOTE: The agent may still send `current_mode_update` via the legacy modes API — if so, ignore it silently. The `config_option_update` handler covers this.

- [ ] **Step 3: Verify build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build 2>&1 | tail -20`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/agents/agent-instance.ts
git commit -m "refactor: remove setMode/setModel from AgentInstance, use setConfigOption only"
```

---

### Task 7: Clean Up Middleware Hooks

**Files:**
- Modify: `src/core/plugin/types.ts:395-410`
- Modify: `src/cli/plugin-template/claude-md.ts`
- Modify: `src/cli/plugin-template/plugin-guide.ts`

- [ ] **Step 1: Remove `mode:beforeChange` and `model:beforeChange` from MiddlewarePayloadMap**

In `src/core/plugin/types.ts`, remove:

```typescript
// Remove:
'mode:beforeChange': {
  sessionId: string
  fromMode: string | undefined
  toMode: string
}
// Remove:
'model:beforeChange': {
  sessionId: string
  fromModel: string | undefined
  toModel: string
}
```

Keep `config:beforeChange` as the single hook.

- [ ] **Step 2: Update plugin template**

In `src/cli/plugin-template/claude-md.ts`, remove references to `mode:beforeChange` and `model:beforeChange` from the middleware hooks list. Keep `config:beforeChange`.

In `src/cli/plugin-template/plugin-guide.ts`, update similarly.

- [ ] **Step 3: Verify build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build 2>&1 | tail -20`

Expected: No errors (if any code references removed hooks, fix those references)

- [ ] **Step 4: Commit**

```bash
git add src/core/plugin/types.ts src/cli/plugin-template/claude-md.ts src/cli/plugin-template/plugin-guide.ts
git commit -m "refactor: remove mode:beforeChange and model:beforeChange hooks, keep config:beforeChange"
```

---

### Task 8: Create Config Commands

**Files:**
- Create: `src/core/commands/config.ts`
- Create: `src/core/commands/__tests__/config-commands.test.ts`

- [ ] **Step 1: Write failing tests for /mode command**

Create `src/core/commands/__tests__/config-commands.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { modeCommand, modelCommand, thoughtCommand, dangerousCommand } from "../config.js";
import type { ConfigOption } from "../../types.js";

const modeConfigOption: ConfigOption = {
  id: "mode",
  name: "Session Mode",
  type: "select",
  category: "mode",
  currentValue: "code",
  options: [
    { value: "code", label: "Code", description: "Full tool access" },
    { value: "architect", label: "Architect", description: "Design without implementation" },
    { value: "bypassPermissions", label: "Bypass Permissions", description: "Skip all permission checks" },
  ],
};

const modelConfigOption: ConfigOption = {
  id: "model",
  name: "Model",
  type: "select",
  category: "model",
  currentValue: "opus-4",
  options: [
    { value: "opus-4", label: "Opus 4" },
    { value: "sonnet-4", label: "Sonnet 4" },
  ],
};

function mockContext(configOptions: ConfigOption[] = [], args: string = "") {
  const session = {
    id: "sess-1",
    configOptions,
    clientOverrides: {} as { bypassPermissions?: boolean },
    getConfigByCategory: (cat: string) => configOptions.find(o => o.category === cat),
    getConfigOption: (id: string) => configOptions.find(o => o.id === id),
    getConfigValue: (id: string) => configOptions.find(o => o.id === id)?.currentValue as string | undefined,
    agentInstance: {
      setConfigOption: vi.fn().mockResolvedValue({ configOptions }),
    },
    updateConfigOptions: vi.fn(),
    middlewareChain: null,
  };
  const deps = { session, sessionManager: { patchRecord: vi.fn() } };
  return { session, deps, args };
}

describe("/mode command", () => {
  it("returns error when agent has no mode config", async () => {
    const { deps, args } = mockContext([], "");
    const result = await modeCommand.execute({ ...deps, args } as any);
    expect(result.type).toBe("error");
  });

  it("returns menu when no args provided", async () => {
    const { deps, args } = mockContext([modeConfigOption], "");
    const result = await modeCommand.execute({ ...deps, args } as any);
    expect(result.type).toBe("menu");
    expect(result.options).toHaveLength(3);
    // Current value should be highlighted
    expect(result.options[0].label).toContain("✅");
    expect(result.options[0].label).toContain("Code");
  });

  it("sets mode when value provided", async () => {
    const { deps, session } = mockContext([modeConfigOption], "");
    const result = await modeCommand.execute({ ...deps, args: "architect" } as any);
    expect(session.agentInstance.setConfigOption).toHaveBeenCalledWith("mode", { type: "select", value: "architect" });
  });

  it("returns error for invalid value", async () => {
    const { deps } = mockContext([modeConfigOption], "");
    const result = await modeCommand.execute({ ...deps, args: "nonexistent" } as any);
    expect(result.type).toBe("error");
  });
});

describe("/model command", () => {
  it("returns error when agent has no model config", async () => {
    const { deps } = mockContext([], "");
    const result = await modelCommand.execute({ ...deps, args: "" } as any);
    expect(result.type).toBe("error");
  });

  it("returns menu with model options", async () => {
    const { deps } = mockContext([modelConfigOption], "");
    const result = await modelCommand.execute({ ...deps, args: "" } as any);
    expect(result.type).toBe("menu");
    expect(result.options).toHaveLength(2);
  });
});

describe("/dangerous command", () => {
  it("uses agent mode bypass when available", async () => {
    const { deps, session } = mockContext([modeConfigOption], "");
    const result = await dangerousCommand.execute({ ...deps, args: "on" } as any);
    // Should find bypassPermissions in mode options and set it
    expect(session.agentInstance.setConfigOption).toHaveBeenCalledWith("mode", { type: "select", value: "bypassPermissions" });
  });

  it("falls back to clientOverrides when agent has no bypass mode", async () => {
    const modeWithoutBypass: ConfigOption = {
      ...modeConfigOption,
      options: [
        { value: "code", label: "Code" },
        { value: "architect", label: "Architect" },
      ],
    };
    const { deps, session } = mockContext([modeWithoutBypass], "");
    const result = await dangerousCommand.execute({ ...deps, args: "on" } as any);
    expect(session.clientOverrides.bypassPermissions).toBe(true);
    expect(result.type).toBe("text");
  });

  it("falls back to clientOverrides when agent has no mode config at all", async () => {
    const { deps, session } = mockContext([], "");
    const result = await dangerousCommand.execute({ ...deps, args: "on" } as any);
    expect(session.clientOverrides.bypassPermissions).toBe(true);
  });

  it("disables bypass", async () => {
    const { deps, session } = mockContext([], "");
    session.clientOverrides.bypassPermissions = true;
    const result = await dangerousCommand.execute({ ...deps, args: "off" } as any);
    expect(session.clientOverrides.bypassPermissions).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/commands/__tests__/config-commands.test.ts 2>&1 | tail -20`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement config commands**

Create `src/core/commands/config.ts`:

```typescript
import type { CommandDef, CommandResponse } from "../plugin/types.js";
import type { ConfigOption } from "../types.js";

const BYPASS_KEYWORDS = ["bypass", "dangerous", "skip", "dontask", "dont_ask", "auto_accept"];

function isPermissionBypass(value: string): boolean {
  const lower = value.toLowerCase();
  return BYPASS_KEYWORDS.some(kw => lower.includes(kw));
}

function buildConfigMenu(option: ConfigOption, commandPrefix: string): CommandResponse {
  if (option.type !== "select") {
    return { type: "error", message: `Config option "${option.name}" is not a select type` };
  }
  const options = option.options.map(o => {
    const isCurrent = o.value === option.currentValue;
    return {
      label: `${isCurrent ? "✅ " : ""}${o.label}`,
      command: `${commandPrefix} ${o.value}`,
      hint: o.description,
    };
  });
  return { type: "menu", title: option.name, options };
}

function makeCategoryCommand(category: string, commandName: string, notSupportedMsg: string): CommandDef {
  return {
    name: commandName,
    description: `Change session ${category}`,
    execute: async (ctx) => {
      const session = ctx.session;
      if (!session) return { type: "error", message: "No active session" };

      const option = session.getConfigByCategory(category);
      if (!option) return { type: "error", message: notSupportedMsg };

      const value = ctx.args?.trim();
      if (!value) return buildConfigMenu(option, `/${commandName}`);

      // Validate value exists in options
      if (option.type === "select") {
        const valid = option.options.some(o => o.value === value);
        if (!valid) {
          return { type: "error", message: `Invalid value "${value}". Use /${commandName} to see options.` };
        }
      }

      // Fire middleware hook before sending to agent
      if (session.middlewareChain) {
        const result = await session.middlewareChain.execute("config:beforeChange", {
          sessionId: session.id, configId: option.id, oldValue: option.currentValue, newValue: value,
        }, async (p) => p);
        if (!result) return { type: "error", message: "Blocked by middleware" };
      }

      // Send to agent
      const response = await session.agentInstance.setConfigOption(option.id, { type: "select", value });
      if (response.configOptions) {
        await session.updateConfigOptions(response.configOptions as ConfigOption[]);
      }

      return { type: "text", text: `${option.name} set to **${value}**` };
    },
  };
}

export const modeCommand = makeCategoryCommand("mode", "mode", "Agent does not support mode selection");
export const modelCommand = makeCategoryCommand("model", "model", "Agent does not support model selection");
export const thoughtCommand = makeCategoryCommand("thought_level", "thought", "Agent does not support thought level");

export const dangerousCommand: CommandDef = {
  name: "dangerous",
  description: "Toggle permission bypass",
  execute: async (ctx) => {
    const session = ctx.session;
    if (!session) return { type: "error", message: "No active session" };

    const arg = ctx.args?.trim().toLowerCase();
    const enable = arg === "on" || arg === "enable" || arg === "true" || arg === "1";
    const disable = arg === "off" || arg === "disable" || arg === "false" || arg === "0";

    if (!enable && !disable) {
      // Show current status
      const modeOption = session.getConfigByCategory("mode");
      const agentBypass = modeOption && isPermissionBypass(
        typeof modeOption.currentValue === "string" ? modeOption.currentValue : "",
      );
      const clientBypass = session.clientOverrides.bypassPermissions;
      const active = agentBypass || clientBypass;
      return {
        type: "menu",
        title: `Permission Bypass: ${active ? "ON" : "OFF"}${agentBypass ? " (agent)" : clientBypass ? " (client fallback)" : ""}`,
        options: [
          { label: active ? "Disable" : "Enable", command: `/dangerous ${active ? "off" : "on"}` },
        ],
      };
    }

    if (enable) {
      // Try agent-side bypass first
      const modeOption = session.getConfigByCategory("mode");
      if (modeOption && modeOption.type === "select") {
        const bypassOpt = modeOption.options.find(o => isPermissionBypass(o.value));
        if (bypassOpt) {
          const response = await session.agentInstance.setConfigOption(modeOption.id, { type: "select", value: bypassOpt.value });
          if (response.configOptions) {
            await session.updateConfigOptions(response.configOptions as ConfigOption[]);
          }
          return { type: "text", text: `Permission bypass enabled via agent mode: **${bypassOpt.label}**` };
        }
      }
      // Fallback to client-side
      session.clientOverrides.bypassPermissions = true;
      // Persist clientOverrides
      ctx.sessionManager?.patchRecord(session.id, { clientOverrides: session.clientOverrides });
      return { type: "text", text: "Permission bypass enabled (client-side auto-approve). Agent does not support native bypass." };
    }

    // Disable
    // Reset agent mode if it was set to bypass
    const modeOption = session.getConfigByCategory("mode");
    if (modeOption && isPermissionBypass(typeof modeOption.currentValue === "string" ? modeOption.currentValue : "")) {
      // Find a non-bypass default mode
      const defaultOpt = modeOption.type === "select"
        ? modeOption.options.find(o => !isPermissionBypass(o.value))
        : undefined;
      if (defaultOpt) {
        const response = await session.agentInstance.setConfigOption(modeOption.id, { type: "select", value: defaultOpt.value });
        if (response.configOptions) {
          await session.updateConfigOptions(response.configOptions as ConfigOption[]);
        }
      }
    }
    session.clientOverrides.bypassPermissions = false;
    ctx.sessionManager?.patchRecord(session.id, { clientOverrides: session.clientOverrides });
    return { type: "text", text: "Permission bypass disabled" };
  },
};
```

- [ ] **Step 4: Register commands in the command system**

Find where system commands are registered (likely in `src/core/commands/index.ts` or in `core.ts`) and add the 4 new commands:

```typescript
import { modeCommand, modelCommand, thoughtCommand, dangerousCommand } from "./commands/config.js";

// In the command registration block:
commandRegistry.register(modeCommand);
commandRegistry.register(modelCommand);
commandRegistry.register(thoughtCommand);
commandRegistry.register(dangerousCommand);
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/core/commands/__tests__/config-commands.test.ts 2>&1 | tail -30`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/commands/config.ts src/core/commands/__tests__/config-commands.test.ts
git commit -m "feat: add /mode, /model, /thought, /dangerous chat commands"
```

---

### Task 9: API Server Config Endpoints

**Files:**
- Modify: `src/plugins/api-server/routes/sessions.ts`
- Modify: `src/plugins/api-server/schemas/sessions.ts`

- [ ] **Step 1: Add config route schemas**

In `src/plugins/api-server/schemas/sessions.ts`, add:

```typescript
import { z } from "zod";

export const SetConfigOptionBodySchema = z.object({
  value: z.string(),
});

export const SetClientOverridesBodySchema = z.object({
  bypassPermissions: z.boolean().optional(),
});
```

- [ ] **Step 2: Add config routes**

In `src/plugins/api-server/routes/sessions.ts`, add new endpoints:

```typescript
// GET /sessions/:sessionId/config
router.get("/sessions/:sessionId/config", async (request, reply) => {
  const session = getSession(request.params.sessionId);
  return {
    configOptions: session.configOptions,
    clientOverrides: session.clientOverrides,
  };
});

// PUT /sessions/:sessionId/config/:configId
router.put("/sessions/:sessionId/config/:configId", async (request, reply) => {
  const session = getSession(request.params.sessionId);
  const { value } = SetConfigOptionBodySchema.parse(request.body);
  const response = await session.agentInstance.setConfigOption(
    request.params.configId,
    { type: "select", value },
  );
  if (response.configOptions) {
    await session.updateConfigOptions(response.configOptions as ConfigOption[]);
    deps.core.sessionManager.patchRecord(session.id, {
      acpState: session.toAcpStateSnapshot(),
    });
  }
  return {
    configOptions: session.configOptions,
    clientOverrides: session.clientOverrides,
  };
});

// GET /sessions/:sessionId/config/overrides
router.get("/sessions/:sessionId/config/overrides", async (request, reply) => {
  const session = getSession(request.params.sessionId);
  return session.clientOverrides;
});

// PUT /sessions/:sessionId/config/overrides
router.put("/sessions/:sessionId/config/overrides", async (request, reply) => {
  const session = getSession(request.params.sessionId);
  const overrides = SetClientOverridesBodySchema.parse(request.body);
  session.clientOverrides = { ...session.clientOverrides, ...overrides };
  await deps.core.sessionManager.patchRecord(session.id, {
    clientOverrides: session.clientOverrides,
  });
  return session.clientOverrides;
});
```

- [ ] **Step 3: Update existing dangerous mode endpoint**

Migrate `PATCH /sessions/:sessionId/dangerous` to use `clientOverrides`:

```typescript
// Update the existing dangerous endpoint to use clientOverrides
session.clientOverrides = {
  ...session.clientOverrides,
  bypassPermissions: body.enabled,
};
await deps.core.sessionManager.patchRecord(sessionId, {
  clientOverrides: session.clientOverrides,
});
return { ok: true, bypassPermissions: body.enabled };
```

- [ ] **Step 4: Update session list/detail responses**

In GET `/sessions` and GET `/sessions/:sessionId`, replace `dangerousMode`, `currentMode`, `currentModel`, etc. with `configOptions` and `clientOverrides`:

```typescript
// In session serialization:
return {
  ...baseFields,
  configOptions: session.configOptions,
  clientOverrides: session.clientOverrides,
  agentCapabilities: session.agentCapabilities,
};
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build 2>&1 | tail -20`

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/plugins/api-server/routes/sessions.ts src/plugins/api-server/schemas/sessions.ts
git commit -m "feat: add session config API endpoints, migrate dangerous mode to clientOverrides"
```

---

### Task 10: CLI Config Commands

**Files:**
- Modify: `src/cli/commands/api.ts` (or create `src/cli/commands/session-config.ts` if more appropriate)

- [ ] **Step 1: Check existing CLI session commands**

Read `src/cli/commands/api.ts` to understand how CLI commands interact with the API server, then add config subcommands.

- [ ] **Step 2: Add session config CLI commands**

Add subcommands under `viben session config`:

```typescript
// viben session config <sessionId> — list all config options
// viben session config <sessionId> set <id> <value> — set config option
// viben session config <sessionId> overrides — show clientOverrides
// viben session config <sessionId> dangerous — toggle bypassPermissions

// These call the REST API endpoints added in Task 9:
// GET /sessions/:id/config
// PUT /sessions/:id/config/:configId
// GET /sessions/:id/config/overrides
// PUT /sessions/:id/config/overrides
```

Implementation depends on existing CLI command patterns — use the same HTTP client/fetch pattern as other CLI commands that talk to the API server.

- [ ] **Step 3: Verify CLI build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build 2>&1 | tail -20`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/
git commit -m "feat: add session config CLI commands"
```

---

### Task 11: Fix Remaining Build Errors & Update Tests

**Files:**
- Various test files referencing removed fields
- Any other files referencing `dangerousMode`, `currentMode`, `currentModel`, `availableModes`, `availableModels`

- [ ] **Step 1: Run full build to find all remaining errors**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build 2>&1`

Fix each error — most will be references to removed fields in:
- Test files (replace `dangerousMode: false` → `clientOverrides: {}`)
- Adapter renderers (update `renderModeChange`, `renderModelUpdate`, `renderConfigUpdate` to read from configOptions)
- API server tests
- Integration tests

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test 2>&1 | tail -40`

Fix any failing tests.

- [ ] **Step 3: Commit all fixes**

```bash
git add -A
git commit -m "fix: update all references to removed session fields, fix tests"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Full build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`

Expected: Clean compile, zero errors.

- [ ] **Step 2: Full test suite**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test`

Expected: All tests pass.

- [ ] **Step 3: Verify backward compat with old session data**

Create a test or manual check: a SessionRecord with `dangerousMode: true` and old `acpState` fields loads correctly and migrates to `clientOverrides: { bypassPermissions: true }`.

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "chore: final cleanup for session config options migration"
```
