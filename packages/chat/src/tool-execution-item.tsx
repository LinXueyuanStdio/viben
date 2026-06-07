import * as React from "react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  CheckCircle2,
  Bot,
  Loader2,
  X,
  FileText,
  FileCode,
  FileJson,
  File,
  Globe,
  Image,
  Maximize2,
} from "lucide-react";
import { cn } from "@viben/ui";
import { formatI18nTemplate, getDisplayPath } from "./utils";
import type { AgentMessage, ContentBlock, ExpandSubagentHandler } from "./types";
import type { TFunction } from "i18next";

/** Artifact info for linking tool_use messages to artifacts */
export interface ArtifactInfo {
  id: string;
  name: string;
  type: string;
}

/** Execution status for a tool call */
export type ToolExecutionStatus = "queued" | "executing" | "success" | "error";

export interface ToolExecutionItemProps {
  name: string;
  displayName?: string;
  input?: Record<string, unknown>;
  output?: string | ContentBlock[];
  /** @deprecated Use `status` instead. Kept for backwards compatibility. */
  isExecuting?: boolean;
  /** @deprecated Use `status` instead. Kept for backwards compatibility. */
  isError?: boolean;
  /** Explicit execution status. When provided, takes precedence over isExecuting/isError. */
  status?: ToolExecutionStatus;
  className?: string;
  /** Compact mode for use within task groups */
  compact?: boolean;
  /** Subagent ID for Task tool calls */
  subagentId?: string;
  /** Parent tool_use ID for matching external subagent loaders */
  toolUseId?: string;
  /** Recursively loaded subagent messages for Task tool calls */
  subagentMessages?: AgentMessage[];
  /** Temporary running transcript preview for Task/Agent calls. Hidden once the call completes. */
  subagentPreviewMessages?: AgentMessage[];
  /** Render function for subagent messages */
  renderMessage?: (message: AgentMessage, index: number) => React.ReactNode;
  /** Artifact info when this tool created/modified a file */
  artifactInfo?: ArtifactInfo;
  /** Callback when artifact badge is clicked */
  onArtifactClick?: (artifactId: string) => void;
  /** When true, show full tool input/output inline without requiring a click-to-open modal */
  expandedInline?: boolean;
  /** Callback to expand subagent messages in a side panel */
  onExpandSubagent?: ExpandSubagentHandler;
}

// ============================================================================
// Content Block Parsing — render image blocks from tool results
// ============================================================================

/**
 * Resolve tool output to content blocks if applicable.
 * - If output is already ContentBlock[], return it directly.
 * - If output is a JSON-stringified content block array, parse and return it.
 * - Otherwise return null (plain text output).
 */
function resolveContentBlocks(output: string | ContentBlock[] | undefined): ContentBlock[] | null {
  if (!output) return null;
  // Already an array of content blocks
  if (Array.isArray(output)) {
    if (output.length === 0) return null;
    if (output.every(
      (b) => typeof b === "object" && b !== null && "type" in b && (b.type === "text" || b.type === "image")
    )) {
      return output as ContentBlock[];
    }
    return null;
  }
  // Try parsing JSON string as content blocks (legacy format)
  if (typeof output !== "string") return null;
  const trimmed = output.trim();
  if (!trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every(
        (b: unknown) =>
          typeof b === "object" &&
          b !== null &&
          "type" in b &&
          ((b as { type: string }).type === "text" || (b as { type: string }).type === "image")
      )
    ) {
      return null;
    }
    return parsed as ContentBlock[];
  } catch {
    return null;
  }
}

/**
 * Render parsed content blocks as React elements (text + inline images).
 */
function RenderContentBlocks({ blocks, maxTextLength }: { blocks: ContentBlock[]; maxTextLength?: number }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "image" && block.source?.type === "base64") {
          return (
            <img
              key={i}
              src={`data:${block.source.media_type};base64,${block.source.data}`}
              alt="tool result"
              style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8, marginTop: 8, marginBottom: 8 }}
            />
          );
        }
        if (block.type === "text") {
          let text = block.text;
          if (maxTextLength && text.length > maxTextLength) {
            text = text.slice(0, maxTextLength) + "\n\n... (truncated)";
          }
          return (
            <pre key={i} className="whitespace-pre-wrap break-words text-xs">
              <code>{text}</code>
            </pre>
          );
        }
        return null;
      })}
    </>
  );
}

// ============================================================================
// Tool Display Utilities (from WorkAny)
// ============================================================================

/**
 * Extract a human-readable label from a bash command.
 * If the command starts with a # comment line, use that as the display label.
 * Otherwise return null to fall through to normal truncation.
 */
function extractBashLabel(command: string): string | null {
  if (!command) return null;
  const trimmed = command.trim();

  // Check if command starts with a # comment (common pattern: "# Do something\nactual-command")
  const lines = trimmed.split("\n");
  if (lines.length >= 2 && lines[0].startsWith("#")) {
    const comment = lines[0].slice(1).trim();
    if (comment.length > 0 && comment.length <= 80) {
      return comment;
    }
  }

  return null;
}

/**
 * Get the most relevant parameter for inline display
 */
function getToolParam(
  toolName: string,
  input: Record<string, unknown> | undefined
): string {
  if (!input) return "";

  switch (toolName) {
    case "Bash": {
      const command = (input.command as string) || "";
      const label = extractBashLabel(command);
      if (label) return label;
      // For multi-line commands, show only first line
      const firstLine = command.split("\n")[0] || command;
      return firstLine;
    }
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      return getDisplayPath((input.file_path as string) || "");
    case "Grep":
    case "Glob":
      return (input.pattern as string) || "";
    case "WebFetch":
      return (input.url as string) || "";
    case "WebSearch":
      return (input.query as string) || "";
    case "Task":
    case "Agent":
      return (input.description as string) || "";
    case "TodoWrite":
    case "TaskCreate":
    case "TaskUpdate":
      return (input.subject as string) || "";
    default:
      return "";
  }
}

/**
 * Truncate parameter for inline display
 */
function truncateParam(param: string, maxLen: number = 60): string {
  if (param.length <= maxLen) return param;
  return param.slice(0, maxLen) + "...";
}

function formatFriendlySubagentType(subagentType: string | undefined): string {
  if (!subagentType) return "Sub-Agent";
  return subagentType
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => {
      if (part.toUpperCase() === part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ") || "Sub-Agent";
}

function formatTranslated(
  value: string,
  vars: Record<string, string | number | undefined>
): string {
  return formatI18nTemplate(value, vars);
}

/**
 * Check if output is an expected non-fatal message (warning, not error)
 */
/**
 * Get the appropriate icon component for an artifact type
 */
function getArtifactIcon(type: string): React.ComponentType<{ className?: string }> {
  switch (type) {
    case "html":
    case "jsx":
      return FileCode;
    case "json":
      return FileJson;
    case "markdown":
    case "text":
    case "document":
      return FileText;
    case "image":
      return Image;
    case "websearch":
      return Globe;
    case "code":
    case "css":
      return FileCode;
    default:
      return File;
  }
}

/**
 * Check if output is an expected non-fatal message (warning, not error)
 */
function isExpectedWarning(toolName: string, output: string): boolean {
  const lowerOutput = output.toLowerCase();

  // Read tool: file not found is expected when checking if files exist
  if (
    toolName === "Read" &&
    (lowerOutput.includes("file does not exist") ||
      lowerOutput.includes("no such file") ||
      lowerOutput.includes("file not found"))
  ) {
    return true;
  }

  // Grep/Glob: no matches is informational, not an error
  if (
    (toolName === "Grep" || toolName === "Glob") &&
    (lowerOutput.includes("no matches") ||
      lowerOutput.includes("no files found") ||
      lowerOutput.includes("no results"))
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// Status Dot Indicator
// ============================================================================

/**
 * Resolve execution status from explicit `status` prop or legacy `isExecuting`/`isError` props.
 * When `status` is provided, it takes precedence.
 */
function resolveStatus(
  statusProp: ToolExecutionStatus | undefined,
  isExecuting: boolean | undefined,
  isError: boolean | undefined,
  output: string | ContentBlock[] | undefined,
): ToolExecutionStatus {
  if (statusProp) return statusProp;
  // Legacy fallback
  if (isExecuting && !output) return "executing";
  if (isError) return "error";
  if (output) return "success";
  return "queued";
}

/**
 * Animated status dot indicator for tool execution state.
 *
 * - queued: muted static dot (low opacity)
 * - executing: pulsing/blinking dot (amber)
 * - success: solid green dot
 * - error: solid red dot
 */
function StatusDot({
  status,
  isWarning = false,
  className,
}: {
  status: ToolExecutionStatus;
  /** When true and status is error, show amber instead of red */
  isWarning?: boolean;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  const dotClass = cn(
    "mt-1.5 size-2 shrink-0 rounded-full",
    status === "queued" && "bg-muted-foreground/40",
    status === "executing" && "bg-amber-500",
    status === "success" && "bg-emerald-500",
    status === "error" && (isWarning ? "bg-amber-500" : "bg-red-500"),
    className,
  );

  // For the executing state, use framer-motion for a smooth pulsing animation
  if (status === "executing" && !prefersReducedMotion) {
    return (
      <motion.span
        className={dotClass}
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    );
  }

  return <span className={dotClass} />;
}

interface ResultInfo {
  summary: string;
  isWarning: boolean;
}

/**
 * Parse tool output and generate a smart summary
 */
function useResultSummary(
  toolName: string,
  output: string | ContentBlock[] | undefined,
  isError: boolean | undefined,
): ResultInfo {
  const { t } = useTranslation();
  if (!output) {
    return { summary: "", isWarning: false };
  }

  // Handle ContentBlock[] directly
  const blocks = resolveContentBlocks(output);
  if (blocks) {
    const imageCount = blocks.filter((b) => b.type === "image").length;
    const textCount = blocks.filter((b) => b.type === "text").length;
    if (imageCount > 0) {
      const parts: string[] = [];
      if (imageCount > 0) parts.push(`${imageCount} image${imageCount > 1 ? "s" : ""}`);
      if (textCount > 0) parts.push(`${textCount} text block${textCount > 1 ? "s" : ""}`);
      return { summary: parts.join(" + "), isWarning: false };
    }
    // Text-only blocks: extract text for summary
    const textOutput = blocks
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return useResultSummaryFromString(toolName, textOutput, isError, t);
  }

  // String output
  if (typeof output !== "string") {
    return { summary: "", isWarning: false };
  }
  return useResultSummaryFromString(toolName, output, isError, t);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useResultSummaryFromString(
  toolName: string,
  output: string,
  isError: boolean | undefined,
  t: (...args: any[]) => any,
): ResultInfo {
  // Extract content from <tool_use_error> tag if present
  const toolUseErrorMatch = output.match(
    /<tool_use_error>([\s\S]*?)<\/tool_use_error>/
  );
  const cleanOutput = toolUseErrorMatch ? toolUseErrorMatch[1].trim() : output;
  const isWarning = isExpectedWarning(toolName, cleanOutput);

  if (isError) {
    // Show first line or truncated output as error summary
    const firstLine = cleanOutput.split("\n").find((l) => l.trim()) || cleanOutput;
    const truncated = firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
    return { summary: truncated || t("chat.toolResult.errorOccurred", "Error occurred"), isWarning };
  }

  if (!cleanOutput || cleanOutput.trim() === "") {
    return { summary: t("chat.toolResult.noOutput", "(No output)"), isWarning: false };
  }

  const lines = cleanOutput.split("\n").filter((l) => l.trim());
  const lineCount = lines.length;

  switch (toolName) {
    case "Bash":
      if (lineCount === 0) return { summary: t("chat.toolResult.noOutput", "(No output)"), isWarning: false };
      if (lineCount === 1) return { summary: lines[0].slice(0, 80), isWarning: false };
      return { summary: formatTranslated(t("chat.toolResult.linesOfOutput", { defaultValue: "{{count}} lines of output", count: lineCount }) as string, { count: lineCount }), isWarning: false };

    case "Read":
      return { summary: formatTranslated(t("chat.toolResult.readLines", { defaultValue: "Read {{count}} lines", count: lineCount }) as string, { count: lineCount }), isWarning: false };

    case "Write":
      return { summary: t("chat.toolResult.fileCreated", "File created successfully"), isWarning: false };

    case "Edit":
    case "MultiEdit":
      return { summary: t("chat.toolResult.fileModified", "File modified successfully"), isWarning: false };

    case "Grep":
      if (lineCount === 0) return { summary: t("chat.toolResult.noMatchesFound", "No matches found"), isWarning: false };
      return { summary: formatTranslated(t("chat.toolResult.foundMatchesInFiles", { defaultValue: "Found matches in {{count}} files", count: lineCount }) as string, { count: lineCount }), isWarning: false };

    case "Glob":
      if (lineCount === 0) return { summary: t("chat.toolResult.noFilesFound", "No files found"), isWarning: false };
      return { summary: formatTranslated(t("chat.toolResult.foundFiles", { defaultValue: "Found {{count}} files", count: lineCount }) as string, { count: lineCount }), isWarning: false };

    case "WebFetch":
      return { summary: formatTranslated(t("chat.toolResult.fetchedCharacters", { defaultValue: "Fetched {{count}} characters", count: cleanOutput.length }) as string, { count: cleanOutput.length }), isWarning: false };

    case "WebSearch":
      return { summary: t("chat.toolResult.searchCompleted", "Search completed"), isWarning: false };

    case "TodoWrite":
    case "TaskCreate":
      return { summary: t("chat.toolResult.taskCreated", "Task created"), isWarning: false };

    case "TaskUpdate":
      return { summary: t("chat.toolResult.taskUpdated", "Task updated"), isWarning: false };

    case "Task":
    case "Agent":
      return { summary: t("chat.toolResult.subtaskCompleted", "Subtask completed"), isWarning: false };

    default:
      return {
        summary: lineCount > 0 ? formatTranslated(t("chat.toolResult.lines", { defaultValue: "{{count}} lines", count: lineCount }) as string, { count: lineCount }) : t("chat.toolResult.noContent", "(No content)"),
        isWarning: false,
      };
  }
}

// ============================================================================
// Tool Detail Modal Component
// ============================================================================

interface ToolDetailModalProps {
  toolName: string;
  input: Record<string, unknown> | undefined;
  output: string | ContentBlock[] | undefined;
  isError: boolean;
  isWarning: boolean;
  onClose: () => void;
}

function ToolDetailModal({
  toolName,
  input,
  output,
  isError,
  isWarning,
  onClose,
}: ToolDetailModalProps) {
  const { t } = useTranslation();

  const formatInput = (input: unknown): string => {
    if (!input) return t("chat.toolResult.noInput", "No input");
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  const formatOutput = (output: string | ContentBlock[] | undefined): string => {
    if (!output) return t("chat.toolResult.noOutputLabel", "No output");
    if (Array.isArray(output)) {
      // Content blocks handled separately via resolveContentBlocks
      return "";
    }
    if (typeof output !== "string") {
      return JSON.stringify(output, null, 2);
    }
    // Extract content from <tool_use_error> tag if present
    const toolUseErrorMatch = output.match(
      /<tool_use_error>([\s\S]*?)<\/tool_use_error>/
    );
    let cleanOutput = toolUseErrorMatch ? toolUseErrorMatch[1].trim() : output;
    // Truncate very long output
    if (cleanOutput.length > 10000) {
      return cleanOutput.slice(0, 10000) + "\n\n" + t("chat.toolResult.truncated", "... (truncated)");
    }
    return cleanOutput;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="bg-background border-border relative flex max-h-[80vh] w-[700px] max-w-[90vw] flex-col rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{toolName}</span>
            {isError && (
              <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400">
                {t("common.error", "Error")}
              </span>
            )}
            {isWarning && !isError && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                {t("common.info", "Info")}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="hover:bg-accent cursor-pointer rounded-md p-1 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-auto p-4">
          {/* Input Section */}
          <div>
            <h3 className="text-muted-foreground mb-2 text-sm font-medium">
              {t("chat.toolInput", "Input")}
            </h3>
            <pre className="bg-code-block max-h-[200px] overflow-auto rounded-md p-3 font-mono text-xs break-words whitespace-pre-wrap">
              {formatInput(input)}
            </pre>
          </div>

          {/* Output Section */}
          <div>
            <h3 className="text-muted-foreground mb-2 text-sm font-medium">
              {t("chat.toolOutput", "Output")}
            </h3>
            {(() => {
              const blocks = resolveContentBlocks(output);
              if (blocks) {
                return (
                  <div className={cn(
                    "max-h-[400px] overflow-auto rounded-md p-3 font-mono text-xs",
                    isError ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : isWarning ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-code-block"
                  )}>
                    <RenderContentBlocks blocks={blocks} maxTextLength={10000} />
                  </div>
                );
              }
              return (
                <pre
                  className={cn(
                    "max-h-[400px] overflow-auto rounded-md p-3 font-mono text-xs break-words whitespace-pre-wrap",
                    isError
                      ? "bg-red-500/10 text-red-400"
                      : isWarning
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-code-block"
                  )}
                >
                  {formatOutput(output)}
                </pre>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Artifact Badge Component
// ============================================================================

interface ArtifactBadgeProps {
  artifactInfo: ArtifactInfo;
  onClick?: (artifactId: string) => void;
}

function ArtifactBadge({ artifactInfo, onClick }: ArtifactBadgeProps) {
  const IconComponent = getArtifactIcon(artifactInfo.type);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click handler
    onClick?.(artifactInfo.id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md",
        "bg-accent/50 hover:bg-accent text-foreground/80",
        "transition-colors cursor-pointer",
        "border border-border/50"
      )}
    >
      <IconComponent className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[150px]">{artifactInfo.name}</span>
    </button>
  );
}

// ============================================================================
// Progress Text for Executing State
// ============================================================================

/**
 * Get tool-specific progress text for the executing state.
 * Instead of a generic "Running...", show contextual info like the command,
 * file path, or search pattern being processed.
 */
function getProgressText(
  toolName: string,
  input: Record<string, unknown> | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (...args: any[]) => any,
): string {
  if (!input) return t("chat.running", "Running...");

  switch (toolName) {
    case "Bash": {
      const cmd = (input.command as string) || "";
      const label = extractBashLabel(cmd);
      if (label) return label;
      const truncated = cmd.length > 80 ? cmd.slice(0, 80) + "\u2026" : cmd;
      return truncated || t("chat.running", "Running...");
    }
    case "Read": {
      const filename = getDisplayPath((input.file_path as string) || "");
      return filename
        ? formatTranslated(t("chat.activity.readingFile", { defaultValue: "Reading {{file}}...", file: filename }) as string, { file: filename })
        : t("chat.running", "Running...");
    }
    case "Write": {
      const filename = getDisplayPath((input.file_path as string) || "");
      return filename
        ? formatTranslated(t("chat.activity.writingFile", { defaultValue: "Writing {{file}}...", file: filename }) as string, { file: filename })
        : t("chat.running", "Running...");
    }
    case "Edit":
    case "MultiEdit": {
      const filename = getDisplayPath((input.file_path as string) || "");
      return filename
        ? formatTranslated(t("chat.activity.editingFile", { defaultValue: "Editing {{file}}...", file: filename }) as string, { file: filename })
        : t("chat.running", "Running...");
    }
    case "Grep": {
      const pattern = (input.pattern as string) || "";
      return pattern
        ? formatTranslated(t("chat.activity.searching", { defaultValue: "Searching \"{{pattern}}\"...", pattern: pattern.slice(0, 40) }) as string, { pattern: pattern.slice(0, 40) })
        : t("chat.running", "Running...");
    }
    case "Glob": {
      const pattern = (input.pattern as string) || "";
      return pattern
        ? formatTranslated(t("chat.activity.findingFiles", { defaultValue: "Finding {{pattern}}...", pattern: pattern.slice(0, 40) }) as string, { pattern: pattern.slice(0, 40) })
        : t("chat.running", "Running...");
    }
    default:
      return t("chat.running", "Running...");
  }
}

function getPreviewText(message: AgentMessage, t: TFunction): string {
  if (message.type === "tool_use") {
    const param = getToolParam(message.name || "", message.input);
    const toolName = message.name || t("chat.preview.tool", "Tool");
    return param ? `${toolName} ${param}` : toolName;
  }
  if (message.type === "tool_result") {
    if (typeof message.output === "string") {
      return message.output.split("\n").find((line) => line.trim())?.trim() || t("chat.preview.toolCompleted", "Tool completed");
    }
    return t("chat.preview.toolCompleted", "Tool completed");
  }
  if (message.type === "thinking") return message.content || t("chat.preview.thinking", "Thinking");
  if (message.type === "text") return message.content || "";
  if (message.type === "error") return message.message || message.content || t("chat.preview.error", "Error");
  if (message.type === "user") return message.content || "";
  return message.content || message.type;
}

function getPreviewLabel(message: AgentMessage, t: TFunction): string {
  if (message.type === "tool_use") return message.name || t("chat.preview.tool", "Tool");
  if (message.type === "tool_result") return message.isError ? t("chat.preview.error", "Error") : t("chat.preview.done", "Done");
  if (message.type === "thinking") return t("chat.preview.thinking", "Thinking");
  if (message.type === "text") return t("chat.preview.text", "Text");
  if (message.type === "user") return t("chat.preview.user", "User");
  if (message.type === "error") return t("chat.preview.error", "Error");
  return message.type;
}

function SubagentPreviewRow({ message }: { message: AgentMessage }) {
  const { t } = useTranslation();
  const isActive = message.type === "tool_use" && !message.output;
  const isError = message.type === "error" || message.isError;
  const text = getPreviewText(message, t);
  const label = getPreviewLabel(message, t);

  return (
    <div className="flex min-w-0 items-start gap-1.5 rounded bg-background/60 px-2 py-1 text-[11px]">
      <span
        className={cn(
          "mt-1 size-1.5 shrink-0 rounded-full",
          isError ? "bg-red-500" : isActive ? "animate-pulse bg-amber-500" : "bg-emerald-500"
        )}
      />
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {text}
      </span>
    </div>
  );
}

function SubagentPreview({ messages }: { messages: AgentMessage[] }) {
  const visibleMessages = messages.slice(-5);

  return (
    <div
      className="h-[132px] overflow-hidden rounded bg-muted/30 p-1.5"
      data-testid="subagent-preview"
    >
      <AnimatePresence initial={false}>
        <motion.div className="space-y-1">
          {visibleMessages.map((message, index) => (
            <motion.div
              key={message.id || `${message.type}-${index}`}
              data-testid="subagent-preview-slot"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.16 }}
            >
              <SubagentPreviewRow message={message} />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ToolExecutionItem({
  name,
  displayName,
  input,
  output,
  isExecuting,
  isError,
  status: statusProp,
  className,
  compact = false,
  subagentId,
  toolUseId,
  subagentMessages,
  subagentPreviewMessages,
  renderMessage,
  artifactInfo,
  onArtifactClick,
  expandedInline = false,
  onExpandSubagent,
}: ToolExecutionItemProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [showModal, setShowModal] = useState(false);
  const hasSubagentMessages = subagentMessages && subagentMessages.length > 0;
  const hasSubagentPreviewMessages = subagentPreviewMessages && subagentPreviewMessages.length > 0;

  // Get tool parameters and result summary
  const param = getToolParam(name, input);
  const truncatedParam = truncateParam(param);
  const { summary, isWarning } = useResultSummary(name, output, isError);

  // Resolve execution status (new prop takes precedence over legacy props)
  const resolvedStatus = resolveStatus(statusProp, isExecuting, isError, output);

  // Derive convenience booleans from resolved status
  const isRunning = resolvedStatus === "executing";
  const hasError = resolvedStatus === "error";
  const isActualError = hasError && !isWarning;
  const isCompleted = resolvedStatus === "success";

  // Check if this is a Task tool (sub-agent)
  const isTaskTool = name === "Task" || name === "Agent";
  const taskInput = isTaskTool && input ? input as {
    subagent_type?: string;
    description?: string;
    prompt?: string;
    model?: string;
  } : null;
  const canOpenSubagent = !!taskInput && !!onExpandSubagent && (!!toolUseId || !!subagentId || !!hasSubagentMessages);
  // Subagent cards stay folded by default; regular tools can still auto-open details.
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand Task/Agent tool when running or when result arrives
  useEffect(() => {
    if (isTaskTool && ((isRunning && hasSubagentPreviewMessages) || (!canOpenSubagent && (isRunning || output)))) {
      setIsExpanded(true);
    }
  }, [canOpenSubagent, hasSubagentPreviewMessages, isRunning, isTaskTool, output]);

  const hasDetails = input || output || hasSubagentMessages;

  const handleClick = () => {
    if (!isRunning && !isTaskTool) {
      setShowModal(true);
    }
  };

  // ============================================================================
  // Compact Mode - Bullet-style two-line display (for use in task groups)
  // ============================================================================
  if (compact) {
    return (
      <>
        <div
          className={cn(
            "-mx-1 rounded-md px-1 py-1 font-mono text-xs transition-colors",
            !isRunning && "hover:bg-accent/50 cursor-pointer",
            className
          )}
          onClick={handleClick}
        >
          {/* Line 1: bullet + tool name + params */}
          <div className="flex items-start gap-1.5">
            <StatusDot status={resolvedStatus} isWarning={isWarning} />

            {/* Tool call text */}
            <div className="min-w-0 flex-1">
              <p className="leading-relaxed">
                <span className="text-foreground font-semibold">
                  {displayName || name}
                </span>
                {resolvedStatus === "queued" && (
                  <span className="text-[11px] text-muted-foreground/60 ml-1">
                    {t("chat.queued", "queued")}
                  </span>
                )}
                {param && (
                  <>
                    <span className="text-muted-foreground">(</span>
                    <span className="text-muted-foreground">
                      {truncatedParam}
                    </span>
                    <span className="text-muted-foreground">)</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Line 2: Result summary */}
          {(summary || isRunning) && (
            <div className="mt-0.5 ml-1 flex items-start gap-2">
              <span className="text-muted-foreground/40 leading-none">{"\u2514"}</span>
              <span
                className={cn(
                  isActualError
                    ? "text-red-600 dark:text-red-400"
                    : isWarning
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                )}
              >
                {isRunning ? getProgressText(name, input, t) : summary}
              </span>
            </div>
          )}

          {/* Artifact badge */}
          {artifactInfo && !isRunning && (
            <div className="mt-1 ml-4">
              <ArtifactBadge
                artifactInfo={artifactInfo}
                onClick={onArtifactClick}
              />
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <ToolDetailModal
            toolName={name}
            input={input}
            output={output}
            isError={isActualError}
            isWarning={isWarning}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  // ============================================================================
  // Task Tool (Sub-agent) - Special display with expandable conversation
  // ============================================================================
  if (isTaskTool && taskInput) {
    const status = isRunning
      ? "executing"
      : hasError
        ? "error"
        : (output || hasSubagentMessages)
          ? "completed"
          : "pending";

    // Pre-merge tool_result into tool_use for subagent messages
    const mergedSubagentMessages = React.useMemo(() => {
      if (!subagentMessages || subagentMessages.length === 0) return undefined;
      const resultMap = new Map<string, AgentMessage>();
      for (const msg of subagentMessages) {
        if (msg.type === "tool_result" && msg.toolUseId) {
          resultMap.set(msg.toolUseId, msg);
        }
      }
      return subagentMessages
        .filter(msg => msg.type !== "tool_result")
        .map(msg => {
          if (msg.type === "tool_use" && msg.toolUseId) {
            const result = resultMap.get(msg.toolUseId);
            if (result) {
              return { ...msg, output: result.output, isError: result.isError };
            }
          }
          return msg;
        });
    }, [subagentMessages]);

    const toolUseCount = mergedSubagentMessages
      ? mergedSubagentMessages.filter(m => m.type === "tool_use").length
      : 0;
    const title = taskInput.description || taskInput.subagent_type || "Sub-Agent";
    const subagentTitle = formatFriendlySubagentType(taskInput.subagent_type);
    const latestSubagentActivity = isRunning && hasSubagentPreviewMessages
      ? getPreviewText(subagentPreviewMessages![subagentPreviewMessages!.length - 1], t)
      : "";
    const handleOpenSubagent = () => {
      if (!canOpenSubagent) return;
      onExpandSubagent(title, taskInput.subagent_type, subagentMessages ?? [], {
        subagentId,
        toolUseId,
        messages: subagentMessages,
      });
    };
    const handleToggleInlineDetails = () => {
      if (hasDetails) setIsExpanded(!isExpanded);
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
        className={cn("w-full min-w-0", className)}
      >
        <div className="rounded-md border border-border overflow-hidden font-mono text-xs">
          {/* Header */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={canOpenSubagent ? handleOpenSubagent : handleToggleInlineDetails}
              disabled={!canOpenSubagent && !hasDetails}
              className={cn(
                "flex flex-1 items-center gap-1.5 px-2.5 py-1.5 text-left min-w-0",
                (canOpenSubagent || hasDetails) && "cursor-pointer hover:bg-accent/50",
                "transition-colors"
              )}
              title={canOpenSubagent ? t("chat.expandSubagent", "Open in side panel") : undefined}
            >
              <StatusDot status={resolvedStatus} isWarning={isWarning} />
              <Bot className="h-3 w-3 shrink-0 text-violet-500" />
              <span className="min-w-0 truncate font-semibold text-foreground">
                {subagentTitle}
              </span>
              {taskInput.description && (
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  ({taskInput.description})
                </span>
              )}
              {toolUseCount > 0 && (
                <span className="text-[11px] text-muted-foreground shrink-0">
                  · {toolUseCount} tools
                </span>
              )}
              {canOpenSubagent && (
                <span className="shrink-0 text-muted-foreground">
                  <Maximize2 className="h-3 w-3" />
                </span>
              )}
            </button>
            {/* Inline details toggle */}
            {hasDetails && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleInlineDetails();
                }}
                className="shrink-0 mr-1.5 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
                title={isExpanded ? t("chat.hideDetails", "Hide details") : t("chat.showDetails", "Show details")}
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
          </div>

          {/* Status line */}
          {(status === "executing" || status === "completed") && (
            <div className="px-2.5 pb-1.5 -mt-0.5">
              <span className="ml-3.5 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="shrink-0">⎿</span>
                {status === "executing" && (
                  <Loader2
                    className="h-3 w-3 shrink-0 animate-spin"
                    data-testid="subagent-status-loading"
                  />
                )}
                <span
                  className="min-w-0 truncate"
                  data-testid={status === "executing" ? "subagent-status-activity" : undefined}
                >
                  {status === "executing"
                    ? latestSubagentActivity || t("chat.subAgentRunning", "Running…")
                    : t("chat.done", "Done")}
                </span>
              </span>
            </div>
          )}

          {/* Expandable details */}
          <AnimatePresence>
            {isExpanded && hasDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border px-2.5 py-2 space-y-1.5 min-w-0 overflow-hidden">
                  {/* Task prompt (collapsed by default for brevity) */}
                  {taskInput.prompt && (
                    <details className="min-w-0 overflow-hidden">
                      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground select-none">
                        {t("chat.taskPrompt", "Task Prompt")}
                      </summary>
                      <pre className="mt-1 overflow-x-auto overflow-y-auto rounded bg-muted p-2 text-[11px] max-h-[120px] max-w-full">
                        <code className="whitespace-pre-wrap break-words text-xs">{taskInput.prompt}</code>
                      </pre>
                    </details>
                  )}

                  {isRunning && hasSubagentPreviewMessages && (
                    <SubagentPreview messages={subagentPreviewMessages!} />
                  )}

                  {/* Subagent messages (merged, rendered inline) */}
                  {!canOpenSubagent && mergedSubagentMessages && mergedSubagentMessages.length > 0 && renderMessage && (
                    <div className="space-y-1 min-w-0 overflow-hidden">
                      {mergedSubagentMessages.map((msg, idx) => (
                        <div key={msg.id || idx} className="min-w-0">
                          {renderMessage(msg, idx)}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Output (fallback when no subagent messages) */}
                  {output && !hasSubagentMessages && (() => {
                    const blocks = resolveContentBlocks(output);
                    if (blocks) {
                      return (
                        <div className="overflow-x-auto overflow-y-auto rounded p-2 text-xs max-h-[200px] max-w-full bg-muted">
                          <RenderContentBlocks blocks={blocks} maxTextLength={5000} />
                        </div>
                      );
                    }
                    return (
                      <pre
                        className={cn(
                          "overflow-x-auto overflow-y-auto rounded p-2 text-xs max-h-[200px] max-w-full",
                          hasError
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted"
                        )}
                      >
                        <code className="whitespace-pre-wrap break-words text-xs">
                          {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
                        </code>
                      </pre>
                    );
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // ============================================================================
  // Default Full Mode - Bullet-style display with click-to-expand modal
  // ============================================================================

  const formatInlineInput = (val: unknown): string => {
    if (!val) return t("chat.toolResult.noInput", "No input");
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  const formatInlineOutput = (val: string | undefined): string => {
    if (!val) return t("chat.toolResult.noOutputLabel", "No output");
    if (typeof val !== "string") return JSON.stringify(val, null, 2);
    const toolUseErrorMatch = val.match(
      /<tool_use_error>([\s\S]*?)<\/tool_use_error>/
    );
    const cleanVal = toolUseErrorMatch ? toolUseErrorMatch[1].trim() : val;
    if (cleanVal.length > 10000) {
      return cleanVal.slice(0, 10000) + "\n\n" + t("chat.toolResult.truncated", "... (truncated)");
    }
    return cleanVal;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        className={cn("flex gap-2 w-full min-w-0", className)}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div
            className={cn(
              "rounded-lg border border-border bg-card overflow-hidden font-mono text-xs",
              !expandedInline && !isRunning && "hover:bg-accent/30 cursor-pointer",
              "transition-colors"
            )}
            onClick={expandedInline ? undefined : handleClick}
          >
            <div className="px-3 py-2">
              {/* Line 1: status dot + tool name + params */}
              <div className="flex items-start gap-1.5">
                <StatusDot status={resolvedStatus} isWarning={isWarning} />

                {/* Tool call text */}
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed">
                    <span className="text-foreground font-semibold">
                      {displayName || name}
                    </span>
                    {resolvedStatus === "queued" && (
                      <span className="text-[11px] text-muted-foreground/60 ml-1">
                        {t("chat.queued", "queued")}
                      </span>
                    )}
                    {!expandedInline && param && (
                      <>
                        <span className="text-muted-foreground">(</span>
                        <span className="text-muted-foreground">
                          {truncatedParam}
                        </span>
                        <span className="text-muted-foreground">)</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Line 2: Result summary (only in non-inline mode) */}
              {!expandedInline && (summary || isRunning) && (
                <div className="mt-0.5 ml-1 flex items-start gap-2">
                  <span className="text-muted-foreground/40 leading-none">{"\u2514"}</span>
                  <span
                    className={cn(
                      isActualError
                        ? "text-red-600 dark:text-red-400"
                        : isWarning
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {isCompleted && <CheckCircle2 className="inline-block size-3 mr-1 align-text-bottom" />}
                    {isRunning ? getProgressText(name, input, t) : summary}
                  </span>
                </div>
              )}

              {/* Artifact badge */}
              {artifactInfo && !isRunning && (
                <div className="mt-1.5 ml-4">
                  <ArtifactBadge
                    artifactInfo={artifactInfo}
                    onClick={onArtifactClick}
                  />
                </div>
              )}
            </div>

            {/* Inline expanded details (when expandedInline is true) */}
            {expandedInline && (input || output) && (
              <div className="border-t border-border px-3 py-2 space-y-2">
                {input && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("chat.toolInput", "Input")}
                    </p>
                    <pre className="overflow-x-auto overflow-y-auto rounded-md bg-code-block p-2 text-xs max-h-[200px] break-words whitespace-pre-wrap">
                      <code>{formatInlineInput(input)}</code>
                    </pre>
                  </div>
                )}
                {output && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("chat.toolOutput", "Output")}
                    </p>
                    {(() => {
                      const blocks = resolveContentBlocks(output);
                      if (blocks) {
                        return (
                          <div className={cn(
                            "overflow-x-auto overflow-y-auto rounded-md p-2 text-xs max-h-[300px]",
                            isActualError ? "bg-red-500/10 text-red-400"
                              : isWarning ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-code-block"
                          )}>
                            <RenderContentBlocks blocks={blocks} maxTextLength={10000} />
                          </div>
                        );
                      }
                      const outputStr = typeof output === "string" ? output : "";
                      return (
                        <pre
                          className={cn(
                            "overflow-x-auto overflow-y-auto rounded-md p-2 text-xs max-h-[300px] break-words whitespace-pre-wrap",
                            isActualError
                              ? "bg-red-500/10 text-red-400"
                              : isWarning
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-code-block"
                          )}
                        >
                          <code>{formatInlineOutput(outputStr)}</code>
                        </pre>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modal (only used when not in expandedInline mode) */}
      {!expandedInline && showModal && (
        <ToolDetailModal
          toolName={name}
          input={input}
          output={output}
          isError={isActualError}
          isWarning={isWarning}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
