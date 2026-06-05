# Output Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `displayVerbosity` system with a principled `outputMode` feature — three display levels (low/medium/high), cascade config (global → adapter → session), rich per-tool DisplaySpec computed from accumulated ACP events.

**Architecture:** Core computes `ToolDisplaySpec` via `DisplaySpecBuilder` from accumulated `ToolEntry` data (via `ToolStateMap`). `ToolCardState` stores specs and debounce-flushes to Telegram. Noise tools are filtered before the serial dispatch queue. `OutputModeResolver` handles global → adapter → session cascade.

**Tech Stack:** TypeScript/ESM, Vitest, grammY (Telegram), Hono (tunnel server), Zod (config), nanoid.

---

## File Map

```
NEW:
  src/core/adapter-primitives/stream-accumulator.ts     — ToolStateMap, ThoughtBuffer, ToolEntry
  src/core/adapter-primitives/display-spec-builder.ts   — DisplaySpecBuilder, ToolDisplaySpec, OutputMode
  src/core/adapter-primitives/output-mode-resolver.ts   — OutputModeResolver (cascade)
  src/plugins/tunnel/templates/output-viewer.ts         — HTML template for /output/:id

UPDATED:
  src/core/adapter-primitives/format-types.ts           — add OutputMode, keep DisplayVerbosity as alias
  src/core/types.ts                                     — SessionRecord.outputMode
  src/core/config/config.ts                             — add outputMode to BaseChannelSchema + global
  src/core/config/config-migrations.ts                  — migrate displayVerbosity → outputMode
  src/core/message-transformer.ts                       — add diffStats in enrichWithViewerLinks
  src/core/plugin/types.ts                              — ViewerStoreInterface.storeOutput + TunnelServiceInterface.outputUrl
  src/plugins/tunnel/viewer-store.ts                    — add storeOutput(), type 'output'
  src/plugins/tunnel/server.ts                          — add /output/:id route
  src/core/adapter-primitives/primitives/tool-card-state.ts — updateFromSpec, store ToolDisplaySpec[]
  src/plugins/telegram/formatting.ts                    — renderToolCard from ToolDisplaySpec[], splitToolCardText fix
  src/plugins/telegram/activity.ts                      — use ToolStateMap + DisplaySpecBuilder
  src/plugins/telegram/adapter.ts                       — filter before queue, OutputModeResolver
  src/plugins/telegram/commands/admin.ts                — add handleOutputMode
  src/plugins/telegram/commands/index.ts                — wire /outputmode command
```

---

## Task 1: Type & Config Foundations

**Files:**
- Modify: `src/core/adapter-primitives/format-types.ts`
- Modify: `src/core/types.ts`
- Modify: `src/core/config/config.ts`
- Modify: `src/core/config/config-migrations.ts`

- [ ] **Step 1.1: Add OutputMode to format-types.ts**

```typescript
// src/core/adapter-primitives/format-types.ts — add after line 3
export type OutputMode = "low" | "medium" | "high";
/** @deprecated Use OutputMode instead */
export type DisplayVerbosity = OutputMode;
```

- [ ] **Step 1.2: Add outputMode to SessionRecord in types.ts**

```typescript
// src/core/types.ts — add field to SessionRecord interface (after dangerousMode)
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
  dangerousMode?: boolean;
  outputMode?: import("./adapter-primitives/format-types.js").OutputMode;  // NEW
  platform: P;
}
```

- [ ] **Step 1.3: Add outputMode to config schema in config.ts**

```typescript
// src/core/config/config.ts — update BaseChannelSchema
const BaseChannelSchema = z
  .object({
    enabled: z.boolean().default(false),
    adapter: z.string().optional(),
    displayVerbosity: z.enum(["low", "medium", "high"]).default("medium").optional(),
    outputMode: z.enum(["low", "medium", "high"]).optional(),  // NEW
  })
  .passthrough();
```

Also add to the global `ConfigSchema` (find where global fields are defined and add):
```typescript
outputMode: z.enum(["low", "medium", "high"]).default("medium").optional(),
```

- [ ] **Step 1.4: Add config migration for displayVerbosity → outputMode**

```typescript
// src/core/config/config-migrations.ts — add to migrations array
{
  name: "migrate-display-verbosity-to-output-mode",
  apply(raw) {
    const channels = raw.channels as Record<string, unknown> | undefined;
    if (!channels) return false;
    let changed = false;
    for (const [, channelCfg] of Object.entries(channels)) {
      if (!channelCfg || typeof channelCfg !== "object") continue;
      const cfg = channelCfg as Record<string, unknown>;
      if (cfg.displayVerbosity && !cfg.outputMode) {
        cfg.outputMode = cfg.displayVerbosity;
        changed = true;
      }
    }
    return changed;
  },
},
```

- [ ] **Step 1.5: Build and verify no type errors**

```bash
pnpm build 2>&1 | tail -20
```

Expected: clean build (or only pre-existing errors, not new ones from these changes).

- [ ] **Step 1.6: Commit**

```bash
git add src/core/adapter-primitives/format-types.ts src/core/types.ts src/core/config/config.ts src/core/config/config-migrations.ts
git commit -m "feat(output-mode): add OutputMode type, SessionRecord field, config schema + migration"
```

---

## Task 2: StreamAccumulator (ToolStateMap + ThoughtBuffer)

**Files:**
- Create: `src/core/adapter-primitives/stream-accumulator.ts`
- Create: `src/core/adapter-primitives/__tests__/stream-accumulator.test.ts`

- [ ] **Step 2.1: Write failing tests**

```typescript
// src/core/adapter-primitives/__tests__/stream-accumulator.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { ToolStateMap, ThoughtBuffer } from "../stream-accumulator.js";
import type { ToolCallMeta } from "../format-types.js";

const makeMeta = (overrides: Partial<ToolCallMeta> = {}): ToolCallMeta => ({
  id: "tool-1",
  name: "Read",
  kind: "read",
  status: "running",
  rawInput: {},  // intentionally empty — matches real ACP initial event
  ...overrides,
});

describe("ToolStateMap", () => {
  let map: ToolStateMap;
  beforeEach(() => { map = new ToolStateMap(); });

  it("upsert creates a new entry with empty rawInput", () => {
    const entry = map.upsert(makeMeta({ id: "t1" }), "read", {});
    expect(entry.id).toBe("t1");
    expect(entry.rawInput).toEqual({});
    expect(entry.status).toBe("running");
  });

  it("merge updates rawInput from tool_call_update (initial rawInput empty)", () => {
    map.upsert(makeMeta({ id: "t1" }), "read", {});
    const entry = map.merge("t1", "completed", { file_path: "src/foo.ts" }, "file content", undefined);
    expect(entry.rawInput).toEqual({ file_path: "src/foo.ts" });
    expect(entry.content).toBe("file content");
    expect(entry.status).toBe("completed");
  });

  it("merge buffers update when tool_call not yet received (out-of-order)", () => {
    // merge arrives before upsert
    map.merge("t1", "completed", { file_path: "x.ts" }, "output", undefined);
    // upsert arrives after — should apply buffered update
    const entry = map.upsert(makeMeta({ id: "t1" }), "read", {});
    expect(entry.status).toBe("completed");
    expect(entry.rawInput).toEqual({ file_path: "x.ts" });
    expect(entry.content).toBe("output");
  });

  it("get returns undefined for unknown id", () => {
    expect(map.get("nope")).toBeUndefined();
  });

  it("clear removes all entries and pending updates", () => {
    map.upsert(makeMeta({ id: "t1" }), "read", {});
    map.clear();
    expect(map.get("t1")).toBeUndefined();
  });
});

describe("ThoughtBuffer", () => {
  let buf: ThoughtBuffer;
  beforeEach(() => { buf = new ThoughtBuffer(); });

  it("append + seal returns accumulated text", () => {
    buf.append("Hello ");
    buf.append("world");
    expect(buf.seal()).toBe("Hello world");
  });

  it("isSealed returns true after seal()", () => {
    expect(buf.isSealed()).toBe(false);
    buf.seal();
    expect(buf.isSealed()).toBe(true);
  });

  it("reset clears sealed state and content", () => {
    buf.append("text");
    buf.seal();
    buf.reset();
    expect(buf.isSealed()).toBe(false);
    expect(buf.seal()).toBe("");
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
pnpm test src/core/adapter-primitives/__tests__/stream-accumulator.test.ts 2>&1 | tail -10
```

Expected: FAIL (module not found).

- [ ] **Step 2.3: Implement stream-accumulator.ts**

```typescript
// src/core/adapter-primitives/stream-accumulator.ts
import type { ToolCallMeta, ViewerLinks } from "./format-types.js";
import { evaluateNoise } from "./message-formatter.js";

export interface ToolEntry {
  id: string;
  name: string;
  kind: string;
  rawInput: unknown;
  content: string | null;
  status: string;
  viewerLinks?: ViewerLinks;
  diffStats?: { added: number; removed: number };
  displaySummary?: string;
  displayTitle?: string;
  displayKind?: string;
  isNoise: boolean;
}

interface PendingUpdate {
  status: string;
  rawInput?: unknown;
  content?: string | null;
  viewerLinks?: ViewerLinks;
  diffStats?: { added: number; removed: number };
}

export class ToolStateMap {
  private entries = new Map<string, ToolEntry>();
  private pendingUpdates = new Map<string, PendingUpdate>();

  upsert(
    meta: ToolCallMeta,
    kind: string,
    rawInput: unknown,
  ): ToolEntry {
    const entry: ToolEntry = {
      id: meta.id,
      name: meta.name,
      kind: kind || meta.kind || "other",
      rawInput: rawInput ?? {},
      content: (meta.content as string | null | undefined) ?? null,
      status: meta.status ?? "running",
      viewerLinks: meta.viewerLinks,
      displaySummary: meta.displaySummary,
      displayTitle: meta.displayTitle,
      displayKind: meta.displayKind,
      isNoise: evaluateNoise(meta.name, kind, rawInput) !== null,
    };

    // Apply buffered out-of-order update
    const pending = this.pendingUpdates.get(meta.id);
    if (pending) {
      entry.status = pending.status;
      if (pending.rawInput !== undefined) entry.rawInput = pending.rawInput;
      if (pending.content !== undefined) entry.content = pending.content ?? null;
      if (pending.viewerLinks) entry.viewerLinks = pending.viewerLinks;
      if (pending.diffStats) entry.diffStats = pending.diffStats;
      this.pendingUpdates.delete(meta.id);
    }

    this.entries.set(meta.id, entry);
    return entry;
  }

  merge(
    id: string,
    status: string,
    rawInput?: unknown,
    content?: string | null,
    viewerLinks?: ViewerLinks,
    diffStats?: { added: number; removed: number },
  ): ToolEntry {
    const entry = this.entries.get(id);
    if (!entry) {
      // Buffer for when upsert arrives later
      this.pendingUpdates.set(id, { status, rawInput, content, viewerLinks, diffStats });
      // Return a placeholder — caller should handle undefined case
      return { id, name: "", kind: "", rawInput: {}, content: null, status, isNoise: false };
    }

    entry.status = status;
    if (rawInput !== undefined && rawInput !== null && typeof rawInput === "object" && Object.keys(rawInput as object).length > 0) {
      entry.rawInput = rawInput;
    }
    if (content !== undefined) entry.content = content ?? null;
    if (viewerLinks) entry.viewerLinks = viewerLinks;
    if (diffStats) entry.diffStats = diffStats;
    return entry;
  }

  get(id: string): ToolEntry | undefined {
    return this.entries.get(id);
  }

  clear(): void {
    this.entries.clear();
    this.pendingUpdates.clear();
  }
}

export class ThoughtBuffer {
  private chunks: string[] = [];
  private _sealed = false;

  append(chunk: string): void {
    if (!this._sealed) this.chunks.push(chunk);
  }

  seal(): string {
    this._sealed = true;
    return this.chunks.join("");
  }

  isSealed(): boolean {
    return this._sealed;
  }

  reset(): void {
    this.chunks = [];
    this._sealed = false;
  }
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
pnpm test src/core/adapter-primitives/__tests__/stream-accumulator.test.ts 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/core/adapter-primitives/stream-accumulator.ts src/core/adapter-primitives/__tests__/stream-accumulator.test.ts
git commit -m "feat(output-mode): add StreamAccumulator (ToolStateMap + ThoughtBuffer)"
```

---

## Task 3: DisplaySpecBuilder

**Files:**
- Create: `src/core/adapter-primitives/display-spec-builder.ts`
- Create: `src/core/adapter-primitives/__tests__/display-spec-builder.test.ts`

- [ ] **Step 3.1: Write failing tests**

```typescript
// src/core/adapter-primitives/__tests__/display-spec-builder.test.ts
import { describe, it, expect } from "vitest";
import { DisplaySpecBuilder } from "../display-spec-builder.js";
import type { ToolEntry } from "../stream-accumulator.js";

function makeEntry(overrides: Partial<ToolEntry> = {}): ToolEntry {
  return {
    id: "t1",
    name: "Bash",
    kind: "execute",
    rawInput: { command: "pnpm build", description: "Build TypeScript" },
    content: "Done in 2.5s",
    status: "completed",
    isNoise: false,
    ...overrides,
  };
}

const builder = new DisplaySpecBuilder();

describe("DisplaySpecBuilder.buildToolSpec", () => {
  describe("low mode", () => {
    it("returns title only, no description, no command, no output", () => {
      const spec = builder.buildToolSpec(makeEntry(), "low");
      expect(spec.title).toBeTruthy();
      expect(spec.description).toBeNull();
      expect(spec.command).toBeNull();
      expect(spec.outputContent).toBeNull();
      expect(spec.outputSummary).toBeNull();
    });

    it("marks noise tools as hidden", () => {
      const spec = builder.buildToolSpec(makeEntry({ isNoise: true }), "low");
      expect(spec.isHidden).toBe(true);
    });

    it("does not hide noise tools on high", () => {
      const spec = builder.buildToolSpec(makeEntry({ isNoise: true }), "high");
      expect(spec.isHidden).toBe(false);
    });
  });

  describe("medium mode", () => {
    it("includes description and command for execute kind", () => {
      const spec = builder.buildToolSpec(makeEntry(), "medium");
      expect(spec.description).toBe("Build TypeScript");
      expect(spec.command).toBe("pnpm build");
    });

    it("includes outputSummary when content present", () => {
      const spec = builder.buildToolSpec(makeEntry({ content: "line1\nline2\nline3" }), "medium");
      expect(spec.outputSummary).toMatch(/3 lines/);
    });

    it("does not include inline outputContent (medium never inline)", () => {
      const spec = builder.buildToolSpec(makeEntry({ content: "short" }), "medium");
      expect(spec.outputContent).toBeNull();
    });
  });

  describe("high mode", () => {
    it("includes inline outputContent for short output (≤15 lines, ≤800 chars)", () => {
      const spec = builder.buildToolSpec(makeEntry({ content: "Done in 2.5s" }), "high");
      expect(spec.outputContent).toBe("Done in 2.5s");
    });

    it("does NOT include inline outputContent for long output (>15 lines)", () => {
      const longOutput = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
      const spec = builder.buildToolSpec(makeEntry({ content: longOutput }), "high");
      expect(spec.outputContent).toBeNull();
    });

    it("does NOT include inline outputContent for long output (>800 chars)", () => {
      const longOutput = "x".repeat(801);
      const spec = builder.buildToolSpec(makeEntry({ content: longOutput }), "high");
      expect(spec.outputContent).toBeNull();
    });
  });

  describe("thought spec", () => {
    it("returns content null on low/medium", () => {
      expect(builder.buildThoughtSpec("thinking", "low").content).toBeNull();
      expect(builder.buildThoughtSpec("thinking", "medium").content).toBeNull();
    });

    it("returns content on high", () => {
      expect(builder.buildThoughtSpec("thinking hard", "high").content).toBe("thinking hard");
    });
  });

  describe("Read tool — no command field", () => {
    it("extracts description from rawInput.description, no command", () => {
      const entry = makeEntry({
        name: "Read",
        kind: "read",
        rawInput: { file_path: "src/foo.ts", description: "Read foo" },
      });
      const spec = builder.buildToolSpec(entry, "medium");
      expect(spec.description).toBe("Read foo");
      expect(spec.command).toBeNull();  // Read is not execute kind
    });
  });

  describe("diffStats", () => {
    it("includes diffStats from entry on medium+", () => {
      const entry = makeEntry({ diffStats: { added: 10, removed: 3 } });
      const spec = builder.buildToolSpec(entry, "medium");
      expect(spec.diffStats).toEqual({ added: 10, removed: 3 });
    });

    it("diffStats is null on low", () => {
      const entry = makeEntry({ diffStats: { added: 10, removed: 3 } });
      const spec = builder.buildToolSpec(entry, "low");
      expect(spec.diffStats).toBeNull();
    });
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
pnpm test src/core/adapter-primitives/__tests__/display-spec-builder.test.ts 2>&1 | tail -5
```

Expected: FAIL (module not found).

- [ ] **Step 3.3: Implement display-spec-builder.ts**

```typescript
// src/core/adapter-primitives/display-spec-builder.ts
import type { OutputMode, ViewerLinks } from "./format-types.js";
import type { ToolEntry } from "./stream-accumulator.js";
import { KIND_ICONS, STATUS_ICONS } from "./format-types.js";
import type { TunnelServiceInterface } from "../plugin/types.js";

export type { OutputMode };

export interface ToolDisplaySpec {
  id: string;
  icon: string;
  title: string;
  description: string | null;
  command: string | null;
  outputSummary: string | null;
  outputContent: string | null;
  diffStats: { added: number; removed: number } | null;
  viewerLinks?: ViewerLinks;
  outputViewerLink?: string;
  outputFallbackContent?: string;
  status: string;
  isNoise: boolean;
  isHidden: boolean;
}

export interface ThoughtDisplaySpec {
  indicator: string;
  content: string | null;
}

export interface UsageDisplaySpec {
  tokensUsed?: number;
  contextSize?: number;
  cost?: number;
}

export interface SessionContext {
  id: string;
  workingDirectory?: string;
}

const OUTPUT_LINE_THRESHOLD = 15;
const OUTPUT_CHAR_THRESHOLD = 800;

const EXECUTE_KINDS = new Set(["execute", "command", "bash", "terminal"]);

export class DisplaySpecBuilder {
  constructor(private tunnelService?: TunnelServiceInterface) {}

  buildToolSpec(
    entry: ToolEntry,
    mode: OutputMode,
    sessionContext?: SessionContext,
  ): ToolDisplaySpec {
    const title = this.buildTitle(entry, mode);
    const description = mode !== "low" ? this.extractDescription(entry) : null;
    const command = mode !== "low" && EXECUTE_KINDS.has(entry.kind) ? this.extractCommand(entry) : null;
    const diffStats = mode !== "low" ? (entry.diffStats ?? null) : null;
    const outputSummary = mode !== "low" ? this.extractOutputSummary(entry) : null;

    let outputContent: string | null = null;
    let outputViewerLink: string | undefined;
    let outputFallbackContent: string | undefined;

    if (mode !== "low") {
      const output = entry.content ?? null;
      if (output) {
        const lines = output.split("\n").length;
        const chars = output.length;
        const isLong = lines > OUTPUT_LINE_THRESHOLD || chars > OUTPUT_CHAR_THRESHOLD;

        if (isLong) {
          if (this.tunnelService && sessionContext) {
            const store = this.tunnelService.getStore();
            const label = this.extractCommand(entry) ?? entry.name;
            const id = store.storeOutput(sessionContext.id, label, output);
            if (id) outputViewerLink = this.tunnelService.outputUrl(id);
          } else if (mode === "high") {
            outputFallbackContent = output;
          }
        } else if (mode === "high") {
          outputContent = output;
        }
      }
    }

    return {
      id: entry.id,
      icon: this.resolveIcon(entry),
      title,
      description,
      command,
      outputSummary,
      outputContent,
      diffStats,
      viewerLinks: entry.viewerLinks,
      outputViewerLink,
      outputFallbackContent,
      status: entry.status,
      isNoise: entry.isNoise,
      isHidden: entry.isNoise && mode !== "high",
    };
  }

  buildThoughtSpec(text: string, mode: OutputMode): ThoughtDisplaySpec {
    return {
      indicator: "Thinking...",
      content: mode === "high" ? text : null,
    };
  }

  private buildTitle(entry: ToolEntry, mode: OutputMode): string {
    // displayTitle override from ACP meta
    if (entry.displayTitle) return entry.displayTitle;
    // displaySummary override
    if (entry.displaySummary) return entry.displaySummary;

    const rawInput = entry.rawInput as Record<string, unknown> | null;
    if (!rawInput) return entry.name;

    // Read: "Read foo.ts (lines 10–20)"
    if (entry.kind === "read" && rawInput.file_path) {
      let title = String(rawInput.file_path).split("/").pop() ?? String(rawInput.file_path);
      if (rawInput.offset || rawInput.limit) {
        const start = Number(rawInput.offset ?? 1);
        const end = rawInput.limit ? start + Number(rawInput.limit) - 1 : "…";
        title += ` (lines ${start}–${end})`;
      }
      return title;
    }

    // Edit/Write: "Edit foo.ts"
    if ((entry.kind === "edit" || entry.kind === "write") && rawInput.file_path) {
      return String(rawInput.file_path).split("/").pop() ?? String(rawInput.file_path);
    }

    // Execute: use description if available, else command truncated
    if (EXECUTE_KINDS.has(entry.kind)) {
      if (rawInput.description) return String(rawInput.description);
      if (rawInput.command) {
        const cmd = String(rawInput.command);
        return cmd.length > 60 ? cmd.slice(0, 57) + "…" : cmd;
      }
    }

    // Search: "Grep 'pattern'"
    if (entry.kind === "search" && rawInput.pattern) {
      return `${entry.name} "${String(rawInput.pattern)}"`;
    }

    return entry.name;
  }

  private extractDescription(entry: ToolEntry): string | null {
    const rawInput = entry.rawInput as Record<string, unknown> | null;
    if (!rawInput) return null;
    if (typeof rawInput.description === "string" && rawInput.description) {
      return rawInput.description;
    }
    return null;
  }

  private extractCommand(entry: ToolEntry): string | null {
    const rawInput = entry.rawInput as Record<string, unknown> | null;
    if (!rawInput) return null;
    if (typeof rawInput.command === "string" && rawInput.command) return rawInput.command;
    return null;
  }

  private extractOutputSummary(entry: ToolEntry): string | null {
    if (!entry.content) return null;
    const lines = entry.content.split("\n").length;
    return `${lines} line${lines === 1 ? "" : "s"} of output`;
  }

  private resolveIcon(entry: ToolEntry): string {
    const kindIcon = KIND_ICONS[entry.kind] ?? KIND_ICONS["other"];
    const statusIcon = STATUS_ICONS[entry.status];
    if (!statusIcon || entry.status === "running" || entry.status === "pending") return kindIcon;
    return kindIcon;
  }
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
pnpm test src/core/adapter-primitives/__tests__/display-spec-builder.test.ts 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 3.5: Build**

```bash
pnpm build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 3.6: Commit**

```bash
git add src/core/adapter-primitives/display-spec-builder.ts src/core/adapter-primitives/__tests__/display-spec-builder.test.ts
git commit -m "feat(output-mode): add DisplaySpecBuilder with ToolDisplaySpec computation"
```

---

## Task 4: OutputModeResolver

**Files:**
- Create: `src/core/adapter-primitives/output-mode-resolver.ts`
- Create: `src/core/adapter-primitives/__tests__/output-mode-resolver.test.ts`

- [ ] **Step 4.1: Write failing tests**

```typescript
// src/core/adapter-primitives/__tests__/output-mode-resolver.test.ts
import { describe, it, expect } from "vitest";
import { OutputModeResolver } from "../output-mode-resolver.js";

function makeConfig(global?: string, adapterMode?: string) {
  return {
    get: () => ({
      outputMode: global,
      channels: { telegram: { outputMode: adapterMode } },
    }),
  } as any;
}

function makeSessionManager(sessionMode?: string) {
  return {
    getSession: (id: string) => id === "sess1" ? { record: { outputMode: sessionMode } } : undefined,
  } as any;
}

describe("OutputModeResolver", () => {
  const resolver = new OutputModeResolver();

  it("returns medium as default when nothing configured", () => {
    expect(resolver.resolve(makeConfig(), "telegram")).toBe("medium");
  });

  it("uses global outputMode when set", () => {
    expect(resolver.resolve(makeConfig("low"), "telegram")).toBe("low");
  });

  it("adapter-level overrides global", () => {
    expect(resolver.resolve(makeConfig("low", "high"), "telegram")).toBe("high");
  });

  it("session-level overrides adapter", () => {
    const result = resolver.resolve(
      makeConfig("low", "medium"),
      "telegram",
      "sess1",
      makeSessionManager("high"),
    );
    expect(result).toBe("high");
  });

  it("skips session override when sessionId not provided", () => {
    const result = resolver.resolve(
      makeConfig("low", "medium"),
      "telegram",
      undefined,
      makeSessionManager("high"),
    );
    expect(result).toBe("medium");
  });
});
```

- [ ] **Step 4.2: Run to verify fail**

```bash
pnpm test src/core/adapter-primitives/__tests__/output-mode-resolver.test.ts 2>&1 | tail -5
```

- [ ] **Step 4.3: Implement output-mode-resolver.ts**

```typescript
// src/core/adapter-primitives/output-mode-resolver.ts
import type { OutputMode } from "./format-types.js";

interface ConfigManagerLike {
  get(): Record<string, unknown>;
}

interface SessionManagerLike {
  getSession(id: string): { record?: { outputMode?: OutputMode } } | undefined;
}

export class OutputModeResolver {
  resolve(
    configManager: ConfigManagerLike,
    adapterName: string,
    sessionId?: string,
    sessionManager?: SessionManagerLike,
  ): OutputMode {
    const config = configManager.get();
    // 1. Global default
    let mode: OutputMode = (config.outputMode as OutputMode | undefined) ?? "medium";
    // 2. Per-adapter override
    const channels = config.channels as Record<string, unknown> | undefined;
    const channelCfg = channels?.[adapterName] as Record<string, unknown> | undefined;
    if (channelCfg?.outputMode) mode = channelCfg.outputMode as OutputMode;
    // 3. Per-session override (most specific)
    if (sessionId && sessionManager) {
      const session = sessionManager.getSession(sessionId);
      const sessionMode = session?.record?.outputMode;
      if (sessionMode) mode = sessionMode;
    }
    return mode;
  }
}
```

- [ ] **Step 4.4: Run to verify pass**

```bash
pnpm test src/core/adapter-primitives/__tests__/output-mode-resolver.test.ts 2>&1 | tail -10
```

- [ ] **Step 4.5: Commit**

```bash
git add src/core/adapter-primitives/output-mode-resolver.ts src/core/adapter-primitives/__tests__/output-mode-resolver.test.ts
git commit -m "feat(output-mode): add OutputModeResolver (cascade global → adapter → session)"
```

---

## Task 5: MessageTransformer — diffStats

**Files:**
- Modify: `src/core/message-transformer.ts`

- [ ] **Step 5.1: Add diffStats computation to enrichWithViewerLinks**

In `message-transformer.ts`, after the `storeDiff` call (around line 160), add diff stats computation:

```typescript
// In enrichWithViewerLinks, after: if (fileInfo.oldContent) { ... }
// Replace the existing block with:
if (fileInfo.oldContent !== undefined) {
  const id = store.storeDiff(
    sessionContext.id,
    fileInfo.filePath,
    fileInfo.oldContent,
    fileInfo.content,
    sessionContext.workingDirectory,
  );
  if (id) viewerLinks.diff = this.tunnelService.diffUrl(id);

  // Compute diff stats: net line count change
  const oldLines = fileInfo.oldContent.split("\n").length;
  const newLines = fileInfo.content.split("\n").length;
  const added = Math.max(0, newLines - oldLines);
  const removed = Math.max(0, oldLines - newLines);
  if (added > 0 || removed > 0) {
    metadata.diffStats = { added, removed };
  }
}
```

- [ ] **Step 5.2: Build to verify no type errors**

```bash
pnpm build 2>&1 | tail -10
```

- [ ] **Step 5.3: Commit**

```bash
git add src/core/message-transformer.ts
git commit -m "feat(output-mode): compute diffStats in enrichWithViewerLinks"
```

---

## Task 6: ViewerStore output type + tunnel route

**Files:**
- Modify: `src/core/plugin/types.ts`
- Modify: `src/plugins/tunnel/viewer-store.ts`
- Create: `src/plugins/tunnel/templates/output-viewer.ts`
- Modify: `src/plugins/tunnel/server.ts`

- [ ] **Step 6.1: Add storeOutput to ViewerStoreInterface and outputUrl to TunnelServiceInterface in types.ts**

```typescript
// src/core/plugin/types.ts — update ViewerStoreInterface
export interface ViewerStoreInterface {
  storeFile(sessionId: string, filePath: string, content: string, workingDirectory: string): string | null
  storeDiff(sessionId: string, filePath: string, oldContent: string, newContent: string, workingDirectory: string): string | null
  storeOutput(sessionId: string, label: string, output: string): string | null  // NEW
}

// In TunnelServiceInterface, add after diffUrl:
outputUrl(entryId: string): string  // NEW
```

- [ ] **Step 6.2: Add storeOutput to ViewerStore and update ViewerEntry type**

```typescript
// src/plugins/tunnel/viewer-store.ts

// Update ViewerEntry type union:
export interface ViewerEntry {
  id: string
  type: 'file' | 'diff' | 'output'  // add 'output'
  filePath?: string
  content: string
  oldContent?: string
  language?: string
  sessionId: string
  workingDirectory: string
  createdAt: number
  expiresAt: number
}

// Add method to ViewerStore class:
storeOutput(sessionId: string, label: string, output: string): string | null {
  if (output.length > MAX_CONTENT_SIZE) {
    log.debug({ label, size: output.length }, 'Output too large for viewer')
    return null
  }
  const id = nanoid(12)
  const now = Date.now()
  this.entries.set(id, {
    id,
    type: 'output',
    filePath: label,
    content: output,
    language: 'text',
    sessionId,
    workingDirectory: '',
    createdAt: now,
    expiresAt: now + this.ttlMs,
  })
  log.debug({ id, label }, 'Stored output for viewing')
  return id
}
```

- [ ] **Step 6.3: Create output-viewer.ts template**

```typescript
// src/plugins/tunnel/templates/output-viewer.ts
import type { ViewerEntry } from '../viewer-store.js'

export function renderOutputViewer(entry: ViewerEntry): string {
  const label = entry.filePath ?? 'Output'
  const lines = entry.content.split('\n')
  const lineNumbers = lines
    .map((line, i) => {
      const num = String(i + 1).padStart(String(lines.length).length, ' ')
      return `<span class="line-num">${num}</span><span class="line-content">${escapeHtml(line)}</span>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(label)} — Viben</title>
<style>
  body { background: #0d1117; color: #c9d1d9; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; margin: 0; padding: 0; }
  header { background: #161b22; border-bottom: 1px solid #30363d; padding: 12px 20px; position: sticky; top: 0; z-index: 10; }
  header h1 { margin: 0; font-size: 14px; color: #e6edf3; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .content { padding: 16px 20px; }
  pre { margin: 0; line-height: 1.6; white-space: pre; overflow-x: auto; }
  .line-num { color: #484f58; user-select: none; margin-right: 16px; display: inline-block; min-width: 3ch; text-align: right; }
  .line-content { color: #c9d1d9; }
</style>
</head>
<body>
<header><h1>📋 ${escapeHtml(label)}</h1></header>
<div class="content"><pre>${lineNumbers}</pre></div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

- [ ] **Step 6.4: Add /output/:id route to server.ts**

```typescript
// src/plugins/tunnel/server.ts — add import at top:
import { renderOutputViewer } from './templates/output-viewer.js'

// Add route after existing /diff/:id route:
app.get('/output/:id', (c) => {
  const entry = store.get(c.req.param('id'))
  if (!entry || entry.type !== 'output') {
    return c.html(notFoundPage(), 404)
  }
  return c.html(renderOutputViewer(entry))
})
```

- [ ] **Step 6.5: Add outputUrl to TunnelService in tunnel-service.ts**

```typescript
// src/plugins/tunnel/tunnel-service.ts — add after diffUrl method
outputUrl(entryId: string): string {
  return `${this.getPublicUrl()}/output/${entryId}`
}
```

- [ ] **Step 6.6: Build to verify**

```bash
pnpm build 2>&1 | tail -10
```

- [ ] **Step 6.7: Commit**

```bash
git add src/core/plugin/types.ts src/plugins/tunnel/viewer-store.ts src/plugins/tunnel/templates/output-viewer.ts src/plugins/tunnel/server.ts
git commit -m "feat(output-mode): add ViewerStore output type, /output/:id route, tunnel outputUrl"
```

---

## Task 7: ToolCardState Refactor

Replaces `ToolCardEntry[]` with `ToolDisplaySpec[]`. Preserves all debounce/flush/rate-limit behaviors.

**Files:**
- Modify: `src/core/adapter-primitives/primitives/tool-card-state.ts`
- Create: `src/core/adapter-primitives/__tests__/tool-card-state.test.ts`

- [ ] **Step 7.1: Write failing tests**

```typescript
// src/core/adapter-primitives/__tests__/tool-card-state.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolCardState } from "../primitives/tool-card-state.js";
import type { ToolDisplaySpec } from "../display-spec-builder.js";

function makeSpec(overrides: Partial<ToolDisplaySpec> = {}): ToolDisplaySpec {
  return {
    id: "t1",
    icon: "📖",
    title: "Read foo.ts",
    description: null,
    command: null,
    outputSummary: null,
    outputContent: null,
    diffStats: null,
    status: "running",
    isNoise: false,
    isHidden: false,
    ...overrides,
  };
}

describe("ToolCardState (refactored)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("first updateFromSpec flushes immediately (no debounce)", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].specs).toHaveLength(1);
  });

  it("second updateFromSpec (same id) debounces", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    onFlush.mockClear();
    state.updateFromSpec(makeSpec({ status: "completed" }));
    expect(onFlush).not.toHaveBeenCalled();  // still in debounce
    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].specs[0].status).toBe("completed");
  });

  it("second updateFromSpec (new id) batches — debounce, not immediate", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec({ id: "t1" }));
    onFlush.mockClear();
    state.updateFromSpec(makeSpec({ id: "t2" }));
    expect(onFlush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].specs).toHaveLength(2);
  });

  it("updateFromSpec after finalize flushes immediately", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec({ id: "t1" }));
    state.finalize();
    onFlush.mockClear();
    state.updateFromSpec(makeSpec({ id: "t1", status: "completed" }));
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it("hasContent returns true when specs present", () => {
    const state = new ToolCardState({ onFlush: vi.fn() });
    expect(state.hasContent()).toBe(false);
    state.updateFromSpec(makeSpec());
    expect(state.hasContent()).toBe(true);
  });
});
```

- [ ] **Step 7.2: Run to verify fail**

```bash
pnpm test src/core/adapter-primitives/__tests__/tool-card-state.test.ts 2>&1 | tail -10
```

- [ ] **Step 7.3: Rewrite tool-card-state.ts**

```typescript
// src/core/adapter-primitives/primitives/tool-card-state.ts
import type { ToolDisplaySpec } from "../display-spec-builder.js";
import type { PlanEntry } from "../../types.js";

const DEBOUNCE_MS = 500;

export type { ToolDisplaySpec };  // re-export for consumers

export interface UsageData {
  tokensUsed?: number;
  contextSize?: number;
  cost?: number;
}

export interface ToolCardSnapshot {
  specs: ToolDisplaySpec[];
  planEntries?: PlanEntry[];
  usage?: UsageData;
  totalVisible: number;
  completedVisible: number;
  allComplete: boolean;
}

export interface ToolCardStateConfig {
  onFlush: (snapshot: ToolCardSnapshot) => void;
}

const DONE_STATUSES = new Set(["completed", "done", "failed", "error"]);

export class ToolCardState {
  private specs: ToolDisplaySpec[] = [];
  private planEntries?: PlanEntry[];
  private usage?: UsageData;
  private finalized = false;
  private isFirstFlush = true;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private onFlush: (snapshot: ToolCardSnapshot) => void;

  constructor(config: ToolCardStateConfig) {
    this.onFlush = config.onFlush;
  }

  /** Add or update a spec. First add = immediate flush; updates/additions = debounced. */
  updateFromSpec(spec: ToolDisplaySpec): void {
    const existingIdx = this.specs.findIndex((s) => s.id === spec.id);
    if (existingIdx >= 0) {
      this.specs[existingIdx] = spec;
    } else {
      this.specs.push(spec);
    }

    if (this.finalized) {
      // Post-finalize update (late tool status completion) — flush immediately
      this.onFlush(this.snapshot());
      return;
    }

    if (this.isFirstFlush) {
      this.isFirstFlush = false;
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  updatePlan(entries: PlanEntry[]): void {
    if (this.finalized) return;
    this.planEntries = entries;
    if (this.specs.length === 0 && this.isFirstFlush) {
      this.isFirstFlush = false;
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  appendUsage(usage: UsageData): void {
    if (this.finalized) return;
    this.usage = usage;
    this.scheduleFlush();
  }

  finalize(): void {
    if (this.finalized) return;
    this.finalized = true;
    this.clearDebounce();
    this.flush();
  }

  destroy(): void {
    this.finalized = true;
    this.clearDebounce();
  }

  hasContent(): boolean {
    return this.specs.length > 0 || this.planEntries !== undefined;
  }

  private snapshot(): ToolCardSnapshot {
    const visible = this.specs.filter((s) => !s.isHidden);
    const completedVisible = visible.filter((s) => DONE_STATUSES.has(s.status)).length;
    const allComplete = visible.length > 0 && completedVisible === visible.length;
    return {
      specs: this.specs,
      planEntries: this.planEntries,
      usage: this.usage,
      totalVisible: visible.length,
      completedVisible,
      allComplete,
    };
  }

  private flush(): void {
    this.clearDebounce();
    this.onFlush(this.snapshot());
  }

  private scheduleFlush(): void {
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.flush();
    }, DEBOUNCE_MS);
  }

  private clearDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }
}
```

- [ ] **Step 7.4: Run tests**

```bash
pnpm test src/core/adapter-primitives/__tests__/tool-card-state.test.ts 2>&1 | tail -15
```

Expected: all PASS.

- [ ] **Step 7.5: Build (expect type errors in activity.ts — will fix in Task 9)**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

Expected: errors only in files that use the old `ToolCardEntry` / `ToolCardSnapshot.entries` API (`activity.ts`, `formatting.ts`). That's fine — they're fixed in Tasks 8 and 9.

- [ ] **Step 7.6: Commit**

```bash
git add src/core/adapter-primitives/primitives/tool-card-state.ts src/core/adapter-primitives/__tests__/tool-card-state.test.ts
git commit -m "feat(output-mode): refactor ToolCardState to store ToolDisplaySpec[] via updateFromSpec()"
```

---

## Task 8: Telegram Formatting — renderToolCard from ToolDisplaySpec[]

**Files:**
- Modify: `src/plugins/telegram/formatting.ts`

- [ ] **Step 8.1: Write failing tests for new renderToolCard and splitToolCardText fix**

```typescript
// src/plugins/telegram/__tests__/formatting.test.ts (create or append)
import { describe, it, expect } from "vitest";
import { renderToolCard, splitToolCardText } from "../formatting.js";
import type { ToolCardSnapshot } from "../../core/adapter-primitives/primitives/tool-card-state.js";
import type { ToolDisplaySpec } from "../../core/adapter-primitives/display-spec-builder.js";

function makeSpec(overrides: Partial<ToolDisplaySpec> = {}): ToolDisplaySpec {
  return {
    id: "t1",
    icon: "📖",
    title: "Read foo.ts",
    description: null,
    command: null,
    outputSummary: null,
    outputContent: null,
    diffStats: null,
    status: "completed",
    isNoise: false,
    isHidden: false,
    ...overrides,
  };
}

function makeSnap(specs: ToolDisplaySpec[], extra: Partial<ToolCardSnapshot> = {}): ToolCardSnapshot {
  const visible = specs.filter((s) => !s.isHidden);
  const done = visible.filter((s) => ["completed","done","failed","error"].includes(s.status)).length;
  return {
    specs,
    totalVisible: visible.length,
    completedVisible: done,
    allComplete: visible.length > 0 && done === visible.length,
    ...extra,
  };
}

describe("renderToolCard from ToolDisplaySpec[]", () => {
  it("renders icon + title for low-mode spec (no description)", () => {
    const snap = makeSnap([makeSpec({ title: "Read foo.ts" })]);
    const html = renderToolCard(snap);
    expect(html).toContain("📖");
    expect(html).toContain("Read foo.ts");
  });

  it("renders description on medium spec", () => {
    const snap = makeSnap([makeSpec({ description: "List files", status: "completed" })]);
    const html = renderToolCard(snap);
    expect(html).toContain("List files");
  });

  it("renders command on medium spec", () => {
    const snap = makeSnap([makeSpec({ command: "pnpm build", status: "completed" })]);
    const html = renderToolCard(snap);
    expect(html).toContain("pnpm build");
  });

  it("renders outputSummary on medium spec", () => {
    const snap = makeSnap([makeSpec({ outputSummary: "47 lines of output", status: "completed" })]);
    const html = renderToolCard(snap);
    expect(html).toContain("47 lines of output");
  });

  it("renders outputContent inline on high spec", () => {
    const snap = makeSnap([makeSpec({ outputContent: "Done in 2.5s", status: "completed" })]);
    const html = renderToolCard(snap);
    expect(html).toContain("Done in 2.5s");
  });

  it("renders viewer link buttons", () => {
    const spec = makeSpec({ viewerLinks: { file: "https://t.me/view/123" }, status: "completed" });
    const html = renderToolCard(makeSnap([spec]));
    expect(html).toContain("https://t.me/view/123");
  });

  it("does not render hidden specs", () => {
    const snap = makeSnap([makeSpec({ isHidden: true, title: "HiddenTool" })]);
    const html = renderToolCard(snap);
    expect(html).not.toContain("HiddenTool");
  });

  it("renders diffStats on medium spec", () => {
    const spec = makeSpec({ diffStats: { added: 10, removed: 3 }, status: "completed" });
    const html = renderToolCard(makeSnap([spec]));
    expect(html).toContain("+10");
  });
});

describe("splitToolCardText — single section > 4096 fix", () => {
  it("handles single section larger than 4096 chars", () => {
    const bigSection = "x".repeat(5000);
    const chunks = splitToolCardText(bigSection);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBeLessThanOrEqual(4096);
    expect(chunks[0]).toMatch(/\.\.\.$/);
  });

  it("splits at section boundaries before hitting limit", () => {
    const section1 = "A".repeat(3000);
    const section2 = "B".repeat(3000);
    const text = `${section1}\n\n${section2}`;
    const chunks = splitToolCardText(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(section1);
    expect(chunks[1]).toBe(section2);
  });
});
```

- [ ] **Step 8.2: Run to verify fail**

```bash
pnpm test src/plugins/telegram/__tests__/formatting.test.ts 2>&1 | tail -10
```

- [ ] **Step 8.3: Update renderToolCard in formatting.ts**

Replace the existing `renderToolCard` function (and its `ToolCardSnapshot` import) with:

```typescript
// src/plugins/telegram/formatting.ts
// Update import from tool-card-state:
import type { ToolCardSnapshot } from "../../core/adapter-primitives/primitives/tool-card-state.js";
import type { ToolDisplaySpec } from "../../core/adapter-primitives/display-spec-builder.js";

// Replace renderToolCard function:
export function renderToolCard(snap: ToolCardSnapshot): string {
  const sections: string[] = [];

  // Header
  const { totalVisible, completedVisible, allComplete } = snap;
  const headerCheck = allComplete ? " ✅" : "";
  if (totalVisible > 0) {
    sections.push(
      `<b>📋 Tools (${completedVisible}/${totalVisible})</b>${headerCheck}`,
    );
  }

  const visible = snap.specs.filter((s) => !s.isHidden);
  const DONE = new Set(["completed", "done", "failed", "error"]);
  const completed = visible.filter((s) => DONE.has(s.status));
  const running = visible.filter((s) => !DONE.has(s.status));

  for (const spec of completed) {
    sections.push(renderSpecSection(spec));
  }

  // Plan section
  if (snap.planEntries && snap.planEntries.length > 0) {
    const planDone = snap.planEntries.filter((e) => e.status === "completed").length;
    const planTotal = snap.planEntries.length;
    sections.push(`── Plan: ${planDone}/${planTotal} ──`);
    const statusIcon: Record<string, string> = { completed: "✅", in_progress: "🔄", pending: "⬜" };
    for (let i = 0; i < snap.planEntries.length; i++) {
      const e = snap.planEntries[i];
      sections.push(`${statusIcon[e.status] ?? "⬜"} ${i + 1}. ${escapeHtml(e.content)}`);
    }
    sections.push("────");
  }

  for (const spec of running) {
    sections.push(renderSpecSection(spec));
  }

  return sections.join("\n\n");
}

function renderSpecSection(spec: ToolDisplaySpec): string {
  const lines: string[] = [];

  // Line 1: icon + title (+ diffStats if present)
  const DONE = new Set(["completed", "done", "failed", "error"]);
  const statusSuffix = DONE.has(spec.status) ? " ✅" : spec.status === "error" || spec.status === "failed" ? " ❌" : "";
  let titleLine = `${spec.icon} ${escapeHtml(spec.title)}${statusSuffix}`;
  if (spec.diffStats) {
    const { added, removed } = spec.diffStats;
    if (added > 0 && removed > 0) titleLine += ` · <i>+${added}/-${removed} lines</i>`;
    else if (added > 0) titleLine += ` · <i>+${added} lines</i>`;
    else if (removed > 0) titleLine += ` · <i>-${removed} lines</i>`;
  }
  lines.push(titleLine);

  // Description (medium+)
  if (spec.description) {
    lines.push(`   <i>${escapeHtml(spec.description)}</i>`);
  }

  // Command (medium+, execute kind)
  if (spec.command) {
    lines.push(`   <code>${escapeHtml(spec.command)}</code>`);
  }

  // Output summary (medium+)
  if (spec.outputSummary) {
    lines.push(`   · ${escapeHtml(spec.outputSummary)}`);
  }

  // Inline output (high, short)
  if (spec.outputContent) {
    const truncated = spec.outputContent.length > 800
      ? spec.outputContent.slice(0, 797) + "…"
      : spec.outputContent;
    lines.push(`   <pre><code>${escapeHtml(truncated)}</code></pre>`);
  }

  // Viewer links
  if (spec.viewerLinks?.file || spec.viewerLinks?.diff || spec.outputViewerLink) {
    const linkParts: string[] = [];
    if (spec.viewerLinks?.file) {
      linkParts.push(`📄 <a href="${escapeHtml(spec.viewerLinks.file)}">View file</a>`);
    }
    if (spec.viewerLinks?.diff) {
      linkParts.push(`📝 <a href="${escapeHtml(spec.viewerLinks.diff)}">View diff</a>`);
    }
    if (spec.outputViewerLink) {
      linkParts.push(`📋 <a href="${escapeHtml(spec.outputViewerLink)}">View output</a>`);
    }
    lines.push(`   ${linkParts.join("\n   ")}`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 8.4: Fix splitToolCardText bug**

```typescript
// src/plugins/telegram/formatting.ts — replace splitToolCardText
export function splitToolCardText(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) return [text];

  const sections = text.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const section of sections) {
    // FIX: handle single section > limit (truncate with ellipsis)
    const safeSection =
      section.length > TELEGRAM_MAX_LENGTH
        ? section.slice(0, TELEGRAM_MAX_LENGTH - 3) + "..."
        : section;

    const candidate = current ? `${current}\n\n${safeSection}` : safeSection;
    if (candidate.length > TELEGRAM_MAX_LENGTH && current) {
      chunks.push(current);
      current = safeSection;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
```

- [ ] **Step 8.5: Run tests**

```bash
pnpm test src/plugins/telegram/__tests__/formatting.test.ts 2>&1 | tail -15
```

Expected: all PASS.

- [ ] **Step 8.6: Commit**

```bash
git add src/plugins/telegram/formatting.ts src/plugins/telegram/__tests__/formatting.test.ts
git commit -m "feat(output-mode): update renderToolCard for ToolDisplaySpec[], fix splitToolCardText overflow bug"
```

---

## Task 9: ActivityTracker Integration

Wires `ToolStateMap` + `DisplaySpecBuilder` into `ActivityTracker` and `ToolCard`.

**Files:**
- Modify: `src/plugins/telegram/activity.ts`

- [ ] **Step 9.1: Rewrite ToolCard in activity.ts to use updateFromSpec**

`ToolCard` no longer calls `addTool`/`updateTool` — it calls `updateFromSpec`. Add `InputFile` to the grammy import at top of file:

```typescript
// src/plugins/telegram/activity.ts — update grammy import line
import { Bot, InputFile } from "grammy";
```

Update the ToolCard class:

```typescript
// src/plugins/telegram/activity.ts — replace ToolCard class

import type { ToolDisplaySpec } from "../../core/adapter-primitives/display-spec-builder.js";

export class ToolCard {
  private state: ToolCardState;
  private msgId?: number;
  private lastSentText?: string;
  private flushPromise: Promise<void> = Promise.resolve();
  private overflowMsgIds: number[] = [];
  private tracer: DebugTracer | null;
  private sessionId: string;

  constructor(
    private api: Bot["api"],
    private chatId: number,
    private threadId: number,
    private sendQueue: SendQueue,
    sessionId: string = "",
    tracer: DebugTracer | null = null,
  ) {
    this.tracer = tracer;
    this.sessionId = sessionId;
    this.state = new ToolCardState({
      onFlush: (snapshot) => {
        this.flushPromise = this.flushPromise
          .then(() => this._sendOrEdit(snapshot))
          .catch(() => {});
      },
    });
  }

  updateFromSpec(spec: ToolDisplaySpec): void {
    this.state.updateFromSpec(spec);
  }

  updatePlan(entries: PlanEntry[]): void {
    this.state.updatePlan(entries);
  }

  appendUsage(usage: { tokensUsed?: number; contextSize?: number; cost?: number }): void {
    this.state.appendUsage(usage);
  }

  async finalize(): Promise<void> {
    this.state.finalize();
    await this.flushPromise;
  }

  destroy(): void {
    this.state.destroy();
  }

  hasContent(): boolean {
    return this.state.hasContent();
  }

  getMsgId(): number | undefined {
    return this.msgId;
  }

  private async _sendOrEdit(snapshot: ToolCardSnapshot): Promise<void> {
    // Check if all specs have outputFallbackContent to send as document
    for (const spec of snapshot.specs) {
      if (spec.outputFallbackContent && !spec.outputViewerLink) {
        const buf = Buffer.from(spec.outputFallbackContent, "utf8");
        await this.sendQueue.enqueue(() =>
          this.api.sendDocument(this.chatId, new InputFile(buf, "output.txt"), {
            message_thread_id: this.threadId,
            caption: `📎 ${spec.title} output`,
            disable_notification: true,
          }),
        ).catch(() => {});
      }
    }

    // Overflow strip: if full render exceeds Telegram limit, strip inline outputContent
    // from all specs (they already have outputSummary; outputFallbackContent was sent above).
    let snapshotToRender = snapshot;
    let fullText = renderToolCard(snapshotToRender);
    if (fullText.length > 4096) {
      snapshotToRender = {
        ...snapshot,
        specs: snapshot.specs.map((s) =>
          s.outputContent ? { ...s, outputContent: null } : s
        ),
      };
      fullText = renderToolCard(snapshotToRender);
    }

    if (!fullText) return;
    if (this.msgId && fullText === this.lastSentText) return;
    this.lastSentText = fullText;

    const chunks = splitToolCardText(fullText);
    this.tracer?.log("telegram", { action: "toolCard:render", sessionId: this.sessionId, chunks: chunks.length, total: snapshot.totalVisible, completed: snapshot.completedVisible, allComplete: snapshot.allComplete, msgId: this.msgId });

    try {
      const firstChunk = chunks[0];
      if (this.msgId) {
        await this.sendQueue.enqueue(() =>
          this.api.editMessageText(this.chatId, this.msgId!, firstChunk, { parse_mode: "HTML" }),
        );
      } else {
        const result = await this.sendQueue.enqueue(() =>
          this.api.sendMessage(this.chatId, firstChunk, {
            message_thread_id: this.threadId,
            parse_mode: "HTML",
            disable_notification: true,
          }),
        );
        if (result) this.msgId = result.message_id;
      }

      for (let i = 1; i < chunks.length; i++) {
        const overflowIdx = i - 1;
        if (overflowIdx < this.overflowMsgIds.length) {
          await this.sendQueue.enqueue(() =>
            this.api.editMessageText(this.chatId, this.overflowMsgIds[overflowIdx], chunks[i], { parse_mode: "HTML" }),
          );
        } else {
          const result = await this.sendQueue.enqueue(() =>
            this.api.sendMessage(this.chatId, chunks[i], {
              message_thread_id: this.threadId,
              parse_mode: "HTML",
              disable_notification: true,
            }),
          );
          if (result) this.overflowMsgIds.push(result.message_id);
        }
      }
    } catch (err) {
      log.warn({ err }, "[ToolCard] send/edit failed");
    }
  }
}
```

- [ ] **Step 9.2: Rewrite ActivityTracker in activity.ts to use ToolStateMap + DisplaySpecBuilder**

Key changes to `ActivityTracker`:
1. Constructor takes `outputMode` instead of `verbosity`
2. Holds a `ToolStateMap` and `DisplaySpecBuilder`
3. `onToolCall` and `onToolUpdate` use the new flow
4. `onToolUpdate` accepts `content` parameter (new)
5. `sealToolCardIfNeeded` creates fresh `ToolStateMap` alongside fresh `ToolCard`

```typescript
// src/plugins/telegram/activity.ts — rewrite ActivityTracker

import { ToolStateMap, ThoughtBuffer } from "../../core/adapter-primitives/stream-accumulator.js";
import { DisplaySpecBuilder } from "../../core/adapter-primitives/display-spec-builder.js";
import type { OutputMode } from "../../core/adapter-primitives/format-types.js";
import type { SessionContext } from "../../core/adapter-primitives/display-spec-builder.js";

export class ActivityTracker {
  private isFirstEvent = true;
  private thinking: ThinkingIndicator;
  private toolCard: ToolCard;
  private previousToolCard?: ToolCard;
  private toolStateMap: ToolStateMap;
  private previousToolStateMap?: ToolStateMap;
  private specBuilder: DisplaySpecBuilder;
  private thoughtBuffer: ThoughtBuffer;
  private outputMode: OutputMode;
  private tracer: DebugTracer | null;
  private sessionId: string;
  private sessionContext?: SessionContext;

  constructor(
    private api: Bot["api"],
    private chatId: number,
    private threadId: number,
    private sendQueue: SendQueue,
    outputMode: OutputMode = "medium",
    sessionId: string = "",
    tracer: DebugTracer | null = null,
    tunnelService?: import("../../core/plugin/types.js").TunnelServiceInterface,
    sessionContext?: SessionContext,
  ) {
    this.outputMode = outputMode;
    this.tracer = tracer;
    this.sessionId = sessionId;
    this.sessionContext = sessionContext;
    this.specBuilder = new DisplaySpecBuilder(tunnelService);
    this.toolStateMap = new ToolStateMap();
    this.thoughtBuffer = new ThoughtBuffer();
    this.thinking = new ThinkingIndicator(api, chatId, threadId, sendQueue, sessionId, tracer);
    this.toolCard = new ToolCard(api, chatId, threadId, sendQueue, sessionId, tracer);
  }

  async onNewPrompt(): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:newPrompt", sessionId: this.sessionId });
    this.isFirstEvent = true;
    this.thoughtBuffer.reset();
    await this.thinking.dismiss();
    this.thinking.reset();
    await this.toolCard.finalize();
    this.toolStateMap.clear();
    this.toolCard = new ToolCard(this.api, this.chatId, this.threadId, this.sendQueue, this.sessionId, this.tracer);
  }

  async onThought(text: string): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:thought", sessionId: this.sessionId });
    this.isFirstEvent = false;
    if (!this.thoughtBuffer.isSealed()) this.thoughtBuffer.append(text);
    await this.sealToolCardIfNeeded();
    await this.thinking.show();
  }

  async onTextStart(): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:textStart", sessionId: this.sessionId });
    this.isFirstEvent = false;
    this.thoughtBuffer.seal();
    await this.thinking.dismiss();
    await this.sealToolCardIfNeeded();
  }

  async onToolCall(
    meta: import("../../core/adapter-primitives/format-types.js").ToolCallMeta,
    kind: string,
    rawInput: unknown,
  ): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:toolCall", sessionId: this.sessionId, toolId: meta.id, toolName: meta.name });
    this.isFirstEvent = false;
    await this.thinking.dismiss();
    this.thinking.reset();

    const entry = this.toolStateMap.upsert(meta, kind, rawInput);
    const spec = this.specBuilder.buildToolSpec(entry, this.outputMode, this.sessionContext);
    this.toolCard.updateFromSpec(spec);
  }

  async onToolUpdate(
    id: string,
    status: string,
    viewerLinks?: ViewerLinks,
    viewerFilePath?: string,
    content?: string | null,
    rawInput?: unknown,
    diffStats?: { added: number; removed: number },
  ): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:toolUpdate", sessionId: this.sessionId, toolId: id, status });

    const existed = !!this.toolStateMap.get(id);
    const entry = this.toolStateMap.merge(id, status, rawInput, content, viewerLinks, diffStats);
    // Skip spec build for out-of-order updates (tool_call not yet received).
    // The buffered update will be applied automatically when upsert() is called.
    if (!existed) return;

    const spec = this.specBuilder.buildToolSpec(entry, this.outputMode, this.sessionContext);
    this.toolCard.updateFromSpec(spec);
    this.previousToolCard?.updateFromSpec(spec);
    this.previousToolStateMap?.merge(id, status, rawInput, content, viewerLinks, diffStats);
  }

  async onPlan(entries: PlanEntry[]): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:plan", sessionId: this.sessionId });
    this.isFirstEvent = false;
    await this.thinking.dismiss();
    this.toolCard.updatePlan(entries);
  }

  async sendUsage(_usage: { tokensUsed?: number; contextSize?: number; cost?: number }): Promise<void> {
    // no-op — adapter sends usage as standalone message
  }

  getToolCardMsgId(): number | undefined {
    return this.toolCard.getMsgId();
  }

  async cleanup(): Promise<void> {
    await this.thinking.dismiss();
    await this.toolCard.finalize();
    this.toolCard.destroy();
  }

  destroy(): void {
    void this.thinking.dismiss();
    this.toolCard.destroy();
  }

  private async sealToolCardIfNeeded(): Promise<void> {
    if (!this.toolCard.hasContent()) return;
    this.tracer?.log("telegram", { action: "tracker:seal", sessionId: this.sessionId });
    await this.toolCard.finalize();
    this.previousToolCard = this.toolCard;
    this.previousToolStateMap = this.toolStateMap;
    this.toolStateMap = new ToolStateMap();
    this.toolCard = new ToolCard(this.api, this.chatId, this.threadId, this.sendQueue, this.sessionId, this.tracer);
  }
}
```

- [ ] **Step 9.3: Build to check progress**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

Expected: errors only in `adapter.ts` (calls old `tracker.onToolCall(meta, kind, rawInput)` signature — still matching, but `verbosity` → `outputMode` constructor change needs fixing there). Fix those in Task 10.

- [ ] **Step 9.4: Commit**

```bash
git add src/plugins/telegram/activity.ts
git commit -m "feat(output-mode): integrate ToolStateMap + DisplaySpecBuilder into ActivityTracker"
```

---

## Task 10: TelegramAdapter — Filter Before Queue + OutputModeResolver

**Files:**
- Modify: `src/plugins/telegram/adapter.ts`

- [ ] **Step 10.1: Add OutputModeResolver and update getOrCreateTracker**

At the top of TelegramAdapter class (or in constructor), add the resolver:

```typescript
// In adapter.ts — add import:
import { OutputModeResolver } from "../../core/adapter-primitives/output-mode-resolver.js";
import type { OutputMode } from "../../core/adapter-primitives/format-types.js";

// In TelegramAdapter class, add field:
private outputModeResolver = new OutputModeResolver();
```

- [ ] **Step 10.2: Update getOrCreateTracker to accept OutputMode**

Find `getOrCreateTracker(sessionId, threadId, verbosity)` and update its signature to use `OutputMode`:

```typescript
private getOrCreateTracker(
  sessionId: string,
  threadId: number,
  outputMode: OutputMode,
): ActivityTracker {
  if (!this._trackers.has(sessionId)) {
    const tunnelService = this.core.serviceRegistry.get("tunnel") as TunnelServiceInterface | undefined;
    const session = this.core.sessionManager.getSession(sessionId);
    const sessionContext = session ? {
      id: sessionId,
      workingDirectory: session.workingDirectory,
    } : undefined;
    this._trackers.set(
      sessionId,
      new ActivityTracker(
        this.bot.api,
        this.telegramConfig.chatId,
        threadId,
        this.sendQueue,
        outputMode,
        sessionId,
        this.getTracer(sessionId),
        tunnelService,
        sessionContext,
      ),
    );
  }
  return this._trackers.get(sessionId)!;
}
```

- [ ] **Step 10.3: Override sendMessage to filter before serial queue**

Replace `TelegramAdapter.sendMessage()` override (or add one if it doesn't exist) with the pre-queue filter:

```typescript
override async sendMessage(
  sessionId: string,
  content: OutgoingMessage,
): Promise<void> {
  // Fast exit checks BEFORE entering serial queue
  if (this.assistantInitializing && sessionId === this.assistantSession?.id) return;
  const session = this.core.sessionManager.getSession(sessionId);
  if (!session || (session as any).archiving) return;

  // Resolve mode via cascade (global → adapter → session)
  const mode = this.outputModeResolver.resolve(
    this.context.configManager,
    this.name,
    sessionId,
    this.core.sessionManager as any,
  );

  // Filter BEFORE enqueuing — noise and hidden-on-mode messages never enter queue
  if (!this.shouldDisplay(content, mode)) return;

  const threadId = this.getThreadId(sessionId);
  if (!threadId || isNaN(threadId)) return;

  const prev = this._dispatchQueues.get(sessionId) ?? Promise.resolve();
  const next = prev
    .then(async () => {
      this._sessionThreadIds.set(sessionId, threadId);
      try {
        await this.dispatchMessage(sessionId, content, mode);
      } finally {
        this._sessionThreadIds.delete(sessionId);
      }
    })
    .catch((err) => log.warn({ err, sessionId }, "Dispatch queue error"));

  this._dispatchQueues.set(sessionId, next);
  await next;
}
```

- [ ] **Step 10.4: Update handleToolUpdate to pass content through**

```typescript
// In TelegramAdapter.handleToolUpdate — update the tracker.onToolUpdate call:
await tracker.onToolUpdate(
  meta.id ?? "",
  meta.status ?? "completed",
  meta.viewerLinks as { file?: string; diff?: string } | undefined,
  meta.viewerFilePath as string | undefined,
  typeof meta.content === "string" ? meta.content : null,  // NEW: output text
  meta.rawInput ?? undefined,                               // NEW: rawInput from update
  (meta as any).diffStats as { added: number; removed: number } | undefined,  // NEW: diffStats
);
```

- [ ] **Step 10.5: Update all handleToolCall/handleToolUpdate/handleThought calls to use `mode` instead of `verbosity`**

Search for uses of `verbosity` in adapter.ts and update method signatures to use `OutputMode`:

```bash
grep -n "verbosity" src/plugins/telegram/adapter.ts | head -20
```

Update `dispatchMessage` signature in `MessagingAdapter` (base) OR override in TelegramAdapter to use `OutputMode`. The base class uses `DisplayVerbosity` which is now aliased to `OutputMode`, so this may not require changes — verify with build.

- [ ] **Step 10.6: Build to verify clean**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

Expected: clean build or minimal remaining errors.

- [ ] **Step 10.7: Commit**

```bash
git add src/plugins/telegram/adapter.ts
git commit -m "feat(output-mode): filter before serial queue, OutputModeResolver cascade, pass content through tool updates"
```

---

## Task 11: /outputmode Command

**Files:**
- Modify: `src/plugins/telegram/commands/admin.ts`
- Modify: `src/plugins/telegram/commands/index.ts`

- [ ] **Step 11.1: Add handleOutputMode to admin.ts**

```typescript
// src/plugins/telegram/commands/admin.ts — add after handleVerbosity

const OUTPUT_MODE_LABELS: Record<string, string> = {
  low: "🔇 Low",
  medium: "📊 Medium",
  high: "🔍 High",
};

export async function handleOutputMode(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  const arg0 = args[0]?.toLowerCase();
  const arg1 = args[1]?.toLowerCase();

  // /outputmode session [low|medium|high|reset]
  if (arg0 === "session") {
    const chatId = ctx.chat?.id;
    const threadId = ctx.message?.message_thread_id;
    if (!chatId || threadId === undefined) {
      await ctx.reply("⚠️ This command must be used in a session topic.", { parse_mode: "HTML" });
      return;
    }

    const session = core.sessionManager.getSessionByThread(
      "telegram",
      String(threadId),
    );

    if (!session) {
      await ctx.reply("⚠️ No active session found for this topic.", { parse_mode: "HTML" });
      return;
    }

    if (arg1 === "reset") {
      await core.sessionManager.patchRecord(session.id, { outputMode: undefined });
      await ctx.reply("🔄 Session output mode reset to adapter default.", { parse_mode: "HTML" });
    } else if (arg1 === "low" || arg1 === "medium" || arg1 === "high") {
      await core.sessionManager.patchRecord(session.id, { outputMode: arg1 });
      await ctx.reply(
        `${OUTPUT_MODE_LABELS[arg1]} Session output mode set to <b>${arg1}</b>.`,
        { parse_mode: "HTML" },
      );
    } else {
      const record = core.sessionManager.getSessionRecord(session.id);
      const current = record?.outputMode ?? "(adapter default)";
      await ctx.reply(
        `📊 Session output mode: <b>${current}</b>\n\nUsage: <code>/outputmode session low|medium|high|reset</code>`,
        { parse_mode: "HTML" },
      );
    }
    return;
  }

  // /outputmode [low|medium|high] — adapter-level
  if (arg0 === "low" || arg0 === "medium" || arg0 === "high") {
    await core.configManager.save(
      { channels: { telegram: { outputMode: arg0 } } },
      "channels.telegram.outputMode",
    );
    await ctx.reply(
      `${OUTPUT_MODE_LABELS[arg0]} Output mode set to <b>${arg0}</b>.`,
      { parse_mode: "HTML" },
    );
  } else {
    const current =
      (
        core.configManager.get().channels?.telegram as
          | Record<string, unknown>
          | undefined
      )?.outputMode ?? "medium";
    await ctx.reply(
      `📊 Current output mode: <b>${current}</b>\n\n` +
        `Usage: <code>/outputmode low|medium|high</code>\n` +
        `Session override: <code>/outputmode session low|medium|high|reset</code>\n\n` +
        `• <b>low</b> — minimal: title only\n` +
        `• <b>medium</b> — balanced: description + output summary (default)\n` +
        `• <b>high</b> — full detail: inline output, IN/OUT blocks`,
      { parse_mode: "HTML" },
    );
  }
}
```

- [ ] **Step 11.2: Keep /verbosity as backward-compat alias**

In `handleVerbosity` (already exists), add a deprecation note at top:

```typescript
export async function handleVerbosity(ctx: Context, core: VibenCore): Promise<void> {
  // Deprecated — alias for /outputmode
  await ctx.reply("⚠️ <code>/verbosity</code> is deprecated. Use <code>/outputmode</code> instead.", { parse_mode: "HTML" });
  await handleOutputMode(ctx, core);
}
```

- [ ] **Step 11.3: Wire /outputmode in commands/index.ts**

Find where `/verbosity` is registered (likely in a `setupCommands` function) and add `/outputmode`:

```typescript
// In setupCommands or wherever bot.command() calls are made:
bot.command("outputmode", (ctx) => handleOutputMode(ctx, core));
```

Also add to the exported functions list if commands/index.ts has an explicit export.

- [ ] **Step 11.4: Add to STATIC_COMMANDS if needed**

In the file that defines `STATIC_COMMANDS`, add:
```typescript
{ command: "outputmode", description: "Control output display level (low/medium/high)" },
```

- [ ] **Step 11.5: Full build + test run**

```bash
pnpm build 2>&1 | tail -20
pnpm test 2>&1 | tail -20
```

Expected: clean build, all tests pass.

- [ ] **Step 11.6: Commit**

```bash
git add src/plugins/telegram/commands/admin.ts src/plugins/telegram/commands/index.ts
git commit -m "feat(output-mode): add /outputmode command with session-level override"
```

---

## Self-Review

After Tasks 1–11 are implemented:

- [ ] **Run full test suite**

```bash
pnpm test 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Run full build**

```bash
pnpm build 2>&1 | grep -c "error TS"
```

Expected: 0 errors.

- [ ] **Verify config migration works with old config**

```bash
node -e "
const { applyMigrations } = await import('./dist/core/config/config-migrations.js');
const raw = { channels: { telegram: { displayVerbosity: 'high' } } };
applyMigrations(raw);
console.log(raw.channels.telegram.outputMode); // should print: high
" 2>&1
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-03-30-output-mode.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
