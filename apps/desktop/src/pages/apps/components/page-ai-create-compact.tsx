import { Loader2, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@viben/chat";
import { cn } from "@/lib/utils";
import { getPageCreationModeLabel, type PageCreationMode } from "./empty-markdown-page-utils";

export interface PageAiCreateCompactProps {
  className?: string;
  mode: PageCreationMode;
  input: string;
  onStop?: () => void;
  onDismiss?: () => void;
}

export function PageAiCreateCompact({
  className,
  mode,
  input,
  onStop,
  onDismiss,
}: PageAiCreateCompactProps) {
  return (
    <section
      className={cn(
        "mx-14 my-4 max-w-3xl rounded-lg border border-border bg-card p-3 shadow-sm",
        className
      )}
      aria-label="AI 创建中"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">AI</AvatarFallback>
          </Avatar>
          <span className="truncate">使用 AI 助手创建 {getPageCreationModeLabel(mode)} 中...</span>
        </div>
        {onDismiss && (
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onDismiss}>
            <X className="size-4" />
          </Button>
        )}
      </div>
      <ChatInput
        value={input}
        onSend={() => undefined}
        onCancel={onStop}
        isLoading
        layoutVariant="compact"
        showTopToolbar={false}
        showBottomToolbar={false}
        disabled
        className="rounded-md border border-border bg-background"
        placeholder=""
      />
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        <span>正在生成内容</span>
      </div>
    </section>
  );
}
