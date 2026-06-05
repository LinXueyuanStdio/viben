# Entire Context Resume — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to resume previous coding session context via `/resume` command by reading Entire.io checkpoints from git and injecting conversation history into new agent sessions.

**Architecture:** Abstract `ContextProvider` interface with `EntireProvider` as first implementation. `ContextManager` in core registers providers. Adapters call `core.createSessionWithContext()`. Conversation history is parsed from JSONL transcripts on `entire/checkpoints/v1` git branch, cleaned of system noise, and formatted with adaptive mode (full/balanced/compact) based on total conversation size.

**Tech Stack:** TypeScript (ESM), Node.js `child_process.execFileSync` for git operations, Vitest for tests. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-03-25-entire-context-resume-design.md`
**Prototype reference:** `/tmp/rebuild_conversation_v6.py` (session parser), `/tmp/entire_extract.py` (multi-session extractor)

---

## File Structure

```
src/core/context/
  context-provider.ts       — ContextProvider interface, ContextQuery, ContextResult, SessionInfo types
  context-manager.ts        — ContextManager class: provider registry + buildContext convenience
  entire/
    entire-provider.ts      — EntireProvider: implements ContextProvider, orchestrates resolve → rebuild
    checkpoint-reader.ts    — Git operations: list checkpoints, read metadata, extract JSONL, resolve entry points
    conversation-builder.ts — Parse JSONL turns, apply adaptive mode, merge sessions, format markdown
    message-cleaner.ts      — System tag stripping, skill prompt detection, noise filtering

src/core/context/__tests__/
  message-cleaner.test.ts
  conversation-builder.test.ts
  checkpoint-reader.test.ts
  entire-provider.test.ts
  context-manager.test.ts

src/core/context/__tests__/fixtures/
  short-session.jsonl          — 2 turns, for full mode testing
  medium-session.jsonl         — 15 turns, for balanced mode testing
  long-session.jsonl           — 30 turns, for compact mode testing
  metadata-checkpoint.json     — sample checkpoint metadata
  metadata-session.json        — sample session metadata

Modified files:
  src/core/session.ts          — Add pendingContext + setContext() + inject in processPrompt
  src/core/core.ts             — Add contextManager field + createSessionWithContext() method
  src/core/index.ts            — Export new context types
  src/adapters/telegram/commands/index.ts  — Register /resume command
  src/adapters/telegram/commands/resume.ts — New: /resume command handler
```

---

## Phases

| Phase | Description | Tasks |
|-------|-------------|-------|
| 1 | Foundation: types + message cleaner | 1–2 |
| 2 | Conversation builder (JSONL → markdown) | 3–4 |
| 3 | Checkpoint reader (git operations) | 5–6 |
| 4 | Entire provider + context manager + cache | 7–9 |
| 5 | Session context injection + core integration | 10–11 |
| 6 | Telegram /resume command + tests | 12–14 |

---

## Task 1: Context Provider Interface + Types

**Files:**
- Create: `src/core/context/context-provider.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/core/context/context-provider.ts

// NOTE: This interface is designed around Entire as the first provider.
// It may evolve when additional providers (Cursor history, Zed, etc.) are added.
// Providers may only support a subset of query types and should return empty results
// for unsupported types rather than throwing.

export interface ContextProvider {
  readonly name: string;
  isAvailable(repoPath: string): Promise<boolean>;
  listSessions(query: ContextQuery): Promise<SessionListResult>;
  buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult>;
}

export interface ContextQuery {
  repoPath: string;
  type: "branch" | "commit" | "pr" | "latest" | "checkpoint" | "session";
  value: string;
}

export interface ContextOptions {
  maxTokens?: number;
  limit?: number;
}

export interface SessionInfo {
  checkpointId: string;
  sessionIndex: string;
  transcriptPath: string;
  createdAt: string;
  endedAt: string;
  branch: string;
  agent: string;
  turnCount: number;
  filesTouched: string[];
  sessionId: string;
}

export interface SessionListResult {
  sessions: SessionInfo[];
  estimatedTokens: number;
}

export type ContextMode = "full" | "balanced" | "compact";

export interface ContextResult {
  markdown: string;
  tokenEstimate: number;
  sessionCount: number;
  totalTurns: number;
  mode: ContextMode;
  truncated: boolean;
  timeRange: { start: string; end: string };
}

export const DEFAULT_MAX_TOKENS = 30_000;
export const TOKENS_PER_TURN_ESTIMATE = 400;
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build 2>&1 | tail -5`
Expected: no errors from context-provider.ts

- [ ] **Step 3: Commit**

```bash
git add src/core/context/context-provider.ts
git commit -m "feat(context): add ContextProvider interface and types"
```

---

## Task 2: Message Cleaner

Port filtering logic from `rebuild_conversation_v6.py` lines 16–87.

**Files:**
- Create: `src/core/context/entire/message-cleaner.ts`
- Create: `src/core/context/__tests__/message-cleaner.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/core/context/__tests__/message-cleaner.test.ts
import { describe, it, expect } from "vitest";
import { cleanSystemTags, isSkillPrompt, isNoiseMessage } from "../entire/message-cleaner.js";

describe("MessageCleaner", () => {
  describe("cleanSystemTags", () => {
    it("strips system-reminder tags", () => {
      const input = "<system-reminder>some system text</system-reminder>Hello user";
      expect(cleanSystemTags(input)).toBe("Hello user");
    });

    it("strips ide_selection tags", () => {
      const input = "<ide_selection>The user selected lines 1-10</ide_selection>Fix this bug";
      expect(cleanSystemTags(input)).toBe("Fix this bug");
    });

    it("strips ide_opened_file tags", () => {
      const input = "<ide_opened_file>User opened foo.ts</ide_opened_file>Check this";
      expect(cleanSystemTags(input)).toBe("Check this");
    });

    it("strips task-notification tags", () => {
      const input = "<task-notification><task-id>abc</task-id></task-notification>Continue";
      expect(cleanSystemTags(input)).toBe("Continue");
    });

    it("extracts command-args as user input", () => {
      const input = '<command-name>/brainstorm</command-name><command-args>fix the login bug</command-args>';
      expect(cleanSystemTags(input)).toBe("fix the login bug");
    });

    it("preserves code/JSX tags", () => {
      const input = "Check this component <Badge variant='pill'>Skill</Badge>";
      expect(cleanSystemTags(input)).toBe("Check this component <Badge variant='pill'>Skill</Badge>");
    });

    it("preserves TypeScript generics", () => {
      const input = "Type Map<string, T> is wrong";
      expect(cleanSystemTags(input)).toBe("Type Map<string, T> is wrong");
    });

    it("handles multiple system tags", () => {
      const input = "<system-reminder>x</system-reminder><local-command-caveat>y</local-command-caveat>Real text";
      expect(cleanSystemTags(input)).toBe("Real text");
    });

    it("returns empty string when only system tags", () => {
      const input = "<system-reminder>foo</system-reminder><local-command-stdout>bar</local-command-stdout>";
      expect(cleanSystemTags(input)).toBe("");
    });
  });

  describe("isSkillPrompt", () => {
    it("detects HARD-GATE marker", () => {
      expect(isSkillPrompt("Some text <HARD-GATE> Do not code </HARD-GATE>")).toBe(true);
    });

    it("detects skill base directory", () => {
      expect(isSkillPrompt("Base directory for this skill: /path/to/skill")).toBe(true);
    });

    it("detects long markdown with many headers", () => {
      const longText = "x".repeat(2001) + "## A\n## B\n## C";
      expect(isSkillPrompt(longText)).toBe(true);
    });

    it("does not flag normal user messages", () => {
      expect(isSkillPrompt("fix the login bug please")).toBe(false);
    });

    it("does not flag short messages with code headers", () => {
      expect(isSkillPrompt("## My Title\nSome text")).toBe(false);
    });
  });

  describe("isNoiseMessage", () => {
    it("detects 'ready'", () => {
      expect(isNoiseMessage("ready")).toBe(true);
    });

    it("detects model switch", () => {
      expect(isNoiseMessage("opus[1m]")).toBe(true);
    });

    it("detects deprecated skill redirect", () => {
      expect(isNoiseMessage("Tell your human partner that this command is deprecated and will be removed")).toBe(true);
    });

    it("detects subagent output retrieval", () => {
      expect(isNoiseMessage("Read the output file to retrieve the result: /tmp/file")).toBe(true);
    });

    it("does not flag real user messages", () => {
      expect(isNoiseMessage("fix the pagination bug")).toBe(false);
    });

    it("returns true for empty after cleaning", () => {
      expect(isNoiseMessage("<system-reminder>x</system-reminder>")).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/core/context/__tests__/message-cleaner.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Implement message-cleaner.ts**

Port from Python prototype (`rebuild_conversation_v6.py` lines 16–87). Key differences from Python:
- Use JS RegExp with `[\s\S]*?` for multiline matching (same as Python `re.DOTALL`)
- `re.match` → `new RegExp(...).test()`

```typescript
// src/core/context/entire/message-cleaner.ts

const SYSTEM_TAG_PATTERNS: RegExp[] = [
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  /<command-name>[\s\S]*?<\/command-name>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<user-prompt-submit-hook>[\s\S]*?<\/user-prompt-submit-hook>/g,
  /<ide_selection>[\s\S]*?<\/ide_selection>/g,
  /<ide_context>[\s\S]*?<\/ide_context>/g,
  /<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g,
  /<cursor_context>[\s\S]*?<\/cursor_context>/g,
  /<attached_files>[\s\S]*?<\/attached_files>/g,
  /<repo_context>[\s\S]*?<\/repo_context>/g,
  /<task-notification>[\s\S]*?<\/task-notification>/g,
];

const COMMAND_ARGS_RE = /<command-args>([\s\S]*?)<\/command-args>/;

export function cleanSystemTags(text: string): string {
  // Extract command-args first (this IS the real user input)
  const argsMatch = COMMAND_ARGS_RE.exec(text);
  const userArgs = argsMatch?.[1]?.trim() ?? "";

  // Remove command-args tag
  text = text.replace(/<command-args>[\s\S]*?<\/command-args>/g, "");

  // Remove system tags
  for (const pat of SYSTEM_TAG_PATTERNS) {
    text = text.replace(new RegExp(pat.source, pat.flags), "");
  }
  text = text.trim();

  if (!text && userArgs) return userArgs;
  if (text && userArgs && text !== userArgs) return `${text}\n${userArgs}`;
  return text || userArgs;
}

const SKILL_INDICATORS = [
  "Base directory for this skill:",
  "<HARD-GATE>",
  "## Checklist",
  "## Process Flow",
  "## Key Principles",
  "digraph brainstorming",
  "You MUST create a task for each",
];

export function isSkillPrompt(text: string): boolean {
  for (const indicator of SKILL_INDICATORS) {
    if (text.includes(indicator)) return true;
  }
  if (text.length > 2000) {
    const headerCount = (text.match(/## /g) || []).length;
    if (headerCount >= 3) return true;
  }
  return false;
}

export function isNoiseMessage(text: string): boolean {
  const cleaned = cleanSystemTags(text);
  if (!cleaned) return true;
  if (/^(ready|ready\.)$/i.test(cleaned)) return true;
  if (cleaned.includes("Tell your human partner that this command is deprecated")) return true;
  if (cleaned.startsWith("Read the output file to retrieve the result:")) return true;
  if (/^(opus|sonnet|haiku|claude)(\[.*\])?$/i.test(cleaned)) return true;
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/core/context/__tests__/message-cleaner.test.ts 2>&1 | tail -10`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/context/entire/message-cleaner.ts src/core/context/__tests__/message-cleaner.test.ts
git commit -m "feat(context): add message cleaner with system tag filtering"
```

---

## Task 3: Conversation Builder — Turn Parsing

Port turn parsing from `rebuild_conversation_v6.py` lines 89–309.

**Files:**
- Create: `src/core/context/entire/conversation-builder.ts`
- Create: `src/core/context/__tests__/fixtures/short-session.jsonl`
- Create: `src/core/context/__tests__/conversation-builder.test.ts`

- [ ] **Step 1: Create test fixture — short session (2 turns)**

Extract a minimal `full.jsonl` fixture with: 2 user messages, 2 assistant responses (one with text, one with Edit tool_use). Keep it small (~20 lines). Can extract from the validated test data or craft manually matching the real format:

```jsonl
{"type":"user","message":{"role":"user","content":"fix the bug"},"timestamp":"2026-03-15T18:53:00.000Z","uuid":"u1","parentUuid":null,"sessionId":"sess1","gitBranch":"main"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Found the issue in app.ts."}]},"timestamp":"2026-03-15T18:53:10.000Z","uuid":"a1","parentUuid":"u1","sessionId":"sess1","gitBranch":"main"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"Edit","input":{"file_path":"/src/app.ts","old_string":"const x = 1","new_string":"const x = 2"}}]},"timestamp":"2026-03-15T18:53:15.000Z","uuid":"a2","parentUuid":"a1","sessionId":"sess1","gitBranch":"main"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Fixed the variable."}]},"timestamp":"2026-03-15T18:53:20.000Z","uuid":"a3","parentUuid":"a2","sessionId":"sess1","gitBranch":"main"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"OK"}]},"timestamp":"2026-03-15T18:53:25.000Z","uuid":"u2a","parentUuid":"a3","sessionId":"sess1","gitBranch":"main"}
{"type":"user","message":{"role":"user","content":"now add tests"},"timestamp":"2026-03-15T18:54:00.000Z","uuid":"u2","parentUuid":"a3","sessionId":"sess1","gitBranch":"main"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I'll add a test file."}]},"timestamp":"2026-03-15T18:54:10.000Z","uuid":"a4","parentUuid":"u2","sessionId":"sess1","gitBranch":"main"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"t2","name":"Write","input":{"file_path":"/src/app.test.ts","content":"import { test } from 'vitest';\ntest('works', () => { expect(1).toBe(1); });"}}]},"timestamp":"2026-03-15T18:54:15.000Z","uuid":"a5","parentUuid":"a4","sessionId":"sess1","gitBranch":"main"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Test file created."}]},"timestamp":"2026-03-15T18:54:20.000Z","uuid":"a6","parentUuid":"a5","sessionId":"sess1","gitBranch":"main"}
```

- [ ] **Step 2: Write the failing tests**

```typescript
// src/core/context/__tests__/conversation-builder.test.ts
import { describe, it, expect } from "vitest";
import { parseJsonlToTurns, buildSessionMarkdown, selectMode } from "../entire/conversation-builder.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fixturesDir = join(import.meta.dirname, "fixtures");

describe("ConversationBuilder", () => {
  describe("selectMode", () => {
    it("returns full for ≤10 turns", () => {
      expect(selectMode(1)).toBe("full");
      expect(selectMode(10)).toBe("full");
    });
    it("returns balanced for 11-25 turns", () => {
      expect(selectMode(11)).toBe("balanced");
      expect(selectMode(25)).toBe("balanced");
    });
    it("returns compact for >25 turns", () => {
      expect(selectMode(26)).toBe("compact");
      expect(selectMode(100)).toBe("compact");
    });
  });

  describe("parseJsonlToTurns", () => {
    it("parses short session fixture into turns", () => {
      const jsonl = readFileSync(join(fixturesDir, "short-session.jsonl"), "utf-8");
      const result = parseJsonlToTurns(jsonl);
      expect(result.turns.length).toBe(2);
      expect(result.turns[0].userText).toBe("fix the bug");
      expect(result.turns[1].userText).toBe("now add tests");
      expect(result.branch).toBe("main");
    });

    it("skips tool_result-only user messages", () => {
      const jsonl = readFileSync(join(fixturesDir, "short-session.jsonl"), "utf-8");
      const result = parseJsonlToTurns(jsonl);
      // tool_result message should not create a turn
      expect(result.turns.every(t => !t.userText.includes("tool_result"))).toBe(true);
    });

    it("extracts Edit tool_use from assistant parts", () => {
      const jsonl = readFileSync(join(fixturesDir, "short-session.jsonl"), "utf-8");
      const result = parseJsonlToTurns(jsonl);
      const editParts = result.turns[0].assistantParts.filter(p => p.type === "edit");
      expect(editParts.length).toBe(1);
      expect(editParts[0].type).toBe("edit");
    });

    it("extracts Write tool_use from assistant parts", () => {
      const jsonl = readFileSync(join(fixturesDir, "short-session.jsonl"), "utf-8");
      const result = parseJsonlToTurns(jsonl);
      const writeParts = result.turns[1].assistantParts.filter(p => p.type === "write");
      expect(writeParts.length).toBe(1);
    });

    it("merges consecutive assistant text blocks", () => {
      const jsonl = readFileSync(join(fixturesDir, "short-session.jsonl"), "utf-8");
      const result = parseJsonlToTurns(jsonl);
      // First turn: "Found the issue" text, then Edit, then "Fixed the variable" text
      const textParts = result.turns[0].assistantParts.filter(p => p.type === "text");
      expect(textParts.length).toBe(2); // before and after edit
    });

    it("extracts timestamps", () => {
      const jsonl = readFileSync(join(fixturesDir, "short-session.jsonl"), "utf-8");
      const result = parseJsonlToTurns(jsonl);
      expect(result.firstTimestamp).toContain("2026-03-15");
      expect(result.lastTimestamp).toContain("2026-03-15");
    });
  });

  describe("buildSessionMarkdown", () => {
    it("renders in full mode with complete diffs", () => {
      const jsonl = readFileSync(join(fixturesDir, "short-session.jsonl"), "utf-8");
      const result = parseJsonlToTurns(jsonl);
      const md = buildSessionMarkdown(result.turns, "full");
      expect(md).toContain("**User [1]:**");
      expect(md).toContain("fix the bug");
      expect(md).toContain("```diff");
      expect(md).toContain("- const x = 1");
      expect(md).toContain("+ const x = 2");
    });

    it("renders in compact mode with one-liner edits", () => {
      const jsonl = readFileSync(join(fixturesDir, "short-session.jsonl"), "utf-8");
      const result = parseJsonlToTurns(jsonl);
      const md = buildSessionMarkdown(result.turns, "compact");
      expect(md).toContain("**User [1]:**");
      expect(md).not.toContain("```diff");
      expect(md).toContain("✏️");
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- src/core/context/__tests__/conversation-builder.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 4: Implement conversation-builder.ts**

Port from Python prototype. The key types and functions:

```typescript
// src/core/context/entire/conversation-builder.ts
import { cleanSystemTags, isSkillPrompt, isNoiseMessage } from "./message-cleaner.js";
import type { ContextMode } from "../context-provider.js";

export interface AssistantPart {
  type: "text" | "edit" | "write";
  content?: string;  // for text
  file?: string;     // for edit/write
  old?: string;      // for edit
  new?: string;      // for edit
  fileContent?: string; // for write
}

export interface Turn {
  userText: string;
  userTimestamp: string;
  assistantParts: AssistantPart[];
}

export interface ParseResult {
  turns: Turn[];
  branch: string;
  firstTimestamp: string;
  lastTimestamp: string;
}

export function selectMode(totalTurns: number): ContextMode {
  if (totalTurns <= 10) return "full";
  if (totalTurns <= 25) return "balanced";
  return "compact";
}

export function parseJsonlToTurns(jsonl: string): ParseResult {
  // Port from rebuild_conversation_v6.py lines 220-309
  // Parse each line, filter user/assistant, build turns
  // Apply message cleaner filters
  // Return structured ParseResult
}

export function buildSessionMarkdown(turns: Turn[], mode: ContextMode): string {
  // Port from rebuild_conversation_v6.py lines 327-431
  // Format each turn: user text + assistant text + file changes per mode
  // Return markdown string
}

// Formatting helpers (port from Python format_edit_full/balanced/compact, format_write_*)
function formatEditFull(file: string, oldStr: string, newStr: string): string { ... }
function formatEditBalanced(file: string, oldStr: string, newStr: string): string { ... }
function formatEditCompact(file: string, oldStr: string, newStr: string): string { ... }
function formatWriteFull(file: string, content: string): string { ... }
function formatWriteBalanced(file: string, content: string): string { ... }
function formatWriteCompact(file: string, content: string): string { ... }

function shortenPath(fp: string): string {
  const parts = fp.split("/");
  return parts.length >= 2 ? parts.slice(-2).join("/") : fp;
}
```

Implement the full file — port each function from the Python prototype preserving the exact same logic. The Python code at `/tmp/rebuild_conversation_v6.py` is the source of truth.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- src/core/context/__tests__/conversation-builder.test.ts 2>&1 | tail -10`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/context/entire/conversation-builder.ts src/core/context/__tests__/conversation-builder.test.ts src/core/context/__tests__/fixtures/
git commit -m "feat(context): add conversation builder with adaptive mode rendering"
```

---

## Task 4: Conversation Builder — Token Budget + Multi-Session Merge

**Files:**
- Modify: `src/core/context/entire/conversation-builder.ts`
- Modify: `src/core/context/__tests__/conversation-builder.test.ts`

- [ ] **Step 1: Write failing tests for merge + budget**

Add to conversation-builder.test.ts:

```typescript
import { mergeSessionsMarkdown, estimateTokens } from "../entire/conversation-builder.js";

describe("mergeSessionsMarkdown", () => {
  it("orders sessions chronologically (oldest first)", () => {
    const sessions = [
      { label: "Session 2", markdown: "content2", startTime: "2026-03-16T10:00", endTime: "2026-03-16T11:00", agent: "Claude Code", turns: 3, branch: "main", files: ["a.ts"] },
      { label: "Session 1", markdown: "content1", startTime: "2026-03-15T10:00", endTime: "2026-03-15T11:00", agent: "Claude Code", turns: 5, branch: "main", files: ["b.ts"] },
    ];
    const result = mergeSessionsMarkdown(sessions, "full", "PR #19");
    expect(result.indexOf("Session Conversation History 1")).toBeLessThan(result.indexOf("Session Conversation History 2"));
    expect(result.indexOf("2026-03-15")).toBeLessThan(result.indexOf("2026-03-16"));
  });

  it("includes branch per session", () => {
    const sessions = [
      { label: "S1", markdown: "c1", startTime: "2026-03-15T10:00", endTime: "2026-03-15T11:00", agent: "Claude Code", turns: 3, branch: "feature-x", files: [] },
    ];
    const result = mergeSessionsMarkdown(sessions, "full", "test");
    expect(result).toContain("branch: feature-x");
  });

  it("appends disclaimer at the end", () => {
    const sessions = [
      { label: "S1", markdown: "c1", startTime: "2026-03-15T10:00", endTime: "2026-03-15T11:00", agent: "Claude Code", turns: 3, branch: "main", files: [] },
    ];
    const result = mergeSessionsMarkdown(sessions, "full", "test");
    expect(result).toContain("may be outdated");
    expect(result).toContain("Always verify the current state");
  });
});

describe("estimateTokens", () => {
  it("estimates ~chars/4", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement merge + budget functions**

Add to `conversation-builder.ts`:

```typescript
export interface SessionMarkdownInput {
  markdown: string;
  startTime: string;
  endTime: string;
  agent: string;
  turns: number;
  branch: string;
  files: string[];
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const DISCLAIMER = `---
⚠️ The conversation history above is from previous sessions and may be outdated.
Files, code, and decisions referenced may have changed since then.
Always verify the current state of the codebase before making changes based on this history.
---`;

export function mergeSessionsMarkdown(
  sessions: SessionMarkdownInput[],
  mode: ContextMode,
  title: string,
): string {
  // Sort chronologically
  const sorted = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const firstTs = sorted[0]?.startTime.slice(0, 16) ?? "?";
  const lastTs = sorted[sorted.length - 1]?.endTime.slice(0, 16) ?? "?";
  const totalTurns = sorted.reduce((sum, s) => sum + s.turns, 0);

  const lines: string[] = [];
  lines.push(`# Conversation History from ${title}`);
  lines.push("");
  lines.push(`${sorted.length} sessions | ${totalTurns} turns | ${firstTs} → ${lastTs} | mode: ${mode}`);
  lines.push("");

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const start = s.startTime.slice(0, 16);
    const end = s.endTime.slice(0, 16);
    lines.push(`## Session Conversation History ${i + 1} — ${start} → ${end} (${s.agent}, ${s.turns} turns, branch: ${s.branch})`);
    if (s.files.length > 0) {
      lines.push(`*Files: ${s.files.slice(0, 8).map(f => f.split("/").pop()).join(", ")}*`);
    }
    lines.push("");
    lines.push(s.markdown);
    lines.push("");
  }

  lines.push(DISCLAIMER);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add src/core/context/entire/conversation-builder.ts src/core/context/__tests__/conversation-builder.test.ts
git commit -m "feat(context): add session merge and token estimation"
```

---

## Task 5: Checkpoint Reader — Git Operations

Port from `entire_extract.py` lines 22–174.

**Files:**
- Create: `src/core/context/entire/checkpoint-reader.ts`
- Create: `src/core/context/__tests__/checkpoint-reader.test.ts`

- [ ] **Step 1: Write failing tests**

Tests mock `execFileSync` to avoid needing a real git repo:

```typescript
// src/core/context/__tests__/checkpoint-reader.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CheckpointReader } from "../entire/checkpoint-reader.js";

// We test the parsing logic, not git itself
describe("CheckpointReader", () => {
  describe("hasEntireBranch", () => {
    it("returns true when branch exists", async () => {
      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockReturnValue("origin/entire/checkpoints/v1");
      expect(await reader.hasEntireBranch()).toBe(true);
    });

    it("returns false when branch missing", async () => {
      const reader = new CheckpointReader("/repo");
      vi.spyOn(reader as any, "git").mockReturnValue("origin/main");
      expect(await reader.hasEntireBranch()).toBe(false);
    });
  });

  describe("parseCheckpointMetadata", () => {
    it("parses valid checkpoint metadata JSON", () => {
      const json = JSON.stringify({
        checkpoint_id: "f634acf05138",
        branch: "main",
        files_touched: ["src/app.ts"],
        sessions: [{ metadata: "/f6/34acf05138/0/metadata.json", transcript: "/f6/34acf05138/0/full.jsonl" }],
      });
      const result = CheckpointReader.parseCheckpointMeta(json);
      expect(result?.branch).toBe("main");
      expect(result?.sessions.length).toBe(1);
    });

    it("returns null for invalid JSON", () => {
      expect(CheckpointReader.parseCheckpointMeta("not json")).toBeNull();
    });
  });

  describe("shardPath", () => {
    it("converts checkpoint ID to shard path", () => {
      expect(CheckpointReader.shardPath("f634acf05138")).toBe("f6/34acf05138");
    });
  });

  describe("resolveByPr — commit parsing", () => {
    it("extracts checkpoint IDs from git log output", () => {
      const logOutput = "abc123|feat: something|f634acf05138\ndef456|fix: other|";
      const ids = CheckpointReader.parseCheckpointTrailers(logOutput);
      expect(ids).toEqual(["f634acf05138"]);
    });
  });

  describe("ID format detection", () => {
    it("detects checkpoint ID (12 hex)", () => {
      expect(CheckpointReader.isCheckpointId("f634acf05138")).toBe(true);
      expect(CheckpointReader.isCheckpointId("abc123")).toBe(false); // too short
    });

    it("detects session ID (UUID)", () => {
      expect(CheckpointReader.isSessionId("1d9503b8-0134-419a-a3a7-019b312dd12c")).toBe(true);
      expect(CheckpointReader.isSessionId("not-a-uuid")).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement checkpoint-reader.ts**

```typescript
// src/core/context/entire/checkpoint-reader.ts
import { execFileSync } from "node:child_process";
import type { SessionInfo } from "../context-provider.js";

export class CheckpointReader {
  constructor(private repoPath: string) {}

  private git(...args: string[]): string {
    try {
      return execFileSync("git", ["-C", this.repoPath, ...args], {
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024, // 50MB for large JSONL
      }).trim();
    } catch {
      return "";
    }
  }

  async hasEntireBranch(): Promise<boolean> {
    const branches = this.git("branch", "-r");
    return branches.includes("entire/checkpoints/v1");
  }

  // Resolve entry points → SessionInfo[]
  // Port each resolve_by_* from entire_extract.py

  async resolveByBranch(branchName: string): Promise<SessionInfo[]> { ... }
  async resolveByCommit(commitHash: string): Promise<SessionInfo[]> { ... }
  async resolveByPr(prInput: string): Promise<SessionInfo[]> { ... }
  async resolveByCheckpoint(checkpointId: string): Promise<SessionInfo[]> { ... }
  async resolveBySessionId(sessionId: string): Promise<SessionInfo[]> { ... }
  async resolveLatest(count: number): Promise<SessionInfo[]> { ... }

  getTranscript(transcriptPath: string): string { ... }

  // Static helpers
  static shardPath(cpId: string): string { return `${cpId.slice(0, 2)}/${cpId.slice(2)}`; }
  static parseCheckpointMeta(json: string): { ... } | null { ... }
  static parseCheckpointTrailers(logOutput: string): string[] { ... }
  static isCheckpointId(value: string): boolean { return /^[0-9a-f]{12}$/.test(value); }
  static isSessionId(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }
}
```

Port each `resolve_by_*` method from `entire_extract.py` — same git commands, same logic.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add src/core/context/entire/checkpoint-reader.ts src/core/context/__tests__/checkpoint-reader.test.ts
git commit -m "feat(context): add checkpoint reader with git operations and entry point resolution"
```

---

## Task 6: Checkpoint Reader — Integration Test with Fixtures

**Files:**
- Create: `src/core/context/__tests__/fixtures/metadata-checkpoint.json`
- Create: `src/core/context/__tests__/fixtures/metadata-session.json`
- Modify: `src/core/context/__tests__/checkpoint-reader.test.ts`

- [ ] **Step 1: Create fixture files**

`metadata-checkpoint.json`:
```json
{
  "cli_version": "0.5.0",
  "checkpoint_id": "f634acf05138",
  "branch": "main",
  "files_touched": ["src/app.ts", "src/app.test.ts"],
  "sessions": [
    { "metadata": "/f6/34acf05138/0/metadata.json", "transcript": "/f6/34acf05138/0/full.jsonl" }
  ]
}
```

`metadata-session.json`:
```json
{
  "cli_version": "0.5.0",
  "checkpoint_id": "f634acf05138",
  "session_id": "082e8393-b2a5-4eb4-b70a-4338c754da64",
  "created_at": "2026-03-12T06:59:39.787Z",
  "branch": "main",
  "files_touched": ["src/app.ts", "src/app.test.ts"],
  "agent": "Claude Code",
  "session_metrics": { "turn_count": 5 }
}
```

- [ ] **Step 2: Add integration tests using mocked git**

Test the full resolve flow by mocking `git` method to return fixture data:

```typescript
describe("CheckpointReader — integration with fixtures", () => {
  it("resolves checkpoint ID to sessions", async () => {
    const reader = new CheckpointReader("/repo");
    const cpMeta = readFileSync(join(fixturesDir, "metadata-checkpoint.json"), "utf-8");
    const sessMeta = readFileSync(join(fixturesDir, "metadata-session.json"), "utf-8");

    vi.spyOn(reader as any, "git")
      .mockImplementation((...args: string[]) => {
        const cmd = args.join(" ");
        if (cmd.includes("metadata.json") && !cmd.includes("/0/")) return cpMeta;
        if (cmd.includes("/0/metadata.json")) return sessMeta;
        return "";
      });

    const sessions = await reader.resolveByCheckpoint("f634acf05138");
    expect(sessions.length).toBe(1);
    expect(sessions[0].agent).toBe("Claude Code");
    expect(sessions[0].branch).toBe("main");
    expect(sessions[0].turnCount).toBe(5);
  });
});
```

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add src/core/context/__tests__/
git commit -m "test(context): add checkpoint reader integration tests with fixtures"
```

---

## Task 7: Entire Provider

**Files:**
- Create: `src/core/context/entire/entire-provider.ts`
- Create: `src/core/context/__tests__/entire-provider.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe("EntireProvider", () => {
  it("has name 'entire'", () => {
    const provider = new EntireProvider();
    expect(provider.name).toBe("entire");
  });

  it("isAvailable returns false when no entire branch", async () => {
    const provider = new EntireProvider();
    // Mock CheckpointReader
    expect(await provider.isAvailable("/nonexistent")).toBe(false);
  });

  it("buildContext returns ContextResult with correct structure", async () => {
    // Mock reader to return sessions, mock builder to return markdown
    // Verify ContextResult fields: markdown, tokenEstimate, sessionCount, mode, timeRange
  });

  it("auto-downgrades to compact when over budget", async () => {
    // Mock large output, verify mode becomes compact
  });

  it("truncates oldest sessions when still over budget in compact", async () => {
    // Verify truncated=true and sessionCount < total
  });
});
```

- [ ] **Step 2: Implement entire-provider.ts**

```typescript
// src/core/context/entire/entire-provider.ts
import type { ContextProvider, ContextQuery, ContextOptions, ContextResult, SessionListResult, SessionInfo } from "../context-provider.js";
import { DEFAULT_MAX_TOKENS, TOKENS_PER_TURN_ESTIMATE } from "../context-provider.js";
import { CheckpointReader } from "./checkpoint-reader.js";
import { parseJsonlToTurns, buildSessionMarkdown, mergeSessionsMarkdown, selectMode, estimateTokens } from "./conversation-builder.js";

export class EntireProvider implements ContextProvider {
  readonly name = "entire";

  async isAvailable(repoPath: string): Promise<boolean> {
    const reader = new CheckpointReader(repoPath);
    return reader.hasEntireBranch();
  }

  async listSessions(query: ContextQuery): Promise<SessionListResult> {
    const reader = new CheckpointReader(query.repoPath);
    const sessions = await this.resolveSessions(reader, query);
    const estimatedTokens = sessions.reduce((sum, s) => sum + s.turnCount * TOKENS_PER_TURN_ESTIMATE, 0);
    return { sessions, estimatedTokens };
  }

  async buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult> {
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const reader = new CheckpointReader(query.repoPath);
    let sessions = await this.resolveSessions(reader, query);

    if (options?.limit && sessions.length > options.limit) {
      sessions = sessions.slice(-options.limit); // keep latest
    }

    // Calculate total turns across all sessions for mode selection
    const totalTurns = sessions.reduce((sum, s) => sum + s.turnCount, 0);
    let mode = selectMode(totalTurns);

    // Rebuild each session
    const sessionMarkdowns = sessions.map(sess => {
      const jsonl = reader.getTranscript(sess.transcriptPath);
      const parsed = parseJsonlToTurns(jsonl);
      const md = buildSessionMarkdown(parsed.turns, mode);
      return {
        markdown: md,
        startTime: parsed.firstTimestamp,
        endTime: parsed.lastTimestamp,
        agent: sess.agent,
        turns: parsed.turns.length,
        branch: sess.branch,
        files: sess.filesTouched.map(f => f.split("/").pop() ?? f),
      };
    });

    // Build title based on query type
    const title = this.buildTitle(query);

    // Merge and check budget
    let merged = mergeSessionsMarkdown(sessionMarkdowns, mode, title);
    let tokens = estimateTokens(merged);

    // Auto-downgrade if over budget
    if (tokens > maxTokens && mode !== "compact") {
      mode = "compact";
      const rebulit = sessionMarkdowns.map(sm => ({
        ...sm,
        markdown: buildSessionMarkdown(
          parseJsonlToTurns(reader.getTranscript(
            sessions[sessionMarkdowns.indexOf(sm)].transcriptPath
          )).turns,
          "compact",
        ),
      }));
      merged = mergeSessionsMarkdown(rebulit, "compact", title);
      tokens = estimateTokens(merged);
    }

    // Truncate oldest sessions if still over budget
    let truncated = false;
    let finalSessions = sessionMarkdowns;
    while (tokens > maxTokens && finalSessions.length > 1) {
      finalSessions = finalSessions.slice(1); // drop oldest
      truncated = true;
      merged = mergeSessionsMarkdown(finalSessions, mode, title);
      tokens = estimateTokens(merged);
    }

    const allTimes = finalSessions.flatMap(s => [s.startTime, s.endTime]).filter(Boolean).sort();

    return {
      markdown: merged,
      tokenEstimate: tokens,
      sessionCount: finalSessions.length,
      totalTurns: finalSessions.reduce((sum, s) => sum + s.turns, 0),
      mode,
      truncated,
      timeRange: { start: allTimes[0] ?? "", end: allTimes[allTimes.length - 1] ?? "" },
    };
  }

  private async resolveSessions(reader: CheckpointReader, query: ContextQuery): Promise<SessionInfo[]> {
    switch (query.type) {
      case "branch": return reader.resolveByBranch(query.value);
      case "commit": return reader.resolveByCommit(query.value);
      case "pr": return reader.resolveByPr(query.value);
      case "checkpoint": return reader.resolveByCheckpoint(query.value);
      case "session": return reader.resolveBySessionId(query.value);
      case "latest": return reader.resolveLatest(parseInt(query.value) || 5);
      default: return [];
    }
  }

  private buildTitle(query: ContextQuery): string {
    switch (query.type) {
      case "pr": return `PR #${query.value.replace(/.*\/pull\//, "")}`;
      case "branch": return `branch \`${query.value}\``;
      case "commit": return `commit \`${query.value.slice(0, 8)}\``;
      case "checkpoint": return `checkpoint \`${query.value}\``;
      case "session": return `session \`${query.value.slice(0, 8)}...\``;
      case "latest": return `latest ${query.value} sessions`;
      default: return "unknown";
    }
  }
}
```

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add src/core/context/entire/entire-provider.ts src/core/context/__tests__/entire-provider.test.ts
git commit -m "feat(context): add EntireProvider implementing ContextProvider interface"
```

---

## Task 8: Context Manager

**Files:**
- Create: `src/core/context/context-manager.ts`
- Create: `src/core/context/__tests__/context-manager.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe("ContextManager", () => {
  it("returns null when no provider available", async () => {
    const manager = new ContextManager();
    const result = await manager.buildContext({ repoPath: "/repo", type: "latest", value: "5" });
    expect(result).toBeNull();
  });

  it("uses first available provider", async () => {
    const manager = new ContextManager();
    const mockProvider = { name: "mock", isAvailable: vi.fn().mockResolvedValue(true), listSessions: vi.fn(), buildContext: vi.fn().mockResolvedValue({ markdown: "test", tokenEstimate: 100, sessionCount: 1, totalTurns: 2, mode: "full", truncated: false, timeRange: { start: "", end: "" } }) };
    manager.register(mockProvider);
    const result = await manager.buildContext({ repoPath: "/repo", type: "latest", value: "5" });
    expect(result?.markdown).toBe("test");
  });

  it("skips unavailable providers", async () => {
    const manager = new ContextManager();
    const unavailable = { name: "no", isAvailable: vi.fn().mockResolvedValue(false), listSessions: vi.fn(), buildContext: vi.fn() };
    const available = { name: "yes", isAvailable: vi.fn().mockResolvedValue(true), listSessions: vi.fn(), buildContext: vi.fn().mockResolvedValue({ markdown: "ok" }) };
    manager.register(unavailable);
    manager.register(available);
    await manager.buildContext({ repoPath: "/repo", type: "latest", value: "5" });
    expect(unavailable.buildContext).not.toHaveBeenCalled();
    expect(available.buildContext).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement context-manager.ts**

```typescript
// src/core/context/context-manager.ts
import type { ContextProvider, ContextQuery, ContextOptions, ContextResult, SessionListResult } from "./context-provider.js";

export class ContextManager {
  private providers: ContextProvider[] = [];

  register(provider: ContextProvider): void {
    this.providers.push(provider);
  }

  async getProvider(repoPath: string): Promise<ContextProvider | null> {
    for (const provider of this.providers) {
      if (await provider.isAvailable(repoPath)) return provider;
    }
    return null;
  }

  async listSessions(query: ContextQuery): Promise<SessionListResult | null> {
    const provider = await this.getProvider(query.repoPath);
    if (!provider) return null;
    return provider.listSessions(query);
  }

  async buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult | null> {
    const provider = await this.getProvider(query.repoPath);
    if (!provider) return null;
    return provider.buildContext(query, options);
  }
}
```

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add src/core/context/context-manager.ts src/core/context/__tests__/context-manager.test.ts
git commit -m "feat(context): add ContextManager provider registry"
```

---

## Task 9: Context Cache

**Files:**
- Create: `src/core/context/context-cache.ts`
- Create: `src/core/context/__tests__/context-cache.test.ts`
- Modify: `src/core/context/context-manager.ts` — wrap `buildContext` with cache

- [ ] **Step 1: Write failing tests**

```typescript
// src/core/context/__tests__/context-cache.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContextCache } from "../context-cache.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("ContextCache", () => {
  const cacheDir = path.join(os.tmpdir(), "viben-test-cache");

  beforeEach(() => { fs.mkdirSync(cacheDir, { recursive: true }); });
  afterEach(() => { fs.rmSync(cacheDir, { recursive: true, force: true }); });

  it("returns null on cache miss", () => {
    const cache = new ContextCache(cacheDir);
    expect(cache.get("repo1", "pr:19")).toBeNull();
  });

  it("stores and retrieves cached result", () => {
    const cache = new ContextCache(cacheDir);
    const result = { markdown: "test", tokenEstimate: 100, sessionCount: 1, totalTurns: 2, mode: "full" as const, truncated: false, timeRange: { start: "", end: "" } };
    cache.set("repo1", "pr:19", result);
    expect(cache.get("repo1", "pr:19")?.markdown).toBe("test");
  });

  it("returns null after TTL expires", () => {
    const cache = new ContextCache(cacheDir, 0); // 0ms TTL = immediate expiry
    const result = { markdown: "test", tokenEstimate: 100, sessionCount: 1, totalTurns: 2, mode: "full" as const, truncated: false, timeRange: { start: "", end: "" } };
    cache.set("repo1", "pr:19", result);
    expect(cache.get("repo1", "pr:19")).toBeNull();
  });
});
```

- [ ] **Step 2: Implement context-cache.ts**

```typescript
// src/core/context/context-cache.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { ContextResult } from "./context-provider.js";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export class ContextCache {
  constructor(
    private cacheDir: string,
    private ttlMs: number = DEFAULT_TTL_MS,
  ) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  private keyHash(repoPath: string, queryKey: string): string {
    const hash = crypto.createHash("sha256").update(`${repoPath}:${queryKey}`).digest("hex").slice(0, 16);
    return hash;
  }

  private filePath(repoPath: string, queryKey: string): string {
    return path.join(this.cacheDir, `${this.keyHash(repoPath, queryKey)}.json`);
  }

  get(repoPath: string, queryKey: string): ContextResult | null {
    const fp = this.filePath(repoPath, queryKey);
    try {
      const stat = fs.statSync(fp);
      if (Date.now() - stat.mtimeMs > this.ttlMs) {
        fs.unlinkSync(fp);
        return null;
      }
      return JSON.parse(fs.readFileSync(fp, "utf-8"));
    } catch {
      return null;
    }
  }

  set(repoPath: string, queryKey: string, result: ContextResult): void {
    const fp = this.filePath(repoPath, queryKey);
    fs.writeFileSync(fp, JSON.stringify(result));
  }
}
```

- [ ] **Step 3: Integrate cache into ContextManager.buildContext**

In `context-manager.ts`, add cache wrapping:

```typescript
import { ContextCache } from "./context-cache.js";
import * as path from "node:path";
import * as os from "node:os";

// In ContextManager constructor or lazily:
private cache = new ContextCache(path.join(os.homedir(), ".viben", "cache", "entire"));

async buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult | null> {
  const queryKey = `${query.type}:${query.value}:${options?.limit ?? ""}:${options?.maxTokens ?? ""}`;
  const cached = this.cache.get(query.repoPath, queryKey);
  if (cached) return cached;

  const provider = await this.getProvider(query.repoPath);
  if (!provider) return null;
  const result = await provider.buildContext(query, options);
  if (result) this.cache.set(query.repoPath, queryKey, result);
  return result;
}
```

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add src/core/context/context-cache.ts src/core/context/__tests__/context-cache.test.ts src/core/context/context-manager.ts
git commit -m "feat(context): add file-based context cache with 1h TTL"
```

---

## Task 10: Session Context Injection

**Files:**
- Modify: `src/core/session.ts`
- Modify: `src/core/__tests__/session-lifecycle.test.ts`

- [ ] **Step 1: Write failing test**

Add to `session-lifecycle.test.ts`:

```typescript
describe("Session - Context Injection", () => {
  it("prepends context to first prompt only", async () => {
    const agent = mockAgentInstance();
    const session = createTestSession(agent);
    session.setContext("Previous conversation context here");

    await session.enqueuePrompt("fix the bug");
    await vi.waitFor(() => expect(agent.prompt).toHaveBeenCalledTimes(1));

    const promptText = agent.prompt.mock.calls[0][0];
    expect(promptText).toContain("[CONVERSATION HISTORY");
    expect(promptText).toContain("Previous conversation context here");
    expect(promptText).toContain("[END CONVERSATION HISTORY]");
    expect(promptText).toContain("fix the bug");
  });

  it("does not inject context on second prompt", async () => {
    const agent = mockAgentInstance();
    const session = createTestSession(agent);
    session.setContext("context");

    await session.enqueuePrompt("first");
    await vi.waitFor(() => expect(agent.prompt).toHaveBeenCalledTimes(1));

    await session.enqueuePrompt("second");
    await vi.waitFor(() => expect(agent.prompt).toHaveBeenCalledTimes(2));

    const secondPrompt = agent.prompt.mock.calls[1][0];
    expect(secondPrompt).not.toContain("[CONVERSATION HISTORY");
    expect(secondPrompt).toBe("second");
  });

  it("works without context (no injection)", async () => {
    const agent = mockAgentInstance();
    const session = createTestSession(agent);

    await session.enqueuePrompt("hello");
    await vi.waitFor(() => expect(agent.prompt).toHaveBeenCalledTimes(1));
    expect(agent.prompt.mock.calls[0][0]).toBe("hello");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Modify session.ts**

Add to `Session` class (after `voiceMode` field, around line 49):

```typescript
private pendingContext: string | null = null;

setContext(markdown: string): void {
  this.pendingContext = markdown;
  this.log.info({ contextLength: markdown.length }, "Context set for injection");
}
```

Modify `processPrompt` method — add context injection BEFORE the STT processing (after warmup check, before line 160):

```typescript
// After warmup check (line 151), before STT processing:
// Context injection: prepend on first real prompt only
if (this.pendingContext) {
  text = `[CONVERSATION HISTORY - This is context from previous sessions, not current conversation]\n\n${this.pendingContext}\n\n[END CONVERSATION HISTORY]\n\n${text}`;
  this.pendingContext = null;
  this.log.debug("Context injected into prompt");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/core/__tests__/session-lifecycle.test.ts 2>&1 | tail -10`
Expected: all PASS

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `pnpm test 2>&1 | tail -20`
Expected: all existing tests still PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/session.ts src/core/__tests__/session-lifecycle.test.ts
git commit -m "feat(session): add context injection for conversation history resume"
```

---

## Task 10: Core Integration — createSessionWithContext

**Files:**
- Modify: `src/core/core.ts`
- Modify: `src/core/index.ts`

- [ ] **Step 1: Add contextManager to VibenCore**

In `core.ts`, add import and field:

```typescript
import { ContextManager } from "./context/context-manager.js";
import { EntireProvider } from "./context/entire/entire-provider.js";
import type { ContextQuery, ContextOptions, ContextResult } from "./context/context-provider.js";
```

Add field after `usageBudget` (around line 45):

```typescript
readonly contextManager: ContextManager;
```

In constructor, after event bus init (around line 72):

```typescript
this.contextManager = new ContextManager();
this.contextManager.register(new EntireProvider());
```

- [ ] **Step 2: Add createSessionWithContext method**

Add after `handleNewChat` method:

```typescript
async createSessionWithContext(params: {
  channelId: string;
  agentName: string;
  workingDirectory: string;
  contextQuery: ContextQuery;
  contextOptions?: ContextOptions;
  createThread?: boolean;
}): Promise<{ session: Session; contextResult: ContextResult | null }> {
  const contextResult = await this.contextManager.buildContext(
    params.contextQuery,
    params.contextOptions,
  );

  const session = await this.createSession({
    channelId: params.channelId,
    agentName: params.agentName,
    workingDirectory: params.workingDirectory,
    createThread: params.createThread,
  });

  if (contextResult) {
    session.setContext(contextResult.markdown);
  }

  return { session, contextResult };
}
```

- [ ] **Step 3: Export new types from index.ts**

Add to `src/core/index.ts`:

```typescript
export type { ContextProvider, ContextQuery, ContextOptions, ContextResult, SessionInfo as ContextSessionInfo, SessionListResult } from "./context/context-provider.js";
export { ContextManager } from "./context/context-manager.js";
export { EntireProvider } from "./context/entire/entire-provider.js";
```

- [ ] **Step 4: Verify build**

Run: `pnpm build 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/core/core.ts src/core/index.ts
git commit -m "feat(core): integrate ContextManager with EntireProvider"
```

---

## Task 11: Telegram /resume Command

**Files:**
- Create: `src/adapters/telegram/commands/resume.ts`
- Modify: `src/adapters/telegram/commands/index.ts`

- [ ] **Step 1: Create resume command handler**

```typescript
// src/adapters/telegram/commands/resume.ts
import type { Bot, Context } from "grammy";
import type { VibenCore } from "../../../core/index.js";
import type { ContextQuery } from "../../../core/context/context-provider.js";
import { CheckpointReader } from "../../../core/context/entire/checkpoint-reader.js";
import { DEFAULT_MAX_TOKENS } from "../../../core/context/context-provider.js";
import { escapeHtml } from "../formatting.js";
import { createSessionTopic, buildDeepLink } from "../topics.js";
import { buildSessionControlKeyboard } from "./admin.js";
import { createChildLogger } from "../../../core/log.js";
import type { CommandsAssistantContext } from "../types.js";

const log = createChildLogger({ module: "telegram-cmd-resume" });

function parseResumeArgs(matchStr: string): { query: Omit<ContextQuery, "repoPath">; repoPath?: string } | null {
  const args = matchStr.split(" ").filter(Boolean);
  if (args.length === 0) return { query: { type: "latest", value: "5" } };

  const first = args[0];

  // Subcommands
  if (first === "pr") return args[1] ? { query: { type: "pr", value: args[1] }, repoPath: args[2] } : null;
  if (first === "branch") return args[1] ? { query: { type: "branch", value: args[1] }, repoPath: args[2] } : null;
  if (first === "commit") return args[1] ? { query: { type: "commit", value: args[1] }, repoPath: args[2] } : null;

  // Auto-detect ID format
  if (CheckpointReader.isCheckpointId(first)) return { query: { type: "checkpoint", value: first }, repoPath: args[1] };
  if (CheckpointReader.isSessionId(first)) return { query: { type: "session", value: first }, repoPath: args[1] };

  // Might be a PR URL
  if (first.includes("/pull/")) return { query: { type: "pr", value: first }, repoPath: args[1] };

  // Unknown — treat as repo_path for latest
  return { query: { type: "latest", value: "5" }, repoPath: first };
}

export async function handleResume(
  ctx: Context,
  core: VibenCore,
  chatId: number,
  assistant?: CommandsAssistantContext,
): Promise<void> {
  const rawMatch = (ctx as Context & { match: unknown }).match;
  const matchStr = typeof rawMatch === "string" ? rawMatch : "";
  const parsed = parseResumeArgs(matchStr);

  if (!parsed) {
    await ctx.reply("Usage: /resume pr <number> | /resume branch <name> | /resume commit <hash> | /resume <checkpoint_id> | /resume", { parse_mode: "HTML" });
    return;
  }

  // Resolve repo path
  const config = core.configManager.get();
  const repoPath = core.configManager.resolveWorkspace(parsed.repoPath);

  // Check provider availability
  const provider = await core.contextManager.getProvider(repoPath);
  if (!provider) {
    await ctx.reply(
      `⚠️ <b>This repo doesn't have Entire checkpoints enabled.</b>\n\n` +
      `To enable conversation history tracking:\n` +
      `<code>npx entire enable</code>\n\n` +
      `Learn more: https://docs.entire.io/getting-started`,
      { parse_mode: "HTML" },
    );
    return;
  }

  const query: ContextQuery = { ...parsed.query, repoPath };

  // Scan sessions
  await ctx.reply(`🔍 Scanning ${query.type} ${query.type !== "latest" ? `\`${escapeHtml(query.value)}\`` : "sessions"}...`, { parse_mode: "HTML" });

  const listResult = await core.contextManager.listSessions(query);
  if (!listResult || listResult.sessions.length === 0) {
    await ctx.reply(`No Entire sessions found for ${query.type} \`${escapeHtml(query.value)}\`.`, { parse_mode: "HTML" });
    return;
  }

  const { sessions, estimatedTokens } = listResult;
  const totalTurns = sessions.reduce((sum, s) => sum + s.turnCount, 0);

  // TODO: Over-budget flow with inline keyboard (Task 12)
  // For now, auto-cap with limit
  let contextOptions = { maxTokens: DEFAULT_MAX_TOKENS };

  // Create topic FIRST (Telegram pattern — avoid race condition)
  const topicLabel = query.type === "pr" ? `PR #${query.value.replace(/.*\/pull\//, "")}` : `${query.type}: ${query.value.slice(0, 20)}`;
  const bot = { api: ctx.api } as unknown as Bot;
  const threadId = await createSessionTopic(bot, chatId, `📜 ${topicLabel}`);

  try {
    await ctx.api.sendMessage(chatId, "⏳ Building context and creating session...", { message_thread_id: threadId, parse_mode: "HTML" });

    const agentName = config.defaultAgent;
    const { session, contextResult } = await core.createSessionWithContext({
      channelId: "telegram",
      agentName,
      workingDirectory: repoPath,
      contextQuery: query,
      contextOptions,
    });
    session.threadId = String(threadId);

    await core.sessionManager.patchRecord(session.id, { platform: { topicId: threadId } });

    const modeLabel = contextResult?.mode ?? "none";
    const tokenLabel = contextResult?.tokenEstimate ?? 0;
    const truncLabel = contextResult?.truncated ? " (truncated)" : "";

    await ctx.api.sendMessage(
      chatId,
      `✅ <b>Session created with conversation history</b>\n` +
      `<b>Source:</b> ${escapeHtml(topicLabel)}\n` +
      `<b>Sessions:</b> ${contextResult?.sessionCount ?? 0}${truncLabel}\n` +
      `<b>Mode:</b> ${modeLabel} (~${Math.round(tokenLabel / 1000)}K tokens)\n\n` +
      `Send your message to continue.`,
      { message_thread_id: threadId, parse_mode: "HTML", reply_markup: buildSessionControlKeyboard(session.id, false, false) },
    );

    // Deep link in original thread
    const topicLink = buildDeepLink(chatId, threadId);
    await ctx.reply(`✅ Session created → <a href="${topicLink}">Open topic</a>`, { parse_mode: "HTML" });

    session.warmup().catch((err) => log.error({ err }, "Warm-up error"));
  } catch (err) {
    try { await ctx.api.deleteForumTopic(chatId, threadId); } catch { /* ignore */ }
    const message = err instanceof Error ? err.message : String(err);
    await ctx.reply(`❌ ${escapeHtml(message)}`, { parse_mode: "HTML" });
  }
}
```

- [ ] **Step 2: Register command in index.ts**

In `src/adapters/telegram/commands/index.ts`:

Add import:
```typescript
import { handleResume } from "./resume.js";
```

Add in `setupCommands`:
```typescript
bot.command("resume", (ctx) => handleResume(ctx, core, chatId, assistant));
```

- [ ] **Step 3: Verify build**

Run: `pnpm build 2>&1 | tail -10`

- [ ] **Step 4: Commit**

```bash
git add src/adapters/telegram/commands/resume.ts src/adapters/telegram/commands/index.ts
git commit -m "feat(telegram): add /resume command for Entire context resume"
```

---

## Task 12: Over-Budget Flow with Inline Keyboard

**Files:**
- Modify: `src/adapters/telegram/commands/resume.ts`

- [ ] **Step 1: Add over-budget handling**

When `estimatedTokens > DEFAULT_MAX_TOKENS`, show options with callback query buttons:

```typescript
// In handleResume, after listResult check:
if (estimatedTokens > DEFAULT_MAX_TOKENS) {
  const keyboard = new InlineKeyboard()
    .text(`1️⃣ Latest 5 (~${Math.round(sessions.slice(-5).reduce((s, x) => s + x.turnCount * 400, 0) / 1000)}K)`, "m:resume:5")
    .row()
    .text(`2️⃣ Latest 10 (~${Math.round(sessions.slice(-10).reduce((s, x) => s + x.turnCount * 400, 0) / 1000)}K)`, "m:resume:10")
    .row()
    .text(`3️⃣ All ${sessions.length} in compact (~${Math.round(estimatedTokens / 1000)}K)`, "m:resume:all");

  await ctx.reply(
    `Found ${sessions.length} sessions (${totalTurns} turns) — estimated ~${Math.round(estimatedTokens / 1000)}K tokens.\n\n` +
    `This exceeds the ${DEFAULT_MAX_TOKENS / 1000}K token budget. Choose:`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );
  // Store pending state, handle callback, 60s timeout
  return;
}
```

Register callback handler in `setupResumeCallbacks`:

```typescript
export function setupResumeCallbacks(bot: Bot, core: VibenCore, chatId: number): void {
  bot.callbackQuery(/^m:resume:/, async (ctx) => {
    // Parse choice, proceed with limit
  });
}
```

Add 60s timeout — auto-select option 1 if no response.

- [ ] **Step 2: Register callbacks in index.ts**

```typescript
import { setupResumeCallbacks } from "./resume.js";
// In setupAllCallbacks:
setupResumeCallbacks(bot, core, chatId);
```

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```bash
git add src/adapters/telegram/commands/resume.ts src/adapters/telegram/commands/index.ts
git commit -m "feat(telegram): add over-budget flow for /resume command"
```

---

## Task 13: Unit Tests for parseResumeArgs + Core Integration

**Files:**
- Create: `src/adapters/telegram/commands/__tests__/resume.test.ts`
- Modify: `src/core/__tests__/create-session.test.ts` (or new file)

- [ ] **Step 1: Write parseResumeArgs tests**

```typescript
// src/adapters/telegram/commands/__tests__/resume.test.ts
import { describe, it, expect } from "vitest";
import { parseResumeArgs } from "../resume.js";

describe("parseResumeArgs", () => {
  it("parses 'pr 19'", () => {
    const r = parseResumeArgs("pr 19");
    expect(r?.query).toEqual({ type: "pr", value: "19" });
  });

  it("parses 'pr https://github.com/org/repo/pull/19'", () => {
    const r = parseResumeArgs("pr https://github.com/org/repo/pull/19");
    expect(r?.query).toEqual({ type: "pr", value: "https://github.com/org/repo/pull/19" });
  });

  it("parses 'branch main'", () => {
    const r = parseResumeArgs("branch main");
    expect(r?.query).toEqual({ type: "branch", value: "main" });
  });

  it("parses 'commit e0dd2fa4'", () => {
    const r = parseResumeArgs("commit e0dd2fa4");
    expect(r?.query).toEqual({ type: "commit", value: "e0dd2fa4" });
  });

  it("auto-detects 12-hex checkpoint ID", () => {
    const r = parseResumeArgs("f634acf05138");
    expect(r?.query).toEqual({ type: "checkpoint", value: "f634acf05138" });
  });

  it("auto-detects UUID session ID", () => {
    const r = parseResumeArgs("1d9503b8-0134-419a-a3a7-019b312dd12c");
    expect(r?.query).toEqual({ type: "session", value: "1d9503b8-0134-419a-a3a7-019b312dd12c" });
  });

  it("auto-detects PR URL without 'pr' subcommand", () => {
    const r = parseResumeArgs("https://github.com/org/repo/pull/42");
    expect(r?.query.type).toBe("pr");
  });

  it("defaults to latest 5 with no args", () => {
    const r = parseResumeArgs("");
    expect(r?.query).toEqual({ type: "latest", value: "5" });
  });

  it("extracts optional repo_path", () => {
    const r = parseResumeArgs("pr 19 /path/to/repo");
    expect(r?.repoPath).toBe("/path/to/repo");
  });

  it("returns null for 'pr' without number", () => {
    expect(parseResumeArgs("pr")).toBeNull();
  });
});
```

- [ ] **Step 2: Export parseResumeArgs from resume.ts**

Make sure `parseResumeArgs` is exported so tests can import it.

- [ ] **Step 3: Write createSessionWithContext integration test**

Add to `src/core/__tests__/create-session.test.ts` (or new file `create-session-context.test.ts`):

```typescript
describe("createSessionWithContext", () => {
  it("creates session and injects context when provider available", async () => {
    // Mock contextManager.buildContext to return a ContextResult
    // Verify session.setContext was called with the markdown
    // Verify session is returned
  });

  it("creates session without context when provider unavailable", async () => {
    // Mock contextManager.buildContext to return null
    // Verify session is still created
    // Verify setContext was NOT called
  });

  it("creates session even if context building throws", async () => {
    // Mock contextManager.buildContext to throw
    // Verify session creation does not fail
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `pnpm test 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add src/adapters/telegram/commands/__tests__/resume.test.ts src/core/__tests__/
git commit -m "test(context): add parseResumeArgs and createSessionWithContext tests"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Full build**

Run: `pnpm build 2>&1 | tail -10`
Expected: 0 errors

- [ ] **Step 2: Full test suite**

Run: `pnpm test 2>&1 | tail -20`
Expected: all PASS

- [ ] **Step 3: Manual smoke test (if Entire-enabled repo available)**

```bash
# In a repo with entire/checkpoints/v1:
pnpm start
# On Telegram: /resume latest
# Verify: topic created, context summary shown, agent responds with context
```

---

## Review Fixes Applied

Issues from plan review that were addressed:
- **[C1]** Added Task 9: Context Cache with TTL
- **[I1]** Added createSessionWithContext tests in Task 13
- **[I2]** Added parseResumeArgs unit tests in Task 13
- **[I3]** Implementer should add `/resume` to `STATIC_COMMANDS` array in `index.ts` during Task 12
- **[I4]** `setupResumeCallbacks` must be registered BEFORE the broad `m:` handler in `setupAllCallbacks`
- **[S1]** `rebulit` typo — fix during implementation of Task 7

---

## Success Criteria

After all tasks:

- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes all new + existing tests
- [ ] `/resume pr 19` creates topic with conversation context on Telegram
- [ ] `/resume branch main` works
- [ ] `/resume commit <hash>` works
- [ ] `/resume <checkpoint_id>` works (12 hex auto-detect)
- [ ] `/resume <session_uuid>` works (UUID auto-detect)
- [ ] `/resume` with no args loads latest 5 sessions
- [ ] Over-budget flow shows options when >30K tokens
- [ ] Repo without Entire shows setup instructions
- [ ] Context injected only on first prompt, cleared after
- [ ] Adaptive mode selects full/balanced/compact correctly based on total turns
- [ ] All sessions show branch in header
- [ ] Context cache stores and retrieves results with 1h TTL
