# Output Mode Design Spec

**Date:** 2026-03-30
**Branch:** `feat/output-mode`
**Status:** Implemented

## Overview

Replaces `displayVerbosity` with a principled `outputMode` system providing 3-level cascade configuration (global → adapter → session), rich per-tool `DisplaySpec`, and streaming-aware accumulation.

**Design philosophy:** OutputMode is a **core feature**, not adapter-specific. Shared logic lives in `adapter-primitives/`, providing sensible defaults. Adapters can override any part of the rendering — flexible, not rigid.

## Output Modes

```typescript
type OutputMode = "low" | "medium" | "high";
type DisplayVerbosity = OutputMode; // deprecated alias
```

### Always Shown (all modes)

These elements are **always displayed** regardless of output mode:

- **View File / View Diff buttons** — for Read/Edit/Write tools (via tunnel viewer)
- **Thinking indicator** — shows agent is thinking (not the content itself)
- **Usage stats** — token/cost summary at the end
- **Agent/SubAgent info** — which agent is running

### Per-Mode Display Matrix

| Element | 🔇 Low | 📊 Medium | 🔍 High |
|---------|--------|-----------|---------|
| **Target audience** | Non-dev users | General users | Developers / power users |
| Tool title/icon | Yes | Yes | Yes |
| Tool description | No | Yes | Yes |
| Command (e.g. terminal cmd) | No | Yes | Yes |
| Output summary | No | Yes | Yes |
| Inline output content | No | No | Yes (if short) |
| View Output button (long output) | No | Yes | Yes |
| Diff stats (+X/-Y) | No | Yes | Yes |
| Thinking content | No | No | Yes |
| Noise tools | Hidden | Hidden | Shown |

### Fallback Logic

- If no `description` available for a tool → show raw content as fallback
- If tunnel unavailable for "View Output" → show inline fallback content (high mode only)

## Architecture

```
ACP Event → MessageTransformer (enrich diffStats/viewerLinks)
         → ToolStateMap (accumulate tool state)
         → DisplaySpecBuilder (mode-aware spec)
         → [filter by mode BEFORE send queue]
         → ToolCardState (debounced render)
         → SendQueue → Adapter renderer (Telegram HTML)
```

**Key optimization:** Filtering/spec-building happens **before** entering the send queue, not inside it. This reduces queue pressure and display delay.

**Multi-tool aggregation:** Multiple tool updates are aggregated into a single message (via ToolCardState debounce), keeping the chat clean and reducing API calls.

### Cascade Resolution

```
Session override → Adapter override → Global default → "medium"
```

`OutputModeResolver.resolve(configManager, adapterName, sessionId?, sessionManager?)` checks each level, returns first defined value.

## Core Components

### 1. ToolStateMap (`stream-accumulator.ts`)

Accumulates raw ACP tool events into `ToolEntry` objects. Handles out-of-order delivery via `pendingUpdates` map.

```typescript
interface ToolEntry {
  id: string; name: string; kind: string;
  rawInput: unknown; content: string | null; status: string;
  viewerLinks?: ViewerLinks; diffStats?: { added: number; removed: number };
  displaySummary?: string; displayTitle?: string; displayKind?: string;
  isNoise: boolean;
}

class ToolStateMap {
  upsert(meta, kind, rawInput): ToolEntry     // Create/update entry
  merge(id, status, ...): ToolEntry | undefined // Returns undefined for out-of-order
  get(id): ToolEntry | undefined
  clear(): void
}
```

**Out-of-order handling:** `merge()` for unknown ID buffers in `pendingUpdates`, returns `undefined`. Next `upsert()` for that ID applies pending update atomically.

### 2. ThoughtBuffer (`stream-accumulator.ts`)

Accumulates streaming thought chunks with seal lifecycle.

```typescript
class ThoughtBuffer {
  append(chunk: string): void
  seal(): string        // Concatenate + prevent further appends
  isSealed(): boolean
  reset(): void
}
```

### 3. DisplaySpecBuilder (`display-spec-builder.ts`)

Transforms `ToolEntry + OutputMode` → `ToolDisplaySpec`.

```typescript
interface ToolDisplaySpec {
  id: string; kind: string; icon: string;
  title: string;
  description: string | null;        // null on low
  command: string | null;             // null on low
  outputSummary: string | null;       // null on low
  outputContent: string | null;       // inline short output (high only)
  diffStats: { added: number; removed: number } | null;
  viewerLinks?: ViewerLinks;
  outputViewerLink?: string;          // large output → tunnel viewer
  outputFallbackContent?: string;     // fallback if no tunnel (high only)
  status: string; isNoise: boolean; isHidden: boolean;
}
```

**Thresholds for inline output (high mode):**
- `OUTPUT_LINE_THRESHOLD = 15` lines
- `OUTPUT_CHAR_THRESHOLD = 800` chars
- Both must be ≤ threshold for inline display

**Visibility:** `isHidden = entry.isNoise && mode !== "high"`

### 4. OutputModeResolver (`output-mode-resolver.ts`)

```typescript
function toOutputMode(v: unknown): OutputMode | undefined  // Type guard

class OutputModeResolver {
  resolve(configManager, adapterName, sessionId?, sessionManager?): OutputMode
}
```

### 5. ToolCardState (`primitives/tool-card-state.ts`)

Debounced rendering state machine.

```typescript
class ToolCardState {
  updateFromSpec(spec: ToolDisplaySpec): void
  finalize(): void
  snapshot(): ToolCardSnapshot
}

interface ToolCardSnapshot {
  specs: ToolDisplaySpec[];
  planEntries?: PlanEntry[];
  usage?: UsageData;
  totalVisible: number; completedVisible: number; allComplete: boolean;
}
```

- `DEBOUNCE_MS = 500`
- First flush immediate, subsequent debounced
- `finalize()` flushes immediately

## Configuration

### Config Schema (`config.ts`)

```typescript
// Global
outputMode: z.enum(["low", "medium", "high"]).default("medium").optional()

// Per-adapter (BaseChannelSchema)
outputMode: z.enum(["low", "medium", "high"]).optional()
displayVerbosity: z.enum(["low", "medium", "high"]).optional()  // deprecated
```

### Session Record (`types.ts`)

```typescript
interface SessionRecord {
  outputMode?: OutputMode;  // undefined = use adapter/global default
}
```

### Migration (`config-migrations.ts`)

Migration `migrate-display-verbosity-to-output-mode`: copies `displayVerbosity → outputMode` per channel if not already set.

## Message Transformer

Enriches ACP events with `diffStats` computed from file content:

```typescript
const added = Math.max(0, newLines - oldLines);
const removed = Math.max(0, oldLines - newLines);
if (added > 0 || removed > 0) metadata.diffStats = { added, removed };
```

## Viewer Store (`tunnel/viewer-store.ts`)

New `'output'` entry type for large tool output:

```typescript
storeOutput(sessionId, label, output): string | null
```

- Route: `/output/:id`
- Template: `output-viewer.ts` (dark GitHub-like theme, line numbers)
- URL: `TunnelService.outputUrl(entryId)`

## Telegram Integration

### ActivityTracker (`activity.ts`)

Constructor takes resolved `outputMode`, `tunnelService?`, `sessionContext?`. Internally wires:

- `ToolStateMap` for event accumulation
- `DisplaySpecBuilder` for spec generation
- `ThoughtBuffer` for thought streaming
- `ToolCard` for debounced rendering

### Adapter (`adapter.ts`)

- `OutputModeResolver` resolves mode at every handler call site
- `getOrCreateTracker()` passes resolved mode + tunnel service + session context

### Formatting (`formatting.ts`)

- `renderToolCard(snap: ToolCardSnapshot)` reads from `snap.specs`
- `renderSpecSection(spec: ToolDisplaySpec)` renders per-tool HTML
- Title/description/command deduplication
- Splits across messages at 4096 char Telegram limit

### Commands (`admin.ts`)

```
/outputmode [low|medium|high]           — Set adapter default
/outputmode session [low|medium|high]   — Override for current session
/outputmode session reset               — Clear session override
/verbosity ...                          — Deprecated alias
```

Callback buttons: `vb:low`, `vb:medium`, `vb:high`

## Edge Cases

- **Tunnel unavailable:** Falls back to inline content if mode=high
- **Out-of-order updates:** Buffered in ToolStateMap, applied on next upsert
- **Large content:** Stored in viewer, not inlined
- **Message overflow:** Tool card splits across multiple Telegram messages
- **Noise filtering:** Hidden in low/medium, shown in high

## Files Changed

**New:**
- `src/core/adapter-primitives/stream-accumulator.ts`
- `src/core/adapter-primitives/display-spec-builder.ts`
- `src/core/adapter-primitives/output-mode-resolver.ts`
- `src/plugins/tunnel/templates/output-viewer.ts`

**Modified:**
- `src/core/adapter-primitives/format-types.ts` — OutputMode type
- `src/core/adapter-primitives/primitives/tool-card-state.ts` — ToolDisplaySpec API
- `src/core/types.ts` — SessionRecord.outputMode
- `src/core/config/config.ts` — Schema additions
- `src/core/config/config-migrations.ts` — displayVerbosity migration
- `src/core/message-transformer.ts` — diffStats enrichment
- `src/core/plugin/types.ts` — ViewerStoreInterface, TunnelServiceInterface
- `src/plugins/tunnel/viewer-store.ts` — storeOutput()
- `src/plugins/tunnel/tunnel-service.ts` — outputUrl()
- `src/plugins/tunnel/server.ts` — /output/:id route
- `src/plugins/telegram/activity.ts` — ActivityTracker rewrite
- `src/plugins/telegram/formatting.ts` — renderToolCard rewrite
- `src/plugins/telegram/adapter.ts` — OutputModeResolver integration
- `src/plugins/telegram/commands/admin.ts` — /outputmode command
