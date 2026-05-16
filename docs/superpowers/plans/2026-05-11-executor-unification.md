# Executor Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge legacy `executors/executors/` into `engines/`, making `Executor` the sole interface and eliminating `StandardCodingAgentExecutor`.

**Architecture:** Registry-based unified executor system (`engines/` + `ops/`) becomes the single source of truth. All consumers migrate from `createExecutor()` → `getExecutor()`, `StandardCodingAgentExecutor` → `Executor`, `SpawnedChild` → streaming or `ExecutionResult`.

**Tech Stack:** TypeScript, Node.js child_process, vitest

**Spec:** `docs/specs/modules/cli/executor-migration.md`

---

## File Structure

### Modified Files

| File | Responsibility |
|------|---------------|
| `packages/core/src/executors/engines/gemini.ts` | Fix --prompt flag, add model, fix MCP path |
| `packages/core/src/executors/engines/gemini.test.ts` | Update tests for fixed methods |
| `packages/core/src/executors/engines/claude.ts` | Add planMode/approvals CLI flags, NPM_CONFIG_LOGLEVEL |
| `packages/core/src/executors/engines/codex.ts` | Add CODEX_FOLLOWUP_PROMPT, fix exec subcommand |
| `packages/core/src/executors/ops/types.ts` | Add SSEAssistantMessage, SSEResultMessage.result/exitCode |
| `packages/core/src/executors/chat/spawn-proxy.ts` | Replace StandardCodingAgentExecutor → Executor |
| `packages/core/src/services/container.ts` | Replace stdout pipe → chatStreaming |
| `packages/core/src/channels/router.ts` | Replace createExecutor/createExecutionEnv → getExecutor |
| `packages/core/src/executors/index.ts` | Remove legacy exports, keep unified only |
| `packages/core/src/index.ts` | Update public API exports |
| `packages/core/src/cli/commands/agent.ts` | Replace EXECUTOR_TYPES/executorSupportsChat/CHAT_SUPPORTED_EXECUTORS |
| `packages/core/src/group-chat/orchestrator.ts` | Replace executorSupportsChat |

### Deleted Files (Phase 4)

| File | Reason |
|------|--------|
| `packages/core/src/executors/executors/*.ts` (10 files) | Legacy implementations replaced by engines |
| `packages/core/src/executors/types.ts` | Types merged into ops/types.ts |

### Test Files to Rewrite

| File | What changes |
|------|-------------|
| `packages/core/src/services/container.test.ts` | Replace StandardCodingAgentExecutor/SpawnedChild/ExecutionEnv → Executor |
| `packages/core/src/services/container.integration.test.ts` | Same as above + ExecutorExitResult |
| `packages/core/src/cli/commands/executor-chat.test.ts` | Update vi.mock to remove createExecutor/EXECUTOR_TYPES |
| `packages/core/src/executors/index.test.ts` | Replace createExecutor/ClaudeCode → getExecutor/ClaudeExecutor |
| `packages/core/src/executors/chat.test.ts` | Replace ClaudeCode → getExecutor |

### NOTE: Partially Migrated (minor residual cleanup)

| File | Status |
|------|--------|
| `packages/core/src/cli/commands/executor.ts` | Already uses `getExecutor`/`getRegisteredTypes`; still imports `createChatProxyAsync`/`chatProxyFactory` from barrel (these remain valid unified exports, no change needed) |

---

## Task 1: Fix GeminiExecutor — Command Format & Config

**Files:**
- Modify: `packages/core/src/executors/engines/gemini.ts`
- Modify: `packages/core/src/executors/engines/gemini.test.ts`

**Context:** Legacy `executors/executors/gemini.ts` reveals that:
- Gemini requires `--prompt` flag (not bare positional arg)
- `defaultMcpConfigPath` should be `config.json` (not `settings.json`)
- Legacy says `SESSION_RESUME` is NOT supported (Gemini CLI has no `--resume`)
- Need `model` field support

- [ ] **Step 1: Add `model` field to GeminiExecutorConfig**

```typescript
// packages/core/src/executors/engines/gemini.ts — config interface
export interface GeminiExecutorConfig extends ExecutorConfig {
  /** Model to use (e.g., "gemini-2.5-pro") */
  model?: string;
  /** Sandbox mode (e.g., docker, none) */
  sandbox?: string;
  /** Yolo mode - skip all confirmations */
  yolo?: boolean;
}
```

- [ ] **Step 2: Fix `buildRunCommand` to use `--prompt` flag and model**

```typescript
buildRunCommand(options: RunCommandOptions): string[] {
  const { prompt } = options;
  const args = ["gemini", "--prompt", prompt];
  if (this.config.model) {
    args.push("--model", this.config.model);
  }
  return args;
}
```

- [ ] **Step 3: Fix `spawn()` to use `--prompt` flag and model**

```typescript
// In spawn(), replace args construction
const args = ["--prompt", prompt];
if (this.config.model) {
  args.push("--model", this.config.model);
}
```

- [ ] **Step 4: Fix `chat()` — use `--prompt` flag, model, outputFormat; remove resume logic**

Replace the entire chat() method body:

```typescript
async chat(options: ChatOptions): Promise<ExecutionResult> {
  const {
    prompt,
    cwd = process.cwd(),
    env: extraEnv = {},
  } = options;

  const execPath = this.getExecutablePath();
  if (!execPath) {
    return {
      success: false,
      error: "Gemini executable not found",
      errorType: "NOT_FOUND",
    };
  }

  const args: string[] = ["--prompt", prompt];
  if (this.config.model || options.model) {
    args.push("--model", options.model || this.config.model!);
  }
  if (options.outputFormat === "stream-json") {
    args.push("--output-format", "json");
  }

  const spawnEnv = {
    ...process.env,
    ...this.config.env,
    ...extraEnv,
  };

  try {
    const child = spawn(execPath, args, {
      cwd,
      env: spawnEnv,
      stdio: "inherit",
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("exit", (code) => resolve(code ?? 1));
      child.on("error", reject);
    });

    return { success: exitCode === 0, exitCode };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorType: "SPAWN_FAILED",
    };
  }
}
```

- [ ] **Step 5: Fix `defaultMcpConfigPath()` to return `config.json`**

```typescript
defaultMcpConfigPath(): string | null {
  return this.getHomePath(".gemini", "config.json");
}
```

- [ ] **Step 6: Remove `SESSION_RESUME` from capabilities, remove `resume()` and `buildResumeCommand()`**

```typescript
capabilities(): ExecutorCapability[] {
  return ["SPAWN", "CHAT"];
}
```

Delete the entire `resume()` method and `buildResumeCommand()` method.

- [ ] **Step 7: Update `gemini.test.ts`**

Update existing tests:
- Change `capabilities` test: expect `["SPAWN", "CHAT"]` (remove `SESSION_RESUME`)
- Change `buildRunCommand` test: expect `["gemini", "--prompt", "test prompt"]`
- Change `buildResumeCommand` test: **delete** this test case (method removed)
- Change `defaultMcpConfigPath` test: expect path ending in `config.json` not `settings.json`

- [ ] **Step 8: Run tests**

Run: `cd packages/core && pnpm vitest run src/executors/engines/gemini`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/executors/engines/gemini.ts packages/core/src/executors/engines/gemini.test.ts
git commit -m "fix(executors): align GeminiExecutor with legacy CLI flags and config"
```

---

## Task 2: Fix ClaudeExecutor — planMode, approvals, NPM_CONFIG_LOGLEVEL

**Files:**
- Modify: `packages/core/src/executors/engines/claude.ts`

- [ ] **Step 1: In `spawn()`, read planMode/approvals config and inject CLI flags**

Find where `spawn()` builds `args` array. After existing flag handling, add:

```typescript
// After existing args construction, before spawning
if (this.config.planMode || this.config.approvals) {
  args.push("--permission-prompt-tool", "stdio");
  args.push("--permission-mode", "bypass");
}
```

- [ ] **Step 2: Inject `NPM_CONFIG_LOGLEVEL` in spawn env**

Find `spawnEnv` construction in `spawn()`. Add:

```typescript
const spawnEnv = {
  ...process.env,
  NPM_CONFIG_LOGLEVEL: "error",
  ...this.config.env,
  ...extraEnv,
};
```

- [ ] **Step 3: In `chatStreaming()`, inject `--include-partial-messages --replay-user-messages`**

Find where `chatStreaming()` builds CLI args. Add:

```typescript
args.push("--include-partial-messages", "--replay-user-messages");
```

- [ ] **Step 4: Run tests**

Run: `cd packages/core && pnpm vitest run src/executors/engines/claude`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/executors/engines/claude.ts
git commit -m "fix(executors): ClaudeExecutor planMode/approvals flags and env"
```

---

## Task 3: Fix CodexExecutor — CODEX_FOLLOWUP_PROMPT & exec subcommand

**Files:**
- Modify: `packages/core/src/executors/engines/codex.ts`

- [ ] **Step 1: In `chatStreaming()` resume path, inject `CODEX_FOLLOWUP_PROMPT` env var**

Find the resume branch in `chatStreaming()`. When resuming with a prompt:

```typescript
if (options.resume && options.prompt) {
  spawnEnv.CODEX_FOLLOWUP_PROMPT = options.prompt;
}
```

- [ ] **Step 2: Fix chat new session command to use `exec` subcommand**

Find where `chat()` spawns a new session (non-resume path). Ensure args include `exec`:

```typescript
// New session: npx -y @openai/codex exec [OPTIONS] [PROMPT]
const args = ["exec"];
if (options.prompt) args.push(options.prompt);
```

- [ ] **Step 3: Run tests**

Run: `cd packages/core && pnpm vitest run src/executors/engines/codex`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/executors/engines/codex.ts
git commit -m "fix(executors): CodexExecutor follow-up env and exec subcommand"
```

---

## Task 4: Extend SSEMessage types for container migration

**Files:**
- Modify: `packages/core/src/executors/ops/types.ts`

- [ ] **Step 1: Add `SSEAssistantMessage` type**

After existing SSE types:

```typescript
export interface SSEAssistantMessage {
  type: "assistant";
  message: {
    role: string;
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: unknown }
    >;
  };
}
```

- [ ] **Step 2: Add `result` and `exitCode` fields to `SSEResultMessage`**

```typescript
export interface SSEResultMessage {
  type: "result";
  subtype?: "success" | "error";
  result?: string;
  cost?: number;
  duration?: number;
  exitCode?: number;
}
```

- [ ] **Step 3: Add `SSEStreamEventMessage` type**

```typescript
export interface SSEStreamEventMessage {
  type: "stream_event";
  event: string;
  data?: unknown;
}
```

- [ ] **Step 4: Add to SSEMessage union**

```typescript
export type SSEMessage =
  | SSETextMessage
  | SSEToolUseMessage
  | SSEToolResultMessage
  | SSEResultMessage
  | SSEErrorMessage
  | SSEQuestionMessage
  | SSESdkSessionMessage
  | SSEThinkingMessage
  | SSEExecApprovalMessage
  | SSEContextUsageMessage
  | SSEAssistantMessage
  | SSEStreamEventMessage;
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/executors/ops/types.ts
git commit -m "feat(executors): extend SSEMessage for container streaming migration"
```

---

## Task 5: Migrate `spawn-proxy.ts` from legacy to unified

**Files:**
- Modify: `packages/core/src/executors/chat/spawn-proxy.ts`

- [ ] **Step 1: Replace imports**

```typescript
// Before
import type { ChatOptions, StandardCodingAgentExecutor } from "../types";
import type { ExecutorType } from "../../types";
import { createExecutor } from "../index";

// After
import type { Executor, ChatOptions, ChatResult } from "../ops/types";
import type { ExecutorType } from "../../types";
import { getExecutor } from "../ops/registry";
```

Note: `ChatResult` is defined in `ops/types.ts` (alias for `ExecutionResult`). Must keep it since `execute()` returns `Promise<ChatResult>`.

- [ ] **Step 2: Replace executor field type and constructor**

```typescript
// Before
private executor: StandardCodingAgentExecutor;
constructor(executorType: ExecutorType) {
  this.executor = createExecutor(executorType);
}

// After
private executor: Executor;
constructor(executorType: ExecutorType) {
  this.executor = getExecutor(executorType);
}
```

- [ ] **Step 3: Replace `execute()` to use `executor.chat()` instead of `executor.spawnChat()`**

```typescript
async execute(options: ChatOptions): Promise<ChatResult> {
  const result = await this.executor.chat({
    prompt: options.prompt || "",
    cwd: options.cwd,
    model: options.model,
    sessionId: options.sessionId,
    resume: options.resume,
    inputFormat: options.inputFormat,
    outputFormat: options.outputFormat,
    verbose: options.verbose,
    dangerouslySkipPermissions: options.dangerouslySkipPermissions,
    env: options.env,
  });
  return { exitCode: result.exitCode ?? (result.success ? 0 : 1) };
}
```

- [ ] **Step 4: Delete dead code — `spawnGenericChat` private method**

The old `execute()` had a fallback path using `getChatCommand()` → `spawnGenericChat()`. Since we now use `executor.chat()` directly, delete:
- The `spawnGenericChat` private method (and any helper methods it used)
- Any references to `this.executor.getChatCommand`

- [ ] **Step 5: Run typecheck**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: PASS (or errors only in other files we haven't migrated yet)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/executors/chat/spawn-proxy.ts
git commit -m "refactor(executors): migrate spawn-proxy to unified Executor interface"
```

---

## Task 6: Migrate `container.ts` and `router.ts` to unified executor (atomic)

**Files:**
- Modify: `packages/core/src/services/container.ts`
- Modify: `packages/core/src/channels/router.ts`

**Context — actual current signatures:**
```
// container.ts
spawnAgent(sessionId, executor: StandardCodingAgentExecutor, agentId, agentType, workdir, prompt, env: ExecutionEnv): Promise<SpawnedChild>
spawnFollowUp(sessionId, executor: StandardCodingAgentExecutor, agentId, agentType, workdir, prompt, existingSessionId, env: ExecutionEnv): Promise<SpawnedChild>
handleAssistantMessage(json: Record<string, unknown>, sessionId: string, agentId: string): void
handleToolUse(json: Record<string, unknown>, sessionId: string, agentId: string): void
// ... all handle* take (json, sessionId, agentId) — 3 params, NO agentType

// Uses: this.eventService.agentSpawned(), this.eventService.executionLog(), etc. (NOT this.events.emit)

// router.ts calls:
await this.container.spawnAgent(sessionId, executor, binding.id, this.getExecutorType(binding.id), workdir, msg.message, env);
// No spawnFollowUp call in router.ts
```

### container.ts changes

- [ ] **Step 1: Replace container.ts imports**

```typescript
// Before
import type { ExecutionEnv, SpawnedChild, StandardCodingAgentExecutor } from "../executors/types";

// After
import type { Executor, ChatOptions, SSEMessage } from "../executors/ops/types";
```

- [ ] **Step 2: Change `spawnAgent` signature — keep param order, change types only**

```typescript
// Before
async spawnAgent(
  sessionId: string,
  executor: StandardCodingAgentExecutor,
  agentId: string,
  agentType: string,
  workdir: string,
  prompt: string,
  env: ExecutionEnv
): Promise<SpawnedChild>

// After
async spawnAgent(
  sessionId: string,
  executor: Executor,
  agentId: string,
  agentType: string,
  workdir: string,
  prompt: string,
  env: Record<string, string>
): Promise<void>
```

- [ ] **Step 3: Replace spawn + setupStdoutStreaming with chatStreaming consumption**

Note: `ProcessState` interface has fields: `{ sessionId, agentType, workdir, pid?, status }`. Keep `workdir` in the state. There is NO `agentId` field — do not add it.

```typescript
async spawnAgent(
  sessionId: string,
  executor: Executor,
  agentId: string,
  agentType: string,
  workdir: string,
  prompt: string,
  env: Record<string, string>
): Promise<void> {
  this.processes.set(sessionId, {
    status: "running",
    pid: undefined,
    sessionId,
    agentType,
    workdir,
  });

  this.eventService.agentSpawned(agentType, sessionId);

  const stream = executor.chatStreaming({
    prompt,
    cwd: workdir,
    env,
    sessionId,
    dangerouslySkipPermissions: true,
    outputFormat: "stream-json",
    inputFormat: "stream-json",
  });

  // Consume stream in background
  (async () => {
    try {
      for await (const message of stream) {
        this.processSSEMessage(message, sessionId, agentId);
      }
      this.eventService.agentCompleted(agentType, sessionId, true);
    } catch (err) {
      this.eventService.agentCompleted(agentType, sessionId, false);
    }
  })();
}
```

- [ ] **Step 4: Add `processSSEMessage` method (replaces `processStreamLine`)**

```typescript
private processSSEMessage(
  message: SSEMessage,
  sessionId: string,
  agentId: string
): void {
  switch (message.type) {
    case "assistant":
      this.handleAssistantMessage(message as Record<string, unknown>, sessionId, agentId);
      break;
    case "text":
      this.handleTextMessage(message as Record<string, unknown>, sessionId, agentId);
      break;
    case "tool_use":
      this.handleToolUse(message as Record<string, unknown>, sessionId, agentId);
      break;
    case "tool_result":
      this.handleToolResult(message as Record<string, unknown>, sessionId, agentId);
      break;
    case "result":
      this.handleResult(message as Record<string, unknown>, sessionId, agentId);
      break;
    case "error":
      this.handleError(message as Record<string, unknown>, sessionId, agentId);
      break;
    default:
      // stream_event, thinking, context_usage, etc. → log
      this.eventService.executionLog(sessionId, message.type, JSON.stringify(message));
      break;
  }
}
```

- [ ] **Step 5: Migrate `spawnFollowUp` to use chatStreaming with resume**

```typescript
async spawnFollowUp(
  sessionId: string,
  executor: Executor,
  agentId: string,
  agentType: string,
  workdir: string,
  prompt: string,
  existingSessionId: string,
  env: Record<string, string>
): Promise<void> {
  const stream = executor.chatStreaming({
    prompt,
    cwd: workdir,
    env,
    resume: existingSessionId,
    dangerouslySkipPermissions: true,
    outputFormat: "stream-json",
    inputFormat: "stream-json",
  });

  (async () => {
    try {
      for await (const message of stream) {
        this.processSSEMessage(message, sessionId, agentId);
      }
      this.eventService.agentCompleted(agentType, sessionId, true);
    } catch (err) {
      this.eventService.agentCompleted(agentType, sessionId, false);
    }
  })();
}
```

- [ ] **Step 6: Remove `setupStdoutStreaming` and old `processStreamLine` methods**

Delete the methods that depended on raw ChildProcess stdout parsing.

- [ ] **Step 7: Update `.content` → `.output` in ALL handle methods that read it**

There are two locations reading `json.content` in container.ts (lines ~236 and ~262):
1. In `handleTextMessage`: reads `json.content` for text extraction
2. In `handleToolResult`: reads `json.content` for tool output

Update both to read `.output` (matching `SSEToolResultMessage.output`) or the appropriate field from the typed SSEMessage.

### router.ts changes

- [ ] **Step 8: Replace router.ts executor imports**

```typescript
// Before (lines 19-20)
import type { StandardCodingAgentExecutor } from "../executors/types";
import { createExecutor, isExecutorType, createExecutionEnv } from "../executors";

// After
import type { Executor } from "../executors/ops/types";
import { getExecutor, isExecutorType } from "../executors";
```

Note: Line 21 (`import { SdkChatProxy, type SSEMessage } from "../executors/chat/sdk-proxy"`) stays unchanged — it's already unified.

- [ ] **Step 9: Replace `resolveExecutor()` return type and implementation**

```typescript
// Before
private resolveExecutor(executorType: ExecutorType): StandardCodingAgentExecutor {
  return createExecutor(executorType);
}

// After
private resolveExecutor(executorType: ExecutorType): Executor {
  return getExecutor(executorType);
}
```

(The `Executor` type import was already added in Step 8 above.)

- [ ] **Step 10: Replace container.spawnAgent call — pass env as Record<string, string>**

```typescript
// Before
const env = createExecutionEnv(workdir);
await this.container.spawnAgent(sessionId, executor, binding.id, this.getExecutorType(binding.id), workdir, msg.message, env);

// After
const env: Record<string, string> = {};  // Simple env, no more ExecutionEnv wrapper
await this.container.spawnAgent(sessionId, executor, binding.id, this.getExecutorType(binding.id), workdir, msg.message, env);
```

- [ ] **Step 11: Run typecheck**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: PASS (or errors in test files only)

- [ ] **Step 12: Commit (atomic: container + router together)**

```bash
git add packages/core/src/services/container.ts packages/core/src/channels/router.ts
git commit -m "refactor(container+router): migrate to unified Executor chatStreaming"
```

---

## Task 7: Migrate `orchestrator.ts` and `agent.ts`

**Files:**
- Modify: `packages/core/src/group-chat/orchestrator.ts`
- Modify: `packages/core/src/cli/commands/agent.ts`

### orchestrator.ts

- [ ] **Step 1: Replace orchestrator imports**

```typescript
// Before
import { executorSupportsChat, createChatProxyAsync, type ChatProxy, type ChatOptions } from "../executors";

// After
import { getExecutor, createChatProxy, createChatProxyAsync, chatProxyFactory, type ChatProxy } from "../executors";
import type { ChatOptions } from "../executors/ops/types";
```

Note: `createChatProxyAsync` and `chatProxyFactory` remain as valid unified exports (they live in `executors/chat/factory.ts`). Only `executorSupportsChat` is legacy.

- [ ] **Step 2: Replace `executorSupportsChat` calls**

```typescript
// Before
if (executorSupportsChat(type)) { ... }

// After
if (getExecutor(type).supports("CHAT")) { ... }
```

### agent.ts

- [ ] **Step 3: Replace agent.ts imports**

```typescript
// Before (packages/core/src/cli/commands/agent.ts lines 19-28)
import {
  EXECUTOR_TYPES,
  isExecutorType,
  executorSupportsChat,
  CHAT_SUPPORTED_EXECUTORS,
  createChatProxyAsync,
  chatProxyFactory,
} from "../../executors";

// After
import {
  getRegisteredTypes,
  isExecutorType,
  getExecutor,
  createChatProxyAsync,
  chatProxyFactory,
} from "../../executors";
```

- [ ] **Step 4: Replace `EXECUTOR_TYPES` usages in agent.ts**

```typescript
// Before (appears twice in error messages)
EXECUTOR_TYPES.join(", ")

// After
getRegisteredTypes().join(", ")
```

- [ ] **Step 5: Replace `executorSupportsChat` / `CHAT_SUPPORTED_EXECUTORS` in agent.ts**

```typescript
// Before
if (executorSupportsChat(executorType)) { ... }
// and
CHAT_SUPPORTED_EXECUTORS.join(", ")

// After
if (getExecutor(executorType).supports("CHAT")) { ... }
// and
getRegisteredTypes().filter(t => getExecutor(t).supports("CHAT")).join(", ")
```

- [ ] **Step 6: Run typecheck**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/group-chat/orchestrator.ts packages/core/src/cli/commands/agent.ts
git commit -m "refactor(orchestrator+agent): migrate to unified executor API"
```

---

## Task 8: Clean `executors/index.ts` and fix remaining `../types` imports

**Files:**
- Modify: `packages/core/src/executors/index.ts`
- Modify: `packages/core/src/executors/chat/factory.ts`
- Modify: `packages/core/src/executors/chat/types.ts`

- [ ] **Step 1: Remove all imports and exports from `"./executors"`**

Delete the block that exports `ClaudeCode`, `createClaudeCode`, `Amp`, etc. from `"./executors"`.
Delete `createExecutor`, `EXECUTOR_TYPES`, `getAllExecutorsAvailability`, `CHAT_SUPPORTED_EXECUTORS`, `executorSupportsChat`, `spawnChat` functions.

- [ ] **Step 2: Remove legacy type exports from `"./types"`**

Remove: `StandardCodingAgentExecutor`, `SpawnedChild`, `ExecutionEnv`, `ExecutorExitResult`, `ExecutorApprovalService`, `ChatSpawnResult`, `createExecutionEnv`, `applyEnvToSpawnOptions`.

Move types still needed by other files to `ops/types.ts`:
- `CommandParts` → move to `ops/types.ts` (used by `command.ts`)
- `ChatFormat` → move to `ops/types.ts` (used by CLI)

Note: `ProcessRunStatus` and `ProcessState` are defined locally inside `container.ts` — they are NOT imported from `executors/types.ts`. No migration needed for those.

- [ ] **Step 3: Keep the `isExecutorType` wrapper function**

```typescript
import { hasExecutor } from "./ops";
import type { ExecutorType } from "../types";

export function isExecutorType(type: string): type is ExecutorType {
  return hasExecutor(type as ExecutorType);
}
```

- [ ] **Step 4: Fix `chat/factory.ts` — replace `../types` import**

```typescript
// Before (chat/factory.ts line 10)
import type { ChatOptions } from "../types";

// After
import type { ChatOptions } from "../ops/types";
```

- [ ] **Step 5: Fix `chat/types.ts` — replace `../types` import**

```typescript
// Before (chat/types.ts line 8)
import type { ChatOptions, ChatFormat } from "../types";

// After
import type { ChatOptions, ChatFormat } from "../ops/types";
```

Note: `ChatFormat` must have been moved to `ops/types.ts` in Step 2 above.

- [ ] **Step 6: Ensure unified exports are clean**

Final `executors/index.ts` should only export from `./engines`, `./ops`, `./chat`, `./command`, `./utils`, plus the `isExecutorType` wrapper.

- [ ] **Step 7: Run typecheck**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/executors/index.ts packages/core/src/executors/chat/factory.ts packages/core/src/executors/chat/types.ts
git commit -m "refactor(executors): remove legacy exports, unified API only"
```

---

## Task 9: Update `packages/core/src/index.ts` public API

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Replace executor export block**

Remove all legacy symbol exports (`ClaudeCode`, `createClaudeCode`, `StandardCodingAgentExecutor`, `SpawnedChild`, `ExecutionEnv`, `createExecutor`, `EXECUTOR_TYPES`, `getAllExecutorsAvailability`, etc.).

Replace with unified exports:

```typescript
// Executor module (unified)
export {
  getExecutor,
  getRegisteredTypes,
  hasExecutor,
  getAvailableExecutors,
  isExecutorType,
  // Engine classes
  ClaudeExecutor,
  AmpExecutor,
  GeminiExecutor,
  CodexExecutor,
  OpencodeExecutor,
  CursorAgentExecutor,
  QwenCodeExecutor,
  CopilotExecutor,
  DroidExecutor,
  OpenClawExecutor,
  BaseExecutor,
  // Chat proxy
  SdkChatProxy,
  SpawnChatProxy,
  createChatProxy,
  createChatProxyAsync,
  chatProxyFactory,
  isSdkAvailable,
  // Utilities
  which,
  whichSync,
  CommandBuilder,
} from "./executors";

export type {
  Executor,
  ExecutorCapability,
  ExecutorConfig,
  SpawnOptions,
  ChatOptions,
  ExecutionResult,
  SSEMessage,
  AvailabilityInfo,
  RunCommandOptions,
  ChatProxy,
  ChatResult,
  // Engine configs
  ClaudeExecutorConfig,
  AmpExecutorConfig,
  GeminiExecutorConfig,
  CodexExecutorConfig,
  OpencodeExecutorConfig,
  CursorAgentExecutorConfig,
  QwenCodeExecutorConfig,
  CopilotExecutorConfig,
  DroidExecutorConfig,
  OpenClawExecutorConfig,
} from "./executors";
```

Note: The old `UnifiedChatOptions` alias is removed — all consumers must use `ChatOptions` directly. This is a breaking change to the public API (full migration, no backwards compat).

- [ ] **Step 2: Run typecheck**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "refactor(core): update public API to unified executor exports"
```

---

## Task 10: Delete legacy files

**Files:**
- Delete: `packages/core/src/executors/executors/` (entire directory)
- Delete: `packages/core/src/executors/types.ts`

- [ ] **Step 1: Verify no remaining imports from deleted paths (excluding test files)**

Run: `grep -r "from.*[\"'].*executors/executors" packages/core/src/ --include="*.ts" | grep -v ".test."`
Run: `grep -r "from.*[\"'].*executors/types" packages/core/src/ --include="*.ts" | grep -v ".test."`
Expected: No output (zero references)

- [ ] **Step 2: Delete the legacy directory**

```bash
rm -rf packages/core/src/executors/executors/
```

- [ ] **Step 3: Delete legacy types file**

```bash
rm packages/core/src/executors/types.ts
```

- [ ] **Step 4: Run typecheck**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: PASS (test files will fail — fixed in next task)

- [ ] **Step 5: Commit**

```bash
git add -A packages/core/src/executors/
git commit -m "chore(executors): delete legacy executors/ directory and types.ts"
```

---

## Task 11: Rewrite tests

**Files:**
- Modify: `packages/core/src/executors/index.test.ts`
- Modify: `packages/core/src/executors/chat.test.ts`
- Modify: `packages/core/src/cli/commands/executor-chat.test.ts`
- Modify: `packages/core/src/services/container.test.ts`
- Modify: `packages/core/src/services/container.integration.test.ts`

- [ ] **Step 1: Rewrite `index.test.ts`**

Replace all `ClaudeCode` → `ClaudeExecutor`, `createExecutor` → `getExecutor`, `instanceof ClaudeCode` → `instanceof ClaudeExecutor`, etc. Remove `useApprovals` test cases.

```typescript
// Before
import { ClaudeCode, createExecutor, EXECUTOR_TYPES, isExecutorType } from "./index";
const executor = createExecutor("CLAUDE_CODE");
expect(executor).toBeInstanceOf(ClaudeCode);

// After
import { ClaudeExecutor, getExecutor, getRegisteredTypes, isExecutorType } from "./index";
const executor = getExecutor("CLAUDE_CODE");
expect(executor).toBeInstanceOf(ClaudeExecutor);
```

- [ ] **Step 2: Rewrite `chat.test.ts`**

```typescript
// Before
import { ClaudeCode } from "./executors";
const executor = new ClaudeCode();

// After
import { getExecutor } from "./ops";
const executor = getExecutor("CLAUDE_CODE");
```

- [ ] **Step 3: Rewrite `executor-chat.test.ts` mocks**

```typescript
// Before (in vi.mock)
createExecutor: vi.fn(),
EXECUTOR_TYPES: [...],
CHAT_SUPPORTED_EXECUTORS: [...],
executorSupportsChat: vi.fn(),

// After
getExecutor: vi.fn(),
getRegisteredTypes: vi.fn(() => ["CLAUDE_CODE", "GEMINI", ...]),
```

- [ ] **Step 4: Rewrite `container.test.ts`**

```typescript
// Before
import type { StandardCodingAgentExecutor, SpawnedChild, ExecutionEnv } from "../executors/types";

// After
import type { Executor, SSEMessage } from "../executors/ops/types";
```

Update `createMockExecutor()` to return a mock that satisfies the `Executor` interface with `chatStreaming()` returning an async generator of SSEMessage.

- [ ] **Step 5: Rewrite `container.integration.test.ts`**

```typescript
// Before
import type { StandardCodingAgentExecutor, SpawnedChild, ExecutionEnv, ExecutorExitResult } from "../executors/types";

// After
import type { Executor, SSEMessage } from "../executors/ops/types";
```

Update `createRealExecutor()` similarly.

- [ ] **Step 6: Run full test suite**

Run: `cd packages/core && pnpm vitest run`
Expected: ALL PASS

- [ ] **Step 7: Run full build**

Run: `pnpm build`
Expected: PASS (all packages compile)

- [ ] **Step 8: Final grep verification**

Run: `grep -r "StandardCodingAgentExecutor\|SpawnedChild\|ExecutionEnv\|createExecutor\|ClaudeCode\b\|ExecutorApprovalService\|UnifiedChatOptions\|UnifiedChatResult\|EXECUTOR_TYPES\|CHAT_SUPPORTED_EXECUTORS\|executorSupportsChat" packages/core/src/ --include="*.ts" | grep -v ".d.ts"`
Expected: Empty output (zero remaining references, including test files)

- [ ] **Step 9: CLI smoke test**

Run: `pnpm --filter @viben/core build && cd packages/core && node -e "const c = require('./dist'); console.log(c.getRegisteredTypes()); console.log(c.getExecutor('CLAUDE_CODE').type)"`
Expected: Prints registered executor types and "CLAUDE_CODE"

Run: `viben executor types`
Expected: Lists executor types without error

- [ ] **Step 10: Commit**

```bash
git add -A packages/core/src/
git commit -m "test(executors): rewrite tests for unified executor API"
```

---

## Summary

| Task | What | Risk | Dependencies |
|------|------|------|-------------|
| 1 | Fix GeminiExecutor (5 bugs) | Low | None |
| 2 | Fix ClaudeExecutor (flags/env) | Low | None |
| 3 | Fix CodexExecutor (CODEX_FOLLOWUP_PROMPT) | Low | None |
| 4 | Extend SSEMessage types | Low | None |
| 5 | Migrate spawn-proxy.ts | Low | None |
| 6 | Migrate container.ts + router.ts (atomic) | **High** — core streaming change | Task 4 |
| 7 | Migrate orchestrator.ts + agent.ts | Low | None |
| 8 | Clean executors/index.ts + move types | Medium | Tasks 5-7 |
| 9 | Update public API | Medium | Task 8 |
| 10 | Delete legacy files | Low (after all migrations) | Tasks 8-9 |
| 11 | Rewrite tests | Medium | Task 10 |

**Tasks 1–5 and 7 are independent and can be parallelized.** Task 6 depends on Task 4. Tasks 8–11 are sequential.

---

## Known Design Decisions

**Full migration, no backwards compatibility.** All aliases (`UnifiedChatOptions`, `UnifiedChatResult`) are removed. Consumers must update to the canonical names.

1. **`chatStreaming()` returns `AsyncGenerator<SSEMessage>` directly** — the spec mentions a potential `{ stream, abort }` wrapper for kill control, but the current `ops/types.ts` interface returns a plain AsyncGenerator. Plan follows the current interface. Abort control is a separate future enhancement.

2. **`handle*` methods keep `Record<string, unknown>` signatures** — passing typed SSEMessage subtypes would be cleaner, but requires rewriting all handler internals. The cast `as Record<string, unknown>` preserves existing handler code unchanged. Refactoring handler signatures is out of scope for this migration.

3. **`createChatProxyAsync` and `chatProxyFactory` remain valid exports** — these live in `executors/chat/factory.ts` (unified module), not in the legacy `executors/executors/` directory. They are kept in the public API.

4. **Two `SSEMessage` definitions coexist intentionally** — `ops/types.ts` has the canonical union (extended in Task 4), while `chat/sdk-proxy.ts` has its own SSEMessage for the SDK proxy layer. Consumers importing from `"../executors"` get the ops version; `"../executors/chat/sdk-proxy"` keeps its own. Unifying these into a single type is out of scope for this migration (sdk-proxy's SSEMessage is internal to that module).

5. **`ChatOptions.repoContext` deferred** — the spec mentions this field but it requires design decisions about how to pass workspace context. Current container.ts passes an empty env `{}`. Adding `repoContext` to `ChatOptions` and actually consuming it in engines is a follow-up task after this migration lands.

6. **`chatStreaming()` assistant message unpacking deferred** — the spec requires ClaudeExecutor to split `type:"assistant"` messages into individual `text`/`tool_use` yields. This is an enhancement to the streaming layer, not a prerequisite for the type migration. It can be done as a follow-up without blocking the migration. Container.ts already handles `type:"assistant"` messages via `processSSEMessage` → `handleAssistantMessage`.
