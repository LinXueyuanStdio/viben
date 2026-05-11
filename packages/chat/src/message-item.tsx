import * as React from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Streamdown } from "streamdown";
import { User, Bot, AlertCircle, FileText, Image as ImageIcon, Brain, ChevronDown, ChevronRight, HelpCircle, FileEdit } from "lucide-react";
import { cn } from "@viben/ui";
import type { AgentMessage, MessageAttachment, AgentQuestion } from "./types";
import { ToolExecutionItem } from "./tool-execution-item";
import { PlanApproval } from "./plan-approval";

export interface MessageItemProps {
  message: AgentMessage;
  isStreaming?: boolean;
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
}

/**
 * Markdown components for react-markdown customization
 */
const createMarkdownComponents = (onLinkClick?: (href: string) => void) => ({
  // Code blocks
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="bg-muted max-w-full overflow-x-auto rounded-lg p-4 my-2 [&>code]:block"
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
          className="bg-muted rounded px-1.5 py-0.5 text-sm font-mono"
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
}: {
  content: string;
  attachments?: MessageAttachment[];
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex justify-end w-full min-w-0"
    >
      <div className="flex max-w-[85%] gap-3 min-w-0">
        <div className="flex flex-col items-end min-w-0 overflow-hidden">
          <div className="rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground overflow-hidden">
            <p className="whitespace-pre-wrap text-sm break-words">{content}</p>
            {attachments?.map((attachment) => (
              <AttachmentPreview key={attachment.id} attachment={attachment} />
            ))}
          </div>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Error message display
 */
function ErrorMessage({ errorMessage }: { errorMessage: string }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex gap-3 w-full min-w-0"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-4 w-4 text-destructive" />
      </div>
      <div className="flex-1">
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
 * Thinking message display - shows Claude's reasoning process
 */
function ThinkingMessage({
  content,
  onLinkClick,
}: {
  content: string;
  onLinkClick?: (href: string) => void;
}) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);
  const markdownComponents = useMemo(
    () => createMarkdownComponents(onLinkClick),
    [onLinkClick]
  );

  // Truncate content for collapsed view
  const truncatedContent = content.length > 200 ? content.slice(0, 200) + "..." : content;

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex gap-3 w-full min-w-0"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
        <Brain className="h-4 w-4 text-purple-500" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="rounded-2xl rounded-tl-md border border-purple-500/20 bg-purple-500/5 overflow-hidden">
          {/* Header - clickable to expand/collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-purple-500/10 transition-colors cursor-pointer min-w-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-purple-500" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-purple-500" />
            )}
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400 shrink-0">
              {t("chat.thinking", "Thinking")}
            </span>
            {!isExpanded && (
              <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                {truncatedContent}
              </span>
            )}
          </button>

          {/* Expandable content */}
          {isExpanded && (
            <div className="px-4 pb-3 border-t border-purple-500/10 overflow-hidden">
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80 overflow-hidden break-words mt-2">
                <Streamdown
                  mode="static"
                  components={markdownComponents}
                >
                  {content || ""}
                </Streamdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
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
}: {
  content: string;
  isResult?: boolean;
  isStreaming?: boolean;
  onLinkClick?: (href: string) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const markdownComponents = useMemo(
    () => createMarkdownComponents(onLinkClick),
    [onLinkClick]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
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
            <Streamdown
              mode={isStreaming ? "streaming" : "static"}
              components={markdownComponents}
              caret={isStreaming ? "block" : undefined}
            >
              {content || ""}
            </Streamdown>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * AskUserQuestion message display - shows interactive questions from agent
 */
function AskQuestionMessage({ questions }: { questions: AgentQuestion[] }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex gap-3 w-full min-w-0"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
        <HelpCircle className="h-4 w-4 text-blue-500" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="rounded-2xl rounded-tl-md border border-blue-500/20 bg-blue-500/5 px-4 py-3 space-y-3">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {t("chat.questionFromAgent", "Question from Agent")}
          </p>
          {questions.map((q, idx) => (
            <div key={idx} className="space-y-2">
              {q.header && (
                <span className="inline-block text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {q.header}
                </span>
              )}
              <p className="text-sm text-foreground">{q.question}</p>
              {q.options.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-sm"
                    >
                      <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium">
                        {optIdx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">{opt.label}</p>
                        {opt.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Plan mode indicator - shows when agent enters/exits plan mode
 */
function PlanModeMessage({ action }: { action: "enter" | "exit" }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  const isEnter = action === "enter";

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex gap-3 w-full min-w-0"
    >
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        isEnter ? "bg-amber-500/10" : "bg-green-500/10"
      )}>
        <FileEdit className={cn("h-4 w-4", isEnter ? "text-amber-500" : "text-green-500")} />
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

export function MessageItem({
  message,
  isStreaming,
  onApprovePlan,
  onRejectPlan,
  isPlanPending,
  onLinkClick,
  className,
  maxWidth,
  toolExpandedInline,
}: MessageItemProps) {
  const { t } = useTranslation();

  // Style for max width constraint
  const maxWidthStyle = maxWidth
    ? { maxWidth } as React.CSSProperties
    : undefined;

  // Determine the content based on message type
  let content: React.ReactNode;

  // User message
  if (message.type === "user") {
    content = (
      <UserMessage
        content={message.content || ""}
        attachments={message.attachments}
      />
    );
  }
  // Error message
  else if (message.type === "error") {
    content = <ErrorMessage errorMessage={message.message || ""} />;
  }
  // Thinking message - Claude's reasoning process
  else if (message.type === "thinking") {
    content = (
      <ThinkingMessage
        content={message.content || ""}
        onLinkClick={onLinkClick}
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
        // Don't pass maxWidth to nested messages - they should fill their container
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
  // AskUserQuestion message - interactive questions
  else if (message.type === "ask_question" && message.questions) {
    content = <AskQuestionMessage questions={message.questions} />;
  }
  // Plan mode indicator
  else if (message.type === "plan_mode" && message.planModeAction) {
    content = <PlanModeMessage action={message.planModeAction} />;
  }
  // Text/Result message from agent
  else {
    content = (
      <AssistantMessage
        content={message.content || ""}
        isResult={message.type === "result"}
        isStreaming={isStreaming}
        onLinkClick={onLinkClick}
      />
    );
  }

  return (
    <div className={className} style={maxWidthStyle}>
      {content}
    </div>
  );
}
