# Session Config Options — Unified ACP Configuration

**Date:** 2026-04-01
**Approach:** A (Config-First) — migrate fully to ACP Config Options as single source of truth

## Overview

Replace all separate session state fields (`currentMode`, `availableModes`, `currentModel`, `availableModels`, `dangerousMode`) with a unified `configOptions: ConfigOption[]` backed by the ACP Session Config Options protocol. Expose config options to users via dedicated chat commands, REST API, and CLI.

## ACP Protocol Reference

ACP Config Options (`session/set_config_option`) supersede the older Session Modes API. Key properties:

- Agent declares `configOptions[]` in session initialization response
- Each option: `{ id, name, description?, category?, type: "select", currentValue, options[] }`
- Categories (UX only): `mode`, `model`, `thought_level`, `_custom_*`
- `setSessionConfigOption` response returns **complete** config state (enables cascading changes)
- `config_option_update` notification also returns full state
- Agents must provide defaults; clients display options in agent-provided order

## Section 1: Session State Migration

### Fields removed from Session

```
- currentMode?: string
- availableModes: SessionMode[]
- currentModel?: string
- availableModels: ModelInfo[]
- dangerousMode: boolean
```

### Fields added/changed on Session

```typescript
configOptions: ConfigOption[]           // single source of truth from agent
clientOverrides: {                      // client-side state, not from agent
  bypassPermissions?: boolean           // fallback when agent has no permission mode
}
```

### SessionRecord changes

```typescript
// Removed:
- dangerousMode?: boolean
- acpState.currentMode
- acpState.availableModes
- acpState.currentModel
- acpState.availableModels

// Added/changed:
+ clientOverrides?: { bypassPermissions?: boolean }
// acpState simplified:
+ acpState?: {
    configOptions?: ConfigOption[]
    agentCapabilities?: AgentCapabilities   // kept as-is
  }
```

### Helper methods on Session

- `getConfigOption(id: string): ConfigOption | undefined`
- `getConfigByCategory(category: string): ConfigOption | undefined`
- `getConfigValue(id: string): string | undefined` — shortcut for currentValue
- `setInitialConfigOptions(options: ConfigOption[])` — replaces `setInitialAcpState()`
- `updateConfigOptions(options: ConfigOption[])` — receives full state from agent, replaces entire array

### Data migration

Old SessionRecords with `dangerousMode: true` and no `clientOverrides` are automatically migrated when loaded:
- `dangerousMode: true` → `clientOverrides: { bypassPermissions: true }`
- Old `acpState.currentMode/availableModes/currentModel/availableModels` fields are dropped (agent sends fresh state on resume)

## Section 2: Commands

### 4 dedicated commands (system commands, registered in core)

| Command | Category match | Fallback |
|---------|---------------|----------|
| `/mode` | `category: "mode"` | "Agent does not support mode selection" |
| `/model` | `category: "model"` | "Agent does not support model selection" |
| `/thought` | `category: "thought_level"` | "Agent does not support thought level" |
| `/dangerous` | Scan mode options for bypass values | Toggle `clientOverrides.bypassPermissions` |

### Flow for `/mode`, `/model`, `/thought`

1. Find config option by category in `session.configOptions`
2. Not found → return error message
3. Found → display menu with options (name + description), highlight currentValue
4. User selects → fire `config:beforeChange` middleware hook (plugin can block)
5. Call `agent.setConfigOption(configId, value)`
6. Receive full config state → `session.updateConfigOptions(newOptions)`

### Flow for `/dangerous`

1. Find config option with `category: "mode"` in `session.configOptions`
2. In that option's values, find one related to permission bypass (scan name/description for keywords: "bypass", "dangerous", "skip permission", etc.)
3. **Found** → call `setConfigOption(modeConfigId, bypassValue)` to switch agent to bypass mode
4. **Not found** → toggle `session.clientOverrides.bypassPermissions` (client-side fallback), inform user: "Agent does not support native permission bypass, using client-side auto-approve"

### Permission check logic (in session-bridge)

```typescript
// Known permission-bypass values (matched case-insensitively against option value/name)
const BYPASS_KEYWORDS = ["bypass", "dangerous", "skip", "dontask", "dont_ask", "auto_accept"];

function isPermissionBypass(value: string): boolean {
  const lower = value.toLowerCase();
  return BYPASS_KEYWORDS.some(kw => lower.includes(kw));
}

// 1. Agent-side: check if mode config option's currentValue is a bypass mode
const modeOption = session.getConfigByCategory("mode");
const isBypassMode = modeOption && isPermissionBypass(modeOption.currentValue);

// 2. Client-side fallback
const isClientBypass = session.clientOverrides.bypassPermissions;

if (isBypassMode || isClientBypass) {
  // auto-approve permission request
}
```

## Section 3: API Server & CLI

### REST API routes (api-server plugin)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/sessions/:id/config` | Get all config options + clientOverrides |
| `PUT` | `/sessions/:id/config/:configId` | Set config option → `setConfigOption()` → return full state |
| `GET` | `/sessions/:id/config/overrides` | Get clientOverrides |
| `PUT` | `/sessions/:id/config/overrides` | Set clientOverrides (bypassPermissions, etc.) |

Response format:
```json
{
  "configOptions": [{ "id": "mode", "currentValue": "code", "..." : "..." }],
  "clientOverrides": { "bypassPermissions": false }
}
```

### CLI commands

```bash
viben session config <sessionId>                    # List all config options
viben session config <sessionId> set <id> <value>   # Set config option
viben session config <sessionId> overrides          # Show clientOverrides
viben session config <sessionId> dangerous          # Toggle bypassPermissions
```

All surfaces (chat commands, API, CLI) go through the same flow: Session → AgentInstance.setConfigOption() → receive full state → update session.

## Section 4: Event Flow & Bridge Updates

### Agent-initiated config update

```
Agent → config_option_update (full configOptions[])
  → AgentInstance emits AgentEvent { type: "config_option_update", options }
  → SessionBridge handles:
      1. session.updateConfigOptions(options)
      2. persistAcpState()
      3. messageTransformer → adapter (notify user if needed)
```

### User-initiated config change

```
User → /mode code
  → Command handler finds config option by category "mode"
  → Fire config:beforeChange middleware hook (can block)
  → agent.setConfigOption("mode", "code")
  → Agent response: full configOptions[]
  → session.updateConfigOptions(newOptions)  (no hook — already validated before send)
  → persistAcpState()
```

### Session resume flow

```
1. Load SessionRecord → cache configOptions + clientOverrides
2. session.setInitialConfigOptions(record.acpState.configOptions)
3. session.clientOverrides = record.clientOverrides
4. Agent connects → sends fresh configOptions in initialSessionResponse
5. Fresh state overrides cache (agent is source of truth)
```

### Middleware hooks

- Keep `config:beforeChange` as the single hook for all config changes
- Remove `mode:beforeChange` and `model:beforeChange` (superseded)
- Hook fires once before sending to agent (user-initiated), and once when agent pushes update

## Section 5: Backward Compatibility & Migration

### Data migration (automatic on SessionStore load)

- `dangerousMode: true` → `clientOverrides: { bypassPermissions: true }`
- Old `acpState.currentMode/availableModes/currentModel/availableModels` → dropped

### Code cleanup

**Session class:**
- Remove: `currentMode`, `availableModes`, `currentModel`, `availableModels`, `dangerousMode`
- Remove: `updateMode()`, `updateModel()`, `setInitialAcpState()`
- Add: `configOptions`, `clientOverrides`, `getConfigOption()`, `getConfigByCategory()`, `getConfigValue()`, `setInitialConfigOptions()`, updated `updateConfigOptions()`

**SessionRecord:**
- Remove: `dangerousMode`, `acpState.currentMode/availableModes/currentModel/availableModels`
- Add: `clientOverrides`

**AgentInstance:**
- Remove: `setMode()`, `setModel()` — use `setConfigOption()` only

**AgentEvent types:**
- Remove: `current_mode_update`, `model_update` events
- Keep: `config_option_update` as the single event for all config changes

**SessionBridge:**
- Remove: separate case handlers for `current_mode_update`, `model_update`
- Consolidate into `config_option_update` handler
- Update permission check to use `getConfigByCategory("mode")` + `clientOverrides.bypassPermissions`

**Middleware hooks (plugin/types.ts):**
- Remove: `mode:beforeChange`, `model:beforeChange`
- Keep: `config:beforeChange`

**Plugin template:** Update `cli/plugin-template/` to reflect new middleware hooks.

**Tests:** Update all tests referencing removed fields/methods.

## Section 6: Platform UI Rendering

Commands (`/mode`, `/model`, `/thought`, `/dangerous`) return `CommandResponse` type `menu`. Each adapter renders menus using its native interactive elements.

### Command Response Format

All config commands return a `menu` response:
```typescript
{
  type: 'menu',
  title: 'Session Mode',  // e.g. from configOption.name
  options: [
    { label: '✅ Code', command: '/mode code', hint: 'Full tool access' },
    { label: 'Architect', command: '/mode architect', hint: 'Design without implementation' },
    { label: 'Ask', command: '/mode ask', hint: 'Ask permission before changes' },
  ]
}
```
- Current value prefixed with ✅
- `hint` populated from `ConfigOptionValue.description`
- `command` is the full command to execute when selected

### Telegram
- Inline keyboard: one button per option per row
- Callback data: `c/<command>` prefix (cache for >64 bytes)
- Existing pattern in `adapter.ts` `renderCommandResponse()` for `menu` type

### Discord
- `ActionRowBuilder<ButtonBuilder>`: one button per option
- Active option styled as `Primary`, others as `Secondary`
- Existing pattern in `renderCommandResponse()` + `buildMenuKeyboard()`

### Slack
- Block Kit: `actions` block with `button` elements
- Active option styled with confirm visual
- Existing pattern via blocks rendering

### Agent-Initiated Updates (Notifications)

When agent pushes `config_option_update`, the bridge notifies user via adapter:
- **Config change text**: "Mode changed to **Code**" / "Model switched to **opus-4**"
- No buttons on notifications — user can use commands to change back
- Renderer methods: update existing `renderModeChange()`, `renderModelUpdate()`, `renderConfigUpdate()` to read from configOptions instead of separate fields

### No Config = No Buttons

If agent provides no configOptions, commands return error text. No empty menus or placeholder buttons are shown.
