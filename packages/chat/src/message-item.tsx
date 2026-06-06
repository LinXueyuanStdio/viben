import * as React from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { User, Bot, AlertCircle, FileText, Image as ImageIcon, ChevronRight, FileEdit, BarChart3 } from "lucide-react";
import { cn } from "@viben/ui";
import type { AgentMessage, ExpandSubagentHandler, MessageAttachment, SummaryMessageData } from "./types";
import { ToolExecutionItem } from "./tool-execution-item";
import { PlanSummary } from "./plan-approval";
import { QuestionInput } from "./question-input";
import { CachedStreamdown } from "./cached-markdown";
import { ASSISTANT_MARKDOWN_TYPOGRAPHY } from "./message-typography";

const MESSAGE_AVATAR_CLASS = "sticky top-0 flex shrink-0 items-center justify-center self-start rounded-full";
const CLICKABLE_MESSAGE_AVATAR_CLASS =
  "cursor-pointer transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
  onExpandSubagent?: ExpandSubagentHandler;
  /** Whether this is the latest thinking message (starts expanded) */
  isLatestThinking?: boolean;
  /** Custom renderer for summary messages. */
  renderSummary?: (data: SummaryMessageData, message: AgentMessage) => React.ReactNode;
  /** Custom avatar content for user messages. */
  userAvatar?: React.ReactNode;
  /** Custom avatar content for assistant text/result messages. */
  assistantAvatar?: React.ReactNode;
  /** Called when a user message avatar is clicked. */
  onUserAvatarClick?: (message: AgentMessage) => void;
  /** Called when an assistant text/result message avatar is clicked. */
  onAssistantAvatarClick?: (message: AgentMessage) => void;
}

function MessageAvatar({
  children,
  className,
  label,
  message,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  message: AgentMessage;
  onClick?: (message: AgentMessage) => void;
}) {
  const avatarClassName = cn(
    MESSAGE_AVATAR_CLASS,
    className,
    onClick && CLICKABLE_MESSAGE_AVATAR_CLASS
  );

  if (onClick) {
    return (
      <button
        type="button"
        data-message-avatar="true"
        aria-label={label}
        className={avatarClassName}
        onClick={() => onClick(message)}
      >
        {children}
      </button>
    );
  }

  return (
    <div data-message-avatar="true" aria-label={label} className={avatarClassName}>
      {children}
    </div>
  );
}

/**
 * Markdown components for react-markdown customization
 */
const createMarkdownComponents = (onLinkClick?: (href: string) => void) => ({
  // Code blocks
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className={cn(
        "bg-code-block my-2 max-w-full overflow-x-auto rounded-md p-3 [&>code]:block",
        ASSISTANT_MARKDOWN_TYPOGRAPHY.codeBlock
      )}
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
          className={cn(
            "bg-code-block rounded px-1 py-0.5 font-mono",
            ASSISTANT_MARKDOWN_TYPOGRAPHY.inlineCode
          )}
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
      className={cn(
        "border-border bg-muted border px-2 py-1.5 text-left font-semibold",
        ASSISTANT_MARKDOWN_TYPOGRAPHY.tableText
      )}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td
      className={cn("border-border border px-2 py-1.5", ASSISTANT_MARKDOWN_TYPOGRAPHY.tableText)}
      {...props}
    >
      {children}
    </td>
  ),
  // Paragraphs
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn("my-1", ASSISTANT_MARKDOWN_TYPOGRAPHY.paragraph)} {...props}>
      {children}
    </p>
  ),
  // Headers
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className={cn("mt-3 mb-1.5 font-semibold", ASSISTANT_MARKDOWN_TYPOGRAPHY.h1)} {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className={cn("mt-2.5 mb-1.5 font-semibold", ASSISTANT_MARKDOWN_TYPOGRAPHY.h2)} {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className={cn("mt-2 mb-1 font-semibold", ASSISTANT_MARKDOWN_TYPOGRAPHY.h3)} {...props}>
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
    <li className={ASSISTANT_MARKDOWN_TYPOGRAPHY.listItem} {...props}>
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
  message,
  content,
  attachments,
  skipAnimation,
  avatar,
  onAvatarClick,
}: {
  message: AgentMessage;
  content: string;
  attachments?: MessageAttachment[];
  skipAnimation?: boolean;
  avatar?: React.ReactNode;
  onAvatarClick?: (message: AgentMessage) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={skipAnimation ? false : { opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex gap-3 w-full min-w-0"
    >
      <MessageAvatar
        className="h-8 w-8 bg-primary/10"
        label="User avatar"
        message={message}
        onClick={onAvatarClick}
      >
        {avatar ?? <User className="h-4 w-4 text-primary" />}
      </MessageAvatar>
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
      <div data-message-avatar="true" className={cn(MESSAGE_AVATAR_CLASS, "h-8 w-8 bg-destructive/10")}>
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
  message,
  content,
  isResult,
  isStreaming,
  onLinkClick,
  skipAnimation,
  avatar,
  onAvatarClick,
}: {
  message: AgentMessage;
  content: string;
  isResult?: boolean;
  isStreaming?: boolean;
  onLinkClick?: (href: string) => void;
  skipAnimation?: boolean;
  avatar?: React.ReactNode;
  onAvatarClick?: (message: AgentMessage) => void;
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
      <MessageAvatar
        className="h-8 w-8 bg-secondary"
        label="Assistant avatar"
        message={message}
        onClick={onAvatarClick}
      >
        {avatar ?? <Bot className="h-4 w-4 text-secondary-foreground" />}
      </MessageAvatar>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 overflow-hidden",
            isResult && "border-primary/30 bg-primary/5"
          )}
        >
          <div
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none overflow-hidden break-words text-foreground",
              ASSISTANT_MARKDOWN_TYPOGRAPHY.container
            )}
          >
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

function SummaryMessage({
  data,
  message,
  renderSummary,
  skipAnimation,
}: {
  data: SummaryMessageData;
  message: AgentMessage;
  renderSummary?: (data: SummaryMessageData, message: AgentMessage) => React.ReactNode;
  skipAnimation?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const customContent = renderSummary?.(data, message);
  const entries = useMemo(() => buildSummaryEntries(data), [data]);

  return (
    <motion.div
      initial={skipAnimation ? false : { opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
      className="flex gap-3 w-full min-w-0"
    >
      <div data-message-avatar="true" className={cn(MESSAGE_AVATAR_CLASS, "h-7 w-7 bg-muted")}>
        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="w-fit max-w-full rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {customContent ?? (
            entries.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {entries.map((entry) => (
                  <div key={entry.key} className="min-w-0">
                    <span className="text-muted-foreground/70">{entry.label}</span>
                    <span className="ml-1 font-medium text-foreground/80">{entry.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="max-w-[min(100%,32rem)] overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                {safeStringify(data)}
              </pre>
            )
          )}
        </div>
      </div>
    </motion.div>
  );
}

function buildSummaryEntries(data: SummaryMessageData): Array<{ key: string; label: string; value: string }> {
  return Object.entries(data).flatMap(([key, value]) => {
    const formatted = formatSummaryValue(key, value);
    return formatted ? [{ key, label: formatSummaryLabel(key), value: formatted }] : [];
  });
}

function formatSummaryLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSummaryValue(key: string, value: unknown): string | null {
  if (value == null) return null;
  if (key === "cost" && isRecord(value)) {
    const amount = typeof value.amount === "number" ? value.amount : undefined;
    const currency = typeof value.currency === "string" ? value.currency : "";
    if (amount !== undefined) return `${amount.toFixed(amount < 1 ? 4 : 2)} ${currency}`.trim();
  }
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(4);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  return safeStringify(value);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
      <div data-message-avatar="true" className={cn(
        MESSAGE_AVATAR_CLASS,
        "h-8 w-8",
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
  onLinkClick,
  className,
  maxWidth,
  toolExpandedInline,
  onExpandSubagent,
  isLatestThinking,
  renderSummary,
  userAvatar,
  assistantAvatar,
  onUserAvatarClick,
  onAssistantAvatarClick,
}: MessageItemProps) {
  const { t } = useTranslation();

  // Determine the content based on message type
  let content: React.ReactNode;

  // User message
  if (message.type === "user") {
    content = (
      <UserMessage
        message={message}
        content={message.content || ""}
        attachments={message.attachments}
        skipAnimation={isStatic}
        avatar={userAvatar}
        onAvatarClick={onUserAvatarClick}
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
        toolUseId={message.toolUseId}
        output={message.output}
        isExecuting={!hasOutput}
        isError={message.isError}
        subagentId={message.subagentId}
        subagentMessages={message.subagentMessages}
        subagentPreviewMessages={message.subagentPreviewMessages}
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
    content = <PlanSummary plan={message.plan} />;
  }
  // Summary message
  else if (message.type === "summary") {
    content = (
      <SummaryMessage
        data={message.summary ?? {}}
        message={message}
        renderSummary={renderSummary}
        skipAnimation={isStatic}
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
        message={message}
        content={message.content || ""}
        isResult={message.type === "result"}
        isStreaming={isStreaming}
        onLinkClick={onLinkClick}
        skipAnimation={isStatic}
        avatar={assistantAvatar}
        onAvatarClick={onAssistantAvatarClick}
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
  if (prev.renderSummary !== next.renderSummary) return false;
  if (prev.toolExpandedInline !== next.toolExpandedInline) return false;
  if (prev.userAvatar !== next.userAvatar) return false;
  if (prev.assistantAvatar !== next.assistantAvatar) return false;
  if (prev.onUserAvatarClick !== next.onUserAvatarClick) return false;
  if (prev.onAssistantAvatarClick !== next.onAssistantAvatarClick) return false;

  // If both are static, safe to skip re-render — content is frozen
  if (prev.isStatic && next.isStatic) return true;

  // Non-static messages: check remaining props that affect rendering
  if (prev.isStreaming !== next.isStreaming) return false;
  if (prev.isPlanPending !== next.isPlanPending) return false;

  return true;
}

export const MessageItem = React.memo(MessageItemImpl, areMessageItemPropsEqual);
