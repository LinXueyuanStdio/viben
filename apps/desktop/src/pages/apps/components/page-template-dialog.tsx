import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PageTemplate } from "@/lib/gateway/types/page";

export interface PageTemplateDialogProps {
  open: boolean;
  templates: PageTemplate[];
  isLoading?: boolean;
  isApplying?: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyTemplate: (templateId: string) => void;
}

export function PageTemplateDialog({
  open,
  templates,
  isLoading = false,
  isApplying = false,
  onOpenChange,
  onApplyTemplate,
}: PageTemplateDialogProps) {
  const [query, setQuery] = useState("");
  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) =>
      [template.name, template.description, template.id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized))
    );
  }, [query, templates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>选择模板</DialogTitle>
          <DialogDescription>从可用模板创建当前空页面。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索模板"
              className="pl-9"
            />
          </label>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">正在加载模板</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">没有匹配的模板</div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    onClick={() => onApplyTemplate(template.id)}
                    disabled={isApplying}
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{template.name}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{template.description}</span>
                    </span>
                    <span className="mt-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {template.source === "custom" ? "自定义" : "内置"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
