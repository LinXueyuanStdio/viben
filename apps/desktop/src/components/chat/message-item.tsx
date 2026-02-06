import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
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
 * Render markdown content with basic formatting
 * For production, consider using react-markdown with remark-gfm
 */
function renderContent(content: string) {
  // Split content into lines for processing
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for code block start/end
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockContent = [];
      } else {
        // End of code block
        inCodeBlock = false;
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-2 overflow-x-auto rounded-lg bg-muted p-4 text-sm"
          >
            <code className={codeBlockLang ? `language-${codeBlockLang}` : ""}>
              {codeBlockContent.join("\n")}
            </code>
          </pre>
        );
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Process inline formatting
    let processedLine: React.ReactNode = line;

    // Bold: **text**
    if (line.includes("**")) {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      processedLine = parts.map((part, idx) =>
        idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
      );
    }

    // Inline code: `code`
    if (typeof processedLine === "string" && processedLine.includes("`")) {
      const parts = processedLine.split(/`([^`]+)`/g);
      processedLine = parts.map((part, idx) =>
        idx % 2 === 1 ? (
          <code
            key={idx}
            className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
          >
            {part}
          </code>
        ) : (
          part
        )
      );
    }

    // Headers
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-xl font-bold mt-4 mb-2">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-semibold mt-3 mb-2">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-semibold mt-2 mb-1">
          {line.slice(4)}
        </h3>
      );
    }
    // List items
    else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <li key={i} className="ml-4 list-decimal">
          {processedLine}
        </li>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 list-disc">
          {typeof processedLine === "string" ? processedLine.slice(2) : processedLine}
        </li>
      );
    }
    // Empty lines
    else if (line.trim() === "") {
      elements.push(<br key={i} />);
    }
    // Regular paragraph
    else {
      elements.push(
        <p key={i} className="my-1">
          {processedLine}
        </p>
      );
    }
  }

  return elements;
}

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
      <div className="flex-1 overflow-hidden">
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3",
            message.type === "result" && "border-primary/30 bg-primary/5"
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {renderContent(message.content || "")}
          </div>
          {isStreaming && (
            <span className="inline-block h-4 w-1 animate-pulse bg-primary ml-1" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
