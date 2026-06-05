# Consolidated Tool Card — Design Spec

> Replaces per-tool-call messages with a single, auto-updating "tool card" per prompt turn. Plan updates render inline within the same card.

## Problem

Each `tool_call` event creates a separate message. An agent calling 10-20 tools floods the chat with short 1-line messages, pushing the actual text response off-screen. Users have to scroll past tool noise to see what the agent said. Plan events add a second card that interleaves with tool messages, making it worse.

## Solution

Consolidate all tool calls AND plan updates within a prompt turn into **one message** (the "tool card") that updates in place as tools execute.

## Verbosity Tiers

All three tiers show the full tool list. They differ in **noise filtering** and **detail level**.

| Verbosity | Noise tools (ls, dir reads, glob) | Viewer links | Input/Output details |
|-----------|----------------------------------|--------------|---------------------|
| **Low** | Hidden | Yes | No |
| **Medium** | Hidden | Yes | No |
| **High** | Shown | Yes | Yes |

### Low — Compact

Full list, noise tools filtered out. Viewer links shown inline.

```
📋 Tools (6/8)
✅ 📖 Read src/main.ts
✅ ✏️ Edit src/config.ts     📝 View diff
✅ 📖 Read src/types.ts
✅ 🔍 Grep "TODO" in src/
✅ ✏️ Edit src/utils.ts      📝 View diff
✅ 📖 Read src/utils.ts
── Plan: 2/3 ──
✅ 1. Set up project
🔄 2. Implement API
⬜ 3. Write tests
────
🔄 ▶️ Run: pnpm test
```

When complete:

```
📋 Tools (8/8) ✅
✅ 📖 Read src/main.ts
✅ ✏️ Edit src/config.ts     📝 View diff
✅ 📖 Read src/types.ts
✅ 🔍 Grep "TODO" in src/
✅ ✏️ Edit src/utils.ts      📝 View diff
✅ 📖 Read src/utils.ts
✅ ▶️ Run: pnpm test
✅ 📖 Read package.json
── Plan: 3/3 ──
✅ 1. Set up project
✅ 2. Implement API
✅ 3. Write tests
───
📊 12.5K tokens · $0.05
```

### Medium

Same as Low. Noise tools filtered out. Viewer links shown inline.

> Low and Medium currently render identically. Medium exists as a tier for future differentiation (e.g., additional metadata, grouping).

```
📋 Tools (6/8)
✅ 📖 Read src/main.ts
✅ ✏️ Edit src/config.ts     📝 View diff
✅ 📖 Read src/types.ts
✅ 🔍 Grep "TODO" in src/
✅ ✏️ Edit src/utils.ts      📝 View diff
✅ 📖 Read src/utils.ts
── Plan: 2/3 ──
✅ 1. Set up project
🔄 2. Implement API
⬜ 3. Write tests
────
🔄 ▶️ Run: pnpm test
```

### High — Full Detail

All tools shown (including noise tools). Viewer links + input/output details.

```
📋 Tools (6/10)
✅ 📖 Read src/main.ts
✅ 🔍 Glob **/*.ts
✅ ✏️ Edit src/config.ts     📄 View file · 📝 View diff
✅ 📖 Read src/types.ts
✅ 📖 Read src/             (directory)
✅ 🔍 Grep "TODO" in src/
✅ ✏️ Edit src/utils.ts      📄 View file · 📝 View diff
✅ 📖 Read src/utils.ts
── Plan: 2/3 ──
✅ 1. Set up project
🔄 2. Implement API
⬜ 3. Write tests
────
🔄 ▶️ Run: pnpm test
⬜ 📖 Read package.json
───
📊 12.5K tokens · $0.05
```

## Card Lifecycle

```
tool_call(id=1)    → Create card message with 1 entry (🔄 status)
tool_update(id=1)  → Edit card: entry 1 → ✅, add viewer links
tool_call(id=2)    → Edit card: append entry 2 (🔄)
plan(entries)       → Edit card: render plan section inline
tool_update(id=2)  → Edit card: entry 2 → ✅
...
usage event        → Edit card: append usage line at bottom
session_end        → Card becomes immutable
```

### Finalization

- Card stays as-is (full state preserved) on all verbosity levels
- Usage line appended at bottom with separator
- Card becomes **immutable** — no further edits

### Usage Timing

Usage events can arrive after text response. The card accepts `appendUsage()` even after text starts — only `session_end` makes the card truly immutable. This matches the actual ACP event order: `tools → text → usage → session_end`.

### Next Prompt Turn

A new prompt from the user creates a **new tool card** for the next batch. Previous card is immutable.

## Inline Plan

Plan updates render as a section within the tool card instead of a separate PlanCard message.

**Placement**: Plan section appears after the most recent completed tool entries, before any running/pending tools. When plan updates arrive, the section is replaced in-place.

**Format** (same across all verbosity levels — plan always shows full):

```
── Plan: 2/3 ──
✅ 1. Set up project
🔄 2. Implement API
⬜ 3. Write tests
```

**No plan events**: If the agent never sends a plan event, no plan section appears. The card is tools-only.

**PlanCard deprecation**: The existing standalone PlanCard in `activity.ts` is replaced by the inline plan section. PlanCard classes in Discord/Telegram activity trackers will be removed.

## Debounce Strategy

To avoid API rate limits (Telegram: ~30 edits/s global, Discord: 5 edits/10s per message):

- **Debounce window**: 500ms — collect all changes within the window, then flush once
- **Immediate first render**: First tool_call sends immediately (no debounce)
- **Force flush on finalize**: When usage/session_end arrives, flush immediately

This matches the existing PlanCard debounce pattern.

## Viewer Links

Inline after each tool entry that has links:

| Platform | Format |
|----------|--------|
| Discord (embed) | `✅ ✏️ Edit src/config.ts  [View file](url) · [View diff](url)` |
| Telegram (HTML) | `✅ ✏️ Edit src/config.ts  📄 <a href="url">View file</a> · 📝 <a href="url">View diff</a>` |
| Slack (blocks) | Context block with link elements |

Links only appear after `tool_update` with `completed` status delivers them.

## Status Icons

| Status | Icon | Notes |
|--------|------|-------|
| Running / In Progress | 🔄 | Only status from ACP `tool_call` |
| Completed | ✅ | From `tool_update` |
| Failed | ❌ | From `tool_update` |

> ACP does not send a "pending/queued" state. Tools appear in the card only when they start running.

## Noise Filtering

Noise tools are hidden on low and medium, shown on high:
- `ls` tool: hidden on low/medium
- Directory reads (path ends with `/`): hidden on low/medium
- `glob` tool: hidden on low/medium
- `grep` tool: hidden on low/medium

**Hidden tools are NOT counted** in the header total. `📋 Tools (5/5)` means 5 visible tools, even if `ls`/`grep` were called many times in the background. This avoids confusing users with mismatched counts.

## Architecture

### ToolCard replaces platform ToolCallTrackers

The current architecture has 3 layers:
- `SharedToolCallTracker` (state only) — **kept**
- `DiscordToolCallTracker` (state + send/edit) — **replaced by ToolCard**
- `TelegramToolCallTracker` (state + send/edit) — **replaced by ToolCard**

ToolCard = renderer + message manager. It reads state from SharedToolCallTracker.

### ToolCard class

```
ToolCard
├── entries: ToolCardEntry[]        — ordered list of tool calls
├── planEntries?: PlanEntry[]       — current plan state (if any)
├── usage?: UsageData               — appended at bottom
├── verbosity: DisplayVerbosity     — controls rendering tier
├── messageId?: string/number       — the single card message
├── debounce timer                  — 500ms flush window
├── finalized: boolean              — true after session_end
│
├── addTool(meta: ToolCallMeta)     — append new entry, schedule flush
├── updateTool(id, status, links?)  — update entry, schedule flush
├── updatePlan(entries: PlanEntry[])— replace plan section, schedule flush
├── appendUsage(usage)              — set usage data, force flush
├── finalize()                      — force flush, mark immutable
├── destroy()                       — clear timers
│
└── _flush()                        — render + send/edit message
```

### ToolCardEntry

```typescript
interface ToolCardEntry {
  id: string;
  name: string;
  kind?: string;
  status: string;
  icon: string;           // resolved via resolveToolIcon
  label: string;          // from formatToolSummary/formatToolTitle
  viewerLinks?: ViewerLinks;
  viewerFilePath?: string;
  hidden: boolean;        // true if noise-filtered
}
```

### Rendering

Each platform has a `renderToolCard(card: ToolCardState)` function in its `formatting.ts`:

- **Discord**: Returns markdown string for **embed description** (consistent with existing PlanCard embed usage)
- **Telegram**: Returns HTML string
- **Slack**: Returns Block Kit blocks

### Integration with Adapter

```
handleToolCall()   → toolCard.addTool(meta)
handleToolUpdate() → toolCard.updateTool(id, status, links)
handlePlan()       → toolCard.updatePlan(entries)
handleUsage()      → toolCard.appendUsage(usage)
handleSessionEnd() → toolCard.finalize()
```

ActivityTracker integration:
- `onToolCall()` → dismiss thinking indicator + `toolCard.addTool()`
- `onPlan()` → `toolCard.updatePlan()`
- `cleanup()` → `toolCard.finalize()` + `toolCard.destroy()`

### What Changes

| Component | Before | After |
|-----------|--------|-------|
| `handleToolCall` | Send new message via platform ToolCallTracker | `toolCard.addTool()` |
| `handleToolUpdate` | Edit per-tool message | `toolCard.updateTool()` |
| `handlePlan` | Separate PlanCard message | `toolCard.updatePlan()` |
| `handleUsage` | Separate usage message | `toolCard.appendUsage()` |
| Platform ToolCallTrackers | Send/edit messages | **Deleted** |
| PlanCard | Separate embed/message | **Deleted** (inline in ToolCard) |

### What Stays the Same

- `MessagingAdapter` dispatch flow
- `MessageTransformer` event mapping
- `formatToolSummary` / `formatToolTitle` / `resolveToolIcon` (reused by ToolCard)
- Noise filtering logic (`evaluateNoise`)
- Shared `ToolCallTracker` for state tracking

## Edge Cases

1. **No tools called**: No card created. Usage rendered standalone as before.
2. **Single tool**: Card still created (consistent UX).
3. **Agent tool (long-running)**: Shows 🔄 until completed — card updates when subagent finishes.
4. **Tool fails**: Entry shows ❌, card continues for remaining tools.
5. **30+ tools on medium**: Cap at 5 visible, rest collapsed. Header shows `(5/30)` visible count.
6. **Message length limit**: If card exceeds platform limit (Telegram 4096, Discord 4096 embed), truncate oldest completed entries with `... N more` regardless of verbosity.
7. **Rate limit hit**: Debounce handles this. If edit still fails, log warning and retry on next flush.
8. **Plan without tools**: If only plan events arrive (no tool calls), card still created with plan section only.
9. **Multiple plan updates**: Each `plan` event replaces the previous plan section entirely.
10. **Usage after text**: Accepted. Card only becomes immutable on `session_end`.

## Platform Rendering

### Discord

- Card rendered as **Embed** with colored sidebar
- Embed description contains the full card content (markdown)
- Consistent with existing PlanCard embed pattern
- 4096 char embed description limit

### Telegram

- Card rendered as plain HTML message
- `parse_mode: "HTML"` with `disable_notification: true`
- 4096 char message limit

### Slack

- Card rendered as Block Kit blocks
- Section blocks for content, context blocks for metadata
- 3000 char per section limit

## Platform Limits

| Platform | Message edit limit | Max message length | Debounce |
|----------|-------------------|-------------------|----------|
| Telegram | ~30/s global | 4096 chars | 500ms |
| Discord | 5/10s per channel | 4096 embed desc | 500ms |
| Slack | Generous | 3000 per section | 500ms |

## Files to Create/Modify

### New Files
- `src/core/adapter-primitives/primitives/tool-card.ts` — shared ToolCard logic (state, debounce, flush orchestration)

### Modified Files
- `src/plugins/discord/formatting.ts` — add `renderToolCard()`
- `src/plugins/telegram/formatting.ts` — add `renderToolCard()`
- `src/plugins/slack/formatter.ts` — add tool card block rendering
- `src/plugins/discord/adapter.ts` — wire ToolCard, remove PlanCard/ToolCallTracker usage
- `src/plugins/telegram/adapter.ts` — wire ToolCard, remove PlanCard/ToolCallTracker usage
- `src/plugins/discord/activity.ts` — replace PlanCard + ToolCallTracker with ToolCard
- `src/plugins/telegram/activity.ts` — replace PlanCard + ToolCallTracker with ToolCard

### Deleted Files
- `src/plugins/discord/tool-call-tracker.ts` — replaced by ToolCard
- `src/plugins/telegram/tool-call-tracker.ts` — replaced by ToolCard
