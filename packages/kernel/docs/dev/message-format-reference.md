# Message Format Reference

> How each message type is formatted across verbosity levels and platforms.

---

## 1. Visibility Matrix

Which message types are shown at each verbosity level:

| Message Type     | Low    | Medium | High   |
|------------------|--------|--------|--------|
| `text`           | Show   | Show   | Show   |
| `thought`        | Hidden | Show   | Show   |
| `tool_call`      | Show*  | Show   | Show   |
| `tool_update`    | Show*  | Show   | Show   |
| `plan`           | Show   | Show   | Show   |
| `usage`          | Hidden | Show   | Show   |
| `error`          | Show   | Show   | Show   |
| `attachment`     | Show   | Show   | Show   |
| `system_message` | Show   | Show   | Show   |
| `session_end`    | Show   | Show   | Show   |
| `mode_change`    | Show   | Show   | Show   |
| `config_update`  | Show   | Show   | Show   |
| `model_update`   | Show   | Show   | Show   |
| `user_replay`    | Show   | Show   | Show   |
| `resource`       | Show   | Show   | Show   |
| `resource_link`  | Show   | Show   | Show   |

\* `tool_call` has noise filtering: `ls` is hidden (except high), directory reads are hidden (except high), `glob` is collapsed on low.

---

## 2. ToolCall Formatting

### 2.1 Tool-Specific Formats (formatToolSummary — medium/high)

| Tool         | Format                                        | Example                                      |
|--------------|-----------------------------------------------|----------------------------------------------|
| `read`       | `📖 Read {filePath}{(N lines)}`               | `📖 Read src/main.ts (50 lines)`             |
| `edit`       | `✏️ Edit {filePath}`                          | `✏️ Edit src/main.ts`                        |
| `write`      | `📝 Write {filePath}`                         | `📝 Write src/new-file.ts`                   |
| `bash`       | `▶️ Run: {command}`                           | `▶️ Run: pnpm test`                          |
| `grep`       | `🔍 Grep "{pattern}" in {path}`              | `🔍 Grep "TODO" in src/`                     |
| `glob`       | `🔍 Glob {pattern}`                          | `🔍 Glob **/*.test.ts`                       |
| `agent`      | `🧠 Agent: {description}`                    | `🧠 Agent: Find message formatting code`     |
| `webfetch`   | `🌐 Fetch {url}`                             | `🌐 Fetch https://example.com/api`           |
| `websearch`  | `🌐 Search "{query}"`                        | `🌐 Search "vitest mock guide"`              |
| _(default)_  | `🔧 {name}`                                  | `🔧 CustomTool`                              |

> `command` truncated at 60 chars. `description`, `url`, `query` also truncated at 60 chars.

### 2.2 Tool-Specific Formats (formatToolTitle — low)

| Tool         | Format                          | Example                        |
|--------------|---------------------------------|--------------------------------|
| `read`       | `{filePath}`                    | `src/main.ts`                  |
| `edit`       | `{filePath}`                    | `src/main.ts`                  |
| `write`      | `{filePath}`                    | `src/new-file.ts`              |
| `bash`       | `{command}`                     | `pnpm test`                    |
| `grep`       | `"{pattern}" in {path}`        | `"TODO" in src/`               |
| `glob`       | `{pattern}`                     | `**/*.test.ts`                 |
| `agent`      | `{description}`                 | `Find message formatting code` |
| `webfetch`   | `{url}`                         | `https://example.com/api`      |
| `websearch`  | `{query}`                       | `vitest mock guide`            |
| _(default)_  | `{name}`                        | `CustomTool`                   |

### 2.3 Icon Resolution (resolveToolIcon)

Priority: `status` icon > `displayKind`/`kind` icon > `🔧` default.

**Status Icons:**
| Status        | Icon |
|---------------|------|
| `pending`     | ⏳   |
| `in_progress` | 🔄   |
| `completed`   | ✅   |
| `failed`      | ❌   |
| `cancelled`   | 🚫   |
| `running`     | 🔄   |
| `done`        | ✅   |
| `error`       | ❌   |

**Kind Icons:**
| Kind       | Icon |
|------------|------|
| `read`     | 📖   |
| `edit`     | ✏️   |
| `write`    | ✏️   |
| `delete`   | 🗑️   |
| `execute`  | ▶️   |
| `command`  | ▶️   |
| `bash`     | ▶️   |
| `search`   | 🔍   |
| `web`      | 🌐   |
| `fetch`    | 🌐   |
| `agent`    | 🧠   |
| `think`    | 🧠   |
| `install`  | 📦   |
| `move`     | 📦   |
| `other`    | 🛠️   |

### 2.4 Noise Filtering

| Rule                           | Action     | Effect                             |
|--------------------------------|------------|------------------------------------|
| Tool name is `ls`              | `hide`     | Hidden on low/medium               |
| Read on directory (path ends `/`) | `hide`  | Hidden on low/medium               |
| Tool name is `glob`            | `hide`     | Hidden on low/medium               |
| Tool name is `grep`            | `hide`     | Hidden on low/medium               |

---

## 3. Plan Formatting

**Source data:**
```typescript
{ type: "plan", entries: PlanEntry[] }
// PlanEntry = { content: string; status: "pending" | "in_progress" | "completed"; priority }
```

> **Note:** Plan is now rendered inline within the **Consolidated Tool Card** (see Section 9), positioned between completed and running tools. It is no longer a standalone message.

### Per verbosity:

| Verbosity | Output                                     |
|-----------|--------------------------------------------|
| **Low**   | Full list with status icons                |
| **Medium**| Full list with status icons                |
| **High**  | Full list with status icons                |

> Regardless of verbosity, plan always shows all entries in full (no summary collapse).

**Example:**
```
📋 Plan
✅ 1. Set up project structure
✅ 2. Create database schema
🔄 3. Implement API endpoints
⬜ 4. Write tests
⬜ 5. Deploy to staging
```

**Plan status icons:**
| Status        | Base/Discord | Telegram |
|---------------|-------------|----------|
| `completed`   | ✅          | ✅       |
| `in_progress` | 🔄          | 🔄       |
| `pending`     | ⬜          | ⬜       |

> Note: `PlanEntry.priority` exists in the type but is **not rendered** anywhere.

---

## 4. Usage Formatting

**Source data:**
```typescript
{ type: "usage", metadata: { tokensUsed, contextSize, cost } }
```

| Verbosity | Output                                                  |
|-----------|---------------------------------------------------------|
| **Low**   | Hidden                                                  |
| **Medium**| `📊 12.5K tokens · $0.05`                              |
| **High**  | `📊 12.5K / 200K tokens` + progress bar + `💰 $0.05`  |

**High verbosity example:**
```
📊 12,500 / 200,000 tokens
████████░░░░░░░░░░░░ 6%
💰 $0.05
```

> Shows ⚠️ instead of 📊 when usage >= 85% (Discord/Telegram).

---

## 5. Other Message Types

| Type             | Format                                          |
|------------------|-------------------------------------------------|
| `text`           | Raw text (plain/markdown/html per platform)     |
| `thought`        | Hidden on low. Shown on medium/high.            |
| `error`          | `❌ Error: {text}`                              |
| `system_message` | Raw text                                        |
| `session_end`    | `Done ({reason})`                               |
| `mode_change`    | `🔄 Mode: {modeId}`                            |
| `config_update`  | `⚙️ Config updated`                            |
| `model_update`   | `🤖 Model: {modelId}`                          |
| `resource`       | `📄 Resource: {name} ({uri})`                  |
| `resource_link`  | `🔗 {name}: {uri}`                             |
| `notification`   | `{emoji} {sessionName}\n{summary}`              |

**Notification emojis:**
| Type              | Icon |
|-------------------|------|
| `completed`       | ✅   |
| `error`           | ❌   |
| `permission`      | 🔐   |
| `input_required`  | 💬   |
| `budget_warning`  | ⚠️   |
| _(default)_       | ℹ️   |

---

## 6. Platform-Specific Differences

### 6.1 Discord (Markdown)

```
{icon} **{label}**
[View filename](file_url)
[View diff — filename](diff_url)

// High only:
**Input:**
```json
{rawInput}
```
**Output:**
```
{content}
```
```

- Max content: 500 chars (input/output in high mode)
- Max message: 1800 chars per chunk (splitMessage)
- Viewer links always shown

### 6.2 Telegram (HTML)

```html
{icon} <b>{escaped_label}</b>
📄 <a href="url">View filename</a>
📝 <a href="url">View diff — filename</a>

<!-- High only: -->
<b>Input:</b>
<pre>{escaped_input}</pre>
<b>Output:</b>
<pre>{escaped_content}</pre>
```

- Max content: 3800 chars (input/output in high mode)
- Max message: 3800 chars per chunk (splitMessage)
- HTML escaping applied (`&`, `<`, `>`)
- Markdown-to-HTML conversion for links, bold, italic, code

### 6.3 Slack (Block Kit)

| Type          | Block Type | Format                                        |
|---------------|------------|-----------------------------------------------|
| `text`        | `section`  | mrkdwn text (markdown converted)              |
| `thought`     | `context`  | `💭 _{text}_` (500 char limit)                |
| `tool_call`   | `context`  | `` 🔧 `{name}` `` + input JSON code block    |
| `tool_update` | `context`  | `{icon} \`{name}\` — {status}`               |
| `plan`        | `divider` + `section` | `📋 *Plan*\n{text}`              |
| `usage`       | `context`  | `📊 in: X · out: Y · $Z`                     |
| `error`       | `section`  | `⚠️ *Error:* {text}`                         |
| `session_end` | `divider` + `context` | `✅ Session ended — {reason}`    |

> **Known issue:** Slack Plan uses `message.text` (empty string) instead of `metadata.entries`. Plan content will be blank.

---

## 7. Data Flow

```
AgentEvent (ACP subprocess)
    ↓
MessageTransformer.transform()         → OutgoingMessage { type, text, metadata }
    ↓
ToolCardState (consolidation buffer)    → buffers tool_call + tool_update events
    ↓
ToolCardRenderer.render()               → single consolidated embed per prompt turn
    ↓
MessagingAdapter.sendMessage()
    ↓
shouldDisplay(content, verbosity)       → noise filter + HIDDEN_ON_LOW check
    ↓
dispatchMessage(content, verbosity)     → switch(content.type)
    ↓
handleXxx()                             → platform-specific handler
    ↓
renderer.renderXxx() / formatXxx()      → RenderedMessage { body, format }
    ↓
Platform send (Telegram HTML, Discord MD, Slack Blocks)
```

> **Consolidated Tool Card**: Single auto-updating embed/message per prompt turn replaces per-tool messages + standalone PlanCard. Card becomes immutable on `session_end`.

---

## 8. Files Reference

| File | Role |
|------|------|
| `src/core/types.ts` | AgentEvent, OutgoingMessage, PlanEntry types |
| `src/core/message-transformer.ts` | AgentEvent → OutgoingMessage mapping |
| `src/core/adapter-primitives/format-types.ts` | Icons, ToolCallMeta, ViewerLinks types |
| `src/core/adapter-primitives/message-formatter.ts` | formatToolSummary, formatToolTitle, resolveToolIcon, evaluateNoise |
| `src/core/adapter-primitives/format-utils.ts` | progressBar, formatTokens, truncateContent, splitMessage |
| `src/core/adapter-primitives/messaging-adapter.ts` | Message dispatch, visibility, noise filtering |
| `src/core/adapter-primitives/rendering/renderer.ts` | BaseRenderer (plain text defaults) |
| `src/core/adapter-primitives/primitives/tool-card-state.ts` | ToolCard shared state, debounce logic (500ms + immediate first render) |
| `src/plugins/discord/formatting.ts` | Discord markdown formatting |
| `src/plugins/telegram/formatting.ts` | Telegram HTML formatting |
| `src/plugins/slack/formatter.ts` | Slack Block Kit formatting |

---

## 9. Consolidated Tool Card

### Overview

The Consolidated Tool Card is a single auto-updating embed/message per prompt turn that replaces both:
- Per-tool messages (individual `tool_call`/`tool_update` messages)
- Standalone PlanCard (now rendered inline)

**Behavior:**
- One embed per session per prompt turn
- Auto-updates as tools run (debounced at 500ms; immediate first render)
- Becomes immutable on `session_end` event
- Renders sequentially: completed tools → running tools → plan → usage footer
- Verbosity controls noise filtering: low/medium hide noise tools, high shows all

### Structure

**Header:**
```
🔧 Tools (3/5 completed)
```

**Completed Tools Section:**
```
✅ Read src/main.ts (50 lines)
✅ Grep "TODO" in src/
```

**Running Tools Section:**
```
🔄 Edit src/main.ts
```

**Plan Section** (inline, always full entries):
```
📋 Plan
✅ 1. Set up project structure
✅ 2. Create database schema
🔄 3. Implement API endpoints
⬜ 4. Write tests
```

**Usage Footer:**
```
📊 12.5K tokens · $0.05
```

### Noise Filtering

Same rules as Section 2.4 apply:
- `ls` tool: hidden on low/medium
- Directory reads: hidden on low/medium
- `glob` tool: hidden on low/medium
- `grep` tool: hidden on low/medium

On **high** verbosity, all tools show (no filtering).

### Update Strategy

- **Debounce:** 500ms between renders (batches rapid tool events)
- **First render:** Immediate (not debounced)
- **Immutability:** On `session_end`, card stops updating and becomes read-only
- **Card lifecycle:** Created on first `tool_call`, destroyed with session
