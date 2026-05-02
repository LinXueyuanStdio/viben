import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  Loader2,
  CheckCircle2,
  XCircle,
  Bot,
  X,
  FileText,
  FileCode,
  FileJson,
  File,
  Globe,
  Image,
} from "lucide-react";
import { cn } from "@viben/ui";
import type { AgentMessage } from "./types";

/** Artifact info for linking tool_use messages to artifacts */
export interface ArtifactInfo {
  id: string;
  name: string;
  type: string;
}

export interface ToolExecutionItemProps {
  name: string;
  displayName?: string;
  input?: Record<string, unknown>;
  output?: string;
  isExecuting?: boolean;
  isError?: boolean;
  className?: string;
  /** Compact mode for use within task groups */
  compact?: boolean;
  /** Subagent ID for Task tool calls */
  subagentId?: string;
  /** Recursively loaded subagent messages for Task tool calls */
  subagentMessages?: AgentMessage[];
  /** Render function for subagent messages */
  renderMessage?: (message: AgentMessage, index: number) => React.ReactNode;
  /** Artifact info when this tool created/modified a file */
  artifactInfo?: ArtifactInfo;
  /** Callback when artifact badge is clicked */
  onArtifactClick?: (artifactId: string) => void;
  /** When true, show full tool input/output inline without requiring a click-to-open modal */
  expandedInline?: boolean;
}

// ============================================================================
// Content Block Parsing — render image blocks from tool results
// ============================================================================

interface TextContentBlock {
  type: "text";
  text: string;
}

interface ImageContentBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

type ContentBlock = TextContentBlock | ImageContentBlock;

/**
 * Try to parse tool output as an array of content blocks (text / image).
 * Returns null if the output is not a JSON content block array.
 */
function parseContentBlocks(output: string | undefined): ContentBlock[] | null {
  if (!output || typeof output !== "string") return null;
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
          (b.type === "text" || b.type === "image")
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
 * Get the most relevant parameter for inline display
 */
function getToolParam(
  toolName: string,
  input: Record<string, unknown> | undefined
): string {
  if (!input) return "";

  switch (toolName) {
    case "Bash":
      return (input.command as string) || "";
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      return (input.file_path as string) || "";
    case "Grep":
    case "Glob":
      return (input.pattern as string) || "";
    case "WebFetch":
      return (input.url as string) || "";
    case "WebSearch":
      return (input.query as string) || "";
    case "Task":
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

interface ResultInfo {
  summary: string;
  isWarning: boolean;
}

/**
 * Parse tool output and generate a smart summary
 */
function useResultSummary(
  toolName: string,
  output: string | undefined,
  isError: boolean | undefined,
): ResultInfo {
  const { t } = useTranslation();
  // Handle non-string output (could be object at runtime despite types)
  if (!output || typeof output !== "string") {
    return { summary: output ? JSON.stringify(output) : "", isWarning: false };
  }

  // Detect content block arrays with images
  const blocks = parseContentBlocks(output);
  if (blocks) {
    const imageCount = blocks.filter((b) => b.type === "image").length;
    const textCount = blocks.filter((b) => b.type === "text").length;
    if (imageCount > 0) {
      const parts: string[] = [];
      if (imageCount > 0) parts.push(`${imageCount} image${imageCount > 1 ? "s" : ""}`);
      if (textCount > 0) parts.push(`${textCount} text block${textCount > 1 ? "s" : ""}`);
      return { summary: parts.join(" + "), isWarning: false };
    }
  }

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
      return { summary: t("chat.toolResult.linesOfOutput", { defaultValue: "{{count}} lines of output", count: lineCount }) as string, isWarning: false };

    case "Read":
      return { summary: t("chat.toolResult.readLines", { defaultValue: "Read {{count}} lines", count: lineCount }) as string, isWarning: false };

    case "Write":
      return { summary: t("chat.toolResult.fileCreated", "File created successfully"), isWarning: false };

    case "Edit":
    case "MultiEdit":
      return { summary: t("chat.toolResult.fileModified", "File modified successfully"), isWarning: false };

    case "Grep":
      if (lineCount === 0) return { summary: t("chat.toolResult.noMatchesFound", "No matches found"), isWarning: false };
      return { summary: t("chat.toolResult.foundMatchesInFiles", { defaultValue: "Found matches in {{count}} files", count: lineCount }) as string, isWarning: false };

    case "Glob":
      if (lineCount === 0) return { summary: t("chat.toolResult.noFilesFound", "No files found"), isWarning: false };
      return { summary: t("chat.toolResult.foundFiles", { defaultValue: "Found {{count}} files", count: lineCount }) as string, isWarning: false };

    case "WebFetch":
      return { summary: t("chat.toolResult.fetchedCharacters", { defaultValue: "Fetched {{count}} characters", count: cleanOutput.length }) as string, isWarning: false };

    case "WebSearch":
      return { summary: t("chat.toolResult.searchCompleted", "Search completed"), isWarning: false };

    case "TodoWrite":
    case "TaskCreate":
      return { summary: t("chat.toolResult.taskCreated", "Task created"), isWarning: false };

    case "TaskUpdate":
      return { summary: t("chat.toolResult.taskUpdated", "Task updated"), isWarning: false };

    case "Task":
      return { summary: t("chat.toolResult.subtaskCompleted", "Subtask completed"), isWarning: false };

    default:
      return {
        summary: lineCount > 0 ? t("chat.toolResult.lines", { defaultValue: "{{count}} lines", count: lineCount }) as string : t("chat.toolResult.noContent", "(No content)"),
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
  output: string | undefined;
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

  const formatOutput = (output: string | undefined): string => {
    if (!output) return t("chat.toolResult.noOutputLabel", "No output");
    // Handle non-string output (could be object at runtime despite types)
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
              <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-500">
                {t("common.error", "Error")}
              </span>
            )}
            {isWarning && !isError && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-500">
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
            <pre className="bg-muted/50 max-h-[200px] overflow-auto rounded-md p-3 font-mono text-xs break-words whitespace-pre-wrap">
              {formatInput(input)}
            </pre>
          </div>

          {/* Output Section */}
          <div>
            <h3 className="text-muted-foreground mb-2 text-sm font-medium">
              {t("chat.toolOutput", "Output")}
            </h3>
            {(() => {
              const blocks = parseContentBlocks(output);
              if (blocks) {
                return (
                  <div className={cn(
                    "max-h-[400px] overflow-auto rounded-md p-3 font-mono text-xs",
                    isError ? "bg-red-500/10 text-red-400"
                      : isWarning ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-muted/50"
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
                        : "bg-muted/50"
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
// Main Component
// ============================================================================

export function ToolExecutionItem({
  name,
  displayName,
  input,
  output,
  isExecuting,
  isError,
  className,
  compact = false,
  subagentId,
  subagentMessages,
  renderMessage,
  artifactInfo,
  onArtifactClick,
  expandedInline = false,
}: ToolExecutionItemProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [showModal, setShowModal] = useState(false);
  const hasSubagentMessages = subagentMessages && subagentMessages.length > 0;
  // Default to expanded when there are subagent messages
  const [isExpanded, setIsExpanded] = useState(hasSubagentMessages);

  // Get tool parameters and result summary
  const param = getToolParam(name, input);
  const truncatedParam = truncateParam(param);
  const { summary, isWarning } = useResultSummary(name, output, isError);

  // Determine status
  const isRunning = isExecuting && !output;
  const hasError = !!isError;
  const isActualError = hasError && !isWarning;
  const isCompleted = !isRunning && !isActualError && output;

  // Check if this is a Task tool (sub-agent)
  const isTaskTool = name === "Task";
  const taskInput = isTaskTool && input ? input as {
    subagent_type?: string;
    description?: string;
    prompt?: string;
    model?: string;
  } : null;

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
            "-mx-1 rounded-md px-1 py-1.5 font-mono text-[13px] transition-colors",
            !isRunning && "hover:bg-accent/50 cursor-pointer",
            className
          )}
          onClick={handleClick}
        >
          {/* Line 1: bullet + tool name + params */}
          <div className="flex items-start gap-2">
            {/* Bullet indicator */}
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                isRunning
                  ? "animate-pulse bg-amber-500"
                  : isActualError
                    ? "bg-red-500"
                    : isWarning
                      ? "bg-amber-500"
                      : isCompleted
                        ? "bg-emerald-500"
                        : "bg-muted-foreground"
              )}
            />

            {/* Tool call text */}
            <div className="min-w-0 flex-1">
              <p className="leading-relaxed">
                <span className="text-foreground font-semibold">
                  {displayName || name}
                </span>
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
              <span className="text-muted-foreground/40 leading-none">└</span>
              <span
                className={cn(
                  isActualError
                    ? "text-red-500"
                    : isWarning
                      ? "text-amber-500"
                      : "text-muted-foreground"
                )}
              >
                {isRunning ? t("chat.running", "Running...") : summary}
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
    const status = isExecuting
      ? "executing"
      : isError
        ? "error"
        : (output || hasSubagentMessages)
          ? "completed"
          : "pending";

    const StatusIcon = {
      executing: Loader2,
      completed: CheckCircle2,
      error: XCircle,
      pending: Wrench,
    }[status];

    const statusColor = {
      executing: "text-primary",
      completed: "text-green-500",
      error: "text-destructive",
      pending: "text-muted-foreground",
    }[status];

    return (
      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        className={cn("flex gap-3 w-full min-w-0", className)}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
          <Bot className="h-4 w-4 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
            {/* Header */}
            <button
              type="button"
              onClick={() => hasDetails && setIsExpanded(!isExpanded)}
              disabled={!hasDetails}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left",
                hasDetails && "cursor-pointer hover:bg-violet-500/10",
                "transition-colors"
              )}
            >
              {hasDetails && (
                <span className="shrink-0 text-violet-500">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
              )}
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <StatusIcon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    status === "executing" ? "text-violet-500" : statusColor,
                    status === "executing" && "animate-spin"
                  )}
                />
                <span className="truncate font-medium text-sm text-violet-600 dark:text-violet-400">
                  {t("chat.subAgent", "Sub-Agent")}: {taskInput.subagent_type || "unknown"}
                </span>
                {taskInput.description && (
                  <span className="text-xs text-muted-foreground truncate">
                    — {taskInput.description}
                  </span>
                )}
              </div>
            </button>

            {/* Expandable details */}
            <AnimatePresence>
              {isExpanded && hasDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-violet-500/10 px-4 py-3 space-y-3 min-w-0 overflow-hidden">
                    {/* Task prompt */}
                    {taskInput.prompt && (
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {t("chat.taskPrompt", "Task Prompt")}
                        </p>
                        <pre className="overflow-x-auto overflow-y-auto rounded-lg bg-muted p-3 text-xs max-h-[200px] max-w-full">
                          <code className="whitespace-pre-wrap break-all text-xs">{taskInput.prompt}</code>
                        </pre>
                      </div>
                    )}

                    {/* Model if specified */}
                    {taskInput.model && (
                      <div className="text-xs text-muted-foreground">
                        {t("chat.model", "Model")}: <span className="font-medium">{taskInput.model}</span>
                      </div>
                    )}

                    {/* Subagent ID */}
                    {subagentId && (
                      <div className="text-xs text-muted-foreground">
                        {t("chat.subAgentId", "Agent ID")}: <span className="font-mono">{subagentId}</span>
                      </div>
                    )}

                    {/* Subagent messages (recursive rendering) */}
                    {hasSubagentMessages && renderMessage && (
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {t("chat.subAgentConversation", "Sub-Agent Conversation")}
                        </p>
                        <div className="space-y-2 pl-2 border-l-2 border-violet-500/20">
                          {subagentMessages.map((msg, idx) => (
                            <div key={msg.id || idx} className="min-w-0">
                              {renderMessage(msg, idx)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Output (fallback when no subagent messages) */}
                    {output && !hasSubagentMessages && (
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {t("chat.subAgentResult", "Sub-Agent Result")}
                        </p>
                        <pre
                          className={cn(
                            "overflow-x-auto overflow-y-auto rounded-lg p-3 text-xs max-h-[300px] max-w-full",
                            isError
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted"
                          )}
                        >
                          <code className="whitespace-pre-wrap break-all text-xs">
                            {output}
                          </code>
                        </pre>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
        className={cn("flex gap-3 w-full min-w-0", className)}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div
            className={cn(
              "rounded-xl border border-border bg-card overflow-hidden font-mono text-[13px]",
              !expandedInline && !isRunning && "hover:bg-accent/30 cursor-pointer",
              "transition-colors"
            )}
            onClick={expandedInline ? undefined : handleClick}
          >
            <div className="px-4 py-3">
              {/* Line 1: bullet + tool name + params */}
              <div className="flex items-start gap-2">
                {/* Bullet indicator */}
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    isRunning
                      ? "animate-pulse bg-amber-500"
                      : isActualError
                        ? "bg-red-500"
                        : isWarning
                          ? "bg-amber-500"
                          : isCompleted
                            ? "bg-emerald-500"
                            : "bg-muted-foreground"
                  )}
                />

                {/* Tool call text */}
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed">
                    <span className="text-foreground font-semibold">
                      {displayName || name}
                    </span>
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
                        ? "text-red-500"
                        : isWarning
                          ? "text-amber-500"
                          : "text-muted-foreground"
                    )}
                  >
                    {isRunning ? t("chat.running", "Running...") : summary}
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
              <div className="border-t border-border px-4 py-3 space-y-3">
                {input && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("chat.toolInput", "Input")}
                    </p>
                    <pre className="overflow-x-auto overflow-y-auto rounded-md bg-muted/50 p-2 text-xs max-h-[200px] break-words whitespace-pre-wrap">
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
                      const blocks = parseContentBlocks(output);
                      if (blocks) {
                        return (
                          <div className={cn(
                            "overflow-x-auto overflow-y-auto rounded-md p-2 text-xs max-h-[300px]",
                            isActualError ? "bg-red-500/10 text-red-400"
                              : isWarning ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-muted/50"
                          )}>
                            <RenderContentBlocks blocks={blocks} maxTextLength={10000} />
                          </div>
                        );
                      }
                      return (
                        <pre
                          className={cn(
                            "overflow-x-auto overflow-y-auto rounded-md p-2 text-xs max-h-[300px] break-words whitespace-pre-wrap",
                            isActualError
                              ? "bg-red-500/10 text-red-400"
                              : isWarning
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-muted/50"
                          )}
                        >
                          <code>{formatInlineOutput(output)}</code>
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
