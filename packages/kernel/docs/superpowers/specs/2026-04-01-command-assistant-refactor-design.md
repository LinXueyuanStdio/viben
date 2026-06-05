# Command & Assistant Architecture Refactor

**Date:** 2026-04-01
**Status:** Draft
**Scope:** Core command dispatch, assistant session management, bot/chat flow separation, menu extensibility

## Problem

The current codebase has four architectural problems that compound into frequent bugs and confused logic:

1. **Three parallel command dispatch systems** — CommandRegistry, `bot.command()` handlers, and `detectAction()` regex all process the same user input, causing race conditions and duplicate handling.
2. **Assistant session hardcoded in Telegram adapter** — The assistant is managed as a special case with 6+ conditional branches scattered across the adapter, making it impossible to reuse for Discord, Slack, or SSE/API Server.
3. **Mixed Bot UI and Chat flows in assistant topic** — Interactive multi-step flows (agent picker, workspace input) use text interception (`handlePendingWorkspaceInput`) that conflicts with assistant chat, causing input stealing and race conditions.
4. **Hardcoded menu** — The menu keyboard is a static function in `menu.ts`. Plugins cannot add, remove, or replace menu items.

## Design

### Part 1: Unified Command Dispatch

**Goal:** One entry point for all commands. No `bot.command()`, no `detectAction()`, no `silent` placeholders.

#### Current state

```
User types "/new"
  ├─ bot.on("message:text") → CommandRegistry.execute("/new")
  │    → handler returns { type: 'silent' } → return next()
  ├─ bot.command("new") → handleNew() ← actual handler
  └─ detectAction("/new") → regex match → action buttons ← potential duplicate
```

- 11 of ~30 system commands are `silent` placeholders in CommandRegistry — registered for discovery but implemented elsewhere.
- `setupCommands()` in `commands/index.ts` registers 20 `bot.command()` handlers that duplicate registry entries.
- `action-detect.ts` (204 LOC) matches `/new` and `/cancel` via regex and offers confirmation buttons, potentially creating sessions twice.

#### New state

```
User types "/new"
  └─ bot.on("message:text") → CommandRegistry.execute("/new")
       → real handler executes → returns CommandResponse → adapter renders
```

**Changes:**

1. **Delete `setupCommands()` and all `bot.command()` registrations.** Move handler logic into CommandRegistry handlers.

2. **Delete `action-detect.ts` entirely.** The assistant agent handles natural language intent detection via its existing `viben api` tool commands.

3. **Eliminate `silent` response type from CommandRegistry.** Every registered command has a real handler. Commands that need adapter-specific UI return structured `CommandResponse` types (text, menu, confirm, error).

4. **Command handlers that need conversation** (e.g., `/new` without args) delegate to the assistant agent instead of running interactive multi-step flows.

5. **Keep `bot.api.setMyCommands(STATIC_COMMANDS)`** for Telegram autocomplete UI — this is just a static list, not a handler registration.

#### Command handler pattern

```typescript
// Commands with full args → execute immediately
// Commands with missing args → delegate to assistant
{
  name: 'new',
  category: 'system',
  handler: async (args: CommandArgs) => {
    const { agent, workspace } = parseNewArgs(args.raw);

    // Full args → create session directly
    if (agent && workspace) {
      const session = await core.handleNewSession(args.channelId, agent, workspace);
      return {
        type: 'text',
        text: `✅ Session created: ${session.name || session.id}`,
      };
    }

    // Missing args → delegate to assistant for conversational flow
    const assistant = core.assistantManager.get(args.channelId);
    if (assistant) {
      const prompt = agent
        ? `Create session with agent "${agent}", ask user for workspace path.`
        : `Create new session, guide user through agent and workspace selection.`;
      await assistant.enqueuePrompt(prompt);
      return { type: 'delegated' };
    }

    return { type: 'error', message: 'Usage: /new <agent> <workspace>' };
  }
}
```

#### New CommandResponse type

Add `delegated` type to replace `silent`:

```typescript
type CommandResponse =
  | { type: 'text'; text: string }
  | { type: 'error'; message: string }
  | { type: 'menu'; title: string; options: MenuOption[] }
  | { type: 'list'; title: string; items: ListItem[] }
  | { type: 'confirm'; question: string; onYes: string; onNo?: string }
  | { type: 'delegated' }  // command delegated to assistant, no bot response needed
```

`delegated` means "the assistant will handle the response" — adapter shows nothing. Unlike `silent` which meant "I don't handle this, pass to next middleware."

#### Adapter-specific rendering

Commands that need platform-specific UI (e.g., Telegram inline keyboards) use adapter overrides in CommandRegistry. This mechanism already exists — adapter plugins register overrides keyed by `channelId:commandName`. The difference is that overrides now contain real handlers, not just UI wrappers.

For example, `/menu` returns a `menu` CommandResponse with options. The Telegram adapter renders it as inline keyboard buttons. The SSE adapter renders it as JSON. No special handling needed per command.

#### Specific command migrations

| Command | Current handler | New handler location | Behavior |
|---------|----------------|---------------------|----------|
| `/new [agent] [workspace]` | `bot.command("new")` → `handleNew()` | CommandRegistry system handler | Full args → create directly. Missing args → delegate to assistant |
| `/cancel` | `bot.command("cancel")` → `handleCancel()` | CommandRegistry system handler | In session topic → cancel that session. In assistant topic → delegate |
| `/status` | `bot.command("status")` → `handleStatus()` | CommandRegistry system handler | Direct execute, return text |
| `/sessions` | `bot.command("sessions")` → `handleTopics()` | CommandRegistry system handler | Direct execute, return list |
| `/agents` | `bot.command("agents")` → `handleAgents()` | CommandRegistry system handler | Direct execute, return list with install buttons |
| `/handoff` | Standalone `bot.command("handoff")` in adapter.ts | CommandRegistry system handler | Session-topic-only. Looks up agent capabilities via `core.agentCatalog` |
| `/newchat` | `bot.command("newchat")` → `handleNewChat()` | CommandRegistry system handler | Direct execute — inherits agent+workspace from current session topic |
| `/clear` | `bot.command("clear")` → `handleClear()` | CommandRegistry system handler | Calls `core.assistantManager.respawn()` |
| `/restart` | `bot.command("restart")` → `handleRestart()` | CommandRegistry system handler | Delegate to assistant for confirmation |
| `/update` | `bot.command("update")` → `handleUpdate()` | CommandRegistry system handler | Delegate to assistant for confirmation |
| `/settings` | `bot.command("settings")` → `handleSettings()` | CommandRegistry with Telegram adapter override | Adapter override renders inline keyboard |
| `/menu` | `bot.command("menu")` → `handleMenu()` | CommandRegistry system handler | Returns menu from MenuRegistry |

#### Files deleted/changed

| File | Change |
|------|--------|
| `src/plugins/telegram/action-detect.ts` | **Delete entirely** (~204 LOC) |
| `src/plugins/telegram/commands/index.ts` `setupCommands()` | **Delete function** — no more `bot.command()` registrations |
| `src/core/commands/session.ts` | Replace `silent` handlers with real implementations |
| `src/core/commands/admin.ts` | Replace `silent` handlers with real implementations |
| `src/core/commands/agents.ts` | Replace `silent` handlers with real implementations |
| `src/core/command-registry.ts` | Remove `silent` handling in `execute()`, add `delegated` type |
| `src/plugins/telegram/adapter.ts` | Remove `setupCommands()` call, remove `setupActionCallbacks()` call, remove standalone `bot.command("handoff")`, simplify `bot.on("message:text")` handler |

### Part 2: Assistant in Core with Plugin-Extensible Context

**Goal:** Assistant is a core service, any adapter can use it, plugins can extend its knowledge and capabilities.

#### Current state

- `TelegramAdapter` holds `assistantSession`, `assistantInitializing`, `assistantTopicId` as private fields.
- `spawnAssistant()` in `plugins/telegram/assistant.ts` creates session and builds system prompt.
- `buildAssistantSystemPrompt()` is a 240-LOC monolith with hardcoded sections for sessions, agents, speech, config, CLI commands.
- Commands receive assistant via callback chains (`getSession`, `respawn`, `enqueuePrompt`).
- Discord, Slack, SSE adapters cannot reuse any of this.

#### New state: AssistantManager + AssistantRegistry

Two new modules in core:

**AssistantManager** — Lifecycle management (spawn, get, respawn, destroy).

```typescript
// src/core/assistant/assistant-manager.ts
export class AssistantManager {
  private sessions = new Map<string, Session>();          // channelId → Session
  private readyState = new Map<string, Promise<void>>();  // channelId → ready promise
  private respawning = new Set<string>();                 // guard concurrent respawn

  constructor(
    private core: VibenCore,
    private registry: AssistantRegistry,
  ) {}

  async spawn(channelId: string, threadId: string): Promise<Session> {
    const session = await this.core.createSession({
      channelId,
      agentName: this.core.configManager.get().defaultAgent,
      workingDirectory: this.core.configManager.resolveWorkspace(),
      initialName: "Assistant",
      isAssistant: true,
    });
    session.threadId = threadId;
    this.sessions.set(channelId, session);

    // System prompt in background — bridge connects AFTER ready
    const systemPrompt = this.registry.buildSystemPrompt();
    const ready = session.enqueuePrompt(systemPrompt)
      .then(() => { this.core.connectSessionBridge(session); })
      .catch(err => log.warn({ err }, "Assistant system prompt failed"));
    this.readyState.set(channelId, ready);

    return session;
  }

  get(channelId: string): Session | null {
    return this.sessions.get(channelId) ?? null;
  }

  isAssistant(sessionId: string): boolean {
    for (const s of this.sessions.values()) {
      if (s.id === sessionId) return true;
    }
    return false;
  }

  async respawn(channelId: string, threadId: string): Promise<Session> {
    if (this.respawning.has(channelId)) {
      return this.sessions.get(channelId)!; // concurrent respawn → return current
    }
    this.respawning.add(channelId);
    try {
      const old = this.sessions.get(channelId);
      if (old) await old.destroy();
      return await this.spawn(channelId, threadId);
    } finally {
      this.respawning.delete(channelId);
    }
  }

  async waitReady(channelId: string): Promise<void> {
    await this.readyState.get(channelId);
  }
}
```

**AssistantRegistry** — Plugin-extensible system prompt builder.

```typescript
// src/core/assistant/assistant-registry.ts
export interface AssistantSection {
  id: string;
  title: string;
  priority: number;  // 0-99 = core, 100+ = plugins
  buildContext: () => string | null;  // null = skip section
  commands?: AssistantCommand[];
}

export interface AssistantCommand {
  command: string;       // e.g. "viben api tunnel create <port>"
  description: string;   // e.g. "Expose local port to internet"
}

export class AssistantRegistry {
  private sections = new Map<string, AssistantSection>();

  register(section: AssistantSection): void {
    if (this.sections.has(section.id)) {
      log.warn({ id: section.id }, "Assistant section overwritten");
    }
    this.sections.set(section.id, section);
  }

  unregister(id: string): void {
    this.sections.delete(id);
  }

  buildSystemPrompt(): string {
    const sorted = [...this.sections.values()]
      .sort((a, b) => a.priority - b.priority);

    const parts: string[] = [ASSISTANT_PREAMBLE];

    for (const section of sorted) {
      try {
        const context = section.buildContext();
        if (!context) continue;
        parts.push(`## ${section.title}\n${context}`);
        if (section.commands?.length) {
          const cmds = section.commands.map(c => `${c.command}  # ${c.description}`).join('\n');
          parts.push('```bash\n' + cmds + '\n```');
        }
      } catch (err) {
        log.warn({ err, sectionId: section.id }, "Assistant section buildContext() failed, skipping");
      }
    }

    parts.push(ASSISTANT_GUIDELINES);
    return parts.join('\n\n');
  }
}
```

**Key defensive measures:**
- `buildContext()` wrapped in try/catch per section — buggy plugin cannot crash assistant spawn.
- Overwrite logs a warning — helps debug when two plugins accidentally use the same ID.
- Section IDs namespaced by plugin (`${pluginName}:${section.id}`) to prevent collisions. Core sections use `core:` prefix.

**ASSISTANT_PREAMBLE and ASSISTANT_GUIDELINES** are static constants in `assistant-registry.ts`, not plugin-contributed:
- PREAMBLE: Identity ("You are the Viben Assistant"), tone, response language rules.
- GUIDELINES: Behavior rules ("NEVER show viben api commands to users"), formatting ("use `<b>bold</b>`"), CLI usage patterns.
- Plugins only contribute sections between preamble and guidelines.

#### Plugin registration via PluginContext

```typescript
// PluginContext gains new methods:
class PluginContext {
  registerAssistantSection(section: AssistantSection): void {
    this.core.assistantRegistry.register({
      ...section,
      id: `${this.pluginName}:${section.id}`,
    });
  }

  unregisterAssistantSection(id: string): void {
    this.core.assistantRegistry.unregister(`${this.pluginName}:${id}`);
  }
}
```

#### Core sections (registered at startup)

| Section ID | Priority | Content |
|-----------|----------|---------|
| `core:sessions` | 10 | Active session count, create/cancel/status commands |
| `core:agents` | 20 | Installed agents, install/info commands |
| `core:config` | 30 | Config paths, `viben config set` commands |
| `core:system` | 40 | Restart, update, health commands |

#### Plugin sections (registered in plugin `setup()`)

| Plugin | Section ID | Priority | Content |
|--------|-----------|----------|---------|
| tunnel | `@viben/tunnel:tunnels` | 150 | Active tunnels, create/stop commands |
| speech | `@viben/speech:speech` | 160 | STT provider status, setup guidance |
| usage | `@viben/usage:budget` | 200 | Spend vs budget, usage commands |
| security | `@viben/security:access` | 210 | Rate limits, allowed users |

Third-party plugins register sections the same way — no core changes needed.

#### Spawn timing — All plugins setup BEFORE assistant spawn

Assistant spawn must happen AFTER all plugins have completed `setup()`, so all sections are registered before `buildSystemPrompt()` is called.

```typescript
// main.ts — startup sequence
await lifecycleManager.bootAllPlugins();    // all plugins register sections + menu items
// THEN adapters spawn assistants in their start() hook
// (adapters start after all plugins are booted)
```

This is already the current boot order (LifecycleManager boots plugins in dependency order, adapters depend on services). No change needed — just documenting the requirement.

#### Adapter changes

Adapters only need to:
1. Call `core.assistantManager.spawn(channelId, threadId)` during `start()`.
2. Route messages via `core.handleMessage()` — works for both assistant and user sessions.
3. Keep platform-specific UI (welcome message, redirect link) in the adapter.

```typescript
// Telegram adapter — simplified
async start() {
  // ... bot setup ...
  await this.core.assistantManager.spawn("telegram", String(this.assistantTopicId));
  // Done. No assistantSession field, no assistantInitializing flag.
}
```

#### Files deleted/changed

| File | Change |
|------|--------|
| **New:** `src/core/assistant/assistant-manager.ts` | ~100 LOC (includes respawn guard) |
| **New:** `src/core/assistant/assistant-registry.ts` | ~70 LOC (includes error handling) |
| **New:** `src/core/assistant/sections/sessions.ts` | ~30 LOC |
| **New:** `src/core/assistant/sections/agents.ts` | ~25 LOC |
| **New:** `src/core/assistant/sections/config.ts` | ~20 LOC |
| **New:** `src/core/assistant/sections/system.ts` | ~20 LOC |
| `src/plugins/telegram/assistant.ts` | Remove `spawnAssistant()`, `buildAssistantSystemPrompt()`, `handleAssistantMessage()`. Keep `buildWelcomeMessage()`, `redirectToAssistant()`. ~250 → ~30 LOC |
| `src/plugins/telegram/adapter.ts` | Remove `assistantSession`, `assistantInitializing`, 6 conditional branches. Add `core.assistantManager.spawn()` call |
| `src/core/plugin/plugin-context.ts` | Add `registerAssistantSection()`, `unregisterAssistantSection()` methods |
| `src/core/sessions/session.ts` | Add `isAssistant: boolean` field |

### Part 3: Bot/Chat Flow Separation

**Goal:** In assistant topic, text is either a command or chat. No multi-step interactive flows intercepting text input.

#### Current state

Three flows compete for text input in the assistant topic:

1. **Menu buttons** (`m:` prefix) trigger `handleNew()` → `showAgentPicker()` → `pendingNewSessions` Map → `handlePendingWorkspaceInput()` intercepts next text message.
2. **Assistant chat** — text goes to `assistant.enqueuePrompt()`.
3. **Slash commands** — `/new` goes through 3 dispatch systems.

Conflict: When `pendingNewSessions` has an entry, user text is stolen from assistant chat by `handlePendingWorkspaceInput()`. If the pending entry expires, the same text goes to assistant instead. Behavior depends on timing.

Additional bug: The broad `m:` callback handler calls `handleNew(ctx, core, chatId)` WITHOUT passing the `assistant` context parameter. So even in the assistant topic, `handleNew()` runs the interactive button flow instead of delegating to assistant — a known bug where the menu path and command path behave differently.

#### New state

**Principle: Bot = instant actions. Assistant = conversations.**

Bot commands execute immediately with the args provided. If args are missing, the command delegates to the assistant for a conversational flow. There are no multi-step interactive flows with text interception.

```
User input in any topic:
  │
  starts with "/" ?
  ├── YES → CommandRegistry.execute()
  │         ├── has all args → execute, return result
  │         └── missing args → delegate to assistant
  └── NO  → core.handleMessage() → session.enqueuePrompt()
```

No `pendingNewSessions` Map, no `handlePendingWorkspaceInput()`, no `handlePendingResumeInput()`, no `startInteractiveNewSession()`, no `showAgentPicker()`.

#### Command routing — Where do commands execute?

Important: commands are intercepted by the existing `bot.on("message:text")` handler that checks for `/` prefix and dispatches to CommandRegistry BEFORE the message reaches `core.handleMessage()`. This is unchanged from current behavior. The difference is that CommandRegistry now has real handlers instead of `silent` placeholders.

```typescript
// Telegram adapter — command dispatch (existing, stays)
bot.on("message:text", async (ctx, next) => {
  const text = ctx.message?.text;
  if (!text?.startsWith("/")) return next();  // not a command → fall through

  const registry = core.getService<CommandRegistry>("command-registry");
  if (!registry) return next();

  const response = await registry.execute(text, {
    channelId: "telegram",
    sessionId: /* from threadId lookup */,
    userId: String(ctx.from?.id),
  });

  if (response.type === "delegated") return;  // assistant will respond
  await renderCommandResponse(response, chatId, topicId);
});

// Telegram adapter — message routing (simplified)
bot.on("message:text", async (ctx) => {
  // This handler only runs if the command handler above called next()
  // (i.e., text didn't start with "/" or command was unrecognized)
  const threadId = ctx.message.message_thread_id;

  // No thread → redirect to assistant
  if (!threadId) {
    ctx.reply(redirectToAssistant(chatId, assistantTopicId));
    return;
  }

  // Notification topic → ignore
  if (threadId === notificationTopicId) return;

  // ALL topics (including assistant) → core.handleMessage()
  core.handleMessage({
    channelId: "telegram",
    threadId: String(threadId),
    userId: String(ctx.from.id),
    text: ctx.message.text,
  });
});
```

Note: The command handler strips the `/` prefix internally (inside `registry.execute()`). The message handler does NOT strip `/` anymore — unrecognized `/xxx` commands fall through as regular text to the agent, which is the current behavior for session topics.

#### Edge case: `/new` in a session topic (not assistant topic)

When user types `/new` in a session topic, `args.sessionId` is set (resolved from threadId). The `/new` handler should still delegate to assistant for missing args. But the assistant reply appears in the **assistant topic**, not the session topic.

Solution: The `/new` handler returns a text response pointing to assistant topic:

```typescript
// /new handler — missing args in session topic
if (!agent || !workspace) {
  const assistant = core.assistantManager.get(args.channelId);
  if (assistant && args.sessionId) {
    // In session topic → can't delegate (response would go to wrong topic)
    return { type: 'text', text: 'Usage: /new <agent> <workspace>\nOr go to the Assistant topic to create a session interactively.' };
  }
  if (assistant) {
    await assistant.enqueuePrompt("...");
    return { type: 'delegated' };
  }
}
```

This applies to any command that delegates: delegation only makes sense in the assistant topic or when the command is triggered from a menu button (which is always in assistant topic).

No `handlePendingWorkspaceInput()` check. No `handlePendingResumeInput()` check. No assistant topic special case in message routing. One path for all text messages.

#### Settings flow — Unchanged

Settings toggle and select buttons remain as-is (they work well — self-contained, one click = one action). Input fields that delegate to assistant continue using the delegation pattern. The fix is that removing `pendingNewSessions` and `handlePendingWorkspaceInput` eliminates the only source of text interception conflict with settings delegation.

#### Files deleted/changed

| File | Change |
|------|--------|
| `src/plugins/telegram/commands/new-session.ts` | Delete `pendingNewSessions` Map, `showAgentPicker()`, `startWorkspaceStep()`, `startConfirmStep()`, `handlePendingWorkspaceInput()`, `startInteractiveNewSession()`, `setupNewSessionCallbacks()`. Keep `createSessionDirect()`, `executeNewSession()`, `handleNewChat()`. ~460 → ~180 LOC |
| `src/plugins/telegram/commands/resume.ts` | Delete `handlePendingResumeInput()` and pending state machine |
| `src/plugins/telegram/adapter.ts` `setupRoutes()` | Remove `handlePendingWorkspaceInput()` and `handlePendingResumeInput()` checks, remove assistant topic special case |
| `src/plugins/telegram/commands/index.ts` | Remove re-exports of deleted functions |

### Part 4: SessionBridge Simplification

**Goal:** Reduce event wiring complexity. Fewer hops from agent event to user.

#### Current state

- 5 separate handler references stored as optional fields.
- 4 `wire*()` methods in `connect()`.
- `wireSessionToAdapter()` has 40 LOC of nested `.then().catch()` for middleware wrapping.
- `wirePermissions()` has 90 LOC with 4 auto-approve paths in one function.
- Agent event goes through 7 steps to reach user.
- `disconnect()` manually removes 5 handlers.

#### New state

```typescript
class SessionBridge {
  private cleanupFns: Array<() => void> = [];

  connect() {
    // Agent events → dispatch
    this.on(this.session, "agent_event", (event) => this.dispatchAgentEvent(event));

    // Lifecycle
    this.on(this.session, "status_change", (from, to) => this.handleStatusChange(from, to));
    this.on(this.session, "named", (name) => this.handleNamed(name));
    this.on(this.session, "prompt_count_changed", (count) => this.handlePromptCount(count));

    // Permissions
    this.session.agentInstance.onPermissionRequest = (req) => this.resolvePermission(req);
  }

  disconnect() {
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
    this.session.agentInstance.onPermissionRequest = async () => "";
  }

  private on<T extends TypedEmitter<any>>(emitter: T, event: string, handler: Function) {
    emitter.on(event, handler as any);
    this.cleanupFns.push(() => emitter.off(event, handler as any));
  }
}
```

**Changes:**

1. **Remove `wireAgentToSession()` relay.** Currently agent events go: AgentInstance → Session (relay) → SessionBridge. The relay through Session only exists so Session can re-emit events. SessionBridge already listens on Session's `agent_event` (which Session emits from AgentInstance internally). Just remove the separate `wireAgentToSession()` method.

2. **Replace 4 `wire*()` methods with inline listeners in `connect()`.** All wiring in one place, easy to read top-to-bottom.

3. **Auto-cleanup via `cleanupFns` array.** `disconnect()` is one line instead of 5 conditional checks.

4. **Extract `dispatchAgentEvent()`** — replaces nested `.then().catch()` with async/await:

```typescript
private async dispatchAgentEvent(event: AgentEvent) {
  try {
    const mw = this.deps.middlewareChain;
    if (mw) {
      const result = await mw.execute('agent:beforeEvent', { sessionId: this.session.id, event }, async (e) => e)
        .catch(() => ({ event })); // fallback to original on middleware error
      if (!result) return;
      event = result.event;
    }

    const outgoing = this.handleAgentEvent(event);

    if (mw) {
      mw.execute('agent:afterEvent', { sessionId: this.session.id, event, outgoingMessage: outgoing }, async (e) => e).catch(() => {});
    }
  } catch (err) {
    log.error({ err, sessionId: this.session.id }, "Error dispatching agent event");
  }
}
```

Note: `dispatchAgentEvent` is async but called from a sync EventEmitter listener. The top-level try/catch ensures errors are logged, not swallowed. This matches current behavior where the `.then().catch()` chain handles errors the same way.

5. **Extract `resolvePermission()` with clear pipeline:**

```typescript
private async resolvePermission(request: PermissionRequest): Promise<string> {
  const startTime = Date.now();

  // Step 1: Middleware (can block, modify, or auto-resolve)
  const mwResult = await this.applyPermissionMiddleware(request);
  if (mwResult.blocked) return "";
  if (mwResult.autoResolved) return this.emitAfterResolve(mwResult.decision, 'middleware', startTime);
  request = mwResult.request;

  // Step 2: Auto-approve rules
  const autoDecision = this.checkAutoApprove(request);
  if (autoDecision) return this.emitAfterResolve(autoDecision, 'system', startTime);

  // Step 3: Ask user
  const gate = this.session.permissionGate.setPending(request);
  await this.adapter.sendPermissionRequest(this.session.id, request);
  const decision = await gate;
  return this.emitAfterResolve(decision, 'user', startTime);
}

private checkAutoApprove(request: PermissionRequest): string | null {
  // Auto-approve viben CLI commands
  if (request.description.toLowerCase().includes("viben")) {
    return request.options.find(o => o.isAllow)?.id ?? null;
  }
  // Bypass mode (agent-side or client-side)
  const modeOption = this.session.getConfigByCategory("mode");
  const isAgentBypass = modeOption && isPermissionBypass(
    typeof modeOption.currentValue === "string" ? modeOption.currentValue : ""
  );
  const isClientBypass = this.session.clientOverrides.bypassPermissions;
  if (isAgentBypass || isClientBypass) {
    return request.options.find(o => o.isAllow)?.id ?? null;
  }
  return null;
}
```

#### Impact

| Metric | Before | After |
|--------|--------|-------|
| Wire methods | 4 (`wireAgentToSession`, `wireSessionToAdapter`, `wirePermissions`, `wireLifecycle`) | 1 (`connect()`) |
| Handler references | 5 optional fields | 0 (cleanup array) |
| Disconnect logic | 5 conditional checks | `cleanupFns.forEach(fn => fn())` |
| Middleware wrapping | 40 LOC nested `.then().catch()` | ~10 LOC async/await |
| Permission logic | 90 LOC monolith | 3 focused methods (~60 LOC total) |

### Part 5: Extensible Menu Registry

**Goal:** Plugins can add, remove, and replace menu items. Menu builds dynamically from registry.

#### Current state

```typescript
// menu.ts — hardcoded 10 buttons, no extension point
export function buildMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🆕 New Session", "m:new")
    .text("📋 Sessions", "m:topics")
    // ... 8 more hardcoded buttons
}
```

#### New state: MenuRegistry

```typescript
// src/core/menu-registry.ts

export interface MenuItem {
  /** Unique ID, namespaced by plugin. e.g. "core:new", "@viben/tunnel:tunnels" */
  id: string;
  /** Button label. e.g. "🆕 New Session" */
  label: string;
  /** Ordering — lower = higher position. Core: 0-99, plugins: 100+ */
  priority: number;
  /** Optional grouping — items in same group placed on same row */
  group?: string;
  /** What happens when button is pressed */
  action:
    | { type: 'command'; command: string }          // → registry.execute(command)
    | { type: 'delegate'; prompt: string }          // → assistant.enqueuePrompt(prompt)
    | { type: 'callback'; callbackData: string };   // → existing callback handler
  /** Optional visibility check — return false to hide */
  visible?: () => boolean;
}

export class MenuRegistry {
  private items = new Map<string, MenuItem>();

  register(item: MenuItem): void {
    this.items.set(item.id, item);
  }

  unregister(id: string): void {
    this.items.delete(id);
  }

  getItem(id: string): MenuItem | undefined {
    return this.items.get(id);
  }

  /** Get all visible items, sorted by priority */
  getItems(): MenuItem[] {
    return [...this.items.values()]
      .filter(item => {
        if (!item.visible) return true;
        try { return item.visible(); }
        catch { return false; }  // buggy visible() → hide item
      })
      .sort((a, b) => a.priority - b.priority);
  }
}
```

#### Core menu items

```typescript
// src/core/menu/core-items.ts
export function registerCoreMenuItems(registry: MenuRegistry) {
  // Session management (priority 10-19)
  registry.register({
    id: "core:new", label: "🆕 New Session", priority: 10, group: "session",
    action: { type: 'delegate', prompt: 'User wants new session. Guide them through agent and workspace selection.' },
  });
  registry.register({
    id: "core:sessions", label: "📋 Sessions", priority: 11, group: "session",
    action: { type: 'command', command: '/sessions' },
  });

  // Info (priority 20-29)
  registry.register({
    id: "core:status", label: "📊 Status", priority: 20, group: "info",
    action: { type: 'command', command: '/status' },
  });
  registry.register({
    id: "core:agents", label: "🤖 Agents", priority: 21, group: "info",
    action: { type: 'command', command: '/agents' },
  });

  // Config (priority 30-39)
  registry.register({
    id: "core:settings", label: "⚙️ Settings", priority: 30, group: "config",
    action: { type: 'callback', callbackData: 's:settings' },
  });

  // System (priority 40-49)
  registry.register({
    id: "core:restart", label: "🔄 Restart", priority: 40, group: "system",
    action: { type: 'delegate', prompt: 'User wants to restart Viben. Ask for confirmation.' },
  });
  registry.register({
    id: "core:update", label: "⬆️ Update", priority: 41, group: "system",
    action: { type: 'delegate', prompt: 'User wants to update Viben. Ask for confirmation.' },
  });

  // Help (priority 50-59)
  registry.register({
    id: "core:help", label: "❓ Help", priority: 50, group: "help",
    action: { type: 'command', command: '/help' },
  });
  registry.register({
    id: "core:doctor", label: "🩺 Doctor", priority: 51, group: "help",
    action: { type: 'command', command: '/doctor' },
  });
}
```

#### Plugin registration

```typescript
class PluginContext {
  registerMenuItem(item: Omit<MenuItem, 'id'> & { id: string }): void {
    this.core.menuRegistry.register({
      ...item,
      id: `${this.pluginName}:${item.id}`,
    });
  }

  /** Remove a menu item by full ID. Works for core items too. */
  unregisterMenuItem(id: string): void {
    this.core.menuRegistry.unregister(id);
  }
}
```

Plugin examples:

```typescript
// plugins/tunnel/setup.ts
ctx.registerMenuItem({
  id: "tunnels", label: "🌐 Tunnels", priority: 150, group: "tools",
  action: { type: 'command', command: '/tunnels' },
  visible: () => tunnelService.hasAnyProvider(),
});

// plugins/usage/setup.ts
ctx.registerMenuItem({
  id: "budget", label: "💰 Budget", priority: 200, group: "info",
  action: { type: 'command', command: '/budget' },
  visible: () => usageService.hasBudget(),
});

// Plugin that removes defaults
ctx.unregisterMenuItem("core:doctor");  // hide Doctor button
ctx.unregisterMenuItem("core:update");  // hide Update button
```

#### Adapter renders from registry

```typescript
// Telegram — buildMenuKeyboard() reads from registry
function buildMenuKeyboard(menuRegistry: MenuRegistry): InlineKeyboard {
  const items = menuRegistry.getItems();
  const kb = new InlineKeyboard();
  let currentGroup: string | undefined;
  let rowCount = 0;

  for (const item of items) {
    if (item.group !== currentGroup && rowCount > 0) {
      kb.row();
      rowCount = 0;
    }
    currentGroup = item.group;
    if (rowCount >= 2) { kb.row(); rowCount = 0; }
    kb.text(item.label, `m:${item.id}`);
    rowCount++;
  }
  return kb;
}

// Generic callback handler — replaces switch/case
bot.callbackQuery(/^m:/, async (ctx) => {
  const itemId = ctx.callbackQuery.data.replace("m:", "");
  await ctx.answerCallbackQuery().catch(() => {});

  const item = menuRegistry.getItem(itemId);
  if (!item) return;

  const topicId = ctx.callbackQuery.message?.message_thread_id;
  const chatId = ctx.chat!.id;

  switch (item.action.type) {
    case 'command': {
      const response = await registry.execute(item.action.command, {
        channelId: "telegram",
        userId: String(ctx.from.id),
        sessionId: null,
        raw: "",
      });
      if (response.type !== 'delegated') {
        await renderCommandResponse(response, chatId, topicId);
      }
      break;
    }
    case 'delegate': {
      const assistant = core.assistantManager.get("telegram");
      if (assistant) {
        await assistant.enqueuePrompt(item.action.prompt);
      } else {
        await ctx.reply("⚠️ Assistant is not available.");
      }
      break;
    }
    case 'callback':
      // No-op here — the specific callback handler handles it
      // (e.g. s:settings is handled by setupSettingsCallbacks)
      break;
  }
});
```

```typescript
// SSE / API Server — renders as JSON
app.get("/api/menu", (req, res) => {
  res.json(menuRegistry.getItems().map(item => ({
    id: item.id, label: item.label, action: item.action,
  })));
});
```

#### Menu button in non-assistant topics

Edge case: Menu buttons appear in welcome message (assistant topic). But `m:new` with `type: 'delegate'` sends prompt to assistant. If user somehow sees the menu in a session topic, delegate actions should redirect to assistant topic instead:

```typescript
case 'delegate': {
  const assistant = core.assistantManager.get("telegram");
  if (assistant) {
    // If not in assistant topic, reply with redirect
    if (topicId && topicId !== assistantTopicId) {
      await ctx.reply(redirectToAssistant(chatId, assistantTopicId));
    } else {
      await assistant.enqueuePrompt(item.action.prompt);
    }
  }
  break;
}
```

#### Telegram button limit

Telegram inline keyboards have a practical limit of ~20 buttons (8 rows × 2-3 buttons). If too many plugins register items:
- Adapter truncates at 20 items (based on priority — lowest priority items dropped).
- No "More..." button needed — low-priority items are accessible via `/menu` command text or chat with assistant.

#### Files added/changed

| File | Change |
|------|--------|
| **New:** `src/core/menu-registry.ts` | ~50 LOC |
| **New:** `src/core/menu/core-items.ts` | ~50 LOC |
| `src/plugins/telegram/commands/menu.ts` | Replace hardcoded `buildMenuKeyboard()` with registry-based builder |
| `src/plugins/telegram/commands/index.ts` | Replace `switch(data)` in broad `m:` handler with generic registry lookup |
| `src/core/plugin/plugin-context.ts` | Add `registerMenuItem()`, `unregisterMenuItem()` methods |

## Summary of Changes

### Files deleted

| File | LOC | Reason |
|------|-----|--------|
| `src/plugins/telegram/action-detect.ts` | ~204 | Replaced by assistant AI intent detection |

### Files significantly reduced

| File | Before | After | Reason |
|------|--------|-------|--------|
| `src/plugins/telegram/assistant.ts` | ~250 | ~30 | Core logic moved to AssistantManager |
| `src/plugins/telegram/commands/new-session.ts` | ~460 | ~180 | Interactive flows removed, assistant handles conversations |
| `src/plugins/telegram/commands/index.ts` | ~200 | ~80 | `setupCommands()` deleted, broad `m:` handler replaced with generic lookup |
| `src/core/sessions/session-bridge.ts` | ~430 | ~280 | Simplified wiring, extracted methods |
| `src/plugins/telegram/adapter.ts` | ~1050 | ~850 | Assistant fields removed, routing simplified |

### New files

| File | ~LOC | Purpose |
|------|------|---------|
| `src/core/assistant/assistant-manager.ts` | 100 | Assistant lifecycle management |
| `src/core/assistant/assistant-registry.ts` | 70 | Plugin-extensible system prompt builder |
| `src/core/assistant/sections/sessions.ts` | 30 | Session management context for assistant |
| `src/core/assistant/sections/agents.ts` | 25 | Agent management context for assistant |
| `src/core/assistant/sections/config.ts` | 20 | Configuration context for assistant |
| `src/core/assistant/sections/system.ts` | 20 | System admin context for assistant |
| `src/core/menu-registry.ts` | 50 | Extensible menu item registry |
| `src/core/menu/core-items.ts` | 50 | Default menu items |

### Net LOC change

- Deleted/reduced: ~830 LOC
- Added: ~365 LOC
- **Net reduction: ~465 LOC**

## Complete Flow Diagrams

### Flow 1: User types "/new claude ~/project" in any topic

```
User types "/new claude ~/project"
  → bot.on("message:text") catches text starting with "/"
  → CommandRegistry.execute("/new claude ~/project", { channelId: "telegram", sessionId })
  → /new handler parses args: agent="claude", workspace="~/project"
  → Both present → core.handleNewSession("telegram", "claude", "~/project")
  → Returns { type: 'text', text: '✅ Session created' }
  → Adapter renders text message in topic
```

### Flow 2: User types "/new" (no args) in assistant topic

```
User types "/new"
  → bot.on("message:text") catches "/"
  → CommandRegistry.execute("/new", { channelId: "telegram", sessionId })
  → /new handler parses args: agent=undefined, workspace=undefined
  → Missing args → core.assistantManager.get("telegram")
  → assistant.enqueuePrompt("Create new session, guide user...")
  → Returns { type: 'delegated' }
  → Adapter shows nothing
  → Assistant AI responds: "Which agent? claude-code, gemini..."
  → User replies "claude-code" (plain text, not command)
  → core.handleMessage() → assistant.enqueuePrompt("claude-code")
  → Assistant: "Workspace path?"
  → User: "~/my-project"
  → core.handleMessage() → assistant.enqueuePrompt("~/my-project")
  → Assistant runs: viben api new claude-code ~/my-project --channel telegram
  → Assistant: "✅ Session created → link"
```

### Flow 3: User taps "🆕 New Session" menu button

```
User taps [🆕 New Session]
  → callback_data = "m:core:new"
  → bot.callbackQuery(/^m:/) handler
  → menuRegistry.getItem("core:new")
  → action.type === 'delegate'
  → Check: is user in assistant topic?
    → YES: assistant.enqueuePrompt("User wants new session. Guide them.")
    → NO: reply with redirect link to assistant topic
  → Assistant handles conversational flow (same as Flow 2)
```

### Flow 4: User taps "📊 Status" menu button

```
User taps [📊 Status]
  → callback_data = "m:core:status"
  → bot.callbackQuery(/^m:/) handler
  → menuRegistry.getItem("core:status")
  → action.type === 'command', command: '/status'
  → registry.execute("/status", baseArgs)
  → Returns { type: 'text', text: '2 active / 5 total...' }
  → Adapter renders text in topic
```

### Flow 5: User sends chat message in session topic

```
User types "fix the login bug" in session topic (threadId=12345)
  → bot.on("message:text")
  → text doesn't start with "/" → not a command
  → core.handleMessage({ channelId: "telegram", threadId: "12345", text: "fix the login bug" })
  → core finds session by threadId → session.enqueuePrompt("fix the login bug")
  → Agent processes prompt → emits agent_event
  → SessionBridge.dispatchAgentEvent() → middleware → transform → adapter.sendMessage()
```

### Flow 6: User sends chat message in assistant topic

```
User types "how many sessions do I have?" in assistant topic
  → bot.on("message:text")
  → text doesn't start with "/" → not a command
  → core.handleMessage({ channelId: "telegram", threadId: "99999", text: "how many..." })
  → core finds assistant session by threadId → session.enqueuePrompt("how many...")
  → Assistant agent processes → runs viben api status → responds
  → SessionBridge → adapter.sendMessage() → user sees answer
```

### Flow 7: Plugin menu button

```
User taps [🌐 Tunnels] (plugin button)
  → callback_data = "m:@viben/tunnel:tunnels"
  → bot.callbackQuery(/^m:/) handler
  → menuRegistry.getItem("@viben/tunnel:tunnels")
  → action.type === 'command', command: '/tunnels'
  → registry.execute("/tunnels", baseArgs)
  → Tunnel plugin's command handler returns list of active tunnels
  → Adapter renders
```

## Edge Cases & Defensive Measures

### Registry Collisions

| Case | Behavior |
|------|----------|
| Two plugins register same section ID | Impossible — IDs namespaced by `${pluginName}:${id}` |
| Plugin registers same ID as core section | Impossible — core uses `core:` prefix |
| Plugin registers with same priority as another | Stable sort — registration order preserved |
| Plugin registers menu item with same label as another | Allowed — different IDs. Plugin author's responsibility |

### Error Isolation

| Case | Behavior |
|------|----------|
| Plugin `buildContext()` throws | Caught per-section. Log warning, skip section. Other sections unaffected |
| Plugin `visible()` throws | Caught. Treated as `false` (hidden). Log warning |
| Plugin command handler throws | CommandRegistry wraps in try/catch, returns `{ type: 'error' }` |
| Plugin menu action refers to unregistered command | `registry.execute()` returns `{ type: 'error', message: 'Unknown command' }` |

### Concurrency

| Case | Behavior |
|------|----------|
| User double-taps menu button | Menu buttons: Telegram shows spinner after first tap, second tap is no-op |
| User spams `/new` | PromptQueue serializes. Each delegation queues behind the previous. Not ideal but safe |
| Concurrent `respawn()` calls | Mutex guard (`respawning` Set). Second call returns current session |
| `dispatchAgentEvent` async in sync listener | Top-level try/catch ensures errors logged, not swallowed |

### Assistant Availability

| Case | Behavior |
|------|----------|
| Assistant not spawned yet (bot just started) | `get()` returns null → command returns error with usage hint |
| Assistant spawned but system prompt still running | `enqueuePrompt()` queues behind system prompt. User prompt runs after init completes |
| Assistant spawn fails (agent not installed) | `spawn()` throws → adapter catches, shows error message in topic. Commands fallback to error response |
| Assistant session destroyed externally | `get()` returns stale session. Next `enqueuePrompt()` will fail → need `isAlive()` check or error handling |

### Security

| Concern | Assessment |
|---------|-----------|
| Plugin injects malicious system prompt section | Medium risk but not new attack surface — plugins run arbitrary code in process. Document that `buildContext()` output goes into system prompt |
| Plugin adds dangerous CLI commands to assistant | Commands run through agent subprocess with permission gate. User must approve (or bypass mode must be enabled) |
| Plugin removes core menu items (e.g., Settings) | Allowed by design — `/settings` command still works, just no button. Plugin author's choice |
| Plugin overrides core command via adapter scope | Only adapter plugins (`ADAPTER_SCOPES`) can override. Regular plugins cannot. Existing behavior |
| Rate limiting on assistant delegations | Security plugin middleware applies to `message:incoming`. Button spam handled by Telegram UI (spinner after tap) |

### Backward Compatibility

| Concern | Impact |
|---------|--------|
| `setupCommands()` removal | Internal function, not part of plugin API. No external breakage |
| `silent` CommandResponse type removed | Plugin commands returning `silent` will need to return `delegated` or a real response. Plugin API change — document in migration guide |
| `handlePendingWorkspaceInput()` removed | Internal function. No plugin API impact |
| `action-detect.ts` removed | Internal module. No plugin API impact |
| `CommandsAssistantContext` type removed | Internal type used only between adapter and commands. No plugin API impact |
| Menu buttons use new IDs (`m:core:new` vs `m:new`) | Old button messages in chat will stop working. Acceptable — buttons are ephemeral |

## Testing Strategy

1. **Command dispatch:** Test that every system command executes through CommandRegistry with real handlers. Test `delegated` response for commands with missing args. Test adapter override precedence.
2. **AssistantManager:** Test spawn, get, respawn, isAssistant, waitReady. Test that bridge connects only after system prompt completes. Test concurrent respawn guard. Test spawn failure handling.
3. **AssistantRegistry:** Test section registration, priority ordering, buildSystemPrompt output. Test plugin sections included/excluded correctly. Test buildContext() error isolation. Test overwrite warning.
4. **MenuRegistry:** Test item registration, priority sorting, visibility filtering. Test `visible()` error handling. Test unregister (core items by plugin). Test getItems() with mixed priorities.
5. **SessionBridge:** Test connect/disconnect cleanup. Test dispatchAgentEvent with and without middleware. Test resolvePermission pipeline (middleware → auto-approve → user). Test async error handling in sync listener.
6. **Message routing:** Test that text in assistant topic goes to assistant session via `core.handleMessage()`. Test that commands go through CommandRegistry. Test no text interception.
7. **Menu callback flow:** Test command action executes via registry. Test delegate action sends prompt to assistant. Test delegate in non-assistant topic redirects. Test callback action passes through.
8. **Integration:** Test `/new` with full args creates session directly. Test `/new` without args delegates to assistant. Test menu button delegates to assistant. Test plugin adds menu item and assistant section.
