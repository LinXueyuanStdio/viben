import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
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
      className="bg-muted my-2 max-w-full overflow-x-auto rounded-lg p-4"
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
          className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm"
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
    <div className="my-2 overflow-x-auto">
      <table className="border-border w-full border-collapse border" {...props}>
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
    <h1 className="mb-2 mt-4 text-xl font-bold" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mb-2 mt-3 text-lg font-semibold" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mb-1 mt-2 text-base font-semibold" {...props}>
      {children}
    </h3>
  ),
  // Lists
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-2 ml-4 list-disc space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-2 ml-4 list-decimal space-y-1" {...props}>
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
      className="border-primary/30 text-muted-foreground my-2 border-l-4 pl-4 italic"
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
      <div className="mt-2 overflow-hidden rounded-lg border border-border">
        <img
          src={attachment.data}
          alt={attachment.name}
          className="max-h-[300px] max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
      {attachment.type === "image" ? (
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground" />
      )}
      <span>{attachment.name}</span>
    </div>
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="flex max-w-[80%] gap-3">
          <div className="flex flex-col items-end">
            <div className="rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground">
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.attachments?.map((attachment) => (
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

  // Error message
  if (message.type === "error") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
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
            <p className="mt-1 text-sm text-destructive/80">{message.message}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Tool use message
  if (message.type === "tool_use") {
    return (
      <ToolExecutionItem
        name={message.name || "unknown"}
        input={message.input}
        isExecuting
      />
    );
  }

  // Tool result message
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

  // Text/Result message from agent
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Bot className="h-4 w-4 text-secondary-foreground" />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "border-border bg-card rounded-2xl rounded-tl-md border px-4 py-3",
            message.type === "result" && "border-primary/30 bg-primary/5"
          )}
        >
          <div className="prose prose-sm dark:prose-invert text-foreground max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content || ""}
            </ReactMarkdown>
          </div>
          {isStreaming && (
            <span className="bg-primary ml-1 inline-block h-4 w-1 animate-pulse" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
