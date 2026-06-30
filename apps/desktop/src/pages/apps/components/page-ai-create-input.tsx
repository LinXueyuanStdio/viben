import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bot, FileText, Globe2 } from "lucide-react";
import { ChatInput } from "@viben/chat";
import { cn } from "@/lib/utils";
import {
  buildPageCreationPrompt,
  getPageCreationModeLabel,
  type PageCreationMode,
} from "./empty-markdown-page-utils";

export interface PageAiCreateInputProps {
  className?: string;
  disabled?: boolean;
  defaultMode?: PageCreationMode;
  onSubmit: (prompt: string, mode: PageCreationMode) => void;
}

const modeItems: Array<{ value: PageCreationMode; label: string; icon: ReactNode }> = [
  { value: "document", label: "文档", icon: <FileText className="size-3.5" /> },
  { value: "static", label: "静态网页", icon: <Globe2 className="size-3.5" /> },
  { value: "fullstack", label: "全栈应用", icon: <Bot className="size-3.5" /> },
];

export function PageAiCreateInput({
  className,
  disabled = false,
  defaultMode = "document",
  onSubmit,
}: PageAiCreateInputProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<PageCreationMode>(defaultMode);
  const [value, setValue] = useState("");
  const placeholder = useMemo(
    () => t("page.emptyPage.describeWhatToCreate", "描述你想创建的{{mode}}", { mode: getPageCreationModeLabel(mode) }),
    [mode]
  );

  const handleSend = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSubmit(buildPageCreationPrompt(trimmed, mode), mode);
    setValue("");
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot className="size-4 text-muted-foreground" />
          <span>{t("page.emptyPage.aiCreateLabel", "使用 AI 助手创建")}</span>
        </div>
        <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
          {modeItems.map((item) => (
            <button
              key={item.value}
              type="button"
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground transition-colors",
                mode === item.value && "bg-background text-foreground shadow-sm"
              )}
              onClick={() => setMode(item.value)}
              aria-pressed={mode === item.value}
              disabled={disabled}
            >
              {item.icon}
              {t(item.value === "document" ? "page.emptyPage.document" : item.value === "static" ? "page.emptyPage.staticPage" : "page.emptyPage.fullstackApp", item.label)}
            </button>
          ))}
        </div>
      </div>

      <ChatInput
        value={value}
        onValueChange={setValue}
        onSend={handleSend}
        layoutVariant="expanded"
        showTopToolbar={false}
        showBottomToolbar={false}
        minHeight={88}
        placeholder={placeholder}
        disabled={disabled}
        className="rounded-lg border border-border bg-background"
      />
    </div>
  );
}
