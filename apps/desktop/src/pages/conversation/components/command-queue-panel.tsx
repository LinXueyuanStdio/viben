/**
 * Command Queue Panel
 *
 * Displays queued commands with controls to pause/resume, remove items, and clear.
 * Shown above the chat input when there are pending commands.
 */
import { useTranslation } from "react-i18next";
import { X, Pause, Play, Trash2, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CommandQueueItem } from "../hooks/use-command-queue";

interface CommandQueuePanelProps {
  items: CommandQueueItem[];
  isPaused: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPause: () => void;
  onResume: () => void;
  className?: string;
}

export function CommandQueuePanel({
  items,
  isPaused,
  onRemove,
  onClear,
  onPause,
  onResume,
  className,
}: CommandQueuePanelProps) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <div className={cn("border rounded-lg bg-muted/30 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ListOrdered className="h-3.5 w-3.5" />
          <span>
            {t("chat.commandQueue.title", "Queue")} ({items.length})
          </span>
          {isPaused && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {t("chat.commandQueue.paused", "Paused")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isPaused ? (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onResume} title={t("chat.commandQueue.resume", "Resume")}>
              <Play className="h-3 w-3" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onPause} title={t("chat.commandQueue.pause", "Pause")}>
              <Pause className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear} title={t("chat.commandQueue.clear", "Clear all")}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Items */}
      <div className="max-h-32 overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border-b last:border-b-0 hover:bg-muted/30"
          >
            <span className="text-muted-foreground shrink-0 w-4 text-right">{index + 1}.</span>
            <span className="flex-1 truncate">{item.input}</span>
            {item.files.length > 0 && (
              <span className="text-muted-foreground shrink-0">
                +{item.files.length} {t("chat.commandQueue.files", "files")}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
              onClick={() => onRemove(item.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
