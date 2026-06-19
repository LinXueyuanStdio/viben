import { useCallback, useState } from "react";
import { AudioWaveform, Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVoiceStore } from "@/stores/voice-store";
import { useWakeWord } from "@/hooks/use-wake-word";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/stores/ui-store";
import { handleWakeWordDetected } from "@/lib/voice/wake-word-actions";

interface WakeWordSegmentProps {
  isMacOS?: boolean;
}

export function WakeWordSegment({ isMacOS = false }: WakeWordSegmentProps) {
  const { t } = useTranslation();
  const config = useVoiceStore((s) => s.config);
  const toggleChatPopup = useUiStore((s) => s.toggleChatPopup);
  const isChatPopupOpen = useUiStore((s) => s.isChatPopupOpen);
  const [error, setError] = useState<string | null>(null);

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
          console.error("[WakeWordSegment] Failed to start:", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [wakeWord, isLoading],
  );

  const handleToggleChat = useCallback(() => {
    toggleChatPopup();
  }, [toggleChatPopup]);

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
  const iconSize = isMacOS ? "h-3 w-3" : "h-3.5 w-3.5";
  const segmentHeight = isMacOS ? "h-6" : "h-7";

  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-border/60 overflow-hidden",
        segmentHeight,
      )}
    >
      {/* Listening segment */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleWakeWord}
            className={cn(
              "relative flex items-center justify-center px-1.5 transition-colors",
              "hover:bg-accent",
              segmentHeight,
              isActive && "bg-primary/10",
              isLoading && "cursor-wait",
            )}
          >
            <ListeningIcon
              className={cn(
                iconSize,
                "transition-all duration-300",
                isLoading && "animate-spin text-yellow-500",
                wakeWord.state === "detected" && "text-green-500",
                wakeWord.state === "listening" && "text-blue-500",
                wakeWord.state === "inactive" && "text-muted-foreground",
              )}
            />
            {isActive && (
              <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_3px_rgba(34,197,94,0.6)]" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-48">
          {listeningTooltip}
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="w-px h-3.5 bg-border/60" />

      {/* Agent/Chat segment */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleToggleChat}
            className={cn(
              "relative flex items-center justify-center px-1.5 transition-colors",
              "hover:bg-accent",
              segmentHeight,
              isChatPopupOpen && "bg-primary/10",
            )}
          >
            <Bot
              className={cn(
                iconSize,
                "transition-colors",
                isChatPopupOpen ? "text-primary" : "text-muted-foreground",
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {t("sidebar.newTask", "New Task")}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
