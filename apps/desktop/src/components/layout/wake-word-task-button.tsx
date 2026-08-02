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
import { useUiStore } from "@/stores/ui-store";
import { handleWakeWordDetected } from "@/lib/voice/wake-word-actions";

interface WakeWordTaskButtonProps {
  collapsed: boolean;
  disabled: boolean;
}

export function WakeWordTaskButton({
  collapsed,
  disabled,
}: WakeWordTaskButtonProps) {
  const { t } = useTranslation();
  const config = useVoiceStore((s) => s.config);
  const toggleChatPopup = useUiStore((s) => s.toggleChatPopup);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(() => {
    toggleChatPopup();
  }, [toggleChatPopup]);

  const wakeWord = useWakeWord(handleWakeWordDetected, {
    threshold: config.wakeWordThreshold,
  });

  const isActive = wakeWord.state === "listening" || wakeWord.state === "detected";
  const isLoading = wakeWord.state === "loading";

  const toggleWakeWord = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setError(null);

      if (wakeWord.isListening || wakeWord.state === "detected") {
        await wakeWord.stop();
      } else if (!isLoading) {
        try {
          await wakeWord.start();
        } catch (err) {
          console.error("[WakeWordTaskButton] Failed to start:", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [wakeWord, isLoading],
  );

  const listeningTooltip = isLoading
    ? t("sidebar.wakeWord.loading", "Loading wake word model...")
    : isActive
      ? t("sidebar.wakeWord.listening", {
          wakeWord: config.wakeWord,
          defaultValue: 'Listening for "{{wakeWord}}" - click to stop',
        })
      : error
        ? error
        : t("sidebar.wakeWord.inactive", "Click to start listening for wake word");

  const ListeningIcon = isLoading ? Loader2 : AudioWaveform;

  if (collapsed) {
    return (
      <div className="grid place-items-center w-full">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleClick}
                disabled={disabled}
                className={cn(
                  "relative flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
                  "hover:bg-sidebar-accent",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                <AudioWaveform className="h-4 w-4 text-sidebar-foreground" />
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

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "group relative w-full flex items-center justify-center gap-2 rounded-md border-2 px-3 py-1 text-sm font-medium",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          wakeWord.state === "listening" && "border-blue-500 text-blue-500 hover:bg-blue-500/10",
          wakeWord.state === "detected" && "border-green-500 text-green-500 hover:bg-green-500/10",
          wakeWord.state === "inactive" && "border-primary text-primary hover:bg-primary/10",
          isLoading && "border-yellow-500 text-yellow-500 hover:bg-yellow-500/10",
          "bg-transparent",
        )}
      >
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

        <span className="truncate">{config.wakeWord}</span>
      </button>
    </div>
  );
}
