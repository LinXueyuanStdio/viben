import * as React from "react";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@viben/ui";
import { getDisplayPath } from "./utils";
import { useMinDisplayTime } from "./use-min-display-time";
import type { ContentBlock } from "./types";

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
  className?: string;
}

interface ToolCounts {
  read: number;
  search: number;
  bash: number;
  write: number;
  edit: number;
  other: number;
}

/**
 * Count tools by category for the summary line.
 */
function countToolsByCategory(
  tools: CollapsedToolGroupProps["tools"]
): ToolCounts {
  const counts: ToolCounts = {
    read: 0,
    search: 0,
    bash: 0,
    write: 0,
    edit: 0,
    other: 0,
  };

  for (const tool of tools) {
    switch (tool.name) {
      case "Read":
        counts.read++;
        break;
      case "Glob":
      case "Grep":
        counts.search++;
        break;
      case "Bash":
        counts.bash++;
        break;
      case "Write":
        counts.write++;
        break;
      case "Edit":
      case "MultiEdit":
        counts.edit++;
        break;
      default:
        counts.other++;
        break;
    }
  }

  return counts;
}

/**
 * Build a human-readable summary string from tool counts.
 * Uses present tense when executing ("Reading 3 files..."), past tense when done ("Read 3 files").
 */
function useSummaryText(counts: ToolCounts, isExecuting: boolean): string {
  const { t } = useTranslation();
  const parts: string[] = [];

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

/**
 * CollapsedToolGroup summarizes a group of consecutive tool calls
 * into a single compact line. Clicking toggles between the summary
 * and the full list of individual tool items.
 */
export function CollapsedToolGroup({
  tools,
  isExecuting = false,
  expanded = false,
  onToggle,
  children,
  className,
}: CollapsedToolGroupProps) {
  const prefersReducedMotion = useReducedMotion();

  // Stabilize counts during execution - numbers only go up, never down
  const maxCountsRef = useRef<ToolCounts>({ read: 0, search: 0, bash: 0, write: 0, edit: 0, other: 0 });

  const stableCounts = useMemo(() => {
    const currentCounts = countToolsByCategory(tools);

    if (isExecuting) {
      // During execution, only allow counts to increase
      maxCountsRef.current = {
        read: Math.max(maxCountsRef.current.read, currentCounts.read),
        search: Math.max(maxCountsRef.current.search, currentCounts.search),
        bash: Math.max(maxCountsRef.current.bash, currentCounts.bash),
        write: Math.max(maxCountsRef.current.write, currentCounts.write),
        edit: Math.max(maxCountsRef.current.edit, currentCounts.edit),
        other: Math.max(maxCountsRef.current.other, currentCounts.other),
      };
      return maxCountsRef.current;
    }

    // When done, use actual counts and reset max
    maxCountsRef.current = currentCounts;
    return currentCounts;
  }, [tools, isExecuting]);

  const summaryText = useSummaryText(stableCounts, isExecuting);

  const lastHint = useMemo(() => {
    if (!isExecuting || tools.length === 0) return "";
    const lastTool = tools[tools.length - 1];
    const input = lastTool.input;
    if (!input) return "";

    switch (lastTool.name) {
      case "Read":
      case "Write":
      case "Edit":
      case "MultiEdit": {
        const filePath = (input.file_path as string) || "";
        return getDisplayPath(filePath);
      }
      case "Grep": {
        const pattern = (input.pattern as string) || "";
        return `"${pattern.slice(0, 30)}"`;
      }
      case "Glob": {
        const pattern = (input.pattern as string) || "";
        return pattern.slice(0, 40);
      }
      default:
        return "";
    }
  }, [tools, isExecuting]);

  // Stabilize hint display - each hint stays visible for at least 700ms
  const displayedHint = useMinDisplayTime(lastHint, 700);

  const hasErrors = tools.some((t) => t.isError);

  return (
    <div className={cn("w-full", className)}>
      {/* Collapsed summary row */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group flex w-full items-center gap-2 rounded-md px-2 py-1",
          "text-left transition-colors",
          "hover:bg-accent/50 cursor-pointer",
          "font-mono text-[13px]"
        )}
      >
        {/* Chevron indicator */}
        <motion.span
          className="shrink-0 text-muted-foreground/60"
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.15,
          }}
        >
          <ChevronRight className="size-3.5" />
        </motion.span>

        {/* Status dot: pulsing amber when executing, static green when done, red on error */}
        {isExecuting ? (
          <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
        ) : hasErrors ? (
          <span className="size-1.5 shrink-0 rounded-full bg-red-500" />
        ) : (
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
        )}

        {/* Summary text */}
        <span
          className={cn(
            "truncate",
            hasErrors
              ? "text-red-500"
              : "text-muted-foreground"
          )}
        >
          {summaryText}
        </span>

        {/* Hint showing last processed item (stabilized with min display time) */}
        {isExecuting && displayedHint && (
          <span className="text-muted-foreground/40 truncate text-[11px] ml-auto max-w-[200px]">
            {displayedHint}
          </span>
        )}
      </button>

      {/* Expanded children */}
      <AnimatePresence initial={false}>
        {expanded && children && (
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
        )}
      </AnimatePresence>
    </div>
  );
}
