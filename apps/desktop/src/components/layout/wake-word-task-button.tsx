import { useCallback, useState } from "react";
import { AudioWaveform, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVoiceStore } from "@/stores/voice-store";
import { useWakeWord } from "@/hooks/use-wake-word";
import { useTranslation } from "react-i18next";

interface WakeWordTaskButtonProps {
  collapsed: boolean;
  onCreateTask: () => void;
  disabled: boolean;
}

/**
 * Wake word + new-task button for the sidebar bottom area.
 *
 * - Text shows the configured wake word (e.g. "你好微本").
 * - Clicking the button body opens the create-task dialog.
 * - A small listening-status icon sits inside the button (left side in
 *   expanded mode, top-right badge in collapsed mode). Clicking that icon
 *   toggles wake-word listening on/off; a green check badge appears when
 *   listening is active.
 */
export function WakeWordTaskButton({
  collapsed,
  onCreateTask,
  disabled,
}: WakeWordTaskButtonProps) {
  const { t } = useTranslation();
  const config = useVoiceStore((s) => s.config);
  const [error, setError] = useState<string | null>(null);

  const wakeWord = useWakeWord(
    () => {
      // Detection handled internally by the hook (state transitions)
    },
    { threshold: config.wakeWordThreshold },
  );

  const isActive = wakeWord.state === "listening" || wakeWord.state === "detected";
  const isLoading = wakeWord.state === "loading";

  const toggleWakeWord = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setError(null);

      if (wakeWord.isListening || wakeWord.state === "detected") {
        wakeWord.stop();
      } else if (!isLoading) {
        const keyword =
          config.wakeWord === "你好微本" ? "nihao_weiben" : "hey_jarvis";
        try {
          await wakeWord.loadKeyword(keyword);
          wakeWord.setActiveKeywords([keyword]);
          await wakeWord.start();
        } catch (err) {
          console.error("[WakeWordTaskButton] Failed to start:", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [wakeWord, config.wakeWord, isLoading],
  );

  const listeningTooltip = isLoading
    ? t("sidebar.wakeWord.loading", "正在加载唤醒词模型...")
    : isActive
      ? t("sidebar.wakeWord.listening", {
          wakeWord: config.wakeWord,
          defaultValue: "正在监听「{{wakeWord}}」- 点击关闭",
        })
      : error
        ? error
        : t("sidebar.wakeWord.inactive", "点击开始监听唤醒词");

  // --- Shared listening icon piece ---
  const ListeningIcon = isLoading ? Loader2 : AudioWaveform;
  const iconColor = cn(
    isLoading && "text-yellow-500",
    wakeWord.state === "detected" && "text-green-500",
    wakeWord.state === "listening" && "text-blue-500",
    wakeWord.state === "inactive" && "text-muted-foreground",
  );

  /* ------------------------------------------------------------------ */
  /*  Collapsed mode                                                     */
  /* ------------------------------------------------------------------ */
  if (collapsed) {
    return (
      <div className="grid place-items-center w-full">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCreateTask}
                disabled={disabled}
                className={cn(
                  "relative flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
                  "hover:bg-sidebar-accent",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                {/* Wake word icon as the main visual */}
                <AudioWaveform className="h-4 w-4 text-sidebar-foreground" />

                {/* Listening status badge — top-right corner */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={toggleWakeWord}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          toggleWakeWord(e as unknown as React.MouseEvent);
                        }
                      }}
                      className={cn(
                        "absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full",
                        "h-3.5 w-3.5 cursor-pointer transition-all",
                        "ring-1 ring-background",
                        isActive && "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]",
                        isLoading && "bg-yellow-500",
                        !isActive && !isLoading && "bg-muted-foreground/30 hover:bg-muted-foreground/60",
                      )}
                    >
                      {isActive ? (
                        <Check className="h-2 w-2 text-white" strokeWidth={3} />
                      ) : isLoading ? (
                        <Loader2 className="h-2 w-2 text-white animate-spin" strokeWidth={3} />
                      ) : null}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs max-w-48">
                    {listeningTooltip}
                  </TooltipContent>
                </Tooltip>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {config.wakeWord}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Expanded mode                                                      */
  /* ------------------------------------------------------------------ */
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onCreateTask}
        disabled={disabled}
        className={cn(
          "group relative w-full flex items-center gap-2.5 rounded-md border-2 px-3 py-2 text-sm font-medium",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "border-primary bg-transparent text-primary",
          "hover:bg-primary/10 hover:-translate-y-0.5",
          "active:translate-y-0",
        )}
      >
        {/* Listening toggle icon — inside button, left side */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                onClick={toggleWakeWord}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    toggleWakeWord(e as unknown as React.MouseEvent);
                  }
                }}
                className={cn(
                  "relative flex items-center justify-center shrink-0",
                  "h-6 w-6 rounded-md transition-colors",
                  "hover:bg-primary/15",
                  isActive && "bg-blue-500/15",
                  isLoading && "cursor-wait",
                )}
              >
                <ListeningIcon className={cn("h-3.5 w-3.5", iconColor, isLoading && "animate-spin")} />
                {/* Green check badge when active */}
                {isActive && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-green-500 ring-1 ring-background shadow-[0_0_4px_rgba(34,197,94,0.4)]">
                    <Check className="h-1.5 w-1.5 text-white" strokeWidth={3} />
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-48">
              {listeningTooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Wake word text */}
        <span className="truncate">{config.wakeWord}</span>
      </button>
    </div>
  );
}
