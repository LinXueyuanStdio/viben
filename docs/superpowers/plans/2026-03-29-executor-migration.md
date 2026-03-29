# Executor Module Migration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all usages of the old `src/executors/` module to the new unified `src/executor/` module.

**Architecture:** Registry-based executor pattern with factory functions, replacing switch-case based creation. The new module provides a unified `Executor` interface with capabilities detection, streaming support, and consistent error handling.

**Tech Stack:** TypeScript, Node.js, Vitest

---

## Background

The codebase currently has two executor systems:

1. **Old system** (`src/executors/`):
   - `createExecutor()` - switch-case factory
   - `EXECUTOR_TYPES` - hardcoded array
   - `ChatProxy` / `SdkChatProxy` - separate chat abstraction
   - `StandardCodingAgentExecutor` - base type

2. **New unified system** (`src/executor/`):
   - `getExecutor()` - registry-based factory
   - `getRegisteredTypes()` - dynamic from registry
   - `Executor.chat()` / `Executor.chatStreaming()` - built into interface
   - `Executor` - unified interface with capabilities

### Migration Mapping

| Old API | New API |
|---------|---------|
| `createExecutor(type)` | `getExecutor(type)` |
| `EXECUTOR_TYPES` | `getRegisteredTypes()` |
| `isExecutorType(type)` | `hasExecutor(type)` |
| `getAllExecutorsAvailability()` | `getAvailableExecutors()` |
| `executorSupportsChat(type)` | `executor.supports("CHAT")` |
| `createChatProxyAsync(type)` | `getExecutor(type)` + `executor.chat()` |
| `proxy.executeStreaming()` | `executor.chatStreaming()` |
| `proxy instanceof SdkChatProxy` | `executor.supports("CHAT_STREAMING")` |
| `StandardCodingAgentExecutor` | `Executor` (type) |
| `ChatOptions` (old) | `ChatOptions` (new, unified) |
| `SSEMessage` (old) | `SSEMessage` (new, same structure) |

---

## Chunk 1: CLI Commands Migration

### Task 1.1: Migrate `cli/commands/agent.ts`

**Files:**
- Modify: `packages/core/src/cli/commands/agent.ts`

- [ ] **Step 1: Update imports**

```typescript
// Before
import {
  EXECUTOR_TYPES,
  isExecutorType,
  executorSupportsChat,
  CHAT_SUPPORTED_EXECUTORS,
  createChatProxyAsync,
  chatProxyFactory,
  type ChatFormat,
} from "../../executors";

// After
import {
  getExecutor,
  getRegisteredTypes,
  hasExecutor,
} from "../../executor";
import type { ChatOptions } from "../../executor";
```

- [ ] **Step 2: Replace executor type validation**

```typescript
// Before
if (!isExecutorType(executorType)) {
  throw new Error(`Invalid executor type: ${executorType}`);
}

// After
if (!hasExecutor(executorType)) {
  throw new Error(`Invalid executor type: ${executorType}`);
}
```

- [ ] **Step 3: Replace chat support check**

```typescript
// Before
if (!executorSupportsChat(executorType)) {
  throw new Error(`Executor ${executorType} does not support chat. Supported: ${CHAT_SUPPORTED_EXECUTORS.join(", ")}`);
}

// After
const executor = getExecutor(executorType);
if (!executor.supports("CHAT")) {
  const chatExecutors = getRegisteredTypes().filter(t => getExecutor(t).supports("CHAT"));
  throw new Error(`Executor ${executorType} does not support chat. Supported: ${chatExecutors.join(", ")}`);
}
```

- [ ] **Step 4: Replace ChatProxy with Executor.chat()**

```typescript
// Before
const proxy = await createChatProxyAsync(executorType, preferSdk);
const result = await proxy.execute({
  prompt,
  cwd,
  systemPrompt,
  appendPrompt,
  mcpServers,
  skills,
  model,
  dangerouslySkipPermissions: true,
});

// After
const executor = getExecutor(executorType);
const result = await executor.chat({
  prompt,
  cwd,
  systemPrompt,
  appendPrompt,
  mcpServers,
  skills,
  model,
  dangerouslySkipPermissions: true,
  preferSdk,
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- --run src/cli/commands/agent`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/cli/commands/agent.ts
git commit -m "refactor(cli): migrate agent command to unified executor module

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.2: Migrate `channels/router.ts`

**Files:**
- Modify: `packages/core/src/channels/router.ts`

- [ ] **Step 1: Update imports**

```typescript
// Before
import {
  createExecutor,
  isExecutorType,
  createExecutionEnv,
  type StandardCodingAgentExecutor,
} from "../executors";

// After
import { getExecutor, hasExecutor } from "../executor";
import type { Executor } from "../executor";
// Note: createExecutionEnv stays in old module until migrated
import { createExecutionEnv } from "../executors";
```

- [ ] **Step 2: Replace createExecutor calls**

```typescript
// Before
const executor = createExecutor(executorType);

// After
const executor = getExecutor(executorType);
```

- [ ] **Step 3: Replace type annotations**

```typescript
// Before
const executor: StandardCodingAgentExecutor = ...

// After
const executor: Executor = ...
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --run src/channels`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/channels/router.ts
git commit -m "refactor(channels): migrate router to unified executor module

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Chunk 2: Gateway Routes Migration (Simple)

### Task 2.1: Migrate `gateway/routes/mcp-inspector.ts`

**Files:**
- Modify: `packages/core/src/gateway/routes/mcp-inspector.ts`

- [ ] **Step 1: Update imports**

```typescript
// Before
import { whichSync } from "../../executors/utils";

// After
import { whichSync } from "../../executor/ops/utils";
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- --run src/gateway/routes/mcp-inspector`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/gateway/routes/mcp-inspector.ts
git commit -m "refactor(gateway): migrate mcp-inspector to unified executor utils

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.2: Migrate `gateway/routes/chat-list.ts`

**Files:**
- Modify: `packages/core/src/gateway/routes/chat-list.ts`

- [ ] **Step 1: Replace EXECUTOR_CONFIGS with registry**

```typescript
// Before
const EXECUTOR_CONFIGS: Array<{
  id: string;
  name: string;
  folders: string[];
  supportsMcp: boolean;
}> = [
  { id: "CLAUDE_CODE", name: "Claude Code", folders: [".claude"], supportsMcp: true },
  // ... hardcoded list
];

// After
import { getRegisteredTypes, getExecutor } from "../../executor";

function getExecutorConfigs(): Array<{
  id: string;
  name: string;
  folders: string[];
  supportsMcp: boolean;
}> {
  return getRegisteredTypes().map(type => {
    const executor = getExecutor(type);
    return {
      id: type,
      name: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      folders: [executor.getConfigDirName()],
      supportsMcp: executor.defaultMcpConfigPath() !== null,
    };
  });
}
```

- [ ] **Step 2: Update usages**

```typescript
// Replace EXECUTOR_CONFIGS with getExecutorConfigs()
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --run src/gateway/routes/chat-list`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/gateway/routes/chat-list.ts
git commit -m "refactor(gateway): migrate chat-list to unified executor registry

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.3: Migrate `gateway/routes/workspaces.ts`

**Files:**
- Modify: `packages/core/src/gateway/routes/workspaces.ts`

- [ ] **Step 1: Update imports**

```typescript
// Before
import { ExecutorType } from "../../workspace";

// After
import { getRegisteredTypes } from "../../executor";
import type { ExecutorType } from "../../types";
```

- [ ] **Step 2: Replace hardcoded executor list**

```typescript
// Use getRegisteredTypes() instead of hardcoded list
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --run src/gateway/routes/workspaces`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/gateway/routes/workspaces.ts
git commit -m "refactor(gateway): migrate workspaces to unified executor registry

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Chunk 3: Gateway Core Migration

### Task 3.1: Migrate `gateway/routes/executors.ts`

**Files:**
- Modify: `packages/core/src/gateway/routes/executors.ts`

- [ ] **Step 1: Update imports**

```typescript
// Before
import { EXECUTOR_TYPES } from "../../executors";

// After
import {
  getExecutor,
  getRegisteredTypes,
  getAvailableExecutors,
} from "../../executor";
```

- [ ] **Step 2: Remove EXECUTOR_METADATA hardcoding**

```typescript
// Before
const EXECUTOR_METADATA = {
  CLAUDE_CODE: { name: "Claude Code", cli: "claude", ... },
  // ... hardcoded
};

// After
function getExecutorMetadata(type: ExecutorType) {
  const executor = getExecutor(type);
  return {
    name: type,
    cli: executor.getCliName(),
    configDir: executor.getConfigDirName(),
    capabilities: executor.capabilities(),
  };
}
```

- [ ] **Step 3: Replace checkExecutorAvailability**

```typescript
// Before
function checkExecutorAvailability(type: ExecutorType) {
  // ... hardcoded path checking
}

// After
function checkExecutorAvailability(type: ExecutorType) {
  const executor = getExecutor(type);
  return executor.getAvailabilityInfo();
}
```

- [ ] **Step 4: Update GET /api/executors endpoint**

```typescript
// Use getAvailableExecutors() from unified module
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- --run src/gateway/routes/executors`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/gateway/routes/executors.ts
git commit -m "refactor(gateway): migrate executors route to unified executor module

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3.2: Migrate `gateway/routes/agents.ts`

**Files:**
- Modify: `packages/core/src/gateway/routes/agents.ts`

- [ ] **Step 1: Update imports**

```typescript
// Add
import { getExecutor, getRegisteredTypes, hasExecutor } from "../../executor";
```

- [ ] **Step 2: Remove duplicate availability check logic (lines 831-984)**

```typescript
// Before: ~150 lines of hardcoded path checking

// After
function getExecutorAvailability(type: ExecutorType) {
  if (!hasExecutor(type)) return { status: "NOT_FOUND" };
  return getExecutor(type).getAvailabilityInfo();
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --run src/gateway/routes/agents`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/gateway/routes/agents.ts
git commit -m "refactor(gateway): migrate agents route to unified executor module

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Chunk 4: Streaming Migration

### Task 4.1: Migrate `group-chat/orchestrator.ts`

**Files:**
- Modify: `packages/core/src/group-chat/orchestrator.ts`

- [ ] **Step 1: Update imports**

```typescript
// Before
import {
  createChatProxyAsync,
  executorSupportsChat,
  ChatProxy,
  ChatOptions,
  ExecutorType,
} from "../executors";
import { SdkChatProxy, SSEMessage } from "../executors/chat/sdk-proxy";

// After
import {
  getExecutor,
  type Executor,
  type ChatOptions,
  type SSEMessage,
} from "../executor";
import type { ExecutorType } from "../types";
```

- [ ] **Step 2: Replace SdkChatProxy instanceof check**

```typescript
// Before
const proxy = await createChatProxyAsync(executorType);
if (proxy instanceof SdkChatProxy) {
  for await (const msg of proxy.executeStreaming(options)) {
    // handle streaming
  }
} else {
  const result = await proxy.execute(options);
}

// After
const executor = getExecutor(executorType);
if (executor.supports("CHAT_STREAMING")) {
  for await (const msg of executor.chatStreaming(options)) {
    // handle streaming
  }
} else {
  const result = await executor.chat(options);
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --run src/group-chat`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/group-chat/orchestrator.ts
git commit -m "refactor(group-chat): migrate orchestrator to unified executor streaming

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.2: Migrate `gateway/routes/agent-run.ts`

**Files:**
- Modify: `packages/core/src/gateway/routes/agent-run.ts`

- [ ] **Step 1: Update imports**

```typescript
// Before
import { SdkChatProxy } from "../../executors/chat/sdk-proxy";

// After
import { getExecutor, type SSEMessage } from "../../executor";
```

- [ ] **Step 2: Replace SdkChatProxy usage**

```typescript
// Before
const proxy = new SdkChatProxy(executorType);
for await (const msg of proxy.executeStreaming(options)) { ... }

// After
const executor = getExecutor(executorType);
if (!executor.supports("CHAT_STREAMING")) {
  throw new Error(`Executor ${executorType} does not support streaming`);
}
for await (const msg of executor.chatStreaming(options)) { ... }
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --run src/gateway/routes/agent-run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/gateway/routes/agent-run.ts
git commit -m "refactor(gateway): migrate agent-run to unified executor streaming

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.3: Migrate `gateway/routes/agent-ws.ts`

**Files:**
- Modify: `packages/core/src/gateway/routes/agent-ws.ts`

- [ ] **Step 1: Same pattern as agent-run.ts**

- [ ] **Step 2: Run tests**

Run: `pnpm test -- --run src/gateway/routes/agent-ws`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/gateway/routes/agent-ws.ts
git commit -m "refactor(gateway): migrate agent-ws to unified executor streaming

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.4: Migrate `gateway/queue/worker.ts`

**Files:**
- Modify: `packages/core/src/gateway/queue/worker.ts`

- [ ] **Step 1: Update imports and replace SdkChatProxy**

- [ ] **Step 2: Run tests**

Run: `pnpm test -- --run src/gateway/queue`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/gateway/queue/worker.ts
git commit -m "refactor(gateway): migrate queue worker to unified executor streaming

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.5: Migrate `idea/ops/generator.ts`

**Files:**
- Modify: `packages/core/src/idea/ops/generator.ts`

- [ ] **Step 1: Update imports**

```typescript
// Before
import { SdkChatProxy, isSdkAvailable } from "../../executors/chat/sdk-proxy";

// After
import { getExecutor } from "../../executor";
```

- [ ] **Step 2: Replace isSdkAvailable check**

```typescript
// Before
if (!isSdkAvailable(executorType)) { ... }

// After
const executor = getExecutor(executorType);
if (!executor.supports("CHAT_SDK")) { ... }
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --run src/idea`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/idea/ops/generator.ts
git commit -m "refactor(idea): migrate generator to unified executor module

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Chunk 5: Services Migration

### Task 5.1: Migrate `services/container.ts`

**Files:**
- Modify: `packages/core/src/services/container.ts`
- Modify: `packages/core/src/services/container.test.ts`
- Modify: `packages/core/src/services/container.integration.test.ts`

- [ ] **Step 1: Update imports in container.ts**

```typescript
// Before
import {
  ExecutionEnv,
  SpawnedChild,
  StandardCodingAgentExecutor,
} from "../executors/types";

// After
import type { Executor, SpawnOptions, ExecutionResult } from "../executor";
// Note: ExecutionEnv and SpawnedChild may need to be added to new module
// or kept as internal types if only used here
```

- [ ] **Step 2: Update type annotations**

```typescript
// Before
executor: StandardCodingAgentExecutor

// After
executor: Executor
```

- [ ] **Step 3: Update test files with same pattern**

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --run src/services/container`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/container.ts packages/core/src/services/container.test.ts packages/core/src/services/container.integration.test.ts
git commit -m "refactor(services): migrate container to unified executor module

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5.2: Migrate `cli/commands/executor.ts` (complete migration)

**Files:**
- Modify: `packages/core/src/cli/commands/executor.ts`
- Modify: `packages/core/src/cli/commands/executor-execution.test.ts`

- [ ] **Step 1: Remove remaining old imports**

```typescript
// Before (partial migration state)
import { createChatProxyAsync, chatProxyFactory } from "../../executors";

// After (fully migrated)
// All executor functionality from ../../executor
```

- [ ] **Step 2: Update test file imports**

```typescript
// Before
import { which, whichSync } from "../../executors/utils";

// After
import { which, whichSync } from "../../executor/ops/utils";
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --run src/cli/commands/executor`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/cli/commands/executor.ts packages/core/src/cli/commands/executor-execution.test.ts
git commit -m "refactor(cli): complete executor command migration to unified module

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Chunk 6: Cleanup

### Task 6.1: Update `src/index.ts` exports

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Deprecate old exports**

```typescript
// Add deprecation comments
/** @deprecated Use getUnifiedExecutor instead */
export { createExecutor } from "./executors";

/** @deprecated Use getUnifiedExecutorTypes instead */
export { EXECUTOR_TYPES } from "./executors";
```

- [ ] **Step 2: Remove chat proxy re-exports (after all migrations)**

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "refactor(core): deprecate old executor exports

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6.2: Update `executors/chat/spawn-proxy.ts`

**Files:**
- Modify: `packages/core/src/executors/chat/spawn-proxy.ts`

- [ ] **Step 1: Update to use unified executor internally**

```typescript
// Before
import { createExecutor } from "..";

// After
import { getExecutor } from "../../executor";
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- --run src/executors/chat`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/executors/chat/spawn-proxy.ts
git commit -m "refactor(executors): migrate spawn-proxy to use unified executor

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Verification

### Final Verification Steps

- [ ] **Step 1: Run all tests**

```bash
cd packages/core && pnpm test
```

- [ ] **Step 2: Build check**

```bash
pnpm build
```

- [ ] **Step 3: Type check**

```bash
pnpm typecheck
```

- [ ] **Step 4: Manual CLI test**

```bash
pnpm viben executor list
pnpm viben executor show CLAUDE_CODE
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking changes in chat streaming | Keep old module until all consumers migrated |
| SSE message format differences | Verify SSEMessage types are compatible |
| Session management differences | Test session creation/resume with real executors |
| Missing capabilities in unified module | Add capabilities as needed during migration |
| `createExecutionEnv` not in new module | Keep import from old module until Phase 2 |
| Container service type dependencies | May need to add ExecutionEnv to new module |

## Success Criteria

1. All tests pass after each chunk
2. No imports from `src/executors/` in migrated files (except deprecated re-exports)
3. `viben executor` commands work correctly
4. Gateway SSE streaming works for all executor types
5. Group chat orchestrator handles streaming correctly

## Files Summary

### Files to Migrate (by chunk)

| Chunk | File | Status |
|-------|------|--------|
| 1 | `src/cli/commands/agent.ts` | Pending |
| 1 | `src/channels/router.ts` | Pending |
| 2 | `src/gateway/routes/mcp-inspector.ts` | Pending |
| 2 | `src/gateway/routes/chat-list.ts` | Pending |
| 2 | `src/gateway/routes/workspaces.ts` | Pending |
| 3 | `src/gateway/routes/executors.ts` | Pending |
| 3 | `src/gateway/routes/agents.ts` | Pending |
| 4 | `src/group-chat/orchestrator.ts` | Pending |
| 4 | `src/gateway/routes/agent-run.ts` | Pending |
| 4 | `src/gateway/routes/agent-ws.ts` | Pending |
| 4 | `src/gateway/queue/worker.ts` | Pending |
| 4 | `src/idea/ops/generator.ts` | Pending |
| 5 | `src/services/container.ts` | Pending |
| 5 | `src/services/container.test.ts` | Pending |
| 5 | `src/services/container.integration.test.ts` | Pending |
| 5 | `src/cli/commands/executor.ts` | Partial |
| 5 | `src/cli/commands/executor-execution.test.ts` | Pending |
| 6 | `src/index.ts` | Pending |
| 6 | `src/executors/chat/spawn-proxy.ts` | Pending |

### Files NOT Requiring Migration

- `src/cli/commands/agent.test.ts` - Only imports `ExecutorType` (can use from `../../types`)
- `src/cli/commands/agent-chat.test.ts` - Test file, will be updated with parent
