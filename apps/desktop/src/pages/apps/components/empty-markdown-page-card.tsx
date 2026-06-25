import { ChevronDown, Import, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PageCreationMode } from "./empty-markdown-page-utils";
import { PageAiCreateInput } from "./page-ai-create-input";

export interface EmptyMarkdownPageCardProps {
  className?: string;
  isCreating?: boolean;
  onStartEditing?: () => void;
  onCreateFromTemplate?: () => void;
  onImportPage?: () => void;
  onAiCreate?: (prompt: string, mode: PageCreationMode) => void;
}

export function EmptyMarkdownPageCard({
  className,
  isCreating = false,
  onStartEditing,
  onCreateFromTemplate,
  onImportPage,
  onAiCreate,
}: EmptyMarkdownPageCardProps) {
  return (
    <section
      className={cn(
        "mx-14 my-4 max-w-3xl overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button, input, textarea, select, [role='button'], [data-empty-page-action='true']")) {
          return;
        }
        onStartEditing?.();
      }}
      aria-label="空页面操作"
    >
      <button
        type="button"
        className="flex w-full items-center justify-center border-b border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onStartEditing}
      >
        开始
      </button>

      <div className="space-y-3 border-b border-border px-4 py-4">
        <p className="text-sm text-muted-foreground">按 Enter 键开始编辑内容</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-empty-page-action="true"
            onClick={(event) => {
              event.stopPropagation();
              onCreateFromTemplate?.();
            }}
            disabled={isCreating}
          >
            <LayoutTemplate className="size-4" />
            从模板创建
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-empty-page-action="true"
            onClick={(event) => {
              event.stopPropagation();
              onImportPage?.();
            }}
            disabled={isCreating}
          >
            <Import className="size-4" />
            导入新页面
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4" data-empty-page-action="true">
        <PageAiCreateInput
          disabled={isCreating}
          onSubmit={(prompt, mode) => onAiCreate?.(prompt, mode)}
        />
      </div>
    </section>
  );
}
