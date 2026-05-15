# Tool Renderer Plugin Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract tool-specific rendering logic from `ToolExecutionItem`'s hardcoded `switch(name)` into a plugin interface where each tool registers its own renderer, making `packages/chat` extensible without modifying the core library.

**Architecture:** Define a `ToolRenderer` interface in types, provide renderers via React context (`ToolRendererContext`), ship built-in renderers for common tools (Bash, Read, Write, Edit, Grep, Glob, Agent), and allow consumers to override/extend via a `toolRenderers` prop on `MessageList`. The framework (status dot, expand/collapse chrome, modal shell) remains in `ToolExecutionItem`; only "content" rendering (summary text, result text, progress text, display name) is delegated to renderers.

**Tech Stack:** React 19, TypeScript, React Context API, `@viben/ui` (cn utility), `react-i18next` for translations.

---

## Reference Architecture (Claude Code)

The reference implementation in `infra/claude-code/` follows this pattern:

- **`src/Tool.ts`** defines render methods directly on each `Tool` object: `renderToolUseMessage()`, `renderToolResultMessage()`, `renderToolUseProgressMessage()`, `isResultTruncated()`, `userFacingName()`, `getToolUseSummary()`.
- **`src/components/messages/AssistantToolUseMessage.tsx`** is the generic framework that calls `tool.renderToolUseMessage()` for the inline call summary. It owns the "chrome" (status dot, bold tool name, tag rendering).
- **`src/components/messages/UserToolResultMessage/UserToolSuccessMessage.tsx`** calls `tool.renderToolResultMessage()` for the result.
- **Each tool in `packages/builtin-tools/src/tools/<Name>/UI.tsx`** exports its render functions (e.g., `BashTool/UI.tsx` exports `renderToolUseMessage`, `renderToolResultMessage`).

Our adaptation differs in that `packages/chat` is a UI-only library without access to tool runtime objects. We use a registry-based approach with React Context rather than method calls on tool instances.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/chat/src/tool-renderer/types.ts` | `ToolRenderer` interface definition |
| `packages/chat/src/tool-renderer/context.ts` | `ToolRendererContext` provider and `useToolRenderer(name)` hook |
| `packages/chat/src/tool-renderer/built-in/bash.ts` | Bash tool renderer |
| `packages/chat/src/tool-renderer/built-in/read.ts` | Read tool renderer |
| `packages/chat/src/tool-renderer/built-in/write.ts` | Write tool renderer |
| `packages/chat/src/tool-renderer/built-in/edit.ts` | Edit/MultiEdit tool renderer |
| `packages/chat/src/tool-renderer/built-in/grep.ts` | Grep tool renderer |
| `packages/chat/src/tool-renderer/built-in/glob.ts` | Glob tool renderer |
| `packages/chat/src/tool-renderer/built-in/agent.ts` | Agent/Task tool renderer |
| `packages/chat/src/tool-renderer/built-in/index.ts` | Re-exports all built-in renderers as a single array |
| `packages/chat/src/tool-renderer/index.ts` | Barrel export for the module |
| `packages/chat/src/tool-execution-item.tsx` | Modified to consume `useToolRenderer()` instead of switch statements |
| `packages/chat/src/message-list.tsx` | Modified to accept `toolRenderers` prop and wrap children with provider |
| `packages/chat/src/index.ts` | Export new public API |

---

### Task 1: Define the ToolRenderer Interface

**Files:**
- Create: `packages/chat/src/tool-renderer/types.ts`

- [ ] **Step 1: Create the types file with the ToolRenderer interface**

```typescript
// packages/chat/src/tool-renderer/types.ts
import type { ContentBlock } from "../types";

/**
 * Plugin interface for tool-specific rendering in the chat UI.
 *
 * Each renderer handles one or more tool names and provides methods
 * to render summaries, results, progress, and display names.
 *
 * The framework (ToolExecutionItem) retains ownership of:
 * - Status dot (queued/executing/success/error)
 * - Expand/collapse chrome (chevron, modal shell)
 * - Layout structure (flex, spacing)
 *
 * Renderers only provide the "content" portions.
 */
export interface ToolRenderer {
  /**
   * Tool name(s) this renderer handles.
   * A single renderer can handle multiple tools (e.g., "Edit" and "MultiEdit").
   */
  name: string | string[];

  /**
   * Render the inline parameter summary shown next to the tool name.
   * e.g., for Bash: the command text; for Read: the file path.
   * Return null to show nothing; return a string for simple text.
   */
  renderSummary(input: Record<string, unknown>): React.ReactNode | string | null;

  /**
   * Render the result summary line (shown below the tool name when collapsed).
   * e.g., "Read 42 lines", "File modified successfully", "3 lines of output".
   * Return an object with `summary` text and `isWarning` flag.
   */
  renderResultSummary(
    output: string | ContentBlock[],
    input?: Record<string, unknown>,
    isError?: boolean,
  ): { summary: string; isWarning: boolean };

  /**
   * Render the full result content for the detail modal or inline expanded view.
   * Return null to use default JSON formatting.
   */
  renderResult?(
    output: string | ContentBlock[],
    input?: Record<string, unknown>,
  ): React.ReactNode | null;

  /**
   * Get progress text for the executing state.
   * e.g., "Reading src/foo.ts...", "Running: npm test".
   * Return null to fall back to generic "Running...".
   */
  renderProgress?(input: Record<string, unknown>): string | null;

  /**
   * Override the display name shown in the UI.
   * Return null to use the raw tool name.
   */
  getDisplayName?(input: Record<string, unknown>): string | null;

  /**
   * Whether the non-verbose result is truncated (gates click-to-expand).
   * Default: false.
   */
  isResultTruncated?(output: string | ContentBlock[]): boolean;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/tool-renderer/types.ts
git commit -m "feat(chat): define ToolRenderer plugin interface"
```

---

### Task 2: Create the ToolRendererContext

**Files:**
- Create: `packages/chat/src/tool-renderer/context.ts`

- [ ] **Step 1: Create the context provider and hook**

```typescript
// packages/chat/src/tool-renderer/context.ts
import { createContext, useContext } from "react";
import type { ToolRenderer } from "./types";

/**
 * Internal registry that maps tool names to their renderer.
 * Built at provider creation time from the renderers array.
 */
export type ToolRendererRegistry = Map<string, ToolRenderer>;

/**
 * Context holding the tool renderer registry.
 * Defaults to an empty map (no custom renderers).
 */
export const ToolRendererContext = createContext<ToolRendererRegistry>(
  new Map()
);

/**
 * Look up the renderer for a given tool name.
 * Returns undefined if no renderer is registered for that name.
 */
export function useToolRenderer(toolName: string): ToolRenderer | undefined {
  const registry = useContext(ToolRendererContext);
  return registry.get(toolName);
}

/**
 * Build a registry Map from an array of ToolRenderer objects.
 * Later entries override earlier ones for the same tool name.
 */
export function buildRendererRegistry(
  renderers: ToolRenderer[]
): ToolRendererRegistry {
  const registry = new Map<string, ToolRenderer>();
  for (const renderer of renderers) {
    const names = Array.isArray(renderer.name) ? renderer.name : [renderer.name];
    for (const name of names) {
      registry.set(name, renderer);
    }
  }
  return registry;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/tool-renderer/context.ts
git commit -m "feat(chat): add ToolRendererContext and useToolRenderer hook"
```

---

### Task 3: Implement Built-in Renderers

**Files:**
- Create: `packages/chat/src/tool-renderer/built-in/bash.ts`
- Create: `packages/chat/src/tool-renderer/built-in/read.ts`
- Create: `packages/chat/src/tool-renderer/built-in/write.ts`
- Create: `packages/chat/src/tool-renderer/built-in/edit.ts`
- Create: `packages/chat/src/tool-renderer/built-in/grep.ts`
- Create: `packages/chat/src/tool-renderer/built-in/glob.ts`
- Create: `packages/chat/src/tool-renderer/built-in/agent.ts`
- Create: `packages/chat/src/tool-renderer/built-in/index.ts`

- [ ] **Step 1: Create the Bash renderer**

```typescript
// packages/chat/src/tool-renderer/built-in/bash.ts
import type { ContentBlock } from "../../types";
import type { ToolRenderer } from "../types";
import { getDisplayPath } from "../../utils";

/**
 * Extract a human-readable label from a bash command.
 * If the command starts with a # comment line, use that as the display label.
 */
function extractBashLabel(command: string): string | null {
  if (!command) return null;
  const trimmed = command.trim();
  const lines = trimmed.split("\n");
  if (lines.length >= 2 && lines[0].startsWith("#")) {
    const comment = lines[0].slice(1).trim();
    if (comment.length > 0 && comment.length <= 80) {
      return comment;
    }
  }
  return null;
}

function getTextOutput(output: string | ContentBlock[]): string {
  if (typeof output === "string") return output;
  return output
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export const bashRenderer: ToolRenderer = {
  name: "Bash",

  renderSummary(input) {
    const command = (input.command as string) || "";
    const label = extractBashLabel(command);
    if (label) return label;
    // Show first line only
    const firstLine = command.split("\n")[0] || command;
    return firstLine.length > 60 ? firstLine.slice(0, 60) + "..." : firstLine;
  },

  renderResultSummary(output, _input, isError) {
    const text = getTextOutput(output);
    const lines = text.split("\n").filter((l) => l.trim());
    const lineCount = lines.length;

    if (isError) {
      const firstLine = lines.find((l) => l.trim()) || text;
      const truncated = firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
      return { summary: truncated || "Error occurred", isWarning: false };
    }

    if (lineCount === 0) return { summary: "(No output)", isWarning: false };
    if (lineCount === 1) return { summary: lines[0].slice(0, 80), isWarning: false };
    return { summary: `${lineCount} lines of output`, isWarning: false };
  },

  renderProgress(input) {
    const cmd = (input.command as string) || "";
    const label = extractBashLabel(cmd);
    if (label) return label;
    const truncated = cmd.length > 80 ? cmd.slice(0, 80) + "\u2026" : cmd;
    return truncated || null;
  },
};
```

- [ ] **Step 2: Create the Read renderer**

```typescript
// packages/chat/src/tool-renderer/built-in/read.ts
import type { ContentBlock } from "../../types";
import type { ToolRenderer } from "../types";
import { getDisplayPath } from "../../utils";

function getTextOutput(output: string | ContentBlock[]): string {
  if (typeof output === "string") return output;
  return output
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function isExpectedWarning(output: string): boolean {
  const lower = output.toLowerCase();
  return (
    lower.includes("file does not exist") ||
    lower.includes("no such file") ||
    lower.includes("file not found")
  );
}

export const readRenderer: ToolRenderer = {
  name: "Read",

  renderSummary(input) {
    return getDisplayPath((input.file_path as string) || "");
  },

  renderResultSummary(output, _input, isError) {
    const text = getTextOutput(output);

    if (isError) {
      const isWarning = isExpectedWarning(text);
      const firstLine = text.split("\n").find((l) => l.trim()) || text;
      const truncated = firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
      return { summary: truncated || "Error occurred", isWarning };
    }

    const lines = text.split("\n").filter((l) => l.trim());
    return { summary: `Read ${lines.length} lines`, isWarning: false };
  },

  renderProgress(input) {
    const filename = getDisplayPath((input.file_path as string) || "");
    return filename ? `Reading ${filename}...` : null;
  },
};
```

- [ ] **Step 3: Create the Write renderer**

```typescript
// packages/chat/src/tool-renderer/built-in/write.ts
import type { ContentBlock } from "../../types";
import type { ToolRenderer } from "../types";
import { getDisplayPath } from "../../utils";

export const writeRenderer: ToolRenderer = {
  name: "Write",

  renderSummary(input) {
    return getDisplayPath((input.file_path as string) || "");
  },

  renderResultSummary(_output, _input, isError) {
    if (isError) {
      return { summary: "Write failed", isWarning: false };
    }
    return { summary: "File created successfully", isWarning: false };
  },

  renderProgress(input) {
    const filename = getDisplayPath((input.file_path as string) || "");
    return filename ? `Writing ${filename}...` : null;
  },
};
```

- [ ] **Step 4: Create the Edit renderer**

```typescript
// packages/chat/src/tool-renderer/built-in/edit.ts
import type { ContentBlock } from "../../types";
import type { ToolRenderer } from "../types";
import { getDisplayPath } from "../../utils";

export const editRenderer: ToolRenderer = {
  name: ["Edit", "MultiEdit"],

  renderSummary(input) {
    return getDisplayPath((input.file_path as string) || "");
  },

  renderResultSummary(_output, _input, isError) {
    if (isError) {
      return { summary: "Edit failed", isWarning: false };
    }
    return { summary: "File modified successfully", isWarning: false };
  },

  renderProgress(input) {
    const filename = getDisplayPath((input.file_path as string) || "");
    return filename ? `Editing ${filename}...` : null;
  },
};
```

- [ ] **Step 5: Create the Grep renderer**

```typescript
// packages/chat/src/tool-renderer/built-in/grep.ts
import type { ContentBlock } from "../../types";
import type { ToolRenderer } from "../types";

function getTextOutput(output: string | ContentBlock[]): string {
  if (typeof output === "string") return output;
  return output
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function isNoMatchWarning(output: string): boolean {
  const lower = output.toLowerCase();
  return (
    lower.includes("no matches") ||
    lower.includes("no files found") ||
    lower.includes("no results")
  );
}

export const grepRenderer: ToolRenderer = {
  name: "Grep",

  renderSummary(input) {
    return (input.pattern as string) || "";
  },

  renderResultSummary(output, _input, isError) {
    const text = getTextOutput(output);

    if (isError) {
      const isWarning = isNoMatchWarning(text);
      const firstLine = text.split("\n").find((l) => l.trim()) || text;
      const truncated = firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
      return { summary: truncated || "Error occurred", isWarning };
    }

    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return { summary: "No matches found", isWarning: false };
    return { summary: `Found matches in ${lines.length} files`, isWarning: false };
  },

  renderProgress(input) {
    const pattern = (input.pattern as string) || "";
    return pattern ? `Searching "${pattern.slice(0, 40)}"...` : null;
  },
};
```

- [ ] **Step 6: Create the Glob renderer**

```typescript
// packages/chat/src/tool-renderer/built-in/glob.ts
import type { ContentBlock } from "../../types";
import type { ToolRenderer } from "../types";

function getTextOutput(output: string | ContentBlock[]): string {
  if (typeof output === "string") return output;
  return output
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function isNoMatchWarning(output: string): boolean {
  const lower = output.toLowerCase();
  return (
    lower.includes("no matches") ||
    lower.includes("no files found") ||
    lower.includes("no results")
  );
}

export const globRenderer: ToolRenderer = {
  name: "Glob",

  renderSummary(input) {
    return (input.pattern as string) || "";
  },

  renderResultSummary(output, _input, isError) {
    const text = getTextOutput(output);

    if (isError) {
      const isWarning = isNoMatchWarning(text);
      const firstLine = text.split("\n").find((l) => l.trim()) || text;
      const truncated = firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
      return { summary: truncated || "Error occurred", isWarning };
    }

    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return { summary: "No files found", isWarning: false };
    return { summary: `Found ${lines.length} files`, isWarning: false };
  },

  renderProgress(input) {
    const pattern = (input.pattern as string) || "";
    return pattern ? `Finding ${pattern.slice(0, 40)}...` : null;
  },
};
```

- [ ] **Step 7: Create the Agent renderer**

```typescript
// packages/chat/src/tool-renderer/built-in/agent.ts
import type { ContentBlock } from "../../types";
import type { ToolRenderer } from "../types";

export const agentRenderer: ToolRenderer = {
  name: ["Agent", "Task"],

  renderSummary(input) {
    return (input.description as string) || "";
  },

  renderResultSummary(_output, _input, isError) {
    if (isError) {
      return { summary: "Subtask failed", isWarning: false };
    }
    return { summary: "Subtask completed", isWarning: false };
  },

  renderProgress(_input) {
    return "Running subtask...";
  },

  getDisplayName(input) {
    const type = input.subagent_type as string | undefined;
    return type || null;
  },
};
```

- [ ] **Step 8: Create the barrel export for built-in renderers**

```typescript
// packages/chat/src/tool-renderer/built-in/index.ts
import type { ToolRenderer } from "../types";
import { bashRenderer } from "./bash";
import { readRenderer } from "./read";
import { writeRenderer } from "./write";
import { editRenderer } from "./edit";
import { grepRenderer } from "./grep";
import { globRenderer } from "./glob";
import { agentRenderer } from "./agent";

/**
 * All built-in tool renderers provided by @viben/chat.
 * These handle the common tools: Bash, Read, Write, Edit, Grep, Glob, Agent/Task.
 */
export const builtInRenderers: ToolRenderer[] = [
  bashRenderer,
  readRenderer,
  writeRenderer,
  editRenderer,
  grepRenderer,
  globRenderer,
  agentRenderer,
];

export {
  bashRenderer,
  readRenderer,
  writeRenderer,
  editRenderer,
  grepRenderer,
  globRenderer,
  agentRenderer,
};
```

- [ ] **Step 9: Verify all files compile**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add packages/chat/src/tool-renderer/built-in/
git commit -m "feat(chat): implement built-in tool renderers for Bash, Read, Write, Edit, Grep, Glob, Agent"
```

---

### Task 4: Create the Module Barrel Export

**Files:**
- Create: `packages/chat/src/tool-renderer/index.ts`

- [ ] **Step 1: Create the barrel export**

```typescript
// packages/chat/src/tool-renderer/index.ts
export type { ToolRenderer } from "./types";
export {
  ToolRendererContext,
  useToolRenderer,
  buildRendererRegistry,
} from "./context";
export type { ToolRendererRegistry } from "./context";
export { builtInRenderers } from "./built-in";
export {
  bashRenderer,
  readRenderer,
  writeRenderer,
  editRenderer,
  grepRenderer,
  globRenderer,
  agentRenderer,
} from "./built-in";
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/tool-renderer/index.ts
git commit -m "feat(chat): add tool-renderer barrel export"
```

---

### Task 5: Integrate Context into MessageList

**Files:**
- Modify: `packages/chat/src/message-list.tsx`

This task adds the `toolRenderers` prop to `MessageListProps` and wraps the rendered content with `ToolRendererContext.Provider`.

- [ ] **Step 1: Add the toolRenderers prop and provider wrapping**

Add import at the top of `packages/chat/src/message-list.tsx`:

```typescript
import { useMemo as useMemoReact } from "react";
import type { ToolRenderer } from "./tool-renderer/types";
import {
  ToolRendererContext,
  buildRendererRegistry,
} from "./tool-renderer/context";
import { builtInRenderers } from "./tool-renderer/built-in";
```

Add `toolRenderers` to the `MessageListProps` interface:

```typescript
  /**
   * Custom tool renderers to override or extend built-in rendering.
   * These are merged with built-in renderers; later entries override earlier ones.
   * Pass `[]` to use only built-in renderers (default).
   */
  toolRenderers?: ToolRenderer[];
```

Inside the `MessageList` component (after destructuring props), add the registry memo:

```typescript
  // Build tool renderer registry from built-in + custom renderers
  const toolRendererRegistry = useMemo(
    () => buildRendererRegistry([...builtInRenderers, ...(toolRenderers ?? [])]),
    [toolRenderers]
  );
```

Wrap the returned JSX with the provider. The `ScrollArea` and its contents should be wrapped:

```tsx
  return (
    <ToolRendererContext.Provider value={toolRendererRegistry}>
      <div ref={containerRef} className={cn("relative flex-1 w-full min-h-0 min-w-0 overflow-hidden", className)}>
        {/* ... existing content unchanged ... */}
      </div>
    </ToolRendererContext.Provider>
  );
```

Also wrap the empty state returns with the provider for consistency (so any future tool-related rendering in welcome states also has access).

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/message-list.tsx
git commit -m "feat(chat): integrate ToolRendererContext into MessageList with toolRenderers prop"
```

---

### Task 6: Refactor ToolExecutionItem to Use Renderers

**Files:**
- Modify: `packages/chat/src/tool-execution-item.tsx`

This is the key refactoring. Replace the `getToolParam`, `useResultSummary`/`useResultSummaryFromString`, and `getProgressText` switch statements with calls to the renderer obtained from `useToolRenderer(name)`.

- [ ] **Step 1: Add the renderer hook import and usage**

Add import at the top of `packages/chat/src/tool-execution-item.tsx`:

```typescript
import { useToolRenderer } from "./tool-renderer/context";
```

- [ ] **Step 2: Replace getToolParam with renderer.renderSummary**

Replace the `getToolParam` function call in the component with:

```typescript
  // Get tool renderer (may be undefined for unknown tools)
  const renderer = useToolRenderer(name);

  // Get parameter summary from renderer, falling back to legacy switch
  const param = useMemo(() => {
    if (renderer && input) {
      const result = renderer.renderSummary(input);
      if (result === null) return "";
      if (typeof result === "string") return result;
      // React node — will need special handling
      return String(result);
    }
    return getToolParam(name, input);
  }, [renderer, name, input]);
```

- [ ] **Step 3: Replace useResultSummary with renderer.renderResultSummary**

Modify the `useResultSummary` hook to check the renderer first:

```typescript
function useResultSummary(
  toolName: string,
  output: string | ContentBlock[] | undefined,
  isError: boolean | undefined,
  renderer: ToolRenderer | undefined,
): ResultInfo {
  const { t } = useTranslation();
  if (!output) {
    return { summary: "", isWarning: false };
  }

  // Try renderer first
  if (renderer) {
    return renderer.renderResultSummary(output, undefined, isError);
  }

  // Fall back to legacy logic
  // ... (existing code, kept as fallback for unregistered tools)
}
```

Update the call site to pass the renderer:

```typescript
  const { summary, isWarning } = useResultSummary(name, output, isError, renderer);
```

- [ ] **Step 4: Replace getProgressText with renderer.renderProgress**

Modify the places that call `getProgressText` to try the renderer first:

```typescript
  // In the rendering section where getProgressText is called:
  const progressText = useMemo(() => {
    if (renderer && input) {
      const result = renderer.renderProgress?.(input);
      if (result !== null && result !== undefined) return result;
    }
    return getProgressText(name, input, t);
  }, [renderer, name, input, t]);
```

Replace all occurrences of `getProgressText(name, input, t)` in the JSX with `progressText`.

- [ ] **Step 5: Use renderer.getDisplayName if available**

Before the display name is rendered, add:

```typescript
  const effectiveDisplayName = useMemo(() => {
    if (renderer && input) {
      const custom = renderer.getDisplayName?.(input);
      if (custom) return custom;
    }
    return displayName || name;
  }, [renderer, input, displayName, name]);
```

Replace `{displayName || name}` with `{effectiveDisplayName}` in the JSX.

- [ ] **Step 6: Keep existing switch functions as fallback**

Do NOT delete `getToolParam`, `useResultSummaryFromString`, `getProgressText`, or `isExpectedWarning`. Keep them as fallback for tools that don't have a registered renderer. This ensures backwards compatibility.

- [ ] **Step 7: Verify the file compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: PASS

- [ ] **Step 8: Verify the desktop app compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: PASS (since MessageList props are additive and optional)

- [ ] **Step 9: Commit**

```bash
git add packages/chat/src/tool-execution-item.tsx
git commit -m "refactor(chat): delegate tool rendering to ToolRenderer plugin when available"
```

---

### Task 7: Export Public API from packages/chat

**Files:**
- Modify: `packages/chat/src/index.ts`

- [ ] **Step 1: Add exports for the tool-renderer module**

Add the following to `packages/chat/src/index.ts`:

```typescript
// Tool Renderer Plugin System
export type { ToolRenderer } from "./tool-renderer";
export {
  ToolRendererContext,
  useToolRenderer,
  buildRendererRegistry,
  builtInRenderers,
  bashRenderer,
  readRenderer,
  writeRenderer,
  editRenderer,
  grepRenderer,
  globRenderer,
  agentRenderer,
} from "./tool-renderer";
export type { ToolRendererRegistry } from "./tool-renderer";
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/index.ts
git commit -m "feat(chat): export ToolRenderer plugin API from package"
```

---

### Task 8: Update CollapsedToolGroup and MessageList Helpers

**Files:**
- Modify: `packages/chat/src/collapsed-tool-group.tsx`
- Modify: `packages/chat/src/message-list.tsx` (the `countToolsByCategory` and `useTaskGroupSummary` usage)

The `collapsed-tool-group.tsx` has a `countToolsByCategory` with a hardcoded switch. For extensibility, it should also be able to leverage renderers. However, this is a lower-priority optimization; the grouped summary ("Read 3 files, ran 2 commands") is more of a UX pattern than a per-tool renderer concern. For this task, we only need to ensure the `CollapsedToolGroup` still works correctly after the refactoring.

- [ ] **Step 1: Verify collapsed-tool-group still compiles and works**

No changes needed here for the initial implementation. The `CollapsedToolGroup` doesn't call any of the refactored functions directly (it receives pre-computed data from `message-list.tsx`).

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: PASS

- [ ] **Step 2: Verify the full project compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck`
Expected: PASS (or only pre-existing errors unrelated to this change)

- [ ] **Step 3: Commit (if any adjustments were needed)**

```bash
git add -A
git commit -m "fix(chat): ensure collapsed-tool-group compatibility with renderer refactoring"
```

---

### Task 9: Manual Integration Test

**Files:**
- None (runtime verification)

- [ ] **Step 1: Verify the desktop app builds and renders correctly**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop build`
Expected: Build succeeds

- [ ] **Step 2: Verify existing MessageList behavior is unchanged**

The consumer (`apps/desktop`) does NOT pass `toolRenderers` prop, so the built-in renderers activate by default. Verify:
- Tool execution items still show correct summaries (file paths for Read/Write/Edit, commands for Bash, patterns for Grep/Glob)
- Status dots still animate correctly
- Click-to-expand modal still shows input/output
- Agent/Task tools still show the sub-agent expanded UI

- [ ] **Step 3: Test custom renderer override**

Temporarily add a test in the desktop app to verify override works:

```typescript
import { builtInRenderers, type ToolRenderer } from "@viben/chat";

const customBashRenderer: ToolRenderer = {
  name: "Bash",
  renderSummary(input) {
    return `[CUSTOM] ${(input.command as string || "").slice(0, 30)}`;
  },
  renderResultSummary() {
    return { summary: "Custom result", isWarning: false };
  },
};

// In MessageList usage:
<MessageList
  messages={messages}
  toolRenderers={[customBashRenderer]}
/>
```

Verify that Bash tools now show "[CUSTOM]" prefix in their summary.

- [ ] **Step 4: Remove test override and commit final state**

```bash
git add -A
git commit -m "chore(chat): verify tool renderer plugin integration"
```

---

## Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| `ToolExecutionItem` | Hardcoded `switch(name)` in `getToolParam`, `useResultSummary`, `getProgressText` | Calls `renderer.renderSummary()`, `renderer.renderResultSummary()`, `renderer.renderProgress()` when renderer exists; falls back to switch |
| `MessageList` | No renderer awareness | Accepts `toolRenderers` prop, wraps children with `ToolRendererContext.Provider` |
| Tool rendering logic | Embedded in one 1200-line file | Split into focused per-tool files under `tool-renderer/built-in/` |
| Extensibility | Requires modifying `tool-execution-item.tsx` | Consumers pass custom `ToolRenderer[]` via props |

## Consumer Usage Example

```typescript
import { MessageList, builtInRenderers, type ToolRenderer } from "@viben/chat";

// Custom renderer for an MCP tool
const myCustomToolRenderer: ToolRenderer = {
  name: "mcp__myserver__my_tool",
  renderSummary(input) {
    return (input.query as string) || "";
  },
  renderResultSummary(output) {
    return { summary: "Custom tool completed", isWarning: false };
  },
  renderProgress(input) {
    return `Running custom tool with "${input.query}"...`;
  },
};

// Usage - custom renderers override built-ins for same name
<MessageList
  messages={messages}
  toolRenderers={[myCustomToolRenderer]}
/>
```
