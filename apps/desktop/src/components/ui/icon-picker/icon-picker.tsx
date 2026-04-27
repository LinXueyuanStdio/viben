/**
 * IconPicker Component — Notion-like
 *
 * Unified icon picker with:
 * - Emoji tab (emoji-mart)
 * - Icons tab (full Lucide async)
 * - Image tab (upload/URL)
 * - Random icon button
 * - Remove icon button
 * - Smart default tab based on current value
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Dices, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LucideTab } from "./tabs/lucide-tab";
import { EmojiTab } from "./tabs/emoji-tab";
import { ImageTab } from "./tabs/image-tab";
import { IconDisplay } from "./icon-display";
import { createLucideIcon, createEmojiIcon, createImageIcon, parseIconData } from "./utils";
import { ALL_ICON_NAMES } from "./icon-cache";
import type { IconData, IconType } from "./types";

// For random emoji selection
import emojiData from "@emoji-mart/data";

export interface IconPickerProps {
  value?: IconData | string | null;
  onChange?: (icon: IconData | null) => void;
  workspacePath?: string;
  disabled?: boolean;
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  defaultTab?: IconType;
  allowedTypes?: IconType[];
  className?: string;
  iconSize?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /** Show remove button (default: true) */
  allowRemove?: boolean;
  /** Show random button (default: true) */
  showRandom?: boolean;
}

/**
 * Determine default tab based on current icon value.
 */
function getSmartDefaultTab(
  value: IconData | string | null | undefined,
  allowedTypes: IconType[],
  explicitDefault?: IconType
): IconType {
  if (explicitDefault && allowedTypes.includes(explicitDefault)) {
    return explicitDefault;
  }

  if (value) {
    const parsed = typeof value === "string" ? parseIconData(value) : value;
    if (parsed && allowedTypes.includes(parsed.type)) {
      return parsed.type;
    }
  }

  // Default to emoji (Notion-style)
  return allowedTypes.includes("emoji") ? "emoji" : allowedTypes[0] ?? "lucide";
}

/**
 * Get a random emoji from emoji-mart data.
 */
function getRandomEmoji(): string {
  const emojis = (emojiData as { emojis: Record<string, { skins: { native: string }[] }> }).emojis;
  const keys = Object.keys(emojis);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return emojis[randomKey]?.skins?.[0]?.native ?? "😀";
}

/**
 * Get a random Lucide icon name.
 */
function getRandomLucideIcon(): string {
  return ALL_ICON_NAMES[Math.floor(Math.random() * ALL_ICON_NAMES.length)];
}

export function IconPicker({
  value,
  onChange,
  workspacePath,
  disabled = false,
  trigger,
  align = "start",
  defaultTab,
  allowedTypes = ["lucide", "emoji", "image"],
  className,
  iconSize = "md",
  allowRemove = true,
  showRandom = true,
}: IconPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [randomSpin, setRandomSpin] = React.useState(false);

  // Smart default tab
  const smartDefault = React.useMemo(
    () => getSmartDefaultTab(value, allowedTypes, defaultTab),
    [value, allowedTypes, defaultTab]
  );
  const [activeTab, setActiveTab] = React.useState<IconType>(smartDefault);

  // Reset active tab when popover opens
  React.useEffect(() => {
    if (open) {
      setActiveTab(getSmartDefaultTab(value, allowedTypes, defaultTab));
    }
  }, [open, value, allowedTypes, defaultTab]);

  // Handlers
  const handleLucideSelect = React.useCallback(
    (iconName: string) => {
      onChange?.(createLucideIcon(iconName));
      setOpen(false);
    },
    [onChange]
  );

  const handleEmojiSelect = React.useCallback(
    (emoji: string) => {
      onChange?.(createEmojiIcon(emoji));
      setOpen(false);
    },
    [onChange]
  );

  const handleImageSelect = React.useCallback(
    (imagePath: string) => {
      onChange?.(createImageIcon(imagePath));
      setOpen(false);
    },
    [onChange]
  );

  const handleRemove = React.useCallback(() => {
    onChange?.(null);
    setOpen(false);
  }, [onChange]);

  const handleRandom = React.useCallback(() => {
    // Spin animation
    setRandomSpin(true);
    setTimeout(() => setRandomSpin(false), 500);

    if (activeTab === "emoji") {
      const emoji = getRandomEmoji();
      onChange?.(createEmojiIcon(emoji));
    } else if (activeTab === "lucide") {
      const iconName = getRandomLucideIcon();
      onChange?.(createLucideIcon(iconName));
    }
    // Don't close popover — allow rapid re-rolls
  }, [activeTab, onChange]);

  // Current icon for display
  const currentIconValue = React.useMemo(() => {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    return value;
  }, [value]);

  const hasValue = !!value;

  // Tab visibility
  const showEmoji = allowedTypes.includes("emoji");
  const showLucide = allowedTypes.includes("lucide");
  const showImage = allowedTypes.includes("image");
  const showRandomBtn = showRandom && activeTab !== "image";
  const showRemoveBtn = allowRemove && hasValue;

  // Default trigger
  const defaultTrigger = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded-md border border-input bg-background p-2",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <IconDisplay icon={currentIconValue} size={iconSize} workspacePath={workspacePath} />
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger ?? defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="w-[352px] p-0" align={align} sideOffset={4}>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as IconType)}
          className="w-full"
        >
          {/* Tab bar with tools */}
          <TabsList className="w-full justify-between rounded-none p-0 h-auto">
            <div className="flex items-center">
              {showEmoji && (
                <TabsTrigger
                  value="emoji"
                  className="px-3 py-2 text-xs"
                >
                  {t("iconPicker.emoji", "Emoji")}
                </TabsTrigger>
              )}
              {showLucide && (
                <TabsTrigger
                  value="lucide"
                  className="px-3 py-2 text-xs"
                >
                  {t("iconPicker.icons", "Icons")}
                </TabsTrigger>
              )}
              {showImage && (
                <TabsTrigger
                  value="image"
                  className="px-3 py-2 text-xs"
                >
                  {t("iconPicker.image", "Image")}
                </TabsTrigger>
              )}
            </div>

            {/* Tool buttons */}
            <div className="flex items-center gap-0.5 px-2">
              {showRandomBtn && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 w-7 p-0", randomSpin && "animate-spin")}
                  onClick={handleRandom}
                  title={t("iconPicker.random", "Random")}
                >
                  <Dices className="h-3.5 w-3.5" />
                </Button>
              )}
              {showRemoveBtn && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={handleRemove}
                  title={t("iconPicker.remove", "Remove")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </TabsList>

          {/* Tab content */}
          {showEmoji && (
            <TabsContent value="emoji" className="mt-0">
              <EmojiTab onSelect={handleEmojiSelect} />
            </TabsContent>
          )}

          {showLucide && (
            <TabsContent value="lucide" className="mt-0">
              <LucideTab
                value={typeof value === "object" && value?.type === "lucide" ? value.value : undefined}
                onSelect={handleLucideSelect}
              />
            </TabsContent>
          )}

          {showImage && (
            <TabsContent value="image" className="mt-0">
              <ImageTab
                workspacePath={workspacePath}
                onSelect={handleImageSelect}
              />
            </TabsContent>
          )}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

export default IconPicker;
