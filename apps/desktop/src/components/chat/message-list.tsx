import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem } from "./message-item";
import { QuestionInput } from "./question-input";
import type { AgentMessage, PendingQuestion, TaskPlan } from "@/types";

interface MessageListProps {
  messages: AgentMessage[];
  isStreaming?: boolean;
  pendingPlan?: TaskPlan | null;
  pendingQuestions?: PendingQuestion | null;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
  className?: string;
}

export function MessageList({
  messages,
  isStreaming,
  pendingPlan,
  pendingQuestions,
  onApprovePlan,
  onRejectPlan,
  onAnswerQuestions,
  className,
}: MessageListProps) {
  const { t } = useTranslation();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingQuestions]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div className={cn("flex flex-1 items-center justify-center", className)}>
        <div className="text-center max-w-md px-4">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
            {t("chat.welcomeTitle")}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t("chat.welcomeDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("flex-1", className)}>
      <div ref={scrollRef} className="space-y-4 p-4 pb-8">
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          const isPlanMessage = message.type === "plan" && message.plan;

          return (
            <MessageItem
              key={message.id || index}
              message={message}
              isStreaming={isLastMessage && isStreaming && message.type === "text"}
              onApprovePlan={onApprovePlan}
              onRejectPlan={onRejectPlan}
              isPlanPending={isPlanMessage && pendingPlan !== null}
            />
          );
        })}

        {/* Pending questions */}
        {pendingQuestions && onAnswerQuestions && (
          <QuestionInput
            questions={pendingQuestions}
            onSubmit={onAnswerQuestions}
          />
        )}

        {/* Typing indicator */}
        {isStreaming && messages[messages.length - 1]?.type !== "text" && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
              <Bot className="h-4 w-4 text-secondary-foreground" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t("chat.thinking")}
              </span>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
