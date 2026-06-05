# Consolidated Tool Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-tool-call messages with a single auto-updating "tool card" that consolidates tools, plan, and usage into one message per prompt turn.

**Architecture:** A shared `ToolCardState` class manages entries/plan/usage state and debounce. Each platform provides a `renderToolCard()` formatter and a thin `ToolCard` wrapper that handles send/edit via platform API. `ActivityTracker` in each plugin orchestrates the card alongside the existing `ThinkingIndicator`.

**Tech Stack:** TypeScript, Vitest, discord.js EmbedBuilder, grammY Bot API, Slack Block Kit

**Spec:** `docs/superpowers/specs/2026-03-27-consolidated-tool-card-design.md`

---

### Task 1: Update noise filtering rules

Add `grep` to noise rules and change `glob` from `collapse` to `hide`.

**Files:**
- Modify: `src/core/adapter-primitives/message-formatter.ts:171-189`
- Test: `src/core/adapter-primitives/__tests__/message-formatter.test.ts`

- [ ] **Step 1: Update noise rules**

In `src/core/adapter-primitives/message-formatter.ts`, replace the `NOISE_RULES` array:

```typescript
const NOISE_RULES: NoiseRule[] = [
  {
    match: (name) => name.toLowerCase() === "ls",
    action: "hide",
  },
  {
    match: (_name, kind, rawInput) => {
      if (kind !== "read") return false;
      const args = parseRawInput(rawInput);
      const p = String(args.file_path ?? args.filePath ?? args.path ?? "");
      return p.endsWith("/");
    },
    action: "hide",
  },
  {
    match: (name) => name.toLowerCase() === "glob",
    action: "hide",
  },
  {
    match: (name) => name.toLowerCase() === "grep",
    action: "hide",
  },
];
```

- [ ] **Step 2: Update tests for new noise rules**

In `src/core/adapter-primitives/__tests__/message-formatter.test.ts`, update existing glob test and add grep test:

```typescript
it("hides glob tool", () => {
  expect(evaluateNoise("Glob", "search", {})).toBe("hide");
});

it("hides grep tool", () => {
  expect(evaluateNoise("Grep", "search", {})).toBe("hide");
  expect(evaluateNoise("grep", "search", { pattern: "TODO" })).toBe("hide");
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- src/core/adapter-primitives/__tests__/message-formatter.test.ts`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/adapter-primitives/message-formatter.ts src/core/adapter-primitives/__tests__/message-formatter.test.ts
git commit -m "feat(formatting): add grep to noise filter, change glob to hide"
```

---

### Task 2: Create ToolCardState (shared state + debounce)

Platform-agnostic state class with entries, plan, usage, and debounce timer.

**Files:**
- Create: `src/core/adapter-primitives/primitives/tool-card-state.ts`
- Create: `src/core/adapter-primitives/primitives/__tests__/tool-card-state.test.ts`
- Modify: `src/core/adapter-primitives/primitives/index.ts`

- [ ] **Step 1: Write failing tests**

Create `src/core/adapter-primitives/primitives/__tests__/tool-card-state.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolCardState } from "../tool-card-state.js";
import type { ToolCallMeta } from "../../format-types.js";

function makeTool(id: string, name: string, overrides?: Partial<ToolCallMeta>): ToolCallMeta {
  return { id, name, status: "running", ...overrides };
}

describe("ToolCardState", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("addTool appends entry and calls onFlush", async () => {
    const onFlush = vi.fn();
    const card = new ToolCardState({ onFlush, verbosity: "medium" });

    card.addTool(makeTool("t1", "Read"), "read", { file_path: "src/main.ts" });

    // First tool should flush immediately (no debounce)
    expect(onFlush).toHaveBeenCalledTimes(1);
    const state = onFlush.mock.calls[0][0];
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].id).toBe("t1");
    expect(state.entries[0].hidden).toBe(false);

    card.destroy();
  });

  it("subsequent tools debounce 500ms", async () => {
    const onFlush = vi.fn();
    const card = new ToolCardState({ onFlush, verbosity: "medium" });

    card.addTool(makeTool("t1", "Read"), "read", { file_path: "src/a.ts" });
    expect(onFlush).toHaveBeenCalledTimes(1);

    card.addTool(makeTool("t2", "Edit"), "edit", { file_path: "src/b.ts" });
    expect(onFlush).toHaveBeenCalledTimes(1); // still 1 — debounced

    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(2);

    card.destroy();
  });

  it("updateTool changes entry status", () => {
    const onFlush = vi.fn();
    const card = new ToolCardState({ onFlush, verbosity: "medium" });

    card.addTool(makeTool("t1", "Read"), "read", { file_path: "src/a.ts" });
    card.updateTool("t1", "completed", { file: "http://example.com/file" });

    vi.advanceTimersByTime(500);
    const state = onFlush.mock.lastCall![0];
    expect(state.entries[0].status).toBe("completed");
    expect(state.entries[0].viewerLinks).toEqual({ file: "http://example.com/file" });

    card.destroy();
  });

  it("hides noise tools on low/medium verbosity", () => {
    const onFlush = vi.fn();
    const card = new ToolCardState({ onFlush, verbosity: "medium" });

    card.addTool(makeTool("t1", "ls"), "other", {});
    card.addTool(makeTool("t2", "Grep"), "search", {});
    card.addTool(makeTool("t3", "Read"), "read", { file_path: "src/a.ts" });

    vi.advanceTimersByTime(500);
    const state = onFlush.mock.lastCall![0];
    expect(state.entries[0].hidden).toBe(true);  // ls
    expect(state.entries[1].hidden).toBe(true);  // grep
    expect(state.entries[2].hidden).toBe(false);  // read

    card.destroy();
  });

  it("shows noise tools on high verbosity", () => {
    const onFlush = vi.fn();
    const card = new ToolCardState({ onFlush, verbosity: "high" });

    card.addTool(makeTool("t1", "ls"), "other", {});
    card.addTool(makeTool("t2", "Grep"), "search", {});

    vi.advanceTimersByTime(500);
    const state = onFlush.mock.lastCall![0];
    expect(state.entries[0].hidden).toBe(false);
    expect(state.entries[1].hidden).toBe(false);

    card.destroy();
  });

  it("updatePlan sets plan entries", () => {
    const onFlush = vi.fn();
    const card = new ToolCardState({ onFlush, verbosity: "medium" });

    card.addTool(makeTool("t1", "Read"), "read", { file_path: "src/a.ts" });
    card.updatePlan([
      { content: "Step 1", status: "completed", priority: "high" },
      { content: "Step 2", status: "in_progress", priority: "medium" },
    ]);

    vi.advanceTimersByTime(500);
    const state = onFlush.mock.lastCall![0];
    expect(state.planEntries).toHaveLength(2);

    card.destroy();
  });

  it("appendUsage sets usage and force flushes", () => {
    const onFlush = vi.fn();
    const card = new ToolCardState({ onFlush, verbosity: "medium" });

    card.addTool(makeTool("t1", "Read"), "read", { file_path: "src/a.ts" });
    onFlush.mockClear();

    card.appendUsage({ tokensUsed: 5000, cost: 0.05 });
    // Force flush — no debounce
    expect(onFlush).toHaveBeenCalledTimes(1);
    const state = onFlush.mock.lastCall![0];
    expect(state.usage).toEqual({ tokensUsed: 5000, cost: 0.05 });

    card.destroy();
  });

  it("finalize force flushes and prevents further updates", () => {
    const onFlush = vi.fn();
    const card = new ToolCardState({ onFlush, verbosity: "medium" });

    card.addTool(makeTool("t1", "Read"), "read", { file_path: "src/a.ts" });
    onFlush.mockClear();

    card.finalize();
    expect(onFlush).toHaveBeenCalledTimes(1);

    // Further updates ignored
    card.addTool(makeTool("t2", "Edit"), "edit", { file_path: "src/b.ts" });
    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(1); // still 1

    card.destroy();
  });

  it("visibleCount excludes hidden tools", () => {
    const onFlush = vi.fn();
    const card = new ToolCardState({ onFlush, verbosity: "medium" });

    card.addTool(makeTool("t1", "ls"), "other", {});
    card.addTool(makeTool("t2", "Read"), "read", { file_path: "src/a.ts" });
    card.addTool(makeTool("t3", "Glob"), "search", {});
    card.addTool(makeTool("t4", "Edit"), "edit", { file_path: "src/b.ts" });

    vi.advanceTimersByTime(500);
    const state = onFlush.mock.lastCall![0];
    expect(state.visibleCount).toBe(2);
    expect(state.totalVisible).toBe(2);

    card.destroy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/adapter-primitives/primitives/__tests__/tool-card-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ToolCardState**

Create `src/core/adapter-primitives/primitives/tool-card-state.ts`:

```typescript
import type { ToolCallMeta, ViewerLinks, DisplayVerbosity } from "../format-types.js";
import type { PlanEntry } from "../../../core/types.js";
import { evaluateNoise, formatToolSummary, resolveToolIcon } from "../message-formatter.js";

const DEBOUNCE_MS = 500;

export interface ToolCardEntry {
  id: string;
  name: string;
  kind?: string;
  status: string;
  icon: string;
  label: string;
  viewerLinks?: ViewerLinks;
  viewerFilePath?: string;
  hidden: boolean;
}

export interface UsageData {
  tokensUsed?: number;
  contextSize?: number;
  cost?: number;
}

export interface ToolCardSnapshot {
  entries: ToolCardEntry[];
  planEntries?: PlanEntry[];
  usage?: UsageData;
  visibleCount: number;
  totalVisible: number;
  completedVisible: number;
  allComplete: boolean;
  verbosity: DisplayVerbosity;
}

export interface ToolCardStateConfig {
  onFlush: (snapshot: ToolCardSnapshot) => void;
  verbosity: DisplayVerbosity;
}

export class ToolCardState {
  private entries: ToolCardEntry[] = [];
  private planEntries?: PlanEntry[];
  private usage?: UsageData;
  private finalized = false;
  private isFirstFlush = true;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private verbosity: DisplayVerbosity;
  private onFlush: (snapshot: ToolCardSnapshot) => void;

  constructor(config: ToolCardStateConfig) {
    this.verbosity = config.verbosity;
    this.onFlush = config.onFlush;
  }

  addTool(meta: ToolCallMeta, kind: string, rawInput: unknown): void {
    if (this.finalized) return;

    const hidden = this.verbosity !== "high" && evaluateNoise(meta.name, kind, rawInput) !== null;
    const entry: ToolCardEntry = {
      id: meta.id,
      name: meta.name,
      kind,
      status: meta.status ?? "running",
      icon: resolveToolIcon({ status: meta.status ?? "running", kind }),
      label: formatToolSummary(meta.name, rawInput, meta.displaySummary),
      viewerLinks: meta.viewerLinks,
      viewerFilePath: meta.viewerFilePath,
      hidden,
    };
    this.entries.push(entry);

    if (this.isFirstFlush) {
      this.isFirstFlush = false;
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  updateTool(id: string, status: string, viewerLinks?: ViewerLinks, viewerFilePath?: string): void {
    if (this.finalized) return;

    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return;

    entry.status = status;
    entry.icon = resolveToolIcon({ status, kind: entry.kind });
    if (viewerLinks) entry.viewerLinks = viewerLinks;
    if (viewerFilePath) entry.viewerFilePath = viewerFilePath;

    this.scheduleFlush();
  }

  updatePlan(entries: PlanEntry[]): void {
    if (this.finalized) return;
    this.planEntries = entries;

    if (this.entries.length === 0 && this.isFirstFlush) {
      this.isFirstFlush = false;
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  appendUsage(usage: UsageData): void {
    if (this.finalized) return;
    this.usage = usage;
    this.flush();
  }

  finalize(): void {
    if (this.finalized) return;
    this.finalized = true;
    this.clearDebounce();
    this.flush();
  }

  destroy(): void {
    this.clearDebounce();
  }

  hasContent(): boolean {
    return this.entries.length > 0 || this.planEntries !== undefined;
  }

  private snapshot(): ToolCardSnapshot {
    const visible = this.entries.filter((e) => !e.hidden);
    const completedVisible = visible.filter((e) => e.status === "completed" || e.status === "done").length;
    const allComplete = visible.length > 0 && completedVisible === visible.length;

    return {
      entries: this.entries,
      planEntries: this.planEntries,
      usage: this.usage,
      visibleCount: visible.length,
      totalVisible: visible.length,
      completedVisible,
      allComplete,
      verbosity: this.verbosity,
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

- [ ] **Step 4: Export from index**

In `src/core/adapter-primitives/primitives/index.ts`, add:

```typescript
export { ToolCardState, type ToolCardSnapshot, type ToolCardEntry, type UsageData, type ToolCardStateConfig } from './tool-card-state.js'
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- src/core/adapter-primitives/primitives/__tests__/tool-card-state.test.ts`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/adapter-primitives/primitives/tool-card-state.ts src/core/adapter-primitives/primitives/__tests__/tool-card-state.test.ts src/core/adapter-primitives/primitives/index.ts
git commit -m "feat: add ToolCardState for consolidated tool card"
```

---

### Task 3: Add renderToolCard to Discord formatting

Pure rendering function — takes a `ToolCardSnapshot`, returns markdown string.

**Files:**
- Modify: `src/plugins/discord/formatting.ts`
- Test: `src/plugins/discord/__tests__/formatting.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/plugins/discord/__tests__/formatting.test.ts`:

```typescript
import { renderToolCard } from "../formatting.js";
import type { ToolCardSnapshot, ToolCardEntry } from "../../../core/adapter-primitives/primitives/tool-card-state.js";

function makeEntry(id: string, overrides?: Partial<ToolCardEntry>): ToolCardEntry {
  return {
    id,
    name: "Read",
    status: "completed",
    icon: "✅",
    label: "📖 Read src/main.ts",
    hidden: false,
    ...overrides,
  };
}

function makeSnapshot(overrides?: Partial<ToolCardSnapshot>): ToolCardSnapshot {
  return {
    entries: [],
    visibleCount: 0,
    totalVisible: 0,
    completedVisible: 0,
    allComplete: false,
    verbosity: "medium",
    ...overrides,
  };
}

describe("renderToolCard", () => {
  it("renders header with progress", () => {
    const snap = makeSnapshot({
      entries: [makeEntry("t1"), makeEntry("t2", { status: "running", icon: "🔄" })],
      visibleCount: 2,
      totalVisible: 2,
      completedVisible: 1,
    });
    const result = renderToolCard(snap);
    expect(result).toContain("**📋 Tools (1/2)**");
  });

  it("renders completed header with checkmark", () => {
    const snap = makeSnapshot({
      entries: [makeEntry("t1")],
      visibleCount: 1,
      totalVisible: 1,
      completedVisible: 1,
      allComplete: true,
    });
    const result = renderToolCard(snap);
    expect(result).toContain("**📋 Tools (1/1)** ✅");
  });

  it("skips hidden entries", () => {
    const snap = makeSnapshot({
      entries: [
        makeEntry("t1"),
        makeEntry("t2", { hidden: true, label: "🔍 Grep TODO" }),
      ],
      visibleCount: 1,
      totalVisible: 1,
      completedVisible: 1,
    });
    const result = renderToolCard(snap);
    expect(result).not.toContain("Grep");
    expect(result).toContain("Read");
  });

  it("renders viewer links inline", () => {
    const snap = makeSnapshot({
      entries: [makeEntry("t1", { viewerLinks: { diff: "http://diff.url" }, viewerFilePath: "src/a.ts" })],
      visibleCount: 1,
      totalVisible: 1,
      completedVisible: 1,
    });
    const result = renderToolCard(snap);
    expect(result).toContain("[View diff");
    expect(result).toContain("http://diff.url");
  });

  it("renders inline plan section", () => {
    const snap = makeSnapshot({
      entries: [makeEntry("t1")],
      planEntries: [
        { content: "Step 1", status: "completed", priority: "high" },
        { content: "Step 2", status: "in_progress", priority: "medium" },
      ],
      visibleCount: 1,
      totalVisible: 1,
      completedVisible: 1,
    });
    const result = renderToolCard(snap);
    expect(result).toContain("── Plan: 1/2 ──");
    expect(result).toContain("✅ 1. Step 1");
    expect(result).toContain("🔄 2. Step 2");
  });

  it("renders usage footer", () => {
    const snap = makeSnapshot({
      entries: [makeEntry("t1")],
      usage: { tokensUsed: 5000, cost: 0.05 },
      visibleCount: 1,
      totalVisible: 1,
      completedVisible: 1,
    });
    const result = renderToolCard(snap);
    expect(result).toContain("📊");
    expect(result).toContain("5k");
  });

  it("renders plan-only card (no tools)", () => {
    const snap = makeSnapshot({
      planEntries: [
        { content: "Step 1", status: "in_progress", priority: "high" },
      ],
    });
    const result = renderToolCard(snap);
    expect(result).toContain("Plan: 0/1");
    expect(result).toContain("Step 1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/plugins/discord/__tests__/formatting.test.ts`
Expected: FAIL — `renderToolCard` not exported.

- [ ] **Step 3: Implement renderToolCard in Discord formatting**

Add to `src/plugins/discord/formatting.ts`:

```typescript
import type { ToolCardSnapshot } from "../../core/adapter-primitives/primitives/tool-card-state.js";

export function renderToolCard(snap: ToolCardSnapshot): string {
  const sections: string[] = [];

  // Header
  const { visibleCount, totalVisible, completedVisible, allComplete } = snap;
  const headerCheck = allComplete ? " ✅" : "";
  if (totalVisible > 0) {
    sections.push(`**📋 Tools (${completedVisible}/${totalVisible})**${headerCheck}`);
  }

  // Tool entries (split into completed and running)
  const visible = snap.entries.filter((e) => !e.hidden);
  const completed = visible.filter((e) => e.status === "completed" || e.status === "done" || e.status === "failed");
  const running = visible.filter((e) => e.status !== "completed" && e.status !== "done" && e.status !== "failed");

  for (const entry of completed) {
    let line = `${entry.icon} ${entry.label}`;
    if (entry.viewerLinks) {
      const links: string[] = [];
      const fileName = entry.viewerFilePath?.split("/").pop() || "";
      if (entry.viewerLinks.file) links.push(`[View ${fileName || "file"}](${entry.viewerLinks.file})`);
      if (entry.viewerLinks.diff) links.push(`[View diff](${entry.viewerLinks.diff})`);
      if (links.length > 0) line += `     ${links.join(" · ")}`;
    }
    sections.push(line);
  }

  // Plan section (between completed and running tools)
  if (snap.planEntries && snap.planEntries.length > 0) {
    const planDone = snap.planEntries.filter((e) => e.status === "completed").length;
    const planTotal = snap.planEntries.length;
    sections.push(`── Plan: ${planDone}/${planTotal} ──`);

    const statusIcon: Record<string, string> = {
      completed: "✅",
      in_progress: "🔄",
      pending: "⬜",
    };
    for (let i = 0; i < snap.planEntries.length; i++) {
      const e = snap.planEntries[i];
      const icon = statusIcon[e.status] || "⬜";
      sections.push(`${icon} ${i + 1}. ${e.content}`);
    }
    sections.push("────");
  }

  // Running tools (after plan)
  for (const entry of running) {
    sections.push(`${entry.icon} ${entry.label}`);
  }

  // Usage footer
  if (snap.usage?.tokensUsed) {
    sections.push("───");
    const costStr = snap.usage.cost != null ? ` · $${snap.usage.cost.toFixed(2)}` : "";
    sections.push(`📊 ${formatTokens(snap.usage.tokensUsed)} tokens${costStr}`);
  }

  return sections.join("\n");
}
```

Note: `formatTokens` is already imported from `format-utils.js` in this file.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- src/plugins/discord/__tests__/formatting.test.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/discord/formatting.ts src/plugins/discord/__tests__/formatting.test.ts
git commit -m "feat(discord): add renderToolCard formatter"
```

---

### Task 4: Add renderToolCard to Telegram formatting

Same logic as Discord but with HTML output.

**Files:**
- Modify: `src/plugins/telegram/formatting.ts`
- Test: `src/plugins/telegram/__tests__/formatting-extended.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/plugins/telegram/__tests__/formatting-extended.test.ts`:

```typescript
import { renderToolCard } from "../formatting.js";
import type { ToolCardSnapshot, ToolCardEntry } from "../../../core/adapter-primitives/primitives/tool-card-state.js";

function makeEntry(id: string, overrides?: Partial<ToolCardEntry>): ToolCardEntry {
  return {
    id,
    name: "Read",
    status: "completed",
    icon: "✅",
    label: "📖 Read src/main.ts",
    hidden: false,
    ...overrides,
  };
}

function makeSnapshot(overrides?: Partial<ToolCardSnapshot>): ToolCardSnapshot {
  return {
    entries: [],
    visibleCount: 0,
    totalVisible: 0,
    completedVisible: 0,
    allComplete: false,
    verbosity: "medium",
    ...overrides,
  };
}

describe("renderToolCard", () => {
  it("renders header with HTML bold", () => {
    const snap = makeSnapshot({
      entries: [makeEntry("t1")],
      visibleCount: 1,
      totalVisible: 1,
      completedVisible: 1,
      allComplete: true,
    });
    const result = renderToolCard(snap);
    expect(result).toContain("<b>📋 Tools (1/1)</b> ✅");
  });

  it("escapes HTML in tool labels", () => {
    const snap = makeSnapshot({
      entries: [makeEntry("t1", { label: "📖 Read <script>.ts" })],
      visibleCount: 1,
      totalVisible: 1,
      completedVisible: 1,
    });
    const result = renderToolCard(snap);
    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>");
  });

  it("renders viewer links as HTML anchors", () => {
    const snap = makeSnapshot({
      entries: [makeEntry("t1", { viewerLinks: { diff: "http://diff.url" } })],
      visibleCount: 1,
      totalVisible: 1,
      completedVisible: 1,
    });
    const result = renderToolCard(snap);
    expect(result).toContain('<a href="http://diff.url">');
  });

  it("renders plan section with HTML escaping", () => {
    const snap = makeSnapshot({
      planEntries: [
        { content: "Step <1>", status: "completed", priority: "high" },
      ],
    });
    const result = renderToolCard(snap);
    expect(result).toContain("Step &lt;1&gt;");
  });

  it("renders usage footer", () => {
    const snap = makeSnapshot({
      entries: [makeEntry("t1")],
      usage: { tokensUsed: 12500, cost: 0.05 },
      visibleCount: 1,
      totalVisible: 1,
      completedVisible: 1,
    });
    const result = renderToolCard(snap);
    expect(result).toContain("📊 13k tokens · $0.05");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/plugins/telegram/__tests__/formatting-extended.test.ts`
Expected: FAIL — `renderToolCard` not exported.

- [ ] **Step 3: Implement renderToolCard in Telegram formatting**

Add to `src/plugins/telegram/formatting.ts`:

```typescript
import type { ToolCardSnapshot } from "../../core/adapter-primitives/primitives/tool-card-state.js";

export function renderToolCard(snap: ToolCardSnapshot): string {
  const sections: string[] = [];

  // Header
  const { totalVisible, completedVisible, allComplete } = snap;
  const headerCheck = allComplete ? " ✅" : "";
  if (totalVisible > 0) {
    sections.push(`<b>📋 Tools (${completedVisible}/${totalVisible})</b>${headerCheck}`);
  }

  // Tool entries
  const visible = snap.entries.filter((e) => !e.hidden);
  const completed = visible.filter((e) => e.status === "completed" || e.status === "done" || e.status === "failed");
  const running = visible.filter((e) => e.status !== "completed" && e.status !== "done" && e.status !== "failed");

  for (const entry of completed) {
    let line = `${entry.icon} ${escapeHtml(entry.label)}`;
    if (entry.viewerLinks) {
      const links: string[] = [];
      const fileName = entry.viewerFilePath?.split("/").pop() || "";
      if (entry.viewerLinks.file) links.push(`📄 <a href="${escapeHtml(entry.viewerLinks.file)}">View ${escapeHtml(fileName || "file")}</a>`);
      if (entry.viewerLinks.diff) links.push(`📝 <a href="${escapeHtml(entry.viewerLinks.diff)}">View diff</a>`);
      if (links.length > 0) line += `     ${links.join(" · ")}`;
    }
    sections.push(line);
  }

  // Plan section
  if (snap.planEntries && snap.planEntries.length > 0) {
    const planDone = snap.planEntries.filter((e) => e.status === "completed").length;
    const planTotal = snap.planEntries.length;
    sections.push(`── Plan: ${planDone}/${planTotal} ──`);

    const statusIcon: Record<string, string> = {
      completed: "✅",
      in_progress: "🔄",
      pending: "⬜",
    };
    for (let i = 0; i < snap.planEntries.length; i++) {
      const e = snap.planEntries[i];
      const icon = statusIcon[e.status] || "⬜";
      sections.push(`${icon} ${i + 1}. ${escapeHtml(e.content)}`);
    }
    sections.push("────");
  }

  // Running tools
  for (const entry of running) {
    sections.push(`${entry.icon} ${escapeHtml(entry.label)}`);
  }

  // Usage footer
  if (snap.usage?.tokensUsed) {
    sections.push("───");
    const costStr = snap.usage.cost != null ? ` · $${snap.usage.cost.toFixed(2)}` : "";
    sections.push(`📊 ${formatTokens(snap.usage.tokensUsed)} tokens${costStr}`);
  }

  return sections.join("\n");
}
```

Note: `escapeHtml` and `formatTokens` are already available in this file.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- src/plugins/telegram/__tests__/formatting-extended.test.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/telegram/formatting.ts src/plugins/telegram/__tests__/formatting-extended.test.ts
git commit -m "feat(telegram): add renderToolCard formatter"
```

---

### Task 5: Wire ToolCard into Discord ActivityTracker

Replace PlanCard + UsageMessage with ToolCard in Discord's `activity.ts`. Wire into adapter.

**Files:**
- Modify: `src/plugins/discord/activity.ts`
- Modify: `src/plugins/discord/adapter.ts`

- [ ] **Step 1: Rewrite Discord ActivityTracker**

Replace `PlanCard` and `UsageMessage` in `src/plugins/discord/activity.ts` with a `ToolCard` class that wraps `ToolCardState` and Discord's embed send/edit:

```typescript
// Keep: ThinkingIndicator (unchanged)
// Remove: PlanCard class, UsageMessage class
// Add: ToolCard class

import { EmbedBuilder } from "discord.js";
import type { TextChannel, ThreadChannel, Message } from "discord.js";
import { log } from "../../core/utils/log.js";
import type { PlanEntry } from "../../core/types.js";
import type { ToolCallMeta, DisplayVerbosity, ViewerLinks } from "../../core/adapter-primitives/format-types.js";
import type { SendQueue } from "../../core/adapter-primitives/primitives/send-queue.js";
import { ToolCardState } from "../../core/adapter-primitives/primitives/tool-card-state.js";
import type { ToolCardSnapshot } from "../../core/adapter-primitives/primitives/tool-card-state.js";
import { renderToolCard } from "./formatting.js";

// ... ThinkingIndicator stays exactly the same ...

export class ToolCard {
  private state: ToolCardState;
  private message?: Message;
  private lastSentText?: string;
  private flushPromise: Promise<void> = Promise.resolve();

  constructor(
    private thread: TextChannel | ThreadChannel,
    private sendQueue: SendQueue,
    verbosity: DisplayVerbosity,
  ) {
    this.state = new ToolCardState({
      verbosity,
      onFlush: (snapshot) => {
        this.flushPromise = this.flushPromise
          .then(() => this._sendOrEdit(snapshot))
          .catch(() => {});
      },
    });
  }

  addTool(meta: ToolCallMeta, kind: string, rawInput: unknown): void {
    this.state.addTool(meta, kind, rawInput);
  }

  updateTool(id: string, status: string, viewerLinks?: ViewerLinks, viewerFilePath?: string): void {
    this.state.updateTool(id, status, viewerLinks, viewerFilePath);
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

  private async _sendOrEdit(snapshot: ToolCardSnapshot): Promise<void> {
    const text = renderToolCard(snapshot);
    if (this.message && text === this.lastSentText) return;
    this.lastSentText = text;
    const embed = new EmbedBuilder().setDescription(text);
    try {
      if (this.message) {
        await this.sendQueue.enqueue(
          () => this.message!.edit({ embeds: [embed] }),
          { type: "other" },
        );
      } else {
        const result = await this.sendQueue.enqueue(
          () => this.thread.send({ embeds: [embed] }),
          { type: "other" },
        );
        if (result) this.message = result;
      }
    } catch (err) {
      log.warn({ err }, "[ToolCard] send/edit failed");
    }
  }
}

// Updated ActivityTracker
export class ActivityTracker {
  private isFirstEvent = true;
  private thinking: ThinkingIndicator;
  private toolCard: ToolCard;

  constructor(
    private thread: TextChannel | ThreadChannel,
    private sendQueue: SendQueue,
    verbosity: DisplayVerbosity = "medium",
  ) {
    this.thinking = new ThinkingIndicator(thread);
    this.toolCard = new ToolCard(thread, sendQueue, verbosity);
  }

  async onNewPrompt(): Promise<void> {
    this.isFirstEvent = true;
    this.thinking.dismiss();
    this.thinking.reset();
  }

  async onThought(): Promise<void> {
    this.isFirstEvent = false;
    await this.thinking.show();
  }

  async onTextStart(): Promise<void> {
    this.isFirstEvent = false;
    this.thinking.dismiss();
  }

  async onToolCall(meta: ToolCallMeta, kind: string, rawInput: unknown): Promise<void> {
    this.isFirstEvent = false;
    this.thinking.dismiss();
    this.thinking.reset();
    this.toolCard.addTool(meta, kind, rawInput);
  }

  async onToolUpdate(id: string, status: string, viewerLinks?: ViewerLinks, viewerFilePath?: string): Promise<void> {
    this.toolCard.updateTool(id, status, viewerLinks, viewerFilePath);
  }

  async onPlan(entries: PlanEntry[]): Promise<void> {
    this.isFirstEvent = false;
    this.thinking.dismiss();
    this.toolCard.updatePlan(entries);
  }

  async sendUsage(usage: { tokensUsed?: number; contextSize?: number; cost?: number }): Promise<void> {
    if (this.toolCard.hasContent()) {
      this.toolCard.appendUsage(usage);
    }
    // If no tool card (no tools were called), usage is standalone — skip (adapter handles)
  }

  async cleanup(): Promise<void> {
    this.thinking.dismiss();
    await this.toolCard.finalize();
    this.toolCard.destroy();
  }
}
```

- [ ] **Step 2: Update Discord adapter handlers**

In `src/plugins/discord/adapter.ts`, update `handleToolCall`, `handleToolUpdate`, `handlePlan`, `handleUsage` to use the new ActivityTracker API. Remove imports and usage of `DiscordToolCallTracker`.

Key changes in adapter:
- `handleToolCall` → `tracker.onToolCall(meta, kind, rawInput)` instead of `toolTracker.trackNewCall()`
- `handleToolUpdate` → `tracker.onToolUpdate(id, status, viewerLinks, viewerFilePath)`
- `handlePlan` → `tracker.onPlan(entries)`
- `handleUsage` → `tracker.sendUsage(usage)`
- Remove `this.toolTracker` field and all `DiscordToolCallTracker` references
- Update `getOrCreateTracker` to pass `verbosity` to `ActivityTracker` constructor

- [ ] **Step 3: Build and verify**

Run: `pnpm build`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/discord/activity.ts src/plugins/discord/adapter.ts
git commit -m "feat(discord): wire ToolCard into ActivityTracker"
```

---

### Task 6: Wire ToolCard into Telegram ActivityTracker

Same pattern as Discord but with grammY API for send/edit.

**Files:**
- Modify: `src/plugins/telegram/activity.ts`
- Modify: `src/plugins/telegram/adapter.ts`

- [ ] **Step 1: Rewrite Telegram ActivityTracker**

Replace `PlanCard`, `UsageMessage`, and `formatPlanCard` in `src/plugins/telegram/activity.ts` with a `ToolCard` class wrapping `ToolCardState` + grammY `sendMessage`/`editMessageText`:

```typescript
// Keep: ThinkingIndicator (unchanged), UsageMessage (kept for standalone usage when no tools)
// Remove: PlanCard class, formatPlanCard function
// Add: ToolCard class

import type { Bot } from "grammy";
import { createChildLogger } from "../../core/utils/log.js";
import type { PlanEntry } from "../../core/types.js";
import type { ToolCallMeta, DisplayVerbosity, ViewerLinks } from "../../core/adapter-primitives/format-types.js";
import type { SendQueue } from "../../core/adapter-primitives/primitives/send-queue.js";
import { ToolCardState } from "../../core/adapter-primitives/primitives/tool-card-state.js";
import type { ToolCardSnapshot } from "../../core/adapter-primitives/primitives/tool-card-state.js";
import { renderToolCard } from "./formatting.js";

const log = createChildLogger({ module: "telegram:activity" });

// ... ThinkingIndicator stays the same ...
// ... UsageMessage stays — used for standalone usage when no tools called ...

export class ToolCard {
  private state: ToolCardState;
  private msgId?: number;
  private lastSentText?: string;
  private flushPromise: Promise<void> = Promise.resolve();

  constructor(
    private api: Bot["api"],
    private chatId: number,
    private threadId: number,
    private sendQueue: SendQueue,
    verbosity: DisplayVerbosity,
  ) {
    this.state = new ToolCardState({
      verbosity,
      onFlush: (snapshot) => {
        this.flushPromise = this.flushPromise
          .then(() => this._sendOrEdit(snapshot))
          .catch(() => {});
      },
    });
  }

  addTool(meta: ToolCallMeta, kind: string, rawInput: unknown): void {
    this.state.addTool(meta, kind, rawInput);
  }

  updateTool(id: string, status: string, viewerLinks?: ViewerLinks, viewerFilePath?: string): void {
    this.state.updateTool(id, status, viewerLinks, viewerFilePath);
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

  private async _sendOrEdit(snapshot: ToolCardSnapshot): Promise<void> {
    const text = renderToolCard(snapshot);
    if (this.msgId && text === this.lastSentText) return;
    this.lastSentText = text;
    try {
      if (this.msgId) {
        await this.sendQueue.enqueue(() =>
          this.api.editMessageText(this.chatId, this.msgId!, text, {
            parse_mode: "HTML",
          }),
        );
      } else {
        const result = await this.sendQueue.enqueue(() =>
          this.api.sendMessage(this.chatId, text, {
            message_thread_id: this.threadId,
            parse_mode: "HTML",
            disable_notification: true,
          }),
        );
        if (result) this.msgId = result.message_id;
      }
    } catch (err) {
      log.warn({ err }, "[ToolCard] send/edit failed");
    }
  }
}

// Updated ActivityTracker — same pattern as Discord
```

- [ ] **Step 2: Update Telegram adapter handlers**

Same changes as Discord adapter: route `handleToolCall`, `handleToolUpdate`, `handlePlan`, `handleUsage` through ActivityTracker's new API. Remove `TelegramToolCallTracker` references.

- [ ] **Step 3: Build and verify**

Run: `pnpm build`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/telegram/activity.ts src/plugins/telegram/adapter.ts
git commit -m "feat(telegram): wire ToolCard into ActivityTracker"
```

---

### Task 7: Delete deprecated platform ToolCallTrackers

**Files:**
- Delete: `src/plugins/discord/tool-call-tracker.ts`
- Delete: `src/plugins/telegram/tool-call-tracker.ts`
- Modify: `src/plugins/discord/adapter.ts` (remove import if still present)
- Modify: `src/plugins/telegram/adapter.ts` (remove import if still present)

- [ ] **Step 1: Delete files**

```bash
rm src/plugins/discord/tool-call-tracker.ts
rm src/plugins/telegram/tool-call-tracker.ts
```

- [ ] **Step 2: Remove any remaining imports**

Search for `tool-call-tracker` imports in adapter files and remove them.

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: Build clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete deprecated platform ToolCallTrackers"
```

---

### Task 8: Update message-format-reference.md

Update the dev reference doc to reflect the new consolidated tool card behavior.

**Files:**
- Modify: `docs/dev/message-format-reference.md`

- [ ] **Step 1: Update doc**

Key changes:
- Section 2.4 Noise Filtering: add grep, change glob action to "hide"
- Section 3 Plan: note that plan is now inline in tool card
- Add new section describing the consolidated tool card behavior
- Update data flow diagram

- [ ] **Step 2: Commit**

```bash
git add docs/dev/message-format-reference.md
git commit -m "docs: update message format reference for consolidated tool card"
```

---

## Task Dependency Graph

```
Task 1 (noise rules) ──┐
                        ├── Task 2 (ToolCardState) ──┬── Task 3 (Discord formatter) ── Task 5 (Discord wiring) ──┐
                        │                            └── Task 4 (Telegram formatter) ── Task 6 (Telegram wiring) ──┤
                        │                                                                                          ├── Task 7 (delete old trackers)
                        │                                                                                          └── Task 8 (update docs)
```

Tasks 1 and 2 are sequential. Tasks 3+4 can run in parallel after Task 2. Tasks 5+6 can run in parallel after their respective formatter task. Tasks 7+8 run after all wiring is done.
