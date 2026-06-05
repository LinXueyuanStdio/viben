# Command & Assistant Architecture Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify command dispatch into one path, move assistant management into core with plugin-extensible context, eliminate multi-step interactive flows, simplify SessionBridge, and make menu extensible via registry.

**Architecture:** Five layered changes: (1) MenuRegistry + AssistantRegistry as new core registries, (2) AssistantManager moves assistant lifecycle into core, (3) CommandRegistry handlers replace silent placeholders + bot.command(), (4) SessionBridge refactored with cleanup array + extracted methods, (5) Telegram adapter simplified by removing assistant state, interactive flows, and action detection.

**Tech Stack:** TypeScript, Vitest, grammY (Telegram), ESM with `.js` imports

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `src/core/menu-registry.ts` | MenuItem interface, MenuRegistry class (register/unregister/getItems) |
| `src/core/menu/core-items.ts` | Registers 9 default menu items with priorities/groups |
| `src/core/assistant/assistant-registry.ts` | AssistantSection interface, AssistantRegistry class (register/unregister/buildSystemPrompt) |
| `src/core/assistant/assistant-manager.ts` | AssistantManager class (spawn/get/respawn/isAssistant/waitReady) |
| `src/core/assistant/prompt-constants.ts` | ASSISTANT_PREAMBLE and ASSISTANT_GUIDELINES static strings |
| `src/core/assistant/sections/sessions.ts` | Core section: session management context + commands |
| `src/core/assistant/sections/agents.ts` | Core section: agent management context + commands |
| `src/core/assistant/sections/config.ts` | Core section: configuration context + commands |
| `src/core/assistant/sections/system.ts` | Core section: system admin context + commands |
| `src/core/assistant/index.ts` | Re-exports for assistant module |
| `src/core/__tests__/menu-registry.test.ts` | MenuRegistry tests |
| `src/core/__tests__/assistant-registry.test.ts` | AssistantRegistry tests |
| `src/core/__tests__/assistant-manager.test.ts` | AssistantManager tests |
| `src/core/__tests__/session-bridge-refactor.test.ts` | SessionBridge refactored wiring tests |

### Modified files

| File | Changes |
|------|---------|
| `src/core/plugin/types.ts` | Add `delegated` to CommandResponse union, add MenuItem/AssistantSection type exports |
| `src/core/command-registry.ts` | Handle `delegated` in execute(), remove silent fall-through |
| `src/core/commands/session.ts` | Replace silent handlers with real implementations |
| `src/core/commands/admin.ts` | Replace silent handlers with real implementations |
| `src/core/commands/agents.ts` | Replace silent handlers with real implementations |
| `src/core/plugin/plugin-context.ts` | Add registerMenuItem, unregisterMenuItem, registerAssistantSection, unregisterAssistantSection |
| `src/core/sessions/session.ts` | Add `isAssistant: boolean` field |
| `src/core/sessions/session-bridge.ts` | Refactor: cleanupFns array, dispatchAgentEvent, resolvePermission pipeline |
| `src/core/core.ts` | Add assistantManager + assistantRegistry + menuRegistry fields, wire into startup |
| `src/core/index.ts` | Export new types and classes |
| `src/plugins/telegram/adapter.ts` | Remove assistantSession/assistantInitializing, remove setupCommands/setupActionCallbacks calls, simplify sendMessage/setupRoutes |
| `src/plugins/telegram/assistant.ts` | Remove spawnAssistant/buildAssistantSystemPrompt/handleAssistantMessage, keep buildWelcomeMessage/redirectToAssistant |
| `src/plugins/telegram/commands/index.ts` | Delete setupCommands(), replace broad m: handler with generic MenuRegistry dispatch |
| `src/plugins/telegram/commands/new-session.ts` | Delete pendingNewSessions/showAgentPicker/startWorkspaceStep/startConfirmStep/handlePendingWorkspaceInput/setupNewSessionCallbacks |
| `src/plugins/telegram/commands/menu.ts` | Replace hardcoded buildMenuKeyboard() with registry-based builder |
| `src/plugins/telegram/commands/resume.ts` | Delete handlePendingResumeInput and pending state machine |

### Deleted files

| File | Reason |
|------|--------|
| `src/plugins/telegram/action-detect.ts` | Replaced by assistant AI intent detection |

---

## Task 1: MenuRegistry — Core Registry

**Files:**
- Create: `src/core/menu-registry.ts`
- Modify: `src/core/plugin/types.ts`
- Test: `src/core/__tests__/menu-registry.test.ts`

- [ ] **Step 1: Write MenuRegistry tests**

```typescript
// src/core/__tests__/menu-registry.test.ts
import { describe, it, expect, vi } from "vitest";
import { MenuRegistry, type MenuItem } from "../menu-registry.js";

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "test:item",
    label: "Test",
    priority: 100,
    action: { type: "command", command: "/test" },
    ...overrides,
  };
}

describe("MenuRegistry", () => {
  it("registers and retrieves items sorted by priority", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({ id: "b", priority: 20 }));
    reg.register(makeItem({ id: "a", priority: 10 }));
    reg.register(makeItem({ id: "c", priority: 30 }));
    const items = reg.getItems();
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("unregisters items", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({ id: "x" }));
    expect(reg.getItem("x")).toBeDefined();
    reg.unregister("x");
    expect(reg.getItem("x")).toBeUndefined();
    expect(reg.getItems()).toHaveLength(0);
  });

  it("filters by visible()", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({ id: "show", visible: () => true }));
    reg.register(makeItem({ id: "hide", visible: () => false }));
    reg.register(makeItem({ id: "nocheck" })); // no visible → always shown
    expect(reg.getItems().map((i) => i.id)).toEqual(["show", "nocheck"]);
  });

  it("catches visible() errors and hides item", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({
      id: "broken",
      visible: () => { throw new Error("boom"); },
    }));
    expect(reg.getItems()).toHaveLength(0);
  });

  it("getItem returns specific item by id", () => {
    const reg = new MenuRegistry();
    const item = makeItem({ id: "find-me", label: "Found" });
    reg.register(item);
    expect(reg.getItem("find-me")?.label).toBe("Found");
  });

  it("overwrite replaces existing item", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({ id: "same", label: "V1" }));
    reg.register(makeItem({ id: "same", label: "V2" }));
    expect(reg.getItem("same")?.label).toBe("V2");
    expect(reg.getItems()).toHaveLength(1);
  });

  it("stable sort for same priority", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({ id: "first", priority: 10 }));
    reg.register(makeItem({ id: "second", priority: 10 }));
    const items = reg.getItems();
    expect(items[0].id).toBe("first");
    expect(items[1].id).toBe("second");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm vitest run src/core/__tests__/menu-registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Add MenuItem type to types.ts and create MenuRegistry**

Add to `src/core/plugin/types.ts` after the `CommandResponse` type (after line 163):

```typescript
// ─── Menu Types ───

export interface MenuItemAction {
  type: 'command' | 'delegate' | 'callback'
  command?: string        // for type 'command'
  prompt?: string         // for type 'delegate'
  callbackData?: string   // for type 'callback'
}

export interface MenuItem {
  id: string
  label: string
  priority: number
  group?: string
  action:
    | { type: 'command'; command: string }
    | { type: 'delegate'; prompt: string }
    | { type: 'callback'; callbackData: string }
  visible?: () => boolean
}
```

Create `src/core/menu-registry.ts`:

```typescript
import type { MenuItem } from './plugin/types.js'
import { createChildLogger } from './utils/log.js'

const log = createChildLogger({ module: 'menu-registry' })

export { type MenuItem }

export class MenuRegistry {
  private items = new Map<string, MenuItem>()

  register(item: MenuItem): void {
    this.items.set(item.id, item)
  }

  unregister(id: string): void {
    this.items.delete(id)
  }

  getItem(id: string): MenuItem | undefined {
    return this.items.get(id)
  }

  /** Get all visible items sorted by priority */
  getItems(): MenuItem[] {
    return [...this.items.values()]
      .filter((item) => {
        if (!item.visible) return true
        try {
          return item.visible()
        } catch (err) {
          log.warn({ err, id: item.id }, 'MenuItem visible() threw, hiding item')
          return false
        }
      })
      .sort((a, b) => a.priority - b.priority)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm vitest run src/core/__tests__/menu-registry.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/menu-registry.ts src/core/plugin/types.ts src/core/__tests__/menu-registry.test.ts
git commit -m "feat: add MenuRegistry with plugin-extensible menu items"
```

---

## Task 2: Core Menu Items

**Files:**
- Create: `src/core/menu/core-items.ts`

- [ ] **Step 1: Create core menu items registration**

```typescript
// src/core/menu/core-items.ts
import type { MenuRegistry } from '../menu-registry.js'

export function registerCoreMenuItems(registry: MenuRegistry): void {
  // Session management (priority 10-19)
  registry.register({
    id: 'core:new',
    label: '🆕 New Session',
    priority: 10,
    group: 'session',
    action: { type: 'delegate', prompt: 'User wants new session. Guide them through agent and workspace selection.' },
  })
  registry.register({
    id: 'core:sessions',
    label: '📋 Sessions',
    priority: 11,
    group: 'session',
    action: { type: 'command', command: '/sessions' },
  })

  // Info (priority 20-29)
  registry.register({
    id: 'core:status',
    label: '📊 Status',
    priority: 20,
    group: 'info',
    action: { type: 'command', command: '/status' },
  })
  registry.register({
    id: 'core:agents',
    label: '🤖 Agents',
    priority: 21,
    group: 'info',
    action: { type: 'command', command: '/agents' },
  })

  // Config (priority 30-39)
  registry.register({
    id: 'core:settings',
    label: '⚙️ Settings',
    priority: 30,
    group: 'config',
    action: { type: 'callback', callbackData: 's:settings' },
  })
  registry.register({
    id: 'core:integrate',
    label: '🔗 Integrate',
    priority: 31,
    group: 'config',
    action: { type: 'command', command: '/integrate' },
  })

  // System (priority 40-49)
  registry.register({
    id: 'core:restart',
    label: '🔄 Restart',
    priority: 40,
    group: 'system',
    action: { type: 'delegate', prompt: 'User wants to restart Viben. Ask for confirmation before restarting.' },
  })
  registry.register({
    id: 'core:update',
    label: '⬆️ Update',
    priority: 41,
    group: 'system',
    action: { type: 'delegate', prompt: 'User wants to update Viben to latest version. Ask for confirmation.' },
  })

  // Help (priority 50-59)
  registry.register({
    id: 'core:help',
    label: '❓ Help',
    priority: 50,
    group: 'help',
    action: { type: 'command', command: '/help' },
  })
  registry.register({
    id: 'core:doctor',
    label: '🩺 Doctor',
    priority: 51,
    group: 'help',
    action: { type: 'command', command: '/doctor' },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/menu/core-items.ts
git commit -m "feat: add default core menu items registration"
```

---

## Task 3: AssistantRegistry — Plugin-extensible System Prompt

**Files:**
- Create: `src/core/assistant/assistant-registry.ts`
- Create: `src/core/assistant/prompt-constants.ts`
- Test: `src/core/__tests__/assistant-registry.test.ts`

- [ ] **Step 1: Write AssistantRegistry tests**

```typescript
// src/core/__tests__/assistant-registry.test.ts
import { describe, it, expect, vi } from "vitest";
import { AssistantRegistry, type AssistantSection } from "../assistant/assistant-registry.js";

function makeSection(overrides: Partial<AssistantSection> = {}): AssistantSection {
  return {
    id: "test:section",
    title: "Test Section",
    priority: 100,
    buildContext: () => "test context",
    ...overrides,
  };
}

describe("AssistantRegistry", () => {
  it("builds system prompt with sections sorted by priority", () => {
    const reg = new AssistantRegistry();
    reg.register(makeSection({ id: "b", title: "B", priority: 20, buildContext: () => "B content" }));
    reg.register(makeSection({ id: "a", title: "A", priority: 10, buildContext: () => "A content" }));
    const prompt = reg.buildSystemPrompt();
    const aIdx = prompt.indexOf("## A");
    const bIdx = prompt.indexOf("## B");
    expect(aIdx).toBeLessThan(bIdx);
  });

  it("skips sections that return null", () => {
    const reg = new AssistantRegistry();
    reg.register(makeSection({ id: "show", title: "Shown", buildContext: () => "visible" }));
    reg.register(makeSection({ id: "skip", title: "Skipped", buildContext: () => null }));
    const prompt = reg.buildSystemPrompt();
    expect(prompt).toContain("## Shown");
    expect(prompt).not.toContain("## Skipped");
  });

  it("catches buildContext errors and skips section", () => {
    const reg = new AssistantRegistry();
    reg.register(makeSection({
      id: "broken",
      title: "Broken",
      buildContext: () => { throw new Error("boom"); },
    }));
    reg.register(makeSection({ id: "ok", title: "OK", buildContext: () => "fine" }));
    const prompt = reg.buildSystemPrompt();
    expect(prompt).not.toContain("## Broken");
    expect(prompt).toContain("## OK");
  });

  it("includes command blocks when commands provided", () => {
    const reg = new AssistantRegistry();
    reg.register(makeSection({
      id: "cmds",
      title: "With Commands",
      buildContext: () => "context",
      commands: [
        { command: "viben api status", description: "Show status" },
      ],
    }));
    const prompt = reg.buildSystemPrompt();
    expect(prompt).toContain("viben api status");
    expect(prompt).toContain("Show status");
  });

  it("unregisters sections", () => {
    const reg = new AssistantRegistry();
    reg.register(makeSection({ id: "gone", title: "Gone" }));
    reg.unregister("gone");
    const prompt = reg.buildSystemPrompt();
    expect(prompt).not.toContain("## Gone");
  });

  it("includes preamble and guidelines", () => {
    const reg = new AssistantRegistry();
    const prompt = reg.buildSystemPrompt();
    expect(prompt).toContain("You are the Viben Assistant");
    expect(prompt).toContain("NEVER show");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm vitest run src/core/__tests__/assistant-registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create prompt constants**

Extract preamble and guidelines from the current `buildAssistantSystemPrompt()` in `src/plugins/telegram/assistant.ts`. Create `src/core/assistant/prompt-constants.ts`:

```typescript
// src/core/assistant/prompt-constants.ts

export const ASSISTANT_PREAMBLE = `You are the Viben Assistant — a helpful guide for managing AI coding sessions.

Respond in the same language the user uses.
Format responses for chat platforms: use <b>bold</b>, <code>code</code>, keep it concise.
Talk to users like a helpful assistant, not a CLI manual.`

export const ASSISTANT_GUIDELINES = `## Guidelines
- NEVER show \`viben api ...\` commands to users. These are internal tools for YOU to run silently. Users should only see natural language responses and results.
- Run \`viben api ...\` commands yourself for everything you can. Only guide users to buttons/menu when needed.
- When creating sessions: guide user through agent + workspace choice conversationally, then run the command yourself.
- Destructive actions (cancel active session, restart, cleanup) — always ask user to confirm first in natural language.
- Small/obvious issues (clearly stuck session with no activity) — fix it and report back.
- When you don't know something, check with the relevant \`viben api\` command first before answering.`
```

- [ ] **Step 4: Create AssistantRegistry**

```typescript
// src/core/assistant/assistant-registry.ts
import { createChildLogger } from '../utils/log.js'
import { ASSISTANT_PREAMBLE, ASSISTANT_GUIDELINES } from './prompt-constants.js'

const log = createChildLogger({ module: 'assistant-registry' })

export interface AssistantCommand {
  command: string
  description: string
}

export interface AssistantSection {
  id: string
  title: string
  priority: number
  buildContext: () => string | null
  commands?: AssistantCommand[]
}

export class AssistantRegistry {
  private sections = new Map<string, AssistantSection>()

  register(section: AssistantSection): void {
    if (this.sections.has(section.id)) {
      log.warn({ id: section.id }, 'Assistant section overwritten')
    }
    this.sections.set(section.id, section)
  }

  unregister(id: string): void {
    this.sections.delete(id)
  }

  buildSystemPrompt(): string {
    const sorted = [...this.sections.values()].sort((a, b) => a.priority - b.priority)

    const parts: string[] = [ASSISTANT_PREAMBLE]

    for (const section of sorted) {
      try {
        const context = section.buildContext()
        if (!context) continue
        parts.push(`## ${section.title}\n${context}`)
        if (section.commands?.length) {
          const cmds = section.commands.map((c) => `${c.command}  # ${c.description}`).join('\n')
          parts.push('```bash\n' + cmds + '\n```')
        }
      } catch (err) {
        log.warn({ err, sectionId: section.id }, 'Assistant section buildContext() failed, skipping')
      }
    }

    parts.push(ASSISTANT_GUIDELINES)
    return parts.join('\n\n')
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm vitest run src/core/__tests__/assistant-registry.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/assistant/assistant-registry.ts src/core/assistant/prompt-constants.ts src/core/__tests__/assistant-registry.test.ts
git commit -m "feat: add AssistantRegistry with plugin-extensible system prompt"
```

---

## Task 4: Core Assistant Sections

**Files:**
- Create: `src/core/assistant/sections/sessions.ts`
- Create: `src/core/assistant/sections/agents.ts`
- Create: `src/core/assistant/sections/config.ts`
- Create: `src/core/assistant/sections/system.ts`

- [ ] **Step 1: Create all 4 core sections**

```typescript
// src/core/assistant/sections/sessions.ts
import type { AssistantSection } from '../assistant-registry.js'

export function createSessionsSection(core: { sessionManager: { listRecords(): Array<{ status: string }> } }): AssistantSection {
  return {
    id: 'core:sessions',
    title: 'Session Management',
    priority: 10,
    buildContext: () => {
      const records = core.sessionManager.listRecords()
      const active = records.filter((r) => r.status === 'active' || r.status === 'initializing').length
      return (
        `Active sessions: ${active} / ${records.length} total\n\n` +
        `To create a session, ask which agent to use and which project directory (workspace) to work in.\n` +
        `The workspace is the project folder where the agent will read, write, and execute code.`
      )
    },
    commands: [
      { command: 'viben api status', description: 'List active sessions' },
      { command: 'viben api new <agent> <workspace> --channel <ch>', description: 'Create new session' },
      { command: 'viben api cancel <id>', description: 'Cancel session' },
      { command: 'viben api send <id> "prompt"', description: 'Send prompt to session' },
      { command: 'viben api bypass <id> on|off', description: 'Toggle bypass permissions' },
    ],
  }
}
```

```typescript
// src/core/assistant/sections/agents.ts
import type { AssistantSection } from '../assistant-registry.js'

export function createAgentsSection(core: {
  agentCatalog: { getInstalledEntries(): Record<string, { name: string }>; getAvailable(): Array<{ installed: boolean }> }
  configManager: { get(): { defaultAgent: string } }
}): AssistantSection {
  return {
    id: 'core:agents',
    title: 'Agent Management',
    priority: 20,
    buildContext: () => {
      const installed = Object.keys(core.agentCatalog.getInstalledEntries())
      const available = core.agentCatalog.getAvailable().filter((i) => !i.installed).length
      const defaultAgent = core.configManager.get().defaultAgent
      return (
        `Installed agents: ${installed.join(', ')}\n` +
        `Default agent: ${defaultAgent}\n` +
        `Available in ACP Registry: ${available} more agents`
      )
    },
    commands: [
      { command: 'viben agents', description: 'List all agents' },
      { command: 'viben agents install <name>', description: 'Install agent' },
      { command: 'viben agents info <name>', description: 'Show agent details' },
      { command: 'viben agents run <name> -- <args>', description: 'Run agent CLI (for login etc.)' },
    ],
  }
}
```

```typescript
// src/core/assistant/sections/config.ts
import type { AssistantSection } from '../assistant-registry.js'

export function createConfigSection(core: {
  configManager: { get(): { workspace: { baseDir: string }; speech?: { stt?: { provider?: string } } } }
}): AssistantSection {
  return {
    id: 'core:config',
    title: 'Configuration',
    priority: 30,
    buildContext: () => {
      const config = core.configManager.get()
      return (
        `Workspace base: ${config.workspace.baseDir}\n` +
        `STT: ${config.speech?.stt?.provider ? `${config.speech.stt.provider} ✅` : 'Not configured'}`
      )
    },
    commands: [
      { command: 'viben config', description: 'View config' },
      { command: 'viben config set <key> <value>', description: 'Update config value' },
    ],
  }
}
```

```typescript
// src/core/assistant/sections/system.ts
import type { AssistantSection } from '../assistant-registry.js'

export function createSystemSection(): AssistantSection {
  return {
    id: 'core:system',
    title: 'System',
    priority: 40,
    buildContext: () => {
      return 'Always ask for confirmation before restart or update — these are disruptive actions.'
    },
    commands: [
      { command: 'viben api health', description: 'System health check' },
      { command: 'viben api restart', description: 'Restart daemon' },
      { command: 'viben api version', description: 'Show version' },
      { command: 'viben api topics', description: 'List all topics' },
      { command: 'viben api cleanup', description: 'Cleanup finished topics' },
    ],
  }
}
```

- [ ] **Step 2: Create assistant index**

```typescript
// src/core/assistant/index.ts
export { AssistantRegistry, type AssistantSection, type AssistantCommand } from './assistant-registry.js'
export { ASSISTANT_PREAMBLE, ASSISTANT_GUIDELINES } from './prompt-constants.js'
export { createSessionsSection } from './sections/sessions.js'
export { createAgentsSection } from './sections/agents.js'
export { createConfigSection } from './sections/config.js'
export { createSystemSection } from './sections/system.js'
```

- [ ] **Step 3: Commit**

```bash
git add src/core/assistant/sections/ src/core/assistant/index.ts
git commit -m "feat: add core assistant sections for sessions, agents, config, system"
```

---

## Task 5: AssistantManager — Lifecycle in Core

**Files:**
- Create: `src/core/assistant/assistant-manager.ts`
- Modify: `src/core/sessions/session.ts`
- Test: `src/core/__tests__/assistant-manager.test.ts`

- [ ] **Step 1: Write AssistantManager tests**

```typescript
// src/core/__tests__/assistant-manager.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssistantManager } from "../assistant/assistant-manager.js";
import { AssistantRegistry } from "../assistant/assistant-registry.js";

function mockCore() {
  const session = {
    id: "assistant-1",
    threadId: "",
    enqueuePrompt: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
  return {
    createSession: vi.fn().mockResolvedValue(session),
    connectSessionBridge: vi.fn(),
    configManager: {
      get: () => ({ defaultAgent: "claude-code" }),
      resolveWorkspace: () => "/home/user/code",
    },
    _session: session,
  };
}

describe("AssistantManager", () => {
  let core: ReturnType<typeof mockCore>;
  let registry: AssistantRegistry;
  let manager: AssistantManager;

  beforeEach(() => {
    core = mockCore();
    registry = new AssistantRegistry();
    manager = new AssistantManager(core as any, registry);
  });

  it("spawn creates session and stores it", async () => {
    const session = await manager.spawn("telegram", "12345");
    expect(core.createSession).toHaveBeenCalledWith(expect.objectContaining({
      channelId: "telegram",
      isAssistant: true,
      initialName: "Assistant",
    }));
    expect(session.threadId).toBe("12345");
    expect(manager.get("telegram")).toBe(session);
  });

  it("get returns null for unknown channel", () => {
    expect(manager.get("discord")).toBeNull();
  });

  it("isAssistant returns true for assistant session", async () => {
    await manager.spawn("telegram", "12345");
    expect(manager.isAssistant("assistant-1")).toBe(true);
    expect(manager.isAssistant("other-session")).toBe(false);
  });

  it("respawn destroys old and creates new", async () => {
    await manager.spawn("telegram", "12345");
    const oldSession = core._session;
    // Make a new session for respawn
    const newSession = { ...oldSession, id: "assistant-2", threadId: "", enqueuePrompt: vi.fn().mockResolvedValue(undefined), destroy: vi.fn() };
    core.createSession.mockResolvedValueOnce(newSession);

    await manager.respawn("telegram", "12345");
    expect(oldSession.destroy).toHaveBeenCalled();
    expect(manager.get("telegram")).toBe(newSession);
  });

  it("concurrent respawn returns current session", async () => {
    await manager.spawn("telegram", "12345");
    // Simulate slow destroy
    core._session.destroy.mockImplementation(() => new Promise((r) => setTimeout(r, 100)));
    const newSession = { ...core._session, id: "assistant-2", threadId: "", enqueuePrompt: vi.fn().mockResolvedValue(undefined), destroy: vi.fn() };
    core.createSession.mockResolvedValueOnce(newSession);

    const [r1, r2] = await Promise.all([
      manager.respawn("telegram", "12345"),
      manager.respawn("telegram", "12345"),
    ]);
    // Second call returns current (old) session since first respawn holds the lock
    expect(core._session.destroy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm vitest run src/core/__tests__/assistant-manager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Add isAssistant field to Session**

In `src/core/sessions/session.ts`, add to the constructor options and class field:

Add field after `agentSwitchHistory` declaration:
```typescript
isAssistant: boolean = false;
```

Add to constructor opts type:
```typescript
isAssistant?: boolean
```

Add to constructor body:
```typescript
this.isAssistant = opts.isAssistant ?? false;
```

- [ ] **Step 4: Create AssistantManager**

```typescript
// src/core/assistant/assistant-manager.ts
import type { Session } from '../sessions/session.js'
import type { AssistantRegistry } from './assistant-registry.js'
import { createChildLogger } from '../utils/log.js'

const log = createChildLogger({ module: 'assistant-manager' })

interface AssistantManagerCore {
  createSession(params: {
    channelId: string
    agentName: string
    workingDirectory: string
    initialName?: string
    isAssistant?: boolean
  }): Promise<Session>
  connectSessionBridge(session: Session): void
  configManager: {
    get(): { defaultAgent: string }
    resolveWorkspace(): string
  }
}

export class AssistantManager {
  private sessions = new Map<string, Session>()
  private readyState = new Map<string, Promise<void>>()
  private respawning = new Set<string>()

  constructor(
    private core: AssistantManagerCore,
    private registry: AssistantRegistry,
  ) {}

  async spawn(channelId: string, threadId: string): Promise<Session> {
    const session = await this.core.createSession({
      channelId,
      agentName: this.core.configManager.get().defaultAgent,
      workingDirectory: this.core.configManager.resolveWorkspace(),
      initialName: 'Assistant',
      isAssistant: true,
    })
    session.threadId = threadId
    this.sessions.set(channelId, session)

    const systemPrompt = this.registry.buildSystemPrompt()
    const ready = session
      .enqueuePrompt(systemPrompt)
      .then(() => {
        this.core.connectSessionBridge(session)
        log.info({ sessionId: session.id, channelId }, 'Assistant ready')
      })
      .catch((err) => {
        log.warn({ err, channelId }, 'Assistant system prompt failed')
      })
    this.readyState.set(channelId, ready)

    return session
  }

  get(channelId: string): Session | null {
    return this.sessions.get(channelId) ?? null
  }

  isAssistant(sessionId: string): boolean {
    for (const s of this.sessions.values()) {
      if (s.id === sessionId) return true
    }
    return false
  }

  async respawn(channelId: string, threadId: string): Promise<Session> {
    if (this.respawning.has(channelId)) {
      return this.sessions.get(channelId)!
    }
    this.respawning.add(channelId)
    try {
      const old = this.sessions.get(channelId)
      if (old) await old.destroy()
      return await this.spawn(channelId, threadId)
    } finally {
      this.respawning.delete(channelId)
    }
  }

  async waitReady(channelId: string): Promise<void> {
    await this.readyState.get(channelId)
  }
}
```

- [ ] **Step 5: Add to assistant index**

Update `src/core/assistant/index.ts` — add:
```typescript
export { AssistantManager } from './assistant-manager.js'
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm vitest run src/core/__tests__/assistant-manager.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/assistant/assistant-manager.ts src/core/assistant/index.ts src/core/sessions/session.ts src/core/__tests__/assistant-manager.test.ts
git commit -m "feat: add AssistantManager for core assistant lifecycle"
```

---

## Task 6: Add `delegated` to CommandResponse + Update CommandRegistry

**Files:**
- Modify: `src/core/plugin/types.ts`
- Modify: `src/core/command-registry.ts`

- [ ] **Step 1: Add delegated type to CommandResponse**

In `src/core/plugin/types.ts`, update the CommandResponse union (line 157-163):

```typescript
export type CommandResponse =
  | { type: 'text'; text: string }
  | { type: 'menu'; title: string; options: MenuOption[] }
  | { type: 'list'; title: string; items: ListItem[] }
  | { type: 'confirm'; question: string; onYes: string; onNo: string }
  | { type: 'error'; message: string }
  | { type: 'silent' }
  | { type: 'delegated' }
```

Note: Keep `silent` for backward compatibility during migration. It will be deprecated.

- [ ] **Step 2: Update CommandRegistry.execute() to handle delegated**

In `src/core/command-registry.ts`, update the `execute` method. The current code at line 158-159 already handles null/undefined returns as silent:

```typescript
if (result === undefined || result === null) {
  return { type: 'silent' }
}
```

No change needed here — `delegated` is just a new value handlers can return. The adapter checks `response.type === "delegated"` and skips rendering.

- [ ] **Step 3: Build to verify no type errors**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/core/plugin/types.ts
git commit -m "feat: add delegated CommandResponse type for assistant delegation"
```

---

## Task 7: Wire Registries into VibenCore

**Files:**
- Modify: `src/core/core.ts`
- Modify: `src/core/plugin/plugin-context.ts`
- Modify: `src/core/index.ts`

- [ ] **Step 1: Add registries to VibenCore**

In `src/core/core.ts`, add imports:

```typescript
import { MenuRegistry } from './menu-registry.js'
import { AssistantRegistry, AssistantManager } from './assistant/index.js'
import { registerCoreMenuItems } from './menu/core-items.js'
import { createSessionsSection, createAgentsSection, createConfigSection, createSystemSection } from './assistant/index.js'
```

Add fields to the class:

```typescript
readonly menuRegistry = new MenuRegistry()
readonly assistantRegistry = new AssistantRegistry()
assistantManager!: AssistantManager
```

In the constructor, after existing initialization:

```typescript
// Register core menu items
registerCoreMenuItems(this.menuRegistry)

// Register core assistant sections
this.assistantRegistry.register(createSessionsSection(this))
this.assistantRegistry.register(createAgentsSection(this))
this.assistantRegistry.register(createConfigSection(this))
this.assistantRegistry.register(createSystemSection())

// Create assistant manager
this.assistantManager = new AssistantManager(this, this.assistantRegistry)
```

Add `connectSessionBridge` method to VibenCore (called by AssistantManager after system prompt completes):

```typescript
connectSessionBridge(session: Session): void {
  const adapter = this.adapters.get(session.channelId)
  if (!adapter) return
  this.createBridge(session, adapter)
}
```

Also register menuRegistry and assistantRegistry as services so plugins can access them:

```typescript
this.lifecycleManager.serviceRegistry.register('menu-registry', this.menuRegistry)
this.lifecycleManager.serviceRegistry.register('assistant-registry', this.assistantRegistry)
```

- [ ] **Step 2: Add plugin context methods**

In `src/core/plugin/plugin-context.ts`, add to the returned context object:

```typescript
registerMenuItem(item: MenuItem): void {
  const menuRegistry = serviceRegistry.get('menu-registry') as MenuRegistry | undefined
  if (!menuRegistry) return
  menuRegistry.register({ ...item, id: `${pluginName}:${item.id}` })
},

unregisterMenuItem(id: string): void {
  const menuRegistry = serviceRegistry.get('menu-registry') as MenuRegistry | undefined
  if (!menuRegistry) return
  menuRegistry.unregister(id)
},

registerAssistantSection(section: AssistantSection): void {
  const assistantRegistry = serviceRegistry.get('assistant-registry') as AssistantRegistry | undefined
  if (!assistantRegistry) return
  assistantRegistry.register({ ...section, id: `${pluginName}:${section.id}` })
},

unregisterAssistantSection(id: string): void {
  const assistantRegistry = serviceRegistry.get('assistant-registry') as AssistantRegistry | undefined
  if (!assistantRegistry) return
  assistantRegistry.unregister(`${pluginName}:${id}`)
},
```

Add needed imports to plugin-context.ts:

```typescript
import type { MenuItem } from './types.js'
import type { MenuRegistry } from '../menu-registry.js'
import type { AssistantSection } from '../assistant/assistant-registry.js'
import type { AssistantRegistry } from '../assistant/assistant-registry.js'
```

- [ ] **Step 3: Update core exports**

In `src/core/index.ts`, add:

```typescript
export { MenuRegistry, type MenuItem } from './menu-registry.js'
export { AssistantRegistry, AssistantManager, type AssistantSection, type AssistantCommand } from './assistant/index.js'
```

- [ ] **Step 4: Build to verify**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/core/core.ts src/core/plugin/plugin-context.ts src/core/index.ts
git commit -m "feat: wire MenuRegistry, AssistantRegistry, AssistantManager into core"
```

---

## Task 8: SessionBridge Simplification

**Files:**
- Modify: `src/core/sessions/session-bridge.ts`
- Test: `src/core/__tests__/session-bridge-refactor.test.ts`

- [ ] **Step 1: Write tests for refactored SessionBridge**

```typescript
// src/core/__tests__/session-bridge-refactor.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionBridge } from "../sessions/session-bridge.js";
import { TypedEmitter } from "../utils/typed-emitter.js";

function mockSession() {
  const emitter = new TypedEmitter();
  const agentInstance = new TypedEmitter();
  Object.assign(agentInstance, {
    sessionId: "agent-1",
    onPermissionRequest: vi.fn(),
    debugTracer: null,
  });
  return Object.assign(emitter, {
    id: "sess-1",
    agentInstance,
    permissionGate: { setPending: vi.fn().mockResolvedValue("allow") },
    workingDirectory: "/tmp",
    status: "active",
    name: undefined,
    promptCount: 0,
    finish: vi.fn(),
    fail: vi.fn(),
    emit: emitter.emit.bind(emitter),
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    getConfigByCategory: vi.fn(),
    clientOverrides: {},
    configOptions: [],
    updateConfigOptions: vi.fn(),
    setName: vi.fn(),
    toAcpStateSnapshot: vi.fn().mockReturnValue({}),
    channelId: "telegram",
    archiving: false,
    threadId: "12345",
  }) as any;
}

function mockAdapter() {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendPermissionRequest: vi.fn().mockResolvedValue(undefined),
    renameSessionThread: vi.fn().mockResolvedValue(undefined),
    cleanupSkillCommands: vi.fn(),
    sendSkillCommands: vi.fn(),
    stripTTSBlock: vi.fn(),
  } as any;
}

function mockDeps() {
  return {
    messageTransformer: {
      transform: vi.fn().mockReturnValue({ type: "text", text: "transformed" }),
    },
    notificationManager: { notify: vi.fn() },
    sessionManager: {
      patchRecord: vi.fn().mockResolvedValue(undefined),
      getSessionRecord: vi.fn(),
    },
    eventBus: { emit: vi.fn() },
    middlewareChain: undefined,
  } as any;
}

describe("SessionBridge refactored", () => {
  it("connect/disconnect cleans up all listeners", () => {
    const session = mockSession();
    const bridge = new SessionBridge(session, mockAdapter(), mockDeps());
    bridge.connect();
    // Emit should be handled
    session.emit("agent_event", { type: "text", text: "hello" });
    bridge.disconnect();
    // After disconnect, emitting should not trigger handlers
    // (no error thrown, just no effect)
    session.emit("agent_event", { type: "text", text: "after disconnect" });
  });

  it("double connect is safe", () => {
    const session = mockSession();
    const bridge = new SessionBridge(session, mockAdapter(), mockDeps());
    bridge.connect();
    bridge.connect(); // should be no-op
    bridge.disconnect();
  });

  it("double disconnect is safe", () => {
    const session = mockSession();
    const bridge = new SessionBridge(session, mockAdapter(), mockDeps());
    bridge.connect();
    bridge.disconnect();
    bridge.disconnect(); // should be no-op
  });
});
```

- [ ] **Step 2: Run existing SessionBridge tests to establish baseline**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm vitest run src/core/__tests__/session-bridge`
Expected: All existing tests PASS (baseline)

- [ ] **Step 3: Refactor SessionBridge**

In `src/core/sessions/session-bridge.ts`, apply these changes:

1. Replace the 5 optional handler fields with a single cleanup array:
```typescript
private cleanupFns: Array<() => void> = [];
```

2. Add the `on()` helper method:
```typescript
private listen<E extends string>(emitter: { on(event: E, handler: (...args: any[]) => void): void; off(event: E, handler: (...args: any[]) => void): void }, event: E, handler: (...args: any[]) => void): void {
  emitter.on(event, handler);
  this.cleanupFns.push(() => emitter.off(event, handler));
}
```

3. Refactor `connect()` to use inline listeners with `this.listen()`:
```typescript
connect(): void {
  if (this.connected) return;
  this.connected = true;

  // Agent events → dispatch
  this.listen(this.session, "agent_event", (event: AgentEvent) => {
    this.dispatchAgentEvent(event);
  });

  // Lifecycle: status changes
  this.listen(this.session, "status_change", (from: SessionStatus, to: SessionStatus) => {
    this.deps.sessionManager.patchRecord(this.session.id, { status: to, lastActiveAt: new Date().toISOString() });
    this.deps.eventBus?.emit("session:updated", { sessionId: this.session.id, status: to });
    if (to === "finished") {
      queueMicrotask(() => this.disconnect());
    }
  });

  // Lifecycle: name changes
  this.listen(this.session, "named", async (name: string) => {
    const record = this.deps.sessionManager.getSessionRecord(this.session.id);
    const alreadyNamed = !!record?.name;
    await this.deps.sessionManager.patchRecord(this.session.id, { name });
    this.deps.eventBus?.emit("session:updated", { sessionId: this.session.id, name });
    if (!alreadyNamed) {
      await this.adapter.renameSessionThread(this.session.id, name);
    }
  });

  // Lifecycle: prompt count
  this.listen(this.session, "prompt_count_changed", (count: number) => {
    this.deps.sessionManager.patchRecord(this.session.id, { currentPromptCount: count });
  });

  // Permissions
  this.session.agentInstance.onPermissionRequest = (req) => this.resolvePermission(req);
}
```

4. Simplify `disconnect()`:
```typescript
disconnect(): void {
  if (!this.connected) return;
  this.connected = false;
  this.cleanupFns.forEach((fn) => fn());
  this.cleanupFns = [];
  this.session.agentInstance.onPermissionRequest = async () => "";
}
```

5. Extract `dispatchAgentEvent()` from the nested `.then().catch()` in `wireSessionToAdapter()`:
```typescript
private async dispatchAgentEvent(event: AgentEvent): Promise<void> {
  try {
    this.tracer?.log("core", { step: "agent_event", sessionId: this.session.id, event });
    const mw = this.deps.middlewareChain;
    if (mw) {
      const result = await mw.execute('agent:beforeEvent', { sessionId: this.session.id, event }, async (e) => e)
        .catch(() => ({ event }));
      this.tracer?.log("core", { step: "middleware:before", sessionId: this.session.id, hook: "agent:beforeEvent", blocked: !result });
      if (!result) return;
      event = result.event;
    }

    const outgoing = this.handleAgentEvent(event);

    if (mw) {
      mw.execute('agent:afterEvent', {
        sessionId: this.session.id,
        event,
        outgoingMessage: outgoing ?? { type: 'text' as const, text: '' },
      }, async (e) => e).catch(() => {});
    }
  } catch (err) {
    log.error({ err, sessionId: this.session.id }, "Error dispatching agent event");
  }
}
```

6. Extract `resolvePermission()` from `wirePermissions()`:
```typescript
private async resolvePermission(request: PermissionRequest): Promise<string> {
  const startTime = Date.now();
  const mw = this.deps.middlewareChain;

  // Step 1: Middleware
  let permReq = request;
  if (mw) {
    const payload = { sessionId: this.session.id, request, autoResolve: undefined as string | undefined };
    const result = await mw.execute('permission:beforeRequest', payload, async (r) => r);
    if (!result) return "";
    permReq = result.request;
    if (result.autoResolve) {
      this.emitAfterResolve(mw, permReq.id, result.autoResolve, 'middleware', startTime);
      return result.autoResolve;
    }
  }

  this.session.emit("permission_request", permReq);
  this.deps.eventBus?.emit("permission:request", { sessionId: this.session.id, permission: permReq });

  // Step 2: Auto-approve rules
  const autoDecision = this.checkAutoApprove(permReq);
  if (autoDecision) {
    this.emitAfterResolve(mw, permReq.id, autoDecision, 'system', startTime);
    return autoDecision;
  }

  // Step 3: Ask user
  const promise = this.session.permissionGate.setPending(permReq);
  await this.adapter.sendPermissionRequest(this.session.id, permReq);
  const optionId = await promise;
  this.emitAfterResolve(mw, permReq.id, optionId, 'user', startTime);
  return optionId;
}

private checkAutoApprove(request: PermissionRequest): string | null {
  if (request.description.toLowerCase().includes("viben")) {
    const allow = request.options.find((o) => o.isAllow);
    if (allow) return allow.id;
  }
  const modeOption = this.session.getConfigByCategory("mode");
  const isAgentBypass = modeOption && isPermissionBypass(
    typeof modeOption.currentValue === "string" ? modeOption.currentValue : ""
  );
  const isClientBypass = this.session.clientOverrides.bypassPermissions;
  if (isAgentBypass || isClientBypass) {
    const allow = request.options.find((o) => o.isAllow);
    if (allow) return allow.id;
  }
  return null;
}

private emitAfterResolve(mw: MiddlewareChain | undefined, requestId: string, decision: string, userId: string, startTime: number): void {
  if (mw) {
    mw.execute('permission:afterResolve', {
      sessionId: this.session.id, requestId, decision, userId, durationMs: Date.now() - startTime,
    }, async (p) => p).catch(() => {});
  }
}
```

7. Remove `wireAgentToSession()`, `wireSessionToAdapter()`, `wirePermissions()`, `wireLifecycle()` methods and the 5 optional handler fields.

- [ ] **Step 4: Run all SessionBridge tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm vitest run src/core/__tests__/session-bridge`
Expected: All existing + new tests PASS

- [ ] **Step 5: Build to verify**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/core/sessions/session-bridge.ts src/core/__tests__/session-bridge-refactor.test.ts
git commit -m "refactor: simplify SessionBridge with cleanup array and extracted methods"
```

---

## Task 9: Replace Silent Command Handlers with Real Implementations

**Files:**
- Modify: `src/core/commands/session.ts`
- Modify: `src/core/commands/admin.ts`

- [ ] **Step 1: Replace silent session command handlers**

In `src/core/commands/session.ts`, replace every `{ type: 'silent' }` handler. The pattern per command:

**`/new`** — delegate to assistant if missing args:
```typescript
handler: async (args) => {
  const core = args.coreAccess as any
  if (!core) return { type: 'error', message: 'Core access not available' }
  const parts = args.raw.trim().split(/\s+/)
  const agent = parts[0] || undefined
  const workspace = parts[1] || undefined
  if (agent && workspace) {
    const session = await core.handleNewSession(args.channelId, agent, workspace)
    return { type: 'text', text: `✅ Session created: ${session.name || session.id}` }
  }
  const assistant = core.assistantManager?.get(args.channelId)
  if (assistant && !args.sessionId) {
    const prompt = agent
      ? `Create session with agent "${agent}", ask user for workspace path.`
      : `Create new session, guide user through agent and workspace selection.`
    await assistant.enqueuePrompt(prompt)
    return { type: 'delegated' }
  }
  return { type: 'text', text: 'Usage: /new <agent> <workspace>\nOr use the Assistant topic for guided setup.' }
}
```

**`/cancel`** — cancel session in current topic:
```typescript
handler: async (args) => {
  const core = args.coreAccess as any
  if (!core) return { type: 'error', message: 'Core access not available' }
  if (args.sessionId) {
    const session = core.sessionManager.getSession(args.sessionId)
    if (session) {
      await session.abortPrompt?.()
      session.markCancelled()
      return { type: 'text', text: `⛔ Session cancelled.` }
    }
  }
  return { type: 'error', message: 'No active session in this topic.' }
}
```

**`/status`** — return session or system status:
```typescript
handler: async (args) => {
  const core = args.coreAccess as any
  if (!core) return { type: 'error', message: 'Core access not available' }
  if (args.sessionId) {
    const session = core.sessionManager.getSession(args.sessionId)
    if (session) {
      return { type: 'text', text: `📊 ${session.name || session.id}\nAgent: ${session.agentName}\nStatus: ${session.status}\nPrompts: ${session.promptCount}` }
    }
  }
  const records = core.sessionManager.listRecords()
  const active = records.filter((r: any) => r.status === 'active' || r.status === 'initializing').length
  return { type: 'text', text: `📊 ${active} active / ${records.length} total sessions` }
}
```

**`/sessions`** — list all sessions:
```typescript
handler: async (args) => {
  const core = args.coreAccess as any
  if (!core) return { type: 'error', message: 'Core access not available' }
  const records = core.sessionManager.listRecords()
  if (records.length === 0) return { type: 'text', text: 'No sessions.' }
  const items = records.map((r: any) => ({
    label: r.name || r.id,
    detail: `${r.agentName} — ${r.status}`,
  }))
  return { type: 'list', title: '📋 Sessions', items }
}
```

**`/clear`** — respawn assistant:
```typescript
handler: async (args) => {
  const core = args.coreAccess as any
  if (!core?.assistantManager) return { type: 'error', message: 'Assistant not available' }
  await core.assistantManager.respawn(args.channelId, '') // threadId resolved by manager
  return { type: 'text', text: '✅ Assistant history cleared.' }
}
```

**`/newchat`, `/resume`, `/handoff`** — these require adapter-specific context (threadId for topic lookup, agent capabilities). They should delegate to assistant or return usage text:
```typescript
// /newchat
handler: async (args) => {
  if (!args.sessionId) return { type: 'text', text: 'Use /newchat inside a session topic.' }
  const core = args.coreAccess as any
  if (!core) return { type: 'error', message: 'Core access not available' }
  const session = core.sessionManager.getSession(args.sessionId)
  if (!session) return { type: 'error', message: 'No session in this topic.' }
  const newSession = await core.handleNewSession(args.channelId, session.agentName, session.workingDirectory)
  return { type: 'text', text: `✅ New chat created: ${newSession.name || newSession.id}` }
}

// /resume — delegate to assistant
handler: async (args) => {
  const core = args.coreAccess as any
  const assistant = core?.assistantManager?.get(args.channelId)
  if (assistant && !args.sessionId) {
    await assistant.enqueuePrompt('User wants to resume a previous session. Show available sessions and guide them.')
    return { type: 'delegated' }
  }
  return { type: 'text', text: 'Usage: /resume <session-id>' }
}

// /handoff — needs agent capabilities
handler: async (args) => {
  if (!args.sessionId) return { type: 'text', text: 'Use /handoff inside a session topic.' }
  const core = args.coreAccess as any
  if (!core) return { type: 'error', message: 'Core access not available' }
  const session = core.sessionManager.getSession(args.sessionId)
  if (!session) return { type: 'error', message: 'No session in this topic.' }
  const { getAgentCapabilities } = await import('../agents/agent-registry.js')
  const caps = getAgentCapabilities(session.agentName)
  if (!caps.supportsResume || !caps.resumeCommand) {
    return { type: 'text', text: 'This agent does not support session transfer.' }
  }
  const command = caps.resumeCommand(session.agentSessionId)
  return { type: 'text', text: `Run this in your terminal:\n${command}` }
}
```

Note: `fork`, `close`, `agentsessions` already have real implementations — leave as-is.

- [ ] **Step 2: Replace silent admin command handlers**

In `src/core/commands/admin.ts`, the `restart` command currently returns `{ type: 'silent' }`. Replace with:

```typescript
handler: async (args: CommandArgs) => {
  const core = args.coreAccess as any
  const assistant = core?.assistantManager?.get(args.channelId)
  if (assistant && !args.sessionId) {
    await assistant.enqueuePrompt('User wants to restart Viben. Ask for confirmation before restarting.')
    return { type: 'delegated' as const }
  }
  return { type: 'text' as const, text: 'Use /restart in the Assistant topic, or run `viben api restart` in terminal.' }
}
```

- [ ] **Step 3: Build and run tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm vitest run src/core/__tests__/`
Expected: Build succeeds, tests pass

- [ ] **Step 4: Commit**

```bash
git add src/core/commands/session.ts src/core/commands/admin.ts
git commit -m "feat: replace silent command handlers with real implementations"
```

---

## Task 10: Delete action-detect.ts and Interactive Flows

**Files:**
- Delete: `src/plugins/telegram/action-detect.ts`
- Modify: `src/plugins/telegram/commands/new-session.ts`
- Modify: `src/plugins/telegram/commands/resume.ts`
- Modify: `src/plugins/telegram/commands/index.ts`

- [ ] **Step 1: Delete action-detect.ts**

```bash
rm src/plugins/telegram/action-detect.ts
```

- [ ] **Step 2: Remove interactive flows from new-session.ts**

In `src/plugins/telegram/commands/new-session.ts`, delete:
- `pendingNewSessions` Map and `PendingNewSession` interface
- `cleanupPending()` function
- `showAgentPicker()` function
- `startWorkspaceStep()` function
- `startConfirmStep()` function
- `handlePendingWorkspaceInput()` export
- `startInteractiveNewSession()` export
- `setupNewSessionCallbacks()` export

Keep:
- `createSessionDirect()` — still used by commands for direct session creation
- `executeNewSession()` — still used by API/programmatic session creation
- `handleNewChat()` — still used for /newchat command

- [ ] **Step 3: Remove handlePendingResumeInput from resume.ts**

In `src/plugins/telegram/commands/resume.ts`, delete the pending state machine and `handlePendingResumeInput()` export.

- [ ] **Step 4: Clean up index.ts exports**

In `src/plugins/telegram/commands/index.ts`:
- Delete `setupCommands()` function
- Remove re-exports: `handlePendingWorkspaceInput`, `startInteractiveNewSession`, `setupNewSessionCallbacks`, `handlePendingResumeInput`
- Remove `setupActionCallbacks` import and re-export

- [ ] **Step 5: Fix adapter.ts import errors from deleted functions**

In `src/plugins/telegram/adapter.ts`:
- Remove import of `setupActionCallbacks` from `./action-detect.js`
- Remove import of `handlePendingWorkspaceInput`, `handlePendingResumeInput` from `./commands/index.js`
- Remove `setupActionCallbacks(...)` call in `start()`
- Remove `handlePendingWorkspaceInput()` and `handlePendingResumeInput()` checks in `setupRoutes()`
- Comment out or remove `setupCommands(...)` call (full removal in Task 11)

These are minimal fixes to make the build pass — the full adapter simplification happens in Task 11.

- [ ] **Step 6: Build to verify**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: delete action-detect.ts and interactive multi-step flows"
```

---

## Task 11: Simplify Telegram Adapter

**Files:**
- Modify: `src/plugins/telegram/adapter.ts`
- Modify: `src/plugins/telegram/assistant.ts`
- Modify: `src/plugins/telegram/commands/menu.ts`
- Modify: `src/plugins/telegram/commands/index.ts`

- [ ] **Step 1: Remove assistant state from adapter**

In `src/plugins/telegram/adapter.ts`, remove:
- `private assistantSession: Session | null = null`
- `private assistantInitializing = false`
- The `if (this.assistantInitializing && sessionId === this.assistantSession?.id) return;` check in `sendMessage()`
- The `spawnAssistant()` call and its surrounding try/catch in `start()`
- The assistant topic special case in `setupRoutes()`

Replace assistant spawn with:
```typescript
await this.core.assistantManager.spawn("telegram", String(this.assistantTopicId));
```

- [ ] **Step 2: Remove setupCommands() and setupActionCallbacks() calls**

In `src/plugins/telegram/adapter.ts`, in the `start()` method:
- Remove `setupActionCallbacks(...)` call
- Remove `setupCommands(...)` call
- Remove standalone `this.bot.command("handoff", ...)` handler
- Remove the import of `setupActionCallbacks` from action-detect.ts

- [ ] **Step 3: Simplify setupRoutes()**

In `setupRoutes()`, remove:
- `handlePendingWorkspaceInput()` check
- `handlePendingResumeInput()` check
- The `if (threadId === this.assistantTopicId) { handleAssistantMessage(...) }` special case

Replace with unified routing: ALL topics (including assistant) go through `core.handleMessage()`.

- [ ] **Step 4: Update menu.ts — registry-based buildMenuKeyboard()**

In `src/plugins/telegram/commands/menu.ts`, replace the hardcoded `buildMenuKeyboard()`:

```typescript
import type { MenuRegistry } from '../../../core/menu-registry.js'

export function buildMenuKeyboard(menuRegistry?: MenuRegistry): InlineKeyboard {
  if (!menuRegistry) {
    // Fallback for backward compat if registry not available
    return new InlineKeyboard()
      .text('🆕 New Session', 'm:core:new')
      .text('📋 Sessions', 'm:core:sessions')
      .row()
      .text('📊 Status', 'm:core:status')
      .text('🤖 Agents', 'm:core:agents')
      .row()
      .text('❓ Help', 'm:core:help')
  }

  const items = menuRegistry.getItems()
  const kb = new InlineKeyboard()
  let currentGroup: string | undefined
  let rowCount = 0

  for (const item of items) {
    if (item.group !== currentGroup && rowCount > 0) {
      kb.row()
      rowCount = 0
    }
    currentGroup = item.group
    if (rowCount >= 2) {
      kb.row()
      rowCount = 0
    }
    kb.text(item.label, `m:${item.id}`)
    rowCount++
  }

  return kb
}
```

- [ ] **Step 5: Replace broad m: handler with generic MenuRegistry dispatch**

In `src/plugins/telegram/commands/index.ts`, replace the switch/case `m:` handler with:

```typescript
bot.callbackQuery(/^m:/, async (ctx) => {
  const itemId = ctx.callbackQuery.data.replace('m:', '')
  try { await ctx.answerCallbackQuery() } catch { /* expired */ }

  const menuRegistry = core.lifecycleManager?.serviceRegistry?.get('menu-registry') as MenuRegistry | undefined
  if (!menuRegistry) return

  const item = menuRegistry.getItem(itemId)
  if (!item) return

  const topicId = ctx.callbackQuery.message?.message_thread_id
  const registry = core.lifecycleManager?.serviceRegistry?.get<CommandRegistry>('command-registry')

  switch (item.action.type) {
    case 'command': {
      if (!registry) return
      const response = await registry.execute(item.action.command, {
        raw: '',
        channelId: 'telegram',
        userId: String(ctx.from.id),
        sessionId: null,
        reply: async (content) => {
          if (typeof content === 'string') await ctx.reply(content)
        },
      })
      if (response.type !== 'delegated' && response.type !== 'silent') {
        await renderCommandResponse(response, chatId, topicId)
      }
      break
    }
    case 'delegate': {
      const assistant = core.assistantManager.get('telegram')
      if (assistant) {
        // assistantTopicId is passed as a closure parameter from setupAllCallbacks()
        const assistantTopicId = systemTopicIds?.assistantTopicId
        if (topicId && topicId !== assistantTopicId) {
          await ctx.reply(redirectToAssistant(chatId, assistantTopicId))
        } else {
          await assistant.enqueuePrompt(item.action.prompt)
        }
      } else {
        await ctx.reply('⚠️ Assistant is not available.')
      }
      break
    }
    case 'callback':
      // Pass through — specific callback handlers (s:settings etc.) handle these
      break
  }
})
```

- [ ] **Step 6: Clean up assistant.ts**

In `src/plugins/telegram/assistant.ts`, remove:
- `spawnAssistant()` function
- `buildAssistantSystemPrompt()` function
- `handleAssistantMessage()` function
- `AssistantContext` interface

Keep:
- `buildWelcomeMessage()` — still used by adapter for welcome message
- `redirectToAssistant()` — still used for redirect links
- `WelcomeContext` interface

- [ ] **Step 7: Build and fix any remaining compile errors**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Fix any remaining import errors or type mismatches iteratively.

- [ ] **Step 8: Run full test suite**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test`
Expected: All tests pass (some may need updating if they referenced deleted functions)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: simplify Telegram adapter, registry-based menu, remove assistant state"
```

---

## Task 12: Update Exports, Plugin SDK, and Documentation

**Files:**
- Modify: `src/core/index.ts`
- Modify: `src/packages/plugin-sdk/` (type exports)
- Modify: `src/cli/plugin-template/` (plugin guide, claude-md)
- Modify: `docs/` (if applicable)

- [ ] **Step 1: Verify all new types are exported from core/index.ts**

Ensure these exports exist:
```typescript
export { MenuRegistry, type MenuItem } from './menu-registry.js'
export { AssistantRegistry, AssistantManager, type AssistantSection, type AssistantCommand } from './assistant/index.js'
```

- [ ] **Step 2: Update plugin template**

In `src/cli/plugin-template/claude-md.ts` and `plugin-guide.ts`, add documentation about:
- `ctx.registerMenuItem()` / `ctx.unregisterMenuItem()`
- `ctx.registerAssistantSection()` / `ctx.unregisterAssistantSection()`
- The `delegated` CommandResponse type

- [ ] **Step 3: Run full build and test**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm test`
Expected: Build succeeds, all tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: update plugin SDK exports and template for new registries"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test`
Expected: All tests pass

- [ ] **Step 2: Build for publish**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build:publish`
Expected: Build succeeds

- [ ] **Step 3: Verify no leftover references to deleted code**

```bash
cd /Users/lucas/viben-workspace/Viben
grep -r "action-detect" src/ --include="*.ts" | grep -v "node_modules"
grep -r "setupCommands" src/ --include="*.ts" | grep -v "node_modules"
grep -r "handlePendingWorkspaceInput" src/ --include="*.ts" | grep -v "node_modules"
grep -r "handlePendingResumeInput" src/ --include="*.ts" | grep -v "node_modules"
grep -r "pendingNewSessions" src/ --include="*.ts" | grep -v "node_modules"
grep -r "assistantInitializing" src/ --include="*.ts" | grep -v "node_modules"
```

Expected: No matches (all references cleaned up)

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup for command-assistant refactor"
```
