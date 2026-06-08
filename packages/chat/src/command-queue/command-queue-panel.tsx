import * as React from "react";
import { useTranslation } from "react-i18next";
import { X, Trash2, ListOrdered } from "lucide-react";
import { cn, Button, Badge } from "@viben/ui";
import type { CommandQueueItem } from "./types";

export interface CommandQueuePanelProps {
  items: CommandQueueItem[];
  onRemove: (id: string) => void;
  onUpdate?: (id: string, content: string) => void;
  onClear: () => void;
  className?: string;
  /** Compact mode - shows minimal info, suitable for embedding between message list and input */
  compact?: boolean;
  /** Hide individual item remove buttons */
  hideItemRemove?: boolean;
  /** Called when user wants to recall items to input instead of clearing */
  onRecall?: (items: CommandQueueItem[]) => void;
}

export function CommandQueuePanel({
  items,
  onRemove,
  onClear,
  className,
  compact,
  hideItemRemove,
  onRecall,
}: CommandQueuePanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);

  if (items.length === 0) return null;

  if (compact) {
    return (
      <div
        className={cn(
          "border-t border-border/40 bg-muted/30 text-left",
          className
        )}
      >
        {/* Compact header bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 text-left">
          <ListOrdered className="size-3.5 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-left text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {items.length} {t("chat.commandQueue.queued", "queued")}
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => onRecall ? onRecall(items) : onClear()}
              className="p-0.5 hover:bg-accent rounded cursor-pointer text-muted-foreground"
              title={onRecall ? t("chat.commandQueue.recall", "Recall to input") : t("chat.commandQueue.clear", "Clear")}
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
        {/* Expandable item list */}
        {expanded && (
          <div className="px-3 pb-2 max-h-32 overflow-y-auto border-t border-border/20 text-left">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-start gap-2 py-1 text-left text-xs"
              >
                <span className="text-muted-foreground shrink-0 text-left pt-0.5">
                  {idx + 1}.
                </span>
                <span className="flex-1 text-left whitespace-pre-wrap break-words line-clamp-3">
                  {item.content}
                </span>
                {!hideItemRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="shrink-0 p-0.5 cursor-pointer hover:bg-accent rounded"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card p-2 text-left", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 text-left">
        <div className="flex items-center gap-1.5">
          <ListOrdered className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">
            {t("chat.commandQueue.title", "Queue")}
          </span>
          <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
            {items.length}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={() => onRecall ? onRecall(items) : onClear()}
            title={onRecall ? t("chat.commandQueue.recall", "Recall to input") : t("chat.commandQueue.clear", "Clear")}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Item List */}
      <div className="max-h-40 overflow-y-auto space-y-0.5 text-left">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-2 rounded-md px-2 py-1 text-left text-xs",
              !hideItemRemove && "hover:bg-muted/50 group"
            )}
          >
            <span className="text-muted-foreground w-4 shrink-0 text-left pt-0.5">
              {idx + 1}
            </span>
            <span className="flex-1 text-left whitespace-pre-wrap break-words line-clamp-4">{item.content}</span>
            {item.attachments && item.attachments.length > 0 && (
              <span className="shrink-0 text-muted-foreground pt-0.5">
                +{item.attachments.length} {t("chat.commandQueue.files", "files")}
              </span>
            )}
            {!hideItemRemove && (
              <button
                onClick={() => onRemove(item.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive pt-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
