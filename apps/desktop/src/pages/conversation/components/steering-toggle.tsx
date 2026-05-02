/**
 * Steering Toggle Component
 *
 * A popover button for editing persistent steering instructions
 * that are appended to every message sent to the agent.
 */

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Compass, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChatConfigStore } from "@/stores/chat-config-store";

export function SteeringToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { steeringPrompt, setSteeringPrompt } = useChatConfigStore();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(steeringPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when popover opens
  useEffect(() => {
    if (isOpen) {
      setDraft(steeringPrompt);
      // Focus textarea after popover renders
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, steeringPrompt]);

  const handleSave = () => {
    setSteeringPrompt(draft.trim());
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraft("");
    setSteeringPrompt("");
  };

  const hasContent = steeringPrompt.trim().length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 h-8 px-2",
            hasContent && "text-primary",
            className
          )}
        >
          <Compass className="h-4 w-4" />
          <span className="text-xs hidden sm:inline">
            {t("steering.label", "Steering")}
          </span>
          {hasContent && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                {t("steering.title", "Steering")}
              </span>
            </div>
            {hasContent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-muted-foreground"
                onClick={handleClear}
              >
                <X className="h-3 w-3 mr-1" />
                {t("steering.clear", "Clear")}
              </Button>
            )}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("steering.placeholder", "Add instructions that apply to every message...")}
            className={cn(
              "w-full min-h-[80px] max-h-[200px] resize-y rounded-md border border-input",
              "bg-background px-3 py-2 text-sm",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSave();
              }
            }}
          />

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {t("steering.hint", "⌘+Enter to save")}
            </p>
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={handleSave}
            >
              {t("steering.save", "Save")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
