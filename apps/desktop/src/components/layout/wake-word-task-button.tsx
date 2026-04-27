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
 * - A listening-status icon inside the button toggles wake-word
 *   listening on/off. In collapsed mode the whole icon changes color
 *   and glows; in expanded mode a small check badge appears.
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
    ? t("sidebar.wakeWord.loading", "Loading wake word model...")
    : isActive
      ? t("sidebar.wakeWord.listening", {
          wakeWord: config.wakeWord,
          defaultValue: "Listening for \"{{wakeWord}}\" - click to stop",
        })
      : error
        ? error
        : t("sidebar.wakeWord.inactive", "Click to start listening for wake word");

  const ListeningIcon = isLoading ? Loader2 : AudioWaveform;

  /* ------------------------------------------------------------------ */
  /*  Collapsed mode — icon changes color + glow, no badge              */
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
                <AudioWaveform className="h-4 w-4 text-sidebar-foreground" />
                {/* Small green dot when listening */}
                {isActive && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
                )}
                {isLoading && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {config.wakeWord} · {t("sidebar.newTask")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Expanded mode — icon + text centered, check badge on icon         */
  /* ------------------------------------------------------------------ */
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onCreateTask}
        disabled={disabled}
        className={cn(
          "group relative w-full flex items-center justify-center gap-2 rounded-md border-2 px-3 py-2 text-sm font-medium",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "border-primary bg-transparent text-primary",
          "hover:bg-primary/10 hover:-translate-y-0.5",
          "active:translate-y-0",
        )}
      >
        {/* Listening toggle icon — inside button, left of text */}
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
                  "h-6 w-6 rounded-md transition-all duration-200",
                  "hover:bg-primary/15",
                  isActive && "bg-blue-500/10",
                  isLoading && "cursor-wait",
                )}
              >
                <ListeningIcon
                  className={cn(
                    "h-3.5 w-3.5 transition-all duration-300",
                    isLoading && "animate-spin text-yellow-500",
                    wakeWord.state === "detected" && "text-green-500 drop-shadow-[0_0_5px_rgba(34,197,94,0.6)]",
                    wakeWord.state === "listening" && "text-blue-500 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]",
                    wakeWord.state === "inactive" && "text-muted-foreground",
                  )}
                />
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
