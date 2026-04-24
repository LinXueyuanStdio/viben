import { useCallback, useState } from "react";
import { AudioWaveform, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
      // Detection callback — state is handled internally by the hook
    },
    { threshold: config.wakeWordThreshold }
  );

  const isActive = wakeWord.state === "listening" || wakeWord.state === "detected";
  const isLoading = wakeWord.state === "loading";

  const toggleWakeWord = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setError(null);
      if (wakeWord.isListening || wakeWord.state === "detected") {
        wakeWord.stop();
      } else if (!isLoading) {
        const keyword = config.wakeWord === "你好微本" ? "nihao_weiben" : "hey_jarvis";
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
    [wakeWord, config.wakeWord, isLoading]
  );

  const tooltipText = isLoading
    ? t("sidebar.wakeWord.loading", "正在加载唤醒词模型...")
    : isActive
      ? t("sidebar.wakeWord.listening", { wakeWord: config.wakeWord, defaultValue: "正在监听「{{wakeWord}}」- 点击关闭" })
      : error
        ? error
        : t("sidebar.wakeWord.inactive", "点击开始监听唤醒词");

  // Icon component based on state
  const WakeWordIcon = isLoading ? Loader2 : AudioWaveform;
  const iconClassName = cn(
    "h-4 w-4",
    isLoading && "animate-spin text-yellow-500",
    wakeWord.state === "detected" && "text-green-500",
    wakeWord.state === "listening" && "text-blue-500",
    wakeWord.state === "inactive" && "text-muted-foreground"
  );

  // Check badge shown when actively listening
  const checkBadge = isActive && (
    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-green-500 ring-1 ring-background">
      <Check className="h-2 w-2 text-white" strokeWidth={3} />
    </span>
  );

  if (collapsed) {
    return (
      <>
        {/* Wake word icon button */}
        <div className="grid place-items-center w-full">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleWakeWord}
                  disabled={isLoading}
                  className={cn(
                    "relative flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
                    "hover:bg-sidebar-accent",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "bg-sidebar-accent",
                    isLoading && "opacity-70 cursor-wait"
                  )}
                >
                  <span className="relative">
                    <WakeWordIcon className={iconClassName} />
                    {checkBadge}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium max-w-48">
                {tooltipText}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </>
    );
  }

  // Expanded mode
  return (
    <div className="mt-4 flex items-center gap-1">
      {/* Wake word icon — toggle listening */}
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleWakeWord}
              disabled={isLoading}
              className={cn(
                "relative flex items-center justify-center h-9 w-9 shrink-0 rounded-md border transition-colors",
                "hover:bg-accent",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "border-blue-500/50 bg-blue-500/10",
                !isActive && "border-border",
                isLoading && "opacity-70 cursor-wait"
              )}
            >
              <span className="relative">
                <WakeWordIcon className={iconClassName} />
                {checkBadge}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="font-medium max-w-48">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Main button — create task, text is wake word */}
      <Button
        variant="outline"
        className="flex-1 min-w-0"
        onClick={onCreateTask}
        disabled={disabled}
      >
        <span className="truncate">{config.wakeWord}</span>
      </Button>
    </div>
  );
}
