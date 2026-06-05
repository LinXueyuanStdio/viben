# Conversation History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record full conversation history per session and serve it as condensed context for new sessions via a local ContextProvider.

**Architecture:** Middleware-based recording (no core changes). `HistoryRecorder` captures events via `agent:beforePrompt`, `agent:afterEvent`, `turn:end`, and `permission:afterResolve` hooks. `HistoryProvider` implements `ContextProvider` (name: `"local"`) to read history files and build markdown context at 3 verbosity levels. All integrated into the existing context plugin.

**Tech Stack:** TypeScript, Vitest, Node.js fs, existing middleware/plugin infrastructure.

**Spec:** `docs/superpowers/specs/2026-03-30-conversation-history-design.md`

---

## File Structure

```
src/plugins/context/history/
  types.ts                        # SessionHistory, Turn, Step type definitions
  history-store.ts                # File I/O: read/write/delete/list JSON history files
  history-recorder.ts             # Middleware-based event capture, turn accumulation, disk writes
  history-context-builder.ts      # Render Turn[] → markdown at full/balanced/compact levels
  history-provider.ts             # ContextProvider implementation (name: "local"), reads store + builds context

Modified:
  src/plugins/context/index.ts    # Register HistoryRecorder + HistoryProvider, add permissions
```

---

### Task 1: Types (`types.ts`)

**Files:**
- Create: `src/plugins/context/history/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/plugins/context/history/types.ts

import type { Attachment } from "../../../core/types.js";

export interface SessionHistory {
  version: 1;
  sessionId: string;
  turns: Turn[];
}

export interface Turn {
  index: number;
  role: "user" | "assistant";
  timestamp: string;
  // User turn
  content?: string;
  attachments?: HistoryAttachment[];
  // Assistant turn
  steps?: Step[];
  usage?: HistoryUsage;
  stopReason?: string;
}

export interface HistoryAttachment {
  type: "image" | "audio" | "file";
  fileName: string;
  mimeType: string;
  size: number;
}

export interface HistoryUsage {
  tokensUsed?: number;
  contextSize?: number;
  cost?: { amount: number; currency: string };
}

export type Step =
  | ThinkingStep
  | TextStep
  | ToolCallStep
  | PlanStep
  | ImageStep
  | AudioStep
  | ResourceStep
  | ResourceLinkStep
  | ModeChangeStep
  | ConfigChangeStep;

export interface ThinkingStep {
  type: "thinking";
  content: string;
}

export interface TextStep {
  type: "text";
  content: string;
}

export interface ToolCallStep {
  type: "tool_call";
  id: string;
  name: string;
  kind?: string;
  status: string;
  input?: unknown;
  output?: unknown;
  diff?: { path: string; oldText?: string; newText: string } | null;
  locations?: { path: string; line?: number }[];
  permission?: { requested: boolean; outcome: string } | null;
}

export interface PlanStep {
  type: "plan";
  entries: { content: string; priority: string; status: string }[];
}

export interface ImageStep {
  type: "image";
  mimeType: string;
  filePath: string;
  size?: number;
}

export interface AudioStep {
  type: "audio";
  mimeType: string;
  filePath: string;
  size?: number;
}

export interface ResourceStep {
  type: "resource";
  uri: string;
  name: string;
  text?: string;
}

export interface ResourceLinkStep {
  type: "resource_link";
  uri: string;
  name: string;
  title?: string;
  description?: string;
}

export interface ModeChangeStep {
  type: "mode_change";
  modeId: string;
}

export interface ConfigChangeStep {
  type: "config_change";
  configId: string;
  value: string;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/plugins/context/history/types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/plugins/context/history/types.ts
git commit -m "feat(history): add type definitions for conversation history"
```

---

### Task 2: History Store (`history-store.ts`)

**Files:**
- Create: `src/plugins/context/history/history-store.ts`
- Create: `src/plugins/context/history/__tests__/history-store.test.ts`

- [ ] **Step 1: Write failing tests for HistoryStore**

```typescript
// src/plugins/context/history/__tests__/history-store.test.ts

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { HistoryStore } from "../history-store.js";
import type { SessionHistory } from "../types.js";

function createTestHistory(sessionId: string, turnCount = 1): SessionHistory {
  const turns = [];
  for (let i = 0; i < turnCount; i++) {
    turns.push(
      { index: i * 2, role: "user" as const, timestamp: new Date().toISOString(), content: `Message ${i}` },
      { index: i * 2 + 1, role: "assistant" as const, timestamp: new Date().toISOString(), steps: [{ type: "text" as const, content: `Reply ${i}` }], stopReason: "end_turn" },
    );
  }
  return { version: 1, sessionId, turns };
}

describe("HistoryStore", () => {
  let tmpDir: string;
  let store: HistoryStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "history-store-test-"));
    store = new HistoryStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads a session history", async () => {
    const history = createTestHistory("sess-1", 2);
    await store.write(history);

    const loaded = await store.read("sess-1");
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe("sess-1");
    expect(loaded!.turns).toHaveLength(4);
    expect(loaded!.version).toBe(1);
  });

  it("returns null for non-existent session", async () => {
    const result = await store.read("non-existent");
    expect(result).toBeNull();
  });

  it("lists all session IDs with history", async () => {
    await store.write(createTestHistory("sess-a"));
    await store.write(createTestHistory("sess-b"));
    await store.write(createTestHistory("sess-c"));

    const ids = await store.list();
    expect(ids).toHaveLength(3);
    expect(ids).toContain("sess-a");
    expect(ids).toContain("sess-b");
    expect(ids).toContain("sess-c");
  });

  it("checks if history exists", async () => {
    await store.write(createTestHistory("sess-1"));

    expect(await store.exists("sess-1")).toBe(true);
    expect(await store.exists("sess-2")).toBe(false);
  });

  it("deletes a session history", async () => {
    await store.write(createTestHistory("sess-1"));
    expect(await store.exists("sess-1")).toBe(true);

    await store.delete("sess-1");
    expect(await store.exists("sess-1")).toBe(false);
  });

  it("delete is safe for non-existent files", async () => {
    await expect(store.delete("non-existent")).resolves.not.toThrow();
  });

  it("overwrites existing history on write", async () => {
    await store.write(createTestHistory("sess-1", 1));
    const updated = createTestHistory("sess-1", 3);
    await store.write(updated);

    const loaded = await store.read("sess-1");
    expect(loaded!.turns).toHaveLength(6);
  });

  it("creates directory if it does not exist", async () => {
    const nestedDir = path.join(tmpDir, "nested", "deep");
    const nestedStore = new HistoryStore(nestedDir);
    await nestedStore.write(createTestHistory("sess-1"));

    expect(fs.existsSync(nestedDir)).toBe(true);
    const loaded = await nestedStore.read("sess-1");
    expect(loaded!.sessionId).toBe("sess-1");
  });

  it("handles corrupt JSON gracefully", async () => {
    const filePath = path.join(tmpDir, "corrupt-sess.json");
    fs.writeFileSync(filePath, "{ broken json!!!");

    const result = await store.read("corrupt-sess");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/plugins/context/history/__tests__/history-store.test.ts`
Expected: FAIL — `HistoryStore` not found

- [ ] **Step 3: Implement HistoryStore**

```typescript
// src/plugins/context/history/history-store.ts

import fs from "node:fs";
import path from "node:path";
import type { SessionHistory } from "./types.js";

export class HistoryStore {
  constructor(private readonly dir: string) {}

  async write(history: SessionHistory): Promise<void> {
    await fs.promises.mkdir(this.dir, { recursive: true });
    const filePath = this.filePath(history.sessionId);
    await fs.promises.writeFile(filePath, JSON.stringify(history, null, 2));
  }

  async read(sessionId: string): Promise<SessionHistory | null> {
    const filePath = this.filePath(sessionId);
    try {
      const raw = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(raw) as SessionHistory;
    } catch {
      return null;
    }
  }

  async exists(sessionId: string): Promise<boolean> {
    try {
      await fs.promises.access(this.filePath(sessionId));
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.dir);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""));
    } catch {
      return [];
    }
  }

  async delete(sessionId: string): Promise<void> {
    try {
      await fs.promises.unlink(this.filePath(sessionId));
    } catch {
      // file may not exist — safe to ignore
    }
  }

  private filePath(sessionId: string): string {
    return path.join(this.dir, `${sessionId}.json`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/plugins/context/history/__tests__/history-store.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/context/history/history-store.ts src/plugins/context/history/__tests__/history-store.test.ts
git commit -m "feat(history): add HistoryStore for reading/writing session history files"
```

---

### Task 3: History Recorder (`history-recorder.ts`)

**Files:**
- Create: `src/plugins/context/history/history-recorder.ts`
- Create: `src/plugins/context/history/__tests__/history-recorder.test.ts`

- [ ] **Step 1: Write failing tests for HistoryRecorder**

```typescript
// src/plugins/context/history/__tests__/history-recorder.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { HistoryRecorder } from "../history-recorder.js";
import { HistoryStore } from "../history-store.js";
import type { AgentEvent } from "../../../../core/types.js";

describe("HistoryRecorder", () => {
  let tmpDir: string;
  let store: HistoryStore;
  let recorder: HistoryRecorder;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "history-recorder-test-"));
    store = new HistoryStore(tmpDir);
    recorder = new HistoryRecorder(store);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("user turn capture", () => {
    it("records a user message from beforePrompt", () => {
      recorder.onBeforePrompt("sess-1", "Hello world", undefined);

      const state = recorder.getState("sess-1");
      expect(state).not.toBeNull();
      expect(state!.turns).toHaveLength(1);
      expect(state!.turns[0].role).toBe("user");
      expect(state!.turns[0].content).toBe("Hello world");
    });

    it("records user attachments", () => {
      const attachments = [{ type: "image" as const, filePath: "/tmp/img.png", fileName: "img.png", mimeType: "image/png", size: 1024 }];
      recorder.onBeforePrompt("sess-1", "See image", attachments);

      const state = recorder.getState("sess-1");
      expect(state!.turns[0].attachments).toHaveLength(1);
      expect(state!.turns[0].attachments![0].fileName).toBe("img.png");
    });
  });

  describe("assistant step accumulation", () => {
    it("accumulates text chunks into a single text step", () => {
      recorder.onBeforePrompt("sess-1", "Hi", undefined);
      recorder.onAfterEvent("sess-1", { type: "text", content: "Hello " } as AgentEvent);
      recorder.onAfterEvent("sess-1", { type: "text", content: "world!" } as AgentEvent);

      const state = recorder.getState("sess-1");
      const assistantTurn = state!.turns[1];
      expect(assistantTurn.steps).toHaveLength(1);
      expect(assistantTurn.steps![0]).toEqual({ type: "text", content: "Hello world!" });
    });

    it("accumulates thought chunks into a single thinking step", () => {
      recorder.onBeforePrompt("sess-1", "Hi", undefined);
      recorder.onAfterEvent("sess-1", { type: "thought", content: "Let me " } as AgentEvent);
      recorder.onAfterEvent("sess-1", { type: "thought", content: "think..." } as AgentEvent);

      const state = recorder.getState("sess-1");
      const assistantTurn = state!.turns[1];
      expect(assistantTurn.steps).toHaveLength(1);
      expect(assistantTurn.steps![0]).toEqual({ type: "thinking", content: "Let me think..." });
    });

    it("creates separate steps when types alternate", () => {
      recorder.onBeforePrompt("sess-1", "Hi", undefined);
      recorder.onAfterEvent("sess-1", { type: "thought", content: "Thinking..." } as AgentEvent);
      recorder.onAfterEvent("sess-1", { type: "text", content: "Answer" } as AgentEvent);
      recorder.onAfterEvent("sess-1", { type: "thought", content: "More thinking" } as AgentEvent);

      const state = recorder.getState("sess-1");
      const steps = state!.turns[1].steps!;
      expect(steps).toHaveLength(3);
      expect(steps[0].type).toBe("thinking");
      expect(steps[1].type).toBe("text");
      expect(steps[2].type).toBe("thinking");
    });

    it("records tool_call and tool_update as a single tool_call step", () => {
      recorder.onBeforePrompt("sess-1", "Read file", undefined);

      recorder.onAfterEvent("sess-1", {
        type: "tool_call", id: "t1", name: "Read", kind: "read", status: "pending",
        rawInput: undefined, rawOutput: undefined, content: undefined, locations: undefined, meta: undefined,
      } as AgentEvent);

      recorder.onAfterEvent("sess-1", {
        type: "tool_update", id: "t1", name: "Read", kind: "read", status: "completed",
        rawInput: { file_path: "/src/main.ts" }, rawOutput: "file content here",
        content: undefined, locations: [{ path: "/src/main.ts", line: 1 }], meta: undefined,
      } as AgentEvent);

      const steps = recorder.getState("sess-1")!.turns[1].steps!;
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe("tool_call");

      const toolStep = steps[0] as { type: "tool_call"; id: string; name: string; status: string; input: unknown; output: unknown; locations: unknown };
      expect(toolStep.id).toBe("t1");
      expect(toolStep.name).toBe("Read");
      expect(toolStep.status).toBe("completed");
      expect(toolStep.input).toEqual({ file_path: "/src/main.ts" });
      expect(toolStep.output).toBe("file content here");
      expect(toolStep.locations).toEqual([{ path: "/src/main.ts", line: 1 }]);
    });

    it("extracts diff from tool_call content", () => {
      recorder.onBeforePrompt("sess-1", "Edit file", undefined);

      recorder.onAfterEvent("sess-1", {
        type: "tool_call", id: "t1", name: "Edit", kind: "edit", status: "pending",
      } as AgentEvent);

      recorder.onAfterEvent("sess-1", {
        type: "tool_update", id: "t1", name: "Edit", kind: "edit", status: "completed",
        rawInput: { file_path: "/src/main.ts", old_string: "old", new_string: "new" },
        rawOutput: "Updated",
        content: [{ type: "diff", path: "/src/main.ts", oldText: "old", newText: "new" }],
        locations: [{ path: "/src/main.ts", line: 10 }],
      } as AgentEvent);

      const toolStep = recorder.getState("sess-1")!.turns[1].steps![0] as any;
      expect(toolStep.diff).toEqual({ path: "/src/main.ts", oldText: "old", newText: "new" });
    });

    it("records plan events", () => {
      recorder.onBeforePrompt("sess-1", "Make a plan", undefined);
      recorder.onAfterEvent("sess-1", {
        type: "plan",
        entries: [{ content: "Step 1", priority: "high", status: "pending" }],
      } as AgentEvent);

      const steps = recorder.getState("sess-1")!.turns[1].steps!;
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe("plan");
    });

    it("records usage on turn", () => {
      recorder.onBeforePrompt("sess-1", "Hi", undefined);
      recorder.onAfterEvent("sess-1", {
        type: "usage", tokensUsed: 5000, contextSize: 200000, cost: { amount: 0.03, currency: "USD" },
      } as AgentEvent);

      const assistantTurn = recorder.getState("sess-1")!.turns[1];
      expect(assistantTurn.usage).toEqual({
        tokensUsed: 5000, contextSize: 200000, cost: { amount: 0.03, currency: "USD" },
      });
    });

    it("records mode_change", () => {
      recorder.onBeforePrompt("sess-1", "Change mode", undefined);
      recorder.onAfterEvent("sess-1", { type: "current_mode_update", modeId: "plan" } as AgentEvent);

      const steps = recorder.getState("sess-1")!.turns[1].steps!;
      expect(steps).toHaveLength(1);
      expect(steps[0]).toEqual({ type: "mode_change", modeId: "plan" });
    });

    it("records config_change", () => {
      recorder.onBeforePrompt("sess-1", "Change config", undefined);
      recorder.onAfterEvent("sess-1", {
        type: "config_option_update",
        options: [{ id: "model", name: "Model", type: "select", currentValue: "opus", options: [] }],
      } as AgentEvent);

      const steps = recorder.getState("sess-1")!.turns[1].steps!;
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe("config_change");
    });
  });

  describe("turn finalization", () => {
    it("writes to disk on turn end", async () => {
      recorder.onBeforePrompt("sess-1", "Hi", undefined);
      recorder.onAfterEvent("sess-1", { type: "text", content: "Hello" } as AgentEvent);
      await recorder.onTurnEnd("sess-1", "end_turn");

      const history = await store.read("sess-1");
      expect(history).not.toBeNull();
      expect(history!.turns).toHaveLength(2);
      expect(history!.turns[1].stopReason).toBe("end_turn");
    });

    it("handles multiple turns in sequence", async () => {
      // Turn 1
      recorder.onBeforePrompt("sess-1", "First", undefined);
      recorder.onAfterEvent("sess-1", { type: "text", content: "Reply 1" } as AgentEvent);
      await recorder.onTurnEnd("sess-1", "end_turn");

      // Turn 2
      recorder.onBeforePrompt("sess-1", "Second", undefined);
      recorder.onAfterEvent("sess-1", { type: "text", content: "Reply 2" } as AgentEvent);
      await recorder.onTurnEnd("sess-1", "end_turn");

      const history = await store.read("sess-1");
      expect(history!.turns).toHaveLength(4);
      expect(history!.turns[0].content).toBe("First");
      expect(history!.turns[2].content).toBe("Second");
    });
  });

  describe("permission capture", () => {
    it("attaches permission outcome to matching tool_call step", () => {
      recorder.onBeforePrompt("sess-1", "Do something", undefined);
      recorder.onAfterEvent("sess-1", {
        type: "tool_call", id: "t1", name: "Bash", kind: "execute", status: "pending",
      } as AgentEvent);
      recorder.onPermissionResolved("sess-1", "t1", "allow_always");

      const toolStep = recorder.getState("sess-1")!.turns[1].steps![0] as any;
      expect(toolStep.permission).toEqual({ requested: true, outcome: "allow_always" });
    });
  });

  describe("session cleanup", () => {
    it("removes in-memory state after finalize", async () => {
      recorder.onBeforePrompt("sess-1", "Hi", undefined);
      recorder.onAfterEvent("sess-1", { type: "text", content: "Hello" } as AgentEvent);
      await recorder.onTurnEnd("sess-1", "end_turn");
      recorder.finalize("sess-1");

      expect(recorder.getState("sess-1")).toBeNull();
      // But file should still exist
      expect(await store.exists("sess-1")).toBe(true);
    });
  });

  describe("ignores events without prior prompt", () => {
    it("ignores afterEvent for unknown session", () => {
      recorder.onAfterEvent("unknown", { type: "text", content: "orphan" } as AgentEvent);
      expect(recorder.getState("unknown")).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/plugins/context/history/__tests__/history-recorder.test.ts`
Expected: FAIL — `HistoryRecorder` not found

- [ ] **Step 3: Implement HistoryRecorder**

```typescript
// src/plugins/context/history/history-recorder.ts

import type { AgentEvent, Attachment } from "../../../core/types.js";
import type { HistoryStore } from "./history-store.js";
import type { SessionHistory, Turn, Step, ToolCallStep, HistoryAttachment } from "./types.js";

export class HistoryRecorder {
  private sessions = new Map<string, SessionHistory>();

  constructor(private readonly store: HistoryStore) {}

  /** Called from agent:beforePrompt middleware — captures user message */
  onBeforePrompt(sessionId: string, text: string, attachments: Attachment[] | undefined): void {
    let history = this.sessions.get(sessionId);
    if (!history) {
      history = { version: 1, sessionId, turns: [] };
      this.sessions.set(sessionId, history);
    }

    const userTurn: Turn = {
      index: history.turns.length,
      role: "user",
      timestamp: new Date().toISOString(),
      content: text,
    };

    if (attachments?.length) {
      userTurn.attachments = attachments.map(toHistoryAttachment);
    }

    history.turns.push(userTurn);

    // Pre-create assistant turn for step accumulation
    history.turns.push({
      index: history.turns.length,
      role: "assistant",
      timestamp: new Date().toISOString(),
      steps: [],
    });
  }

  /** Called from agent:afterEvent middleware — accumulates steps into current assistant turn */
  onAfterEvent(sessionId: string, event: AgentEvent): void {
    const history = this.sessions.get(sessionId);
    if (!history) return;

    const assistantTurn = this.currentAssistantTurn(history);
    if (!assistantTurn) return;

    const steps = assistantTurn.steps!;

    switch (event.type) {
      case "text": {
        const last = steps[steps.length - 1];
        if (last?.type === "text") {
          (last as { type: "text"; content: string }).content += event.content;
        } else {
          steps.push({ type: "text", content: event.content });
        }
        break;
      }

      case "thought": {
        const last = steps[steps.length - 1];
        if (last?.type === "thinking") {
          (last as { type: "thinking"; content: string }).content += event.content;
        } else {
          steps.push({ type: "thinking", content: event.content });
        }
        break;
      }

      case "tool_call": {
        const toolStep: ToolCallStep = {
          type: "tool_call",
          id: event.id,
          name: event.name,
          kind: event.kind,
          status: event.status,
          input: event.rawInput ?? undefined,
          output: event.rawOutput ?? undefined,
          diff: extractDiff(event.content),
          locations: extractLocations(event.locations),
          permission: null,
        };
        steps.push(toolStep);
        break;
      }

      case "tool_update": {
        const existing = steps.find(
          (s): s is ToolCallStep => s.type === "tool_call" && (s as ToolCallStep).id === event.id,
        );
        if (existing) {
          if (event.status) existing.status = event.status;
          if (event.rawInput !== undefined) existing.input = event.rawInput;
          if (event.rawOutput !== undefined) existing.output = event.rawOutput;
          const diff = extractDiff(event.content);
          if (diff) existing.diff = diff;
          const locs = extractLocations(event.locations);
          if (locs) existing.locations = locs;
        }
        break;
      }

      case "plan": {
        steps.push({
          type: "plan",
          entries: event.entries.map((e) => ({
            content: e.content,
            priority: e.priority,
            status: e.status,
          })),
        });
        break;
      }

      case "image_content": {
        steps.push({ type: "image", mimeType: event.mimeType, filePath: "", size: event.data.length });
        break;
      }

      case "audio_content": {
        steps.push({ type: "audio", mimeType: event.mimeType, filePath: "", size: event.data.length });
        break;
      }

      case "resource_content": {
        steps.push({ type: "resource", uri: event.uri, name: event.name, text: event.text });
        break;
      }

      case "resource_link": {
        steps.push({
          type: "resource_link",
          uri: event.uri,
          name: event.name,
          title: event.title,
          description: event.description,
        });
        break;
      }

      case "current_mode_update": {
        steps.push({ type: "mode_change", modeId: event.modeId });
        break;
      }

      case "config_option_update": {
        for (const opt of event.options) {
          steps.push({
            type: "config_change",
            configId: opt.id,
            value: String(opt.currentValue),
          });
        }
        break;
      }

      case "usage": {
        assistantTurn.usage = {
          tokensUsed: event.tokensUsed,
          contextSize: event.contextSize,
          cost: event.cost,
        };
        break;
      }

      // Ignored events: session_end, error, system_message, commands_update,
      // session_info_update, model_update, user_message_chunk, tts_strip
    }
  }

  /** Called from permission:afterResolve — attaches permission outcome to tool step */
  onPermissionResolved(sessionId: string, requestId: string, decision: string): void {
    const history = this.sessions.get(sessionId);
    if (!history) return;

    const assistantTurn = this.currentAssistantTurn(history);
    if (!assistantTurn?.steps) return;

    // requestId may be a tool call ID or a permission request ID
    // Try matching against tool call IDs in current turn
    const toolStep = assistantTurn.steps.find(
      (s): s is ToolCallStep => s.type === "tool_call" && (s as ToolCallStep).id === requestId,
    );
    if (toolStep) {
      toolStep.permission = { requested: true, outcome: decision };
    }
  }

  /** Called from turn:end middleware — sets stopReason and writes to disk */
  async onTurnEnd(sessionId: string, stopReason: string): Promise<void> {
    const history = this.sessions.get(sessionId);
    if (!history) return;

    const assistantTurn = this.currentAssistantTurn(history);
    if (assistantTurn) {
      assistantTurn.stopReason = stopReason;
    }

    await this.store.write(history);
  }

  /** Called on session end — flushes final state and removes from memory */
  finalize(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Get current in-memory state (for testing) */
  getState(sessionId: string): SessionHistory | null {
    return this.sessions.get(sessionId) ?? null;
  }

  private currentAssistantTurn(history: SessionHistory): Turn | null {
    const last = history.turns[history.turns.length - 1];
    if (last?.role === "assistant") return last;
    return null;
  }
}

function toHistoryAttachment(att: Attachment): HistoryAttachment {
  return {
    type: att.type,
    fileName: att.fileName,
    mimeType: att.mimeType,
    size: att.size,
  };
}

function extractDiff(content: unknown): { path: string; oldText?: string; newText: string } | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (typeof block === "object" && block !== null && (block as Record<string, unknown>).type === "diff") {
      const d = block as Record<string, unknown>;
      return {
        path: String(d.path ?? ""),
        oldText: d.oldText != null ? String(d.oldText) : undefined,
        newText: String(d.newText ?? ""),
      };
    }
  }
  return null;
}

function extractLocations(locations: unknown): { path: string; line?: number }[] | undefined {
  if (!Array.isArray(locations)) return undefined;
  return locations
    .filter((l): l is { path: string; line?: number } => typeof l === "object" && l !== null && typeof (l as Record<string, unknown>).path === "string")
    .map((l) => ({ path: l.path, line: l.line }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/plugins/context/history/__tests__/history-recorder.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/context/history/history-recorder.ts src/plugins/context/history/__tests__/history-recorder.test.ts
git commit -m "feat(history): add HistoryRecorder for middleware-based event capture"
```

---

### Task 4: History Context Builder (`history-context-builder.ts`)

**Files:**
- Create: `src/plugins/context/history/history-context-builder.ts`
- Create: `src/plugins/context/history/__tests__/history-context-builder.test.ts`

- [ ] **Step 1: Write failing tests for HistoryContextBuilder**

```typescript
// src/plugins/context/history/__tests__/history-context-builder.test.ts

import { describe, it, expect } from "vitest";
import { buildHistoryMarkdown, selectLevel } from "../history-context-builder.js";
import type { Turn } from "../types.js";

function userTurn(index: number, content: string): Turn {
  return { index, role: "user", timestamp: "2026-03-30T10:00:00Z", content };
}

function assistantTurn(index: number, steps: Turn["steps"], stopReason = "end_turn"): Turn {
  return { index, role: "assistant", timestamp: "2026-03-30T10:00:01Z", steps, stopReason };
}

describe("selectLevel", () => {
  it("returns full for ≤10 turns", () => {
    expect(selectLevel(10)).toBe("full");
    expect(selectLevel(1)).toBe("full");
  });

  it("returns balanced for 11-25 turns", () => {
    expect(selectLevel(11)).toBe("balanced");
    expect(selectLevel(25)).toBe("balanced");
  });

  it("returns compact for >25 turns", () => {
    expect(selectLevel(26)).toBe("compact");
    expect(selectLevel(100)).toBe("compact");
  });
});

describe("buildHistoryMarkdown", () => {
  describe("full mode", () => {
    it("renders user and assistant text", () => {
      const turns: Turn[] = [
        userTurn(0, "Hello"),
        assistantTurn(1, [{ type: "text", content: "Hi there!" }]),
      ];
      const md = buildHistoryMarkdown(turns, "full");
      expect(md).toContain("**User [1]:**");
      expect(md).toContain("Hello");
      expect(md).toContain("**Assistant:**");
      expect(md).toContain("Hi there!");
    });

    it("renders thinking steps", () => {
      const turns: Turn[] = [
        userTurn(0, "Explain"),
        assistantTurn(1, [
          { type: "thinking", content: "Let me analyze..." },
          { type: "text", content: "Here's my analysis." },
        ]),
      ];
      const md = buildHistoryMarkdown(turns, "full");
      expect(md).toContain("Thinking");
      expect(md).toContain("Let me analyze...");
    });

    it("renders tool_call with diff", () => {
      const turns: Turn[] = [
        userTurn(0, "Fix bug"),
        assistantTurn(1, [{
          type: "tool_call",
          id: "t1", name: "Edit", kind: "edit", status: "completed",
          input: { file_path: "src/main.ts" },
          diff: { path: "src/main.ts", oldText: "old code", newText: "new code" },
          locations: [{ path: "src/main.ts", line: 42 }],
          permission: { requested: true, outcome: "allow_always" },
        }]),
      ];
      const md = buildHistoryMarkdown(turns, "full");
      expect(md).toContain("Edit");
      expect(md).toContain("src/main.ts");
      expect(md).toContain("- old code");
      expect(md).toContain("+ new code");
      expect(md).toContain("allow_always");
    });

    it("renders tool_call without diff (read)", () => {
      const turns: Turn[] = [
        userTurn(0, "Read file"),
        assistantTurn(1, [{
          type: "tool_call",
          id: "t1", name: "Read", kind: "read", status: "completed",
          input: { file_path: "src/main.ts" },
          locations: [{ path: "src/main.ts", line: 1 }],
        }]),
      ];
      const md = buildHistoryMarkdown(turns, "full");
      expect(md).toContain("**[Read]**");
      expect(md).toContain("src/main.ts");
    });

    it("renders plan steps", () => {
      const turns: Turn[] = [
        userTurn(0, "Plan"),
        assistantTurn(1, [{
          type: "plan",
          entries: [
            { content: "Step 1", priority: "high", status: "completed" },
            { content: "Step 2", priority: "medium", status: "pending" },
          ],
        }]),
      ];
      const md = buildHistoryMarkdown(turns, "full");
      expect(md).toContain("Step 1");
      expect(md).toContain("Step 2");
    });
  });

  describe("balanced mode", () => {
    it("omits thinking steps", () => {
      const turns: Turn[] = [
        userTurn(0, "Hello"),
        assistantTurn(1, [
          { type: "thinking", content: "internal reasoning" },
          { type: "text", content: "Response" },
        ]),
      ];
      const md = buildHistoryMarkdown(turns, "balanced");
      expect(md).not.toContain("internal reasoning");
      expect(md).toContain("Response");
    });

    it("summarizes tool calls", () => {
      const turns: Turn[] = [
        userTurn(0, "Edit"),
        assistantTurn(1, [{
          type: "tool_call",
          id: "t1", name: "Edit", kind: "edit", status: "completed",
          input: { file_path: "src/main.ts" },
          diff: { path: "src/main.ts", oldText: "old", newText: "new" },
          locations: [{ path: "src/main.ts", line: 10 }],
        }]),
      ];
      const md = buildHistoryMarkdown(turns, "balanced");
      expect(md).toContain("Edit");
      expect(md).toContain("src/main.ts");
    });
  });

  describe("compact mode", () => {
    it("renders minimal output", () => {
      const turns: Turn[] = [
        userTurn(0, "Fix the bug"),
        assistantTurn(1, [
          { type: "thinking", content: "thinking..." },
          { type: "text", content: "Done fixing." },
          { type: "tool_call", id: "t1", name: "Edit", kind: "edit", status: "completed" },
        ]),
      ];
      const md = buildHistoryMarkdown(turns, "compact");
      expect(md).not.toContain("thinking...");
      expect(md).toContain("Fix the bug");
      expect(md).toContain("Edit");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/plugins/context/history/__tests__/history-context-builder.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement HistoryContextBuilder**

```typescript
// src/plugins/context/history/history-context-builder.ts

import type { ContextMode } from "../context-provider.js";
import type { Turn, Step, ToolCallStep } from "./types.js";

export function selectLevel(turnCount: number): ContextMode {
  if (turnCount <= 10) return "full";
  if (turnCount <= 25) return "balanced";
  return "compact";
}

export function estimateTokens(text: string): number {
  return Math.floor(text.length / 4);
}

export function buildHistoryMarkdown(turns: Turn[], mode: ContextMode): string {
  switch (mode) {
    case "full":
      return buildFull(turns);
    case "balanced":
      return buildBalanced(turns);
    case "compact":
      return buildCompact(turns);
  }
}

// ─── Full Mode ───────────────────────────────────────────────────────────────

function buildFull(turns: Turn[]): string {
  const out: string[] = [];
  let userIndex = 0;

  for (const turn of turns) {
    if (turn.role === "user") {
      userIndex++;
      out.push(`**User [${userIndex}]:**`);
      out.push(turn.content ?? "");
      if (turn.attachments?.length) {
        out.push(turn.attachments.map((a) => `[${a.type}: ${a.fileName}]`).join(" "));
      }
      out.push("");
    } else if (turn.role === "assistant" && turn.steps?.length) {
      out.push("**Assistant:**");

      for (const step of turn.steps) {
        out.push(renderStepFull(step));
      }

      if (turn.usage) {
        const parts = [];
        if (turn.usage.tokensUsed) parts.push(`${turn.usage.tokensUsed.toLocaleString()} tokens`);
        if (turn.usage.cost) parts.push(`$${turn.usage.cost.amount.toFixed(4)}`);
        if (parts.length) out.push(`**Usage**: ${parts.join(", ")}`);
      }

      out.push("");
      out.push("---");
      out.push("");
    }
  }

  return out.join("\n");
}

function renderStepFull(step: Step): string {
  switch (step.type) {
    case "thinking":
      return `> **Thinking**: ${step.content}\n`;
    case "text":
      return `${step.content}\n`;
    case "tool_call":
      return renderToolCallFull(step);
    case "plan":
      return renderPlan(step.entries);
    case "image":
      return `[Image: ${step.mimeType}]\n`;
    case "audio":
      return `[Audio: ${step.mimeType}]\n`;
    case "resource":
      return `[Resource: ${step.name}] ${step.uri}\n`;
    case "resource_link":
      return `[Resource Link: ${step.name}] ${step.uri}\n`;
    case "mode_change":
      return `*Mode changed to: ${step.modeId}*\n`;
    case "config_change":
      return `*Config ${step.configId} set to: ${step.value}*\n`;
  }
}

function renderToolCallFull(step: ToolCallStep): string {
  const lines: string[] = [];
  const loc = step.locations?.[0];
  const locStr = loc ? (loc.line ? `${loc.path}:${loc.line}` : loc.path) : "";

  if (step.diff) {
    lines.push(`**[${step.name}]** \`${locStr || step.diff.path}\``);
    lines.push("```diff");
    if (step.diff.oldText) {
      for (const line of step.diff.oldText.split("\n")) lines.push(`- ${line}`);
    }
    for (const line of step.diff.newText.split("\n")) lines.push(`+ ${line}`);
    lines.push("```");
  } else {
    lines.push(`**[${step.name}]** \`${locStr}\``);
  }

  if (step.permission) {
    lines.push(`*Permission: ${step.permission.outcome}*`);
  }

  lines.push("");
  return lines.join("\n");
}

function renderPlan(entries: { content: string; priority: string; status: string }[]): string {
  const lines = ["**Plan:**"];
  for (const e of entries) {
    const icon = e.status === "completed" ? "✅" : e.status === "in_progress" ? "🔄" : "⬜";
    lines.push(`${icon} ${e.content} (${e.priority})`);
  }
  lines.push("");
  return lines.join("\n");
}

// ─── Balanced Mode ───────────────────────────────────────────────────────────

function buildBalanced(turns: Turn[]): string {
  const out: string[] = [];
  let userIndex = 0;

  for (const turn of turns) {
    if (turn.role === "user") {
      userIndex++;
      out.push(`**User [${userIndex}]:**`);
      out.push(turn.content ?? "");
      out.push("");
    } else if (turn.role === "assistant" && turn.steps?.length) {
      out.push("**Assistant:**");

      for (const step of turn.steps) {
        if (step.type === "thinking") continue; // Skip thinking in balanced

        if (step.type === "text") {
          out.push(step.content);
        } else if (step.type === "tool_call") {
          out.push(renderToolCallBalanced(step));
        } else if (step.type === "plan") {
          out.push(renderPlan(step.entries));
        } else {
          out.push(renderStepFull(step));
        }
      }

      out.push("");
      out.push("---");
      out.push("");
    }
  }

  return out.join("\n");
}

function renderToolCallBalanced(step: ToolCallStep): string {
  const loc = step.locations?.[0];
  const locStr = loc ? (loc.line ? `${loc.path}:${loc.line}` : loc.path) : "";

  if (step.diff) {
    const oldLines = step.diff.oldText?.split("\n").length ?? 0;
    const newLines = step.diff.newText.split("\n").length;
    return `- ${step.name} \`${locStr || step.diff.path}\` (-${oldLines}/+${newLines} lines)`;
  }

  return `- ${step.name} \`${locStr}\``;
}

// ─── Compact Mode ────────────────────────────────────────────────────────────

function buildCompact(turns: Turn[]): string {
  const out: string[] = [];
  let i = 0;

  while (i < turns.length) {
    const turn = turns[i];
    if (turn.role === "user") {
      const userText = (turn.content ?? "").slice(0, 100);
      const nextTurn = turns[i + 1];
      if (nextTurn?.role === "assistant" && nextTurn.steps?.length) {
        const tools = nextTurn.steps
          .filter((s) => s.type === "tool_call")
          .map((s) => (s as ToolCallStep).name);
        const texts = nextTurn.steps
          .filter((s) => s.type === "text")
          .map((s) => (s as { content: string }).content.slice(0, 80));
        const parts = [];
        if (tools.length) parts.push(tools.join(", "));
        if (texts.length) parts.push(texts.join(" "));
        out.push(`User: ${userText} → Assistant: ${parts.join(" | ")}`);
        i += 2;
      } else {
        out.push(`User: ${userText}`);
        i++;
      }
    } else {
      i++;
    }
  }

  return out.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/plugins/context/history/__tests__/history-context-builder.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/context/history/history-context-builder.ts src/plugins/context/history/__tests__/history-context-builder.test.ts
git commit -m "feat(history): add HistoryContextBuilder for markdown rendering at 3 verbosity levels"
```

---

### Task 5: History Provider (`history-provider.ts`)

**Files:**
- Create: `src/plugins/context/history/history-provider.ts`
- Create: `src/plugins/context/history/__tests__/history-provider.test.ts`

- [ ] **Step 1: Write failing tests for HistoryProvider**

```typescript
// src/plugins/context/history/__tests__/history-provider.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { HistoryProvider } from "../history-provider.js";
import { HistoryStore } from "../history-store.js";
import type { SessionHistory } from "../types.js";
import type { SessionRecord } from "../../../../core/types.js";

function createHistory(sessionId: string, turnCount = 2): SessionHistory {
  const turns = [];
  for (let i = 0; i < turnCount; i++) {
    turns.push(
      { index: i * 2, role: "user" as const, timestamp: `2026-03-30T10:0${i}:00Z`, content: `Message ${i}` },
      { index: i * 2 + 1, role: "assistant" as const, timestamp: `2026-03-30T10:0${i}:30Z`, steps: [{ type: "text" as const, content: `Reply ${i}` }], stopReason: "end_turn" },
    );
  }
  return { version: 1, sessionId, turns };
}

function createRecord(sessionId: string, opts: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId,
    agentSessionId: `agent-${sessionId}`,
    agentName: "claude-code",
    workingDir: "/test",
    channelId: "telegram",
    status: "finished",
    createdAt: "2026-03-30T10:00:00Z",
    lastActiveAt: "2026-03-30T10:05:00Z",
    name: `Session ${sessionId}`,
    platform: {},
    ...opts,
  };
}

describe("HistoryProvider", () => {
  let tmpDir: string;
  let store: HistoryStore;
  let provider: HistoryProvider;
  let mockListSessions: () => SessionRecord[];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "history-provider-test-"));
    store = new HistoryStore(tmpDir);
    mockListSessions = () => [];
    provider = new HistoryProvider(store, () => mockListSessions());
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("has name 'local'", () => {
    expect(provider.name).toBe("local");
  });

  it("isAvailable returns true always", async () => {
    expect(await provider.isAvailable("/any/path")).toBe(true);
  });

  describe("listSessions", () => {
    it("lists sessions that have history files", async () => {
      await store.write(createHistory("sess-1"));
      await store.write(createHistory("sess-2"));
      mockListSessions = () => [createRecord("sess-1"), createRecord("sess-2"), createRecord("sess-3")];

      const result = await provider.listSessions({ repoPath: "/test", type: "latest", value: "10" });
      // Only sess-1 and sess-2 have history files
      expect(result.sessions).toHaveLength(2);
    });
  });

  describe("buildContext", () => {
    it("builds context for a single session", async () => {
      await store.write(createHistory("sess-1"));
      mockListSessions = () => [createRecord("sess-1")];

      const result = await provider.buildContext({ repoPath: "/test", type: "session", value: "sess-1" });
      expect(result.markdown).toContain("Message 0");
      expect(result.markdown).toContain("Reply 0");
      expect(result.sessionCount).toBe(1);
      expect(result.totalTurns).toBeGreaterThan(0);
    });

    it("builds context for latest N sessions", async () => {
      await store.write(createHistory("sess-1"));
      await store.write(createHistory("sess-2"));
      mockListSessions = () => [
        createRecord("sess-1", { lastActiveAt: "2026-03-30T09:00:00Z" }),
        createRecord("sess-2", { lastActiveAt: "2026-03-30T10:00:00Z" }),
      ];

      const result = await provider.buildContext({ repoPath: "/test", type: "latest", value: "5" });
      expect(result.sessionCount).toBe(2);
    });

    it("returns empty result for missing session", async () => {
      const result = await provider.buildContext({ repoPath: "/test", type: "session", value: "non-existent" });
      expect(result.markdown).toBe("");
      expect(result.sessionCount).toBe(0);
    });

    it("respects maxTokens budget", async () => {
      // Create a session with many turns
      await store.write(createHistory("sess-1", 20));
      mockListSessions = () => [createRecord("sess-1")];

      const result = await provider.buildContext(
        { repoPath: "/test", type: "session", value: "sess-1" },
        { maxTokens: 500 },
      );
      expect(result.tokenEstimate).toBeLessThanOrEqual(500);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/plugins/context/history/__tests__/history-provider.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement HistoryProvider**

```typescript
// src/plugins/context/history/history-provider.ts

import type { ContextProvider, ContextQuery, ContextOptions, ContextResult, SessionListResult, SessionInfo } from "../context-provider.js";
import { DEFAULT_MAX_TOKENS, TOKENS_PER_TURN_ESTIMATE } from "../context-provider.js";
import type { SessionRecord } from "../../../core/types.js";
import type { HistoryStore } from "./history-store.js";
import type { SessionHistory } from "./types.js";
import { buildHistoryMarkdown, selectLevel, estimateTokens } from "./history-context-builder.js";

const DISCLAIMER = `> **Note:** This conversation history may contain outdated information. File contents, code, and project state may have changed since these sessions were recorded. Use this as context only — always verify against current files before acting.`;

export class HistoryProvider implements ContextProvider {
  readonly name = "local";

  constructor(
    private readonly store: HistoryStore,
    private readonly getSessionRecords: () => SessionRecord[],
  ) {}

  async isAvailable(_repoPath: string): Promise<boolean> {
    return true;
  }

  async listSessions(query: ContextQuery): Promise<SessionListResult> {
    const sessions = await this.resolveSessions(query);
    const estimatedTokens = sessions.reduce((sum, s) => sum + s.turnCount * TOKENS_PER_TURN_ESTIMATE, 0);
    return { sessions, estimatedTokens };
  }

  async buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult> {
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const emptyResult: ContextResult = {
      markdown: "", tokenEstimate: 0, sessionCount: 0, totalTurns: 0,
      mode: "full", truncated: false, timeRange: { start: "", end: "" },
    };

    const sessionInfos = await this.resolveSessions(query);

    let infos = sessionInfos;
    if (options?.limit && infos.length > options.limit) {
      infos = infos.slice(-options.limit);
    }

    if (infos.length === 0) return emptyResult;

    // Load histories
    const histories: { info: SessionInfo; history: SessionHistory }[] = [];
    for (const info of infos) {
      const h = await this.store.read(info.sessionId);
      if (h) histories.push({ info, history: h });
    }

    if (histories.length === 0) return emptyResult;

    const totalTurns = histories.reduce((sum, h) => sum + h.history.turns.length, 0);
    let mode = selectLevel(totalTurns);

    // Build markdown per session
    let sessionMarkdowns = histories.map((h) => ({
      markdown: buildHistoryMarkdown(h.history.turns, mode),
      info: h.info,
      turns: h.history.turns.length,
    }));

    let merged = this.mergeMarkdowns(sessionMarkdowns, mode, query);
    let tokens = estimateTokens(merged);

    // Auto-downgrade if over budget
    if (tokens > maxTokens && mode !== "compact") {
      mode = "compact";
      sessionMarkdowns = histories.map((h) => ({
        markdown: buildHistoryMarkdown(h.history.turns, "compact"),
        info: h.info,
        turns: h.history.turns.length,
      }));
      merged = this.mergeMarkdowns(sessionMarkdowns, mode, query);
      tokens = estimateTokens(merged);
    }

    // Truncate oldest sessions if still over budget
    let truncated = false;
    while (tokens > maxTokens && sessionMarkdowns.length > 1) {
      sessionMarkdowns = sessionMarkdowns.slice(1);
      truncated = true;
      merged = this.mergeMarkdowns(sessionMarkdowns, mode, query);
      tokens = estimateTokens(merged);
    }

    const allTimes = histories.flatMap((h) => h.history.turns.map((t) => t.timestamp)).filter(Boolean).sort();
    const finalTurns = sessionMarkdowns.reduce((sum, s) => sum + s.turns, 0);

    return {
      markdown: merged,
      tokenEstimate: tokens,
      sessionCount: sessionMarkdowns.length,
      totalTurns: finalTurns,
      mode,
      truncated,
      timeRange: { start: allTimes[0] ?? "", end: allTimes[allTimes.length - 1] ?? "" },
    };
  }

  private mergeMarkdowns(
    sessions: { markdown: string; info: SessionInfo; turns: number }[],
    mode: string,
    query: ContextQuery,
  ): string {
    const title = this.buildTitle(query);
    const totalTurns = sessions.reduce((sum, s) => sum + s.turns, 0);
    const out: string[] = [];
    out.push(`# Conversation History — ${title}`);
    out.push(`${sessions.length} sessions | ${totalTurns} turns | mode: ${mode}`);
    out.push("");

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      out.push(`## Session ${i + 1} — ${s.info.agent} (${s.turns} turns)`);
      out.push("");
      out.push(s.markdown);
    }

    out.push(DISCLAIMER);
    out.push("");
    return out.join("\n");
  }

  private buildTitle(query: ContextQuery): string {
    switch (query.type) {
      case "session": return `session \`${query.value.slice(0, 8)}...\``;
      case "latest": return `latest ${query.value} sessions`;
      default: return query.type;
    }
  }

  private async resolveSessions(query: ContextQuery): Promise<SessionInfo[]> {
    const records = this.getSessionRecords();

    switch (query.type) {
      case "session": {
        const record = records.find((r) => r.sessionId === query.value);
        if (!record || !(await this.store.exists(record.sessionId))) return [];
        return [this.recordToSessionInfo(record)];
      }

      case "latest": {
        const limit = parseInt(query.value) || 5;
        const sorted = [...records]
          .sort((a, b) => a.lastActiveAt.localeCompare(b.lastActiveAt));
        const withHistory: SessionInfo[] = [];
        for (const r of sorted) {
          if (await this.store.exists(r.sessionId)) {
            withHistory.push(this.recordToSessionInfo(r));
          }
        }
        return withHistory.slice(-limit);
      }

      default:
        return [];
    }
  }

  private recordToSessionInfo(record: SessionRecord): SessionInfo {
    return {
      checkpointId: "",
      sessionIndex: "",
      transcriptPath: "",
      createdAt: record.createdAt,
      endedAt: record.lastActiveAt,
      branch: "",
      agent: record.agentName,
      turnCount: 0, // Will be populated from history file
      filesTouched: [],
      sessionId: record.sessionId,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/plugins/context/history/__tests__/history-provider.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/context/history/history-provider.ts src/plugins/context/history/__tests__/history-provider.test.ts
git commit -m "feat(history): add HistoryProvider implementing ContextProvider interface"
```

---

### Task 6: Plugin Integration (`index.ts`)

**Files:**
- Modify: `src/plugins/context/index.ts`

- [ ] **Step 1: Write failing integration test**

```typescript
// src/plugins/context/history/__tests__/integration.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { HistoryRecorder } from "../history-recorder.js";
import { HistoryStore } from "../history-store.js";
import { HistoryProvider } from "../history-provider.js";
import type { AgentEvent } from "../../../../core/types.js";

describe("History Integration", () => {
  let tmpDir: string;
  let store: HistoryStore;
  let recorder: HistoryRecorder;
  let provider: HistoryProvider;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "history-integration-test-"));
    store = new HistoryStore(tmpDir);
    recorder = new HistoryRecorder(store);
    provider = new HistoryProvider(store, () => [{
      sessionId: "sess-1",
      agentSessionId: "agent-1",
      agentName: "claude-code",
      workingDir: "/test",
      channelId: "telegram",
      status: "finished" as const,
      createdAt: "2026-03-30T10:00:00Z",
      lastActiveAt: "2026-03-30T10:05:00Z",
      name: "Test Session",
      platform: {},
    }]);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("records a full conversation and builds context from it", async () => {
    // Simulate a conversation
    recorder.onBeforePrompt("sess-1", "Fix the login bug", undefined);
    recorder.onAfterEvent("sess-1", { type: "thought", content: "Let me look at the auth code..." } as AgentEvent);
    recorder.onAfterEvent("sess-1", {
      type: "tool_call", id: "t1", name: "Read", kind: "read", status: "pending",
    } as AgentEvent);
    recorder.onAfterEvent("sess-1", {
      type: "tool_update", id: "t1", status: "completed",
      rawInput: { file_path: "src/auth.ts" },
      rawOutput: "file content",
      locations: [{ path: "src/auth.ts", line: 1 }],
    } as AgentEvent);
    recorder.onAfterEvent("sess-1", { type: "text", content: "Found the bug. Fixing now." } as AgentEvent);
    recorder.onAfterEvent("sess-1", {
      type: "tool_call", id: "t2", name: "Edit", kind: "edit", status: "pending",
    } as AgentEvent);
    recorder.onAfterEvent("sess-1", {
      type: "tool_update", id: "t2", status: "completed",
      rawInput: { file_path: "src/auth.ts", old_string: "old", new_string: "new" },
      rawOutput: "Updated",
      content: [{ type: "diff", path: "src/auth.ts", oldText: "old", newText: "new" }],
      locations: [{ path: "src/auth.ts", line: 42 }],
    } as AgentEvent);
    recorder.onAfterEvent("sess-1", { type: "text", content: "Fixed!" } as AgentEvent);
    recorder.onAfterEvent("sess-1", {
      type: "usage", tokensUsed: 5000, contextSize: 200000, cost: { amount: 0.03, currency: "USD" },
    } as AgentEvent);
    await recorder.onTurnEnd("sess-1", "end_turn");

    // Now build context from the recorded history
    const result = await provider.buildContext({ repoPath: "/test", type: "session", value: "sess-1" });

    expect(result.markdown).toContain("Fix the login bug");
    expect(result.markdown).toContain("Found the bug");
    expect(result.markdown).toContain("Read");
    expect(result.markdown).toContain("Edit");
    expect(result.markdown).toContain("src/auth.ts");
    expect(result.sessionCount).toBe(1);
    expect(result.totalTurns).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run integration test to verify it fails then passes**

Run: `pnpm vitest run src/plugins/context/history/__tests__/integration.test.ts`
Expected: PASS (all components already implemented)

- [ ] **Step 3: Update context plugin index.ts**

Modify `src/plugins/context/index.ts` to register HistoryRecorder middleware and HistoryProvider:

```typescript
// src/plugins/context/index.ts

import * as os from 'node:os'
import * as path from 'node:path'
import type { VibenPlugin, InstallContext } from '../../core/plugin/types.js'
import { ContextManager } from './context-manager.js'
import { EntireProvider } from './entire/entire-provider.js'
import { HistoryProvider } from './history/history-provider.js'
import { HistoryRecorder } from './history/history-recorder.js'
import { HistoryStore } from './history/history-store.js'

const contextPlugin: VibenPlugin = {
  name: '@viben/context',
  version: '1.0.0',
  description: 'Conversation context management with pluggable providers',
  essential: false,
  permissions: ['services:register', 'middleware:register', 'events:read'],

  async install(ctx: InstallContext) {
    const { settings, terminal } = ctx
    await settings.setAll({ enabled: true })
    terminal.log.success('Context defaults saved')
  },

  async configure(ctx: InstallContext) {
    const { terminal, settings } = ctx
    const current = await settings.getAll()
    const toggle = await terminal.confirm({
      message: `Context service is ${current.enabled !== false ? 'enabled' : 'disabled'}. Toggle?`,
      initialValue: false,
    })
    if (toggle) {
      const newState = current.enabled === false
      await settings.set('enabled', newState)
      terminal.log.success(`Context service ${newState ? 'enabled' : 'disabled'}`)
    }
  },

  async uninstall(ctx: InstallContext, opts: { purge: boolean }) {
    if (opts.purge) {
      await ctx.settings.clear()
      ctx.terminal.log.success('Context settings cleared')
    }
  },

  async setup(ctx) {
    const historyDir = path.join(os.homedir(), '.viben', 'history')
    const store = new HistoryStore(historyDir)
    const recorder = new HistoryRecorder(store)

    // Get session records accessor from core
    const sessionStore = ctx.getService<{ list(): import('../../core/types.js').SessionRecord[] }>('sessionStore')
    const getRecords = () => sessionStore?.list() ?? []

    // Register providers
    const manager = new ContextManager()
    const historyProvider = new HistoryProvider(store, getRecords)
    manager.register(historyProvider) // local provider first (priority)
    manager.register(new EntireProvider())
    ctx.registerService('context', manager)

    // Register middleware hooks for recording
    ctx.registerMiddleware('agent:beforePrompt', {
      priority: 200, // Run late — after other middleware modifies text
      handler: async (payload, next) => {
        recorder.onBeforePrompt(payload.sessionId, payload.text, payload.attachments)
        return next()
      },
    })

    ctx.registerMiddleware('agent:afterEvent', {
      priority: 200,
      handler: async (payload, next) => {
        recorder.onAfterEvent(payload.sessionId, payload.event)
        return next()
      },
    })

    ctx.registerMiddleware('turn:end', {
      priority: 200,
      handler: async (payload, next) => {
        await recorder.onTurnEnd(payload.sessionId, payload.stopReason)
        return next()
      },
    })

    ctx.registerMiddleware('permission:afterResolve', {
      priority: 200,
      handler: async (payload, next) => {
        recorder.onPermissionResolved(payload.sessionId, payload.requestId, payload.decision)
        return next()
      },
    })

    // Clean up recorder when session ends
    ctx.on('session:ended', (data: { sessionId: string }) => {
      recorder.finalize(data.sessionId)
    })

    ctx.log.info('Context service ready (local history + entire providers)')
  },
}

export default contextPlugin
```

- [ ] **Step 4: Verify the plugin compiles**

Run: `pnpm build`
Expected: No TypeScript errors

- [ ] **Step 5: Check if `getService('sessionStore')` exists — if not, adjust**

The `getRecords` accessor needs access to session records. Check if `sessionStore` is registered as a service. If not, use the `sessions` property on PluginContext instead:

```typescript
// Alternative if sessionStore is not a registered service:
const getRecords = () => {
  const sessions = ctx.sessions as { list(): import('../../core/types.js').SessionRecord[] } | undefined
  return sessions?.list() ?? []
}
```

Read `src/core/plugin/plugin-context.ts` to find the correct API for accessing session records from a plugin. Adjust the `getRecords` implementation accordingly.

- [ ] **Step 6: Check if `session:ended` event exists on EventBus — if not, adjust**

Read `src/core/event-bus.ts` to verify `session:ended` is an event. If it's named differently (e.g., `session:updated` with status check), adjust the listener. Alternative: use `session:afterDestroy` middleware hook instead.

- [ ] **Step 7: Run all tests**

Run: `pnpm vitest run src/plugins/context/`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/plugins/context/index.ts src/plugins/context/history/__tests__/integration.test.ts
git commit -m "feat(history): integrate HistoryRecorder and HistoryProvider into context plugin"
```

---

### Task 7: Full Build & Test Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run full build**

Run: `pnpm build`
Expected: No TypeScript errors

- [ ] **Step 3: Verify history directory creation**

Run the app briefly and send a test message, then verify:
```bash
ls ~/.viben/history/
```
Expected: A JSON file should appear with the session ID

- [ ] **Step 4: Final commit if any adjustments were made**

```bash
git add -A
git commit -m "chore(history): build verification and adjustments"
```
