import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot, AlertCircle, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentMessage, MessageAttachment } from "@/types";
import { ToolExecutionItem } from "./tool-execution-item";
import { PlanApproval } from "./plan-approval";

interface MessageItemProps {
  message: AgentMessage;
  isStreaming?: boolean;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  isPlanPending?: boolean;
}

/**
 * Markdown components for react-markdown customization
 */
const markdownComponents = {
  // Code blocks
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="bg-muted max-w-full overflow-x-auto rounded-lg p-4 my-2"
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
  // Links - open in external browser
  a: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      onClick={async (e) => {
        e.preventDefault();
        if (href) {
          try {
            const { open } = await import("@tauri-apps/plugin-shell");
            await open(href);
          } catch {
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
};

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
      className="flex justify-end"
    >
      <div className="flex max-w-[80%] gap-3">
        <div className="flex flex-col items-end">
          <div className="rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground">
            <p className="whitespace-pre-wrap text-sm">{content}</p>
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
      className="flex gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-4 w-4 text-destructive" />
      </div>
      <div className="flex-1">
        <div className="rounded-2xl rounded-tl-md border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            {t("chat.error")}
          </p>
          <p className="mt-1 text-sm text-destructive/80">{errorMessage}</p>
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
}: {
  content: string;
  isResult?: boolean;
  isStreaming?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="flex gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Bot className="h-4 w-4 text-secondary-foreground" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3",
            isResult && "border-primary/30 bg-primary/5"
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {content || ""}
            </ReactMarkdown>
          </div>
          {isStreaming && (
            <span className="inline-block h-4 w-1 animate-pulse bg-primary ml-1" />
          )}
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
}: MessageItemProps) {
  const { t } = useTranslation();

  // User message
  if (message.type === "user") {
    return (
      <UserMessage
        content={message.content || ""}
        attachments={message.attachments}
      />
    );
  }

  // Error message
  if (message.type === "error") {
    return <ErrorMessage errorMessage={message.message || ""} />;
  }

  // Tool use message - handled by task groups in MessageList
  // Only render standalone if not grouped
  if (message.type === "tool_use") {
    return (
      <ToolExecutionItem
        name={message.name || "unknown"}
        input={message.input}
        isExecuting
      />
    );
  }

  // Tool result message - handled by task groups in MessageList
  if (message.type === "tool_result") {
    return (
      <ToolExecutionItem
        name="Tool Result"
        output={message.output}
        isError={message.isError}
      />
    );
  }

  // Plan message
  if (message.type === "plan" && message.plan) {
    return (
      <PlanApproval
        plan={message.plan}
        onApprove={onApprovePlan}
        onReject={onRejectPlan}
        isPending={isPlanPending}
      />
    );
  }

  // Thinking message (extended thinking from Claude)
  if (message.type === "thinking") {
    const prefersReducedMotion = useReducedMotion();

    return (
      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        className="flex gap-3"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
          <Bot className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="rounded-2xl rounded-tl-md border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-xs text-amber-600/80 mb-1 font-medium">{t("chat.thinking", "Thinking...")}</p>
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content || ""}
              </ReactMarkdown>
            </div>
            {isStreaming && (
              <span className="inline-block h-4 w-1 animate-pulse bg-amber-500 ml-1" />
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Text/Result message from agent
  return (
    <AssistantMessage
      content={message.content || ""}
      isResult={message.type === "result"}
      isStreaming={isStreaming}
    />
  );
}
