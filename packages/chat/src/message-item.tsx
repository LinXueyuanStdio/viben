import * as React from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { User, Bot, AlertCircle, FileText, Image as ImageIcon, ChevronRight, FileEdit } from "lucide-react";
import { cn } from "@viben/ui";
import type { AgentMessage, MessageAttachment } from "./types";
import { ToolExecutionItem } from "./tool-execution-item";
import { PlanApproval } from "./plan-approval";
import { QuestionInput } from "./question-input";
import { CachedStreamdown } from "./cached-markdown";

export interface MessageItemProps {
  message: AgentMessage;
  isStreaming?: boolean;
  /** Whether this message is "static" (content won't change). Static messages skip re-render. */
  isStatic?: boolean;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  isPlanPending?: boolean;
  /** Custom link handler - if not provided, links open with window.open */
  onLinkClick?: (href: string) => void;
  /** Additional CSS class name */
  className?: string;
  /** Maximum width for the message card */
  maxWidth?: string;
  /** When true, show full tool input/output inline without requiring a click-to-open modal */
  toolExpandedInline?: boolean;
  /** Callback to expand subagent messages in a side panel */
  onExpandSubagent?: (title: string, subagentType: string | undefined, messages: AgentMessage[]) => void;
  /** Whether this is the latest thinking message (starts expanded) */
  isLatestThinking?: boolean;
}

/**
 * Markdown components for react-markdown customization
 */
const createMarkdownComponents = (onLinkClick?: (href: string) => void) => ({
  // Code blocks
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="bg-code-block max-w-full overflow-x-auto rounded-lg p-4 my-2 [&>code]:block"
      {...props}
    >
      {children}
    </pre>
  ),
  // Inline code
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-code-block rounded px-1.5 py-0.5 text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  // Links - use custom handler or window.open
  a: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href) {
          if (onLinkClick) {
            onLinkClick(href);
          } else {
            window.open(href, "_blank");
          }
        }
      }}
      className="text-primary cursor-pointer hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  // Tables
  table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-2">
      <table className="border-border border-collapse border w-full" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="border-border bg-muted border px-3 py-2 text-left text-sm font-semibold"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-border border px-3 py-2 text-sm" {...props}>
      {children}
    </td>
  ),
  // Paragraphs
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-1 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  // Headers
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-xl font-bold mt-4 mb-2" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-lg font-semibold mt-3 mb-2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-base font-semibold mt-2 mb-1" {...props}>
      {children}
    </h3>
  ),
  // Lists
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc ml-4 my-2 space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal ml-4 my-2 space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li className="text-sm" {...props}>
      {children}
    </li>
  ),
  // Blockquote
  blockquote: ({
    children,
    ...props
  }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="border-l-4 border-primary/30 pl-4 my-2 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
});

/**
 * Render attachments in user message
 */
function AttachmentPreview({ attachment }: { attachment: MessageAttachment }) {
  if (attachment.type === "image" && attachment.data) {
    return (
      <div className="mt-2 overflow-hidden rounded-lg border border-border/50">
        <img
          src={attachment.data}
          alt={attachment.name}
          className="max-h-[300px] max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm">
      {attachment.type === "image" ? (
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="truncate">{attachment.name}</span>
    </div>
  );
}

/**
 * User message bubble
 */
function UserMessage({
  content,
  attachments,
  skipAnimation,
}: {
  content: string;
  attachments?: MessageAttachment[];
  skipAnimation?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={skipAnimation ? false : { opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex gap-3 w-full min-w-0"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <User className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="w-fit max-w-full rounded-2xl rounded-tl-md bg-primary px-4 py-3 text-primary-foreground min-w-0">
          <p className="whitespace-pre-wrap text-sm break-words [overflow-wrap:anywhere]">{content}</p>
          {attachments?.map((attachment) => (
            <AttachmentPreview key={attachment.id} attachment={attachment} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Error message display
 */
function ErrorMessage({ errorMessage, skipAnimation }: { errorMessage: string; skipAnimation?: boolean }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={skipAnimation ? false : { opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex gap-3 w-full min-w-0"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-4 w-4 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-md border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            {t("chat.error", "Error")}
          </p>
          <p className="mt-1 text-sm text-destructive/80">{errorMessage}</p>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Thinking message display - Claude's reasoning process.
 * Claude UI style: left vertical border, muted text, collapsed preview with expand toggle.
 */
function ThinkingMessage({
  content,
  onLinkClick,
  isLatest,
  skipAnimation,
}: {
  content: string;
  onLinkClick?: (href: string) => void;
  /** When true, this is the most recent thinking block — starts expanded */
  isLatest?: boolean;
  skipAnimation?: boolean;
}) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(!!isLatest);
  const markdownComponents = useMemo(
    () => createMarkdownComponents(onLinkClick),
    [onLinkClick]
  );

  // Preview: first 3 non-empty lines
  const { previewLines, isShort } = useMemo(() => {
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const isShort = lines.length <= 3;
    const preview = lines.slice(0, 3).map((l) =>
      l.length > 140 ? l.slice(0, 140) + "…" : l
    );
    return { previewLines: preview, isShort };
  }, [content]);

  const charCount = content.length;

  // Short content (≤3 lines): always show fully, no toggle
  if (isShort) {
    return (
      <div className="w-full min-w-0 pl-1">
        <div className="border-l-2 border-muted-foreground/20 pl-3 py-1">
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground/70 overflow-hidden break-words text-[13px] leading-relaxed">
            <CachedStreamdown
              content={content || ""}
              mode="static"
              components={markdownComponents}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 pl-1">
      <div className="border-l-2 border-muted-foreground/20 pl-3 py-1">
        {/* Content area */}
        {isExpanded ? (
          <AnimatePresence initial={false}>
            <motion.div
              initial={skipAnimation ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
              className="overflow-hidden"
            >
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground/70 overflow-hidden break-words text-[13px] leading-relaxed">
                <CachedStreamdown
                  content={content || ""}
                  mode="static"
                  components={markdownComponents}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="text-muted-foreground/60 text-[13px] leading-relaxed whitespace-pre-line break-words">
            {previewLines.join("\n")}
          </div>
        )}

        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors cursor-pointer"
        >
          <ChevronRight
            className={cn(
              "size-3 transition-transform duration-150",
              isExpanded && "rotate-90"
            )}
          />
          <span>
            {isExpanded
              ? t("chat.thinkingShowLess", "Show less")
              : t("chat.thinkingShowMore", "Show more")}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span>
            {charCount >= 1000
              ? `${(charCount / 1000).toFixed(1)}k chars`
              : `${charCount} chars`}
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * Assistant text message with markdown rendering
 */
function AssistantMessage({
  content,
  isResult,
  isStreaming,
  onLinkClick,
  skipAnimation,
}: {
  content: string;
  isResult?: boolean;
  isStreaming?: boolean;
  onLinkClick?: (href: string) => void;
  skipAnimation?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const markdownComponents = useMemo(
    () => createMarkdownComponents(onLinkClick),
    [onLinkClick]
  );

  return (
    <motion.div
      initial={skipAnimation ? false : { opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex gap-3 w-full min-w-0"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Bot className="h-4 w-4 text-secondary-foreground" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 overflow-hidden",
            isResult && "border-primary/30 bg-primary/5"
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground overflow-hidden break-words">
            <CachedStreamdown
              content={content || ""}
              mode={isStreaming ? "streaming" : "static"}
              components={markdownComponents}
              caret={isStreaming ? "block" : undefined}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}


/**
 * Plan mode indicator - shows when agent enters/exits plan mode
 */
function PlanModeMessage({ action, skipAnimation }: { action: "enter" | "exit"; skipAnimation?: boolean }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  const isEnter = action === "enter";

  return (
    <motion.div
      initial={skipAnimation ? false : { opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex gap-3 w-full min-w-0"
    >
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        isEnter ? "bg-amber-500/10" : "bg-green-500/10"
      )}>
        <FileEdit className={cn("h-4 w-4", isEnter ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400")} />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className={cn(
          "rounded-2xl rounded-tl-md border px-4 py-3",
          isEnter
            ? "border-amber-500/20 bg-amber-500/5"
            : "border-green-500/20 bg-green-500/5"
        )}>
          <p className={cn(
            "text-sm font-medium",
            isEnter ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
          )}>
            {isEnter
              ? t("chat.enterPlanMode", "Entering Plan Mode")
              : t("chat.exitPlanMode", "Exiting Plan Mode")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isEnter
              ? t("chat.planModeDescription", "Agent is planning the approach before implementation")
              : t("chat.planModeComplete", "Planning complete, ready for implementation")}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function MessageItemImpl({
  message,
  isStreaming,
  isStatic,
  onApprovePlan,
  onRejectPlan,
  isPlanPending,
  onLinkClick,
  className,
  maxWidth,
  toolExpandedInline,
  onExpandSubagent,
  isLatestThinking,
}: MessageItemProps) {
  const { t } = useTranslation();

  // Determine the content based on message type
  let content: React.ReactNode;

  // User message
  if (message.type === "user") {
    content = (
      <UserMessage
        content={message.content || ""}
        attachments={message.attachments}
        skipAnimation={isStatic}
      />
    );
  }
  // Error message
  else if (message.type === "error") {
    content = <ErrorMessage errorMessage={message.message || ""} skipAnimation={isStatic} />;
  }
  // Thinking message - Claude's reasoning process
  else if (message.type === "thinking") {
    content = (
      <ThinkingMessage
        content={message.content || ""}
        onLinkClick={onLinkClick}
        isLatest={isLatestThinking}
        skipAnimation={isStatic}
      />
    );
  }
  // Tool use message - with optional merged result
  else if (message.type === "tool_use") {
    // If output is present, the tool has completed (merged from tool_result)
    const hasOutput = message.output !== undefined;

    // Recursive render function for subagent messages
    const renderSubagentMessage = (msg: AgentMessage, idx: number) => (
      <MessageItem
        key={msg.id || idx}
        message={msg}
        onLinkClick={onLinkClick}
        maxWidth="100%"
        toolExpandedInline={toolExpandedInline}
        onExpandSubagent={onExpandSubagent}
      />
    );

    content = (
      <ToolExecutionItem
        name={message.name || "unknown"}
        input={message.input}
        output={message.output}
        isExecuting={!hasOutput}
        isError={message.isError}
        subagentId={message.subagentId}
        subagentMessages={message.subagentMessages}
        renderMessage={renderSubagentMessage}
        expandedInline={toolExpandedInline}
        onExpandSubagent={onExpandSubagent}
      />
    );
  }
  // Tool result message - only shown if not merged with tool_use
  else if (message.type === "tool_result") {
    content = (
      <ToolExecutionItem
        name={t("chat.toolResult.label", "Tool Result")}
        output={message.output}
        isError={message.isError}
        expandedInline={toolExpandedInline}
      />
    );
  }
  // Plan message
  else if (message.type === "plan" && message.plan) {
    content = (
      <PlanApproval
        plan={message.plan}
        onApprove={onApprovePlan}
        onReject={onRejectPlan}
        isPending={isPlanPending}
      />
    );
  }
  // AskUserQuestion message - displayed as read-only QuestionInput
  else if (message.type === "ask_question" && message.questions) {
    content = (
      <QuestionInput
        questions={{ id: message.id || "", questions: message.questions }}
        onSubmit={() => {}}
        readOnly
      />
    );
  }
  // Plan mode indicator
  else if (message.type === "plan_mode" && message.planModeAction) {
    content = <PlanModeMessage action={message.planModeAction} skipAnimation={isStatic} />;
  }
  // Text/Result message from agent
  else {
    content = (
      <AssistantMessage
        content={message.content || ""}
        isResult={message.type === "result"}
        isStreaming={isStreaming}
        onLinkClick={onLinkClick}
        skipAnimation={isStatic}
      />
    );
  }

  return (
    <div
      className={cn("w-full min-w-0", className)}
      style={{
        width: "100%",
        maxWidth: maxWidth ? `min(100%, ${maxWidth})` : "100%",
      }}
    >
      {content}
    </div>
  );
}

/**
 * Custom memo comparator for MessageItem.
 *
 * Reference: Claude Code's `areMessageRowPropsEqual` (MessageRow.tsx lines 290-332)
 * and `areMessagePropsEqual` (Message.tsx lines 484-508).
 *
 * Strategy:
 * - If the message reference changed, always re-render (content may differ)
 * - If both prev and next are static, skip re-render (content is frozen)
 * - For non-static messages, always re-render (streaming/in-progress)
 */
export function areMessageItemPropsEqual(
  prev: MessageItemProps,
  next: MessageItemProps,
): boolean {
  // Different message reference = content may have changed
  if (prev.message !== next.message) return false;

  // Layout/style prop changes require re-render
  if (prev.className !== next.className) return false;
  if (prev.maxWidth !== next.maxWidth) return false;
  if (prev.isLatestThinking !== next.isLatestThinking) return false;
  if (prev.toolExpandedInline !== next.toolExpandedInline) return false;

  // If both are static, safe to skip re-render — content is frozen
  if (prev.isStatic && next.isStatic) return true;

  // Non-static messages: check remaining props that affect rendering
  if (prev.isStreaming !== next.isStreaming) return false;
  if (prev.isPlanPending !== next.isPlanPending) return false;

  return true;
}

export const MessageItem = React.memo(MessageItemImpl, areMessageItemPropsEqual);
