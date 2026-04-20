/**
 * IconPicker Component
 *
 * Unified icon picker supporting:
 * - Lucide icons (categorized)
 * - Emoji (categorized)
 * - Custom images (upload or URL)
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LucideTab } from "./tabs/lucide-tab";
import { EmojiTab } from "./tabs/emoji-tab";
import { ImageTab } from "./tabs/image-tab";
import { IconDisplay } from "./icon-display";
import { createLucideIcon, createEmojiIcon, createImageIcon } from "./utils";
import type { IconData, IconType } from "./types";

export interface IconPickerProps {
  /** Current icon value */
  value?: IconData | string | null;
  /** Callback when icon changes */
  onChange?: (icon: IconData | null) => void;
  /** Workspace path for saving uploaded images */
  workspacePath?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Custom trigger element */
  trigger?: React.ReactNode;
  /** Popover alignment */
  align?: "start" | "center" | "end";
  /** Default tab to show */
  defaultTab?: IconType;
  /** Allowed icon types */
  allowedTypes?: IconType[];
  /** Additional CSS classes for the trigger */
  className?: string;
  /** Size of the icon in the trigger */
  iconSize?: "xs" | "sm" | "md" | "lg" | "xl" | number;
}

/**
 * IconPicker component
 *
 * A popover-based picker for selecting icons from various sources.
 */
export function IconPicker({
  value,
  onChange,
  workspacePath,
  disabled = false,
  trigger,
  align = "start",
  defaultTab = "lucide",
  allowedTypes = ["lucide", "emoji", "image"],
  className,
  iconSize = "md",
}: IconPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<IconType>(defaultTab);

  // Handle Lucide icon selection
  const handleLucideSelect = React.useCallback(
    (iconName: string) => {
      const iconData = createLucideIcon(iconName);
      onChange?.(iconData);
      setOpen(false);
    },
    [onChange]
  );

  // Handle Emoji selection
  const handleEmojiSelect = React.useCallback(
    (emoji: string) => {
      const iconData = createEmojiIcon(emoji);
      onChange?.(iconData);
      setOpen(false);
    },
    [onChange]
  );

  // Handle Image selection
  const handleImageSelect = React.useCallback(
    (imagePath: string) => {
      const iconData = createImageIcon(imagePath);
      onChange?.(iconData);
      setOpen(false);
    },
    [onChange]
  );

  // Get current icon value for display
  const currentIconValue = React.useMemo(() => {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    return value;
  }, [value]);

  // Default trigger button
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
      <IconDisplay
        icon={currentIconValue}
        size={iconSize}
        workspacePath={workspacePath}
      />
    </button>
  );

  // Filter tabs based on allowedTypes
  const showLucide = allowedTypes.includes("lucide");
  const showEmoji = allowedTypes.includes("emoji");
  const showImage = allowedTypes.includes("image");

  // Ensure activeTab is valid
  React.useEffect(() => {
    if (!allowedTypes.includes(activeTab)) {
      setActiveTab(allowedTypes[0] ?? "lucide");
    }
  }, [allowedTypes, activeTab]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger ?? defaultTrigger}
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-0"
        align={align}
        sideOffset={4}
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as IconType)}
          className="w-full"
        >
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            {showLucide && (
              <TabsTrigger
                value="lucide"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {t("iconPicker.icons", "Icons")}
              </TabsTrigger>
            )}
            {showEmoji && (
              <TabsTrigger
                value="emoji"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {t("iconPicker.emoji", "Emoji")}
              </TabsTrigger>
            )}
            {showImage && (
              <TabsTrigger
                value="image"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {t("iconPicker.image", "Image")}
              </TabsTrigger>
            )}
          </TabsList>

          {showLucide && (
            <TabsContent value="lucide" className="m-0">
              <LucideTab
                value={typeof value === "object" && value?.type === "lucide" ? value.value : undefined}
                onSelect={handleLucideSelect}
              />
            </TabsContent>
          )}

          {showEmoji && (
            <TabsContent value="emoji" className="m-0">
              <EmojiTab onSelect={handleEmojiSelect} />
            </TabsContent>
          )}

          {showImage && (
            <TabsContent value="image" className="m-0">
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
