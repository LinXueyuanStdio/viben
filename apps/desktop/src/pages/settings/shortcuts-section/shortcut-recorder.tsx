import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatShortcutForPlatform, keyEventToShortcutForPlatform } from "./shortcut-utils";

// Shortcut Recorder Component
export interface ShortcutRecorderProps {
  value: string;
  onChange: (shortcut: string) => void;
  onClear: () => void;
  currentPlatform: string;
}

export function ShortcutRecorder({ value, onChange, onClear, currentPlatform }: ShortcutRecorderProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape to cancel recording
      if (e.key === "Escape") {
        setIsRecording(false);
        return;
      }

      // Only record if there's at least one modifier or a valid single key
      const shortcut = keyEventToShortcutForPlatform(e, currentPlatform);
      if (shortcut && !["Ctrl", "Alt", "Shift", "Cmd", "Meta"].includes(shortcut)) {
        onChange(shortcut);
        setIsRecording(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isRecording, onChange, currentPlatform]);

  return (
    <div className="flex items-center gap-2">
      <button
        ref={inputRef}
        onClick={() => setIsRecording(true)}
        onBlur={() => setIsRecording(false)}
        className={cn(
          "min-w-[120px] px-3 py-1.5 rounded-lg border text-sm font-mono",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          isRecording
            ? "border-primary bg-primary/5 text-primary"
            : value
              ? "border-border bg-muted text-foreground"
              : "border-border bg-background text-muted-foreground"
        )}
      >
        {isRecording ? t("settings.pressKeys") : value ? formatShortcutForPlatform(value, currentPlatform) : "\u2014"}
      </button>
      {value && !isRecording && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onClear}
          title={t("settings.clearShortcut")}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
