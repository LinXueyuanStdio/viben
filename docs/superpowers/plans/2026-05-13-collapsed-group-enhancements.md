# CollapsedToolGroup 增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `CollapsedToolGroup` 添加经过计时（elapsed time）、单项展开、更丰富分类（目录列出、MCP 查询、git 操作检测），对齐 Claude Code CLI 的折叠体验。

**Architecture:** 在现有 `collapsed-tool-group.tsx` 基础上扩展 props（添加 `startTime`），新增 `use-elapsed-time.ts` hook 驱动实时计时；将 tool 分类从 6 种扩展至 9 种（加入 list/mcp/git）；children 区域改为 per-item 可折叠而非一次性展开所有。

**Tech Stack:** React 19, framer-motion, react-i18next, lucide-react, Tailwind v4

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| Create | `packages/chat/src/use-elapsed-time.ts` | 实时计时 hook，每秒 tick，返回 elapsed 秒数 |
| Modify | `packages/chat/src/collapsed-tool-group.tsx` | 扩展分类、计时显示、per-item expand |
| Modify | `packages/chat/src/index.ts` | 导出新 hook |
| Modify | `packages/chat/src/message-list.tsx` | 传入 `startTime` prop，适配新的 per-item expand 接口 |

---

## 参考文件

- `infra/claude-code/src/components/messages/CollapsedReadSearchContent.tsx`
  - 行 268-289: `shellProgressSuffix` 逻辑 — 当 bash 工具运行 >2s 时显示 elapsed + line count
  - 行 293-434: 各分类的 present/past tense 渲染
  - 行 492-508: `displayedHint` + `⎿` 前缀行
  - 行 196-253: verbose mode per-item `VerboseToolUse`
- `infra/claude-code/src/utils/collapseReadSearch.ts`
  - 行 1033-1138: `getSearchReadSummaryText()` — search/read/list/bash/mcp/memory/git 分别计数
- `infra/claude-code/src/components/ToolUseLoader.tsx`
  - 闪烁/绿/红色状态指示器

---

### Task 1: 创建 `use-elapsed-time` hook

**Files:**
- Create: `packages/chat/src/use-elapsed-time.ts`

- [ ] **Step 1: 创建 hook 文件**

```typescript
import { useEffect, useRef, useState } from "react";

/**
 * Returns elapsed seconds since `startTime` (ms epoch), updating every second.
 * Returns 0 when `enabled` is false or `startTime` is undefined.
 * Stops ticking when enabled turns false — the last value freezes.
 */
export function useElapsedTime(
  startTime: number | undefined,
  enabled: boolean
): number {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || startTime === undefined) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Compute initial elapsed immediately
    setElapsed(Math.floor((Date.now() - startTime) / 1000));

    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTime, enabled]);

  return elapsed;
}

/**
 * Format seconds into human-readable duration.
 * - <60s: "5s"
 * - >=60s: "1m 23s"
 * - >=3600s: "1h 2m"
 */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/use-elapsed-time.ts
git commit -m "feat(chat): add useElapsedTime hook for real-time duration tracking"
```

---

### Task 2: 扩展 ToolCounts 分类

**Files:**
- Modify: `packages/chat/src/collapsed-tool-group.tsx:30-80`

- [ ] **Step 1: 扩展 ToolCounts interface 和 countToolsByCategory**

将 `ToolCounts` 从 6 种扩展到 9 种：添加 `list`（目录列出）、`mcp`（MCP 查询）、`git`（git 操作）。

```typescript
interface ToolCounts {
  read: number;
  search: number;
  list: number;
  bash: number;
  write: number;
  edit: number;
  mcp: number;
  git: number;
  other: number;
}
```

更新 `countToolsByCategory`：

```typescript
function countToolsByCategory(
  tools: CollapsedToolGroupProps["tools"]
): ToolCounts {
  const counts: ToolCounts = {
    read: 0,
    search: 0,
    list: 0,
    bash: 0,
    write: 0,
    edit: 0,
    mcp: 0,
    git: 0,
    other: 0,
  };

  for (const tool of tools) {
    switch (tool.name) {
      case "Read":
        counts.read++;
        break;
      case "Grep":
        counts.search++;
        break;
      case "Glob":
      case "ListDir":
        counts.list++;
        break;
      case "Bash": {
        // Detect git operations from command input
        const cmd = ((tool.input?.command as string) || "").trim();
        if (isGitCommand(cmd)) {
          counts.git++;
        } else {
          counts.bash++;
        }
        break;
      }
      case "Write":
        counts.write++;
        break;
      case "Edit":
      case "MultiEdit":
        counts.edit++;
        break;
      default:
        // Detect MCP tools (prefixed with server name or containing __)
        if (tool.name.includes("__") || tool.name.includes("/")) {
          counts.mcp++;
        } else {
          counts.other++;
        }
        break;
    }
  }

  return counts;
}

/** Check if a bash command is a git operation */
function isGitCommand(cmd: string): boolean {
  const firstWord = cmd.split(/\s+/)[0] || "";
  // Direct git commands
  if (firstWord === "git") return true;
  // gh CLI
  if (firstWord === "gh") return true;
  return false;
}
```

- [ ] **Step 2: 更新 maxCountsRef 初始值和 stableCounts 逻辑**

在组件中更新 `maxCountsRef` 的初始值以包含新字段：

```typescript
const maxCountsRef = useRef<ToolCounts>({
  read: 0, search: 0, list: 0, bash: 0, write: 0, edit: 0, mcp: 0, git: 0, other: 0,
});

const stableCounts = useMemo(() => {
  const currentCounts = countToolsByCategory(tools);

  if (isExecuting) {
    maxCountsRef.current = {
      read: Math.max(maxCountsRef.current.read, currentCounts.read),
      search: Math.max(maxCountsRef.current.search, currentCounts.search),
      list: Math.max(maxCountsRef.current.list, currentCounts.list),
      bash: Math.max(maxCountsRef.current.bash, currentCounts.bash),
      write: Math.max(maxCountsRef.current.write, currentCounts.write),
      edit: Math.max(maxCountsRef.current.edit, currentCounts.edit),
      mcp: Math.max(maxCountsRef.current.mcp, currentCounts.mcp),
      git: Math.max(maxCountsRef.current.git, currentCounts.git),
      other: Math.max(maxCountsRef.current.other, currentCounts.other),
    };
    return maxCountsRef.current;
  }

  maxCountsRef.current = currentCounts;
  return currentCounts;
}, [tools, isExecuting]);
```

- [ ] **Step 3: 验证类型检查通过**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add packages/chat/src/collapsed-tool-group.tsx
git commit -m "feat(chat): extend CollapsedToolGroup categories with list/mcp/git detection"
```

---

### Task 3: 扩展 summary text 以支持新分类

**Files:**
- Modify: `packages/chat/src/collapsed-tool-group.tsx:86-140`

- [ ] **Step 1: 更新 useSummaryText 函数**

在现有 `useSummaryText` 函数中添加 `list`、`mcp`、`git` 分类的文案：

```typescript
function useSummaryText(counts: ToolCounts, isExecuting: boolean): string {
  const { t } = useTranslation();
  const parts: string[] = [];

  if (counts.git > 0) {
    parts.push(
      t(isExecuting ? "chat.collapsedGroup.runningGitOps" : "chat.collapsedGroup.ranGitOps", {
        count: counts.git,
        defaultValue: isExecuting
          ? "Running {{count}} git operations"
          : "Ran {{count}} git operations",
      }) as string
    );
  }
  if (counts.read > 0) {
    parts.push(
      t(isExecuting ? "chat.collapsedGroup.readingFiles" : "chat.collapsedGroup.readFiles", {
        count: counts.read,
        defaultValue: isExecuting ? "Reading {{count}} files" : "Read {{count}} files",
      }) as string
    );
  }
  if (counts.search > 0) {
    parts.push(
      t(isExecuting ? "chat.collapsedGroup.searchingPatterns" : "chat.collapsedGroup.searchedPatterns", {
        count: counts.search,
        defaultValue: isExecuting ? "Searching {{count}} patterns" : "Searched {{count}} patterns",
      }) as string
    );
  }
  if (counts.list > 0) {
    parts.push(
      t(isExecuting ? "chat.collapsedGroup.listingDirs" : "chat.collapsedGroup.listedDirs", {
        count: counts.list,
        defaultValue: isExecuting
          ? "Listing {{count}} directories"
          : "Listed {{count}} directories",
      }) as string
    );
  }
  if (counts.bash > 0) {
    parts.push(
      t(isExecuting ? "chat.collapsedGroup.runningCommands" : "chat.collapsedGroup.ranCommands", {
        count: counts.bash,
        defaultValue: isExecuting ? "Running {{count}} commands" : "Ran {{count}} commands",
      }) as string
    );
  }
  if (counts.write > 0) {
    parts.push(
      t(isExecuting ? "chat.collapsedGroup.writingFiles" : "chat.collapsedGroup.wroteFiles", {
        count: counts.write,
        defaultValue: isExecuting ? "Writing {{count}} files" : "Wrote {{count}} files",
      }) as string
    );
  }
  if (counts.edit > 0) {
    parts.push(
      t(isExecuting ? "chat.collapsedGroup.editingFiles" : "chat.collapsedGroup.editedFiles", {
        count: counts.edit,
        defaultValue: isExecuting ? "Editing {{count}} files" : "Edited {{count}} files",
      }) as string
    );
  }
  if (counts.mcp > 0) {
    parts.push(
      t(isExecuting ? "chat.collapsedGroup.queryingMcp" : "chat.collapsedGroup.queriedMcp", {
        count: counts.mcp,
        defaultValue: isExecuting ? "Querying MCP {{count}} times" : "Queried MCP {{count}} times",
      }) as string
    );
  }
  if (counts.other > 0) {
    parts.push(
      t(isExecuting ? "chat.collapsedGroup.usingTools" : "chat.collapsedGroup.usedTools", {
        count: counts.other,
        defaultValue: isExecuting ? "Using {{count}} tools" : "Used {{count}} tools",
      }) as string
    );
  }

  return parts.join(", ");
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/collapsed-tool-group.tsx
git commit -m "feat(chat): add list/mcp/git summary text to CollapsedToolGroup"
```

---

### Task 4: 添加 elapsed time 显示

**Files:**
- Modify: `packages/chat/src/collapsed-tool-group.tsx` (imports + props + render)

- [ ] **Step 1: 扩展 props 并引入 elapsed time hook**

在 `CollapsedToolGroupProps` 中添加 `startTime` prop：

```typescript
export interface CollapsedToolGroupProps {
  /** The tool use messages in this group */
  tools: Array<{
    name: string;
    input?: Record<string, unknown>;
    output?: string | ContentBlock[];
    isError?: boolean;
  }>;
  /** Whether any tools in the group are still executing */
  isExecuting?: boolean;
  /** Whether the group is expanded (showing individual items) */
  expanded?: boolean;
  /** Toggle expand/collapse */
  onToggle?: () => void;
  /** Content to render when expanded (individual ToolExecutionItems) */
  children?: React.ReactNode;
  /** Epoch timestamp (ms) when the group started executing. Used for elapsed time display. */
  startTime?: number;
  className?: string;
}
```

在文件顶部添加 import：

```typescript
import { useElapsedTime, formatElapsed } from "./use-elapsed-time";
```

- [ ] **Step 2: 在组件中使用 elapsed time**

在 `CollapsedToolGroup` 组件体内，调用 hook 并计算是否显示：

```typescript
// Elapsed time for long-running groups (shown after 2s, like Claude Code)
const elapsedSeconds = useElapsedTime(startTime, isExecuting);
const showElapsed = isExecuting && elapsedSeconds >= 2;
```

- [ ] **Step 3: 渲染 elapsed time 到 summary 行末尾**

在 summary button 内部，hint 区域之前添加 elapsed 显示：

```tsx
{/* Elapsed time for long-running operations */}
{showElapsed && (
  <span className="text-muted-foreground/60 shrink-0 text-[11px] tabular-nums ml-1">
    ({formatElapsed(elapsedSeconds)})
  </span>
)}
```

将其放置在 `summaryText` span 后面、hint span 之前。

- [ ] **Step 4: 验证类型检查通过**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add packages/chat/src/collapsed-tool-group.tsx
git commit -m "feat(chat): display elapsed time in CollapsedToolGroup after 2s"
```

---

### Task 5: Per-item expand（单项展开/折叠）

**Files:**
- Modify: `packages/chat/src/collapsed-tool-group.tsx` (新增 `expandedItems` state + per-item UI)
- Modify: `packages/chat/src/message-list.tsx` (适配 per-item 回调)

- [ ] **Step 1: 在 props 中添加 per-item expand 回调**

在 `CollapsedToolGroupProps` 中添加新的 render prop：

```typescript
export interface CollapsedToolGroupProps {
  // ... existing props ...
  /** Render a single item when it's individually expanded within the group.
   *  When provided, clicking an item in the collapsed list expands just that item. */
  renderItem?: (tool: CollapsedToolGroupProps["tools"][number], index: number) => React.ReactNode;
}
```

- [ ] **Step 2: 在组件中管理 per-item expanded state**

在组件体内添加 per-item state：

```typescript
const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

const toggleItem = (index: number) => {
  setExpandedItems((prev) => {
    const next = new Set(prev);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    return next;
  });
};
```

- [ ] **Step 3: 替换 children 渲染逻辑，支持 per-item 和 all-at-once 两种模式**

当 `expanded` 为 true 时，如果 `renderItem` 存在，渲染 per-item 列表；否则 fallback 到原来的 `children`。

在 `{/* Expanded children */}` section 替换为：

```tsx
{/* Expanded children */}
<AnimatePresence initial={false}>
  {expanded && (renderItem ? (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.2,
        ease: "easeInOut",
      }}
      className="overflow-hidden"
    >
      <div className="ml-[22px] border-l border-muted-foreground/10 pl-2 pt-0.5 pb-0.5">
        {tools.map((tool, index) => (
          <div key={index}>
            {/* Per-item summary row */}
            <button
              type="button"
              onClick={() => toggleItem(index)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-md px-1.5 py-0.5",
                "text-left text-[12px] font-mono transition-colors",
                "hover:bg-accent/30 cursor-pointer"
              )}
            >
              <motion.span
                className="shrink-0 text-muted-foreground/50"
                animate={{ rotate: expandedItems.has(index) ? 90 : 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.1 }}
              >
                <ChevronRight className="size-2.5" />
              </motion.span>
              <span className={cn(
                "truncate",
                tool.isError ? "text-red-500" : "text-muted-foreground"
              )}>
                <span className="font-semibold">{tool.name}</span>
                {tool.input && (
                  <span className="text-muted-foreground/60 ml-1">
                    {getItemHint(tool)}
                  </span>
                )}
              </span>
              {/* Per-item status indicator */}
              {tool.output ? (
                tool.isError
                  ? <span className="size-1.5 shrink-0 rounded-full bg-red-500 ml-auto" />
                  : <span className="size-1.5 shrink-0 rounded-full bg-emerald-500 ml-auto" />
              ) : (
                <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500 ml-auto" />
              )}
            </button>
            {/* Per-item expanded detail */}
            <AnimatePresence initial={false}>
              {expandedItems.has(index) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="ml-4 py-0.5">
                    {renderItem(tool, index)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  ) : children ? (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.2,
        ease: "easeInOut",
      }}
      className="overflow-hidden"
    >
      <div className="ml-[22px] border-l border-muted-foreground/10 pl-2 pt-0.5 pb-0.5">{children}</div>
    </motion.div>
  ) : null)}
</AnimatePresence>
```

- [ ] **Step 4: 添加 `getItemHint` helper 函数**

在组件外部添加辅助函数：

```typescript
/** Get a short hint for a tool item in the per-item list */
function getItemHint(tool: CollapsedToolGroupProps["tools"][number]): string {
  const input = tool.input;
  if (!input) return "";

  switch (tool.name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      return getDisplayPath((input.file_path as string) || "");
    case "Grep":
      return `"${((input.pattern as string) || "").slice(0, 30)}"`;
    case "Glob":
    case "ListDir":
      return ((input.pattern as string) || (input.path as string) || "").slice(0, 40);
    case "Bash": {
      const cmd = ((input.command as string) || "").trim();
      const firstLine = cmd.split("\n")[0] || cmd;
      return firstLine.slice(0, 50);
    }
    default:
      return "";
  }
}
```

- [ ] **Step 5: 验证类型检查通过**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add packages/chat/src/collapsed-tool-group.tsx
git commit -m "feat(chat): add per-item expand/collapse within CollapsedToolGroup"
```

---

### Task 6: 更新 message-list.tsx 以传入新 props

**Files:**
- Modify: `packages/chat/src/message-list.tsx:153-193`

- [ ] **Step 1: 在 CollapsedToolRun 中传入 startTime 和 renderItem**

更新 `CollapsedToolRun` 组件以利用新的 per-item expand 和 startTime：

```typescript
function CollapsedToolRun({
  tools,
  artifacts,
  onArtifactClick,
}: {
  tools: ToolWithResult[];
  artifacts?: Artifact[];
  onArtifactClick?: (artifactId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isExecuting = tools.some((t) => !t.result);

  // Use the timestamp of the first tool in the group as startTime
  const startTime = useMemo(() => {
    const firstTool = tools[0];
    if (!firstTool) return undefined;
    // Approximate: use current time when group first appears and is executing
    return isExecuting ? Date.now() : undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CollapsedToolGroup
      tools={tools.map(({ message, result }) => ({
        name: message.name || "unknown",
        input: message.input,
        output: result?.output,
        isError: result?.isError,
      }))}
      isExecuting={isExecuting}
      expanded={expanded}
      onToggle={() => setExpanded((prev) => !prev)}
      startTime={startTime}
      renderItem={(tool, index) => {
        const { message, result } = tools[index];
        return (
          <ToolExecutionItem
            name={message.name || "unknown"}
            displayName={message.name}
            input={message.input}
            output={result?.output}
            isError={result?.isError}
            isExecuting={!result}
            compact
            artifactInfo={getArtifactInfoForMessage(message, artifacts)}
            onArtifactClick={onArtifactClick}
          />
        );
      }}
    />
  );
}
```

Note: `useMemo` import may already be present. If not, add it to the existing React import.

- [ ] **Step 2: 验证类型检查通过**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/message-list.tsx
git commit -m "feat(chat): wire startTime and renderItem into CollapsedToolRun"
```

---

### Task 7: 更新 index.ts 导出

**Files:**
- Modify: `packages/chat/src/index.ts`

- [ ] **Step 1: 导出 useElapsedTime 和 formatElapsed**

在 `// Utilities` 区域添加：

```typescript
export { useElapsedTime, formatElapsed } from "./use-elapsed-time";
```

- [ ] **Step 2: 验证类型检查通过**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/index.ts
git commit -m "feat(chat): export useElapsedTime and formatElapsed utilities"
```

---

### Task 8: 扩展 COLLAPSIBLE_TOOL_NAMES 以涵盖更多工具

**Files:**
- Modify: `packages/chat/src/message-list.tsx:147`

- [ ] **Step 1: 扩展可折叠工具名集合**

将 `COLLAPSIBLE_TOOL_NAMES` 从仅 Read/Glob/Grep 扩展为包含 Bash（短命令）和 MCP 查询：

```typescript
/** Tool names that are considered collapsible (auto-grouped when consecutive) */
const COLLAPSIBLE_TOOL_NAMES = new Set([
  "Read",
  "Glob",
  "Grep",
  "ListDir",
  "Bash",
]);
```

这意味着连续的 Bash 命令也会被折叠成组。MCP 工具（含 `__` 或 `/`）需要在 `renderToolsWithCollapsing` 中额外检测：

```typescript
function isCollapsibleTool(name: string): boolean {
  if (COLLAPSIBLE_TOOL_NAMES.has(name)) return true;
  // MCP tools (server__tool or server/tool format)
  if (name.includes("__") || name.includes("/")) return true;
  return false;
}
```

然后将 `for` 循环中的 `COLLAPSIBLE_TOOL_NAMES.has(tool.message.name || "")` 替换为 `isCollapsibleTool(tool.message.name || "")`。

- [ ] **Step 2: 验证类型检查通过**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/message-list.tsx
git commit -m "feat(chat): expand collapsible tool detection to include Bash and MCP tools"
```

---

### Task 9: 最终验证

**Files:**
- 无新文件

- [ ] **Step 1: 全量类型检查**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: 无错误

- [ ] **Step 2: 验证 desktop app 编译通过**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: 无错误（desktop 消费 `@viben/chat` 包，接口变更向后兼容）

- [ ] **Step 3: 验证向后兼容**

确认以下行为：
1. 不传 `startTime` 时，不显示 elapsed time — 原有行为不变
2. 不传 `renderItem` 时，展开区域使用 `children` — 原有行为不变
3. 新增的 `list`/`mcp`/`git` 分类不影响原有 `read`/`search`/`bash` 的分类（Grep 仍归 search，Bash 非 git 命令仍归 bash）
