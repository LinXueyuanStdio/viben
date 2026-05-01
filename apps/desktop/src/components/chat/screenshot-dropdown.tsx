/**
 * Screenshot Dropdown Component
 *
 * Shared dropdown menu for screenshot actions (direct, hide-window, region, window).
 * Used by both ChatPopup and DesktopChatInput via the toolbar extraActions slot.
 */

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Camera,
  ChevronDown,
  EyeOff,
  Crosshair,
  AppWindow,
  Monitor,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ScreenshotMonitorInfo } from "@/hooks/use-screenshot";

export interface ScreenshotDropdownProps {
  /** Take a screenshot (optionally hiding the window first) */
  takeScreenshot: (hideWindow?: boolean) => Promise<unknown>;
  /** Start a region screenshot on a specific monitor */
  startRegionScreenshot: (monitorId?: number) => Promise<void>;
  /** List available monitors for region screenshot */
  listMonitors: () => Promise<ScreenshotMonitorInfo[]>;
  /** List available windows */
  listWindows: () => Promise<{ id: number; title: string; app_name: string }[]>;
  /** Take a screenshot of a specific window */
  takeWindowScreenshot: (windowId: number) => Promise<unknown>;
  /** Whether a capture is currently in progress */
  isCapturing?: boolean;
  /** Called when dropdown open state changes (e.g., for parent close-guard) */
  onOpenChange?: (open: boolean) => void;
  /** Additional class for the trigger button */
  triggerClassName?: string;
  /** Z-index for the dropdown content */
  contentClassName?: string;
}

export function ScreenshotDropdown({
  takeScreenshot,
  startRegionScreenshot,
  listMonitors,
  listWindows,
  takeWindowScreenshot,
  isCapturing = false,
  onOpenChange,
  triggerClassName,
  contentClassName,
}: ScreenshotDropdownProps) {
  const { t } = useTranslation();
  const [monitors, setMonitors] = useState<ScreenshotMonitorInfo[]>([]);

  const handleOpenChange = useCallback(
    async (open: boolean) => {
      onOpenChange?.(open);
      if (open) {
        const result = await listMonitors();
        setMonitors(result);
      }
    },
    [onOpenChange, listMonitors],
  );

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isCapturing}
          className={cn(
            "h-7 flex items-center gap-0.5 rounded-full px-1.5",
            "hover:bg-muted/80 transition-colors",
            "text-muted-foreground hover:text-foreground",
            isCapturing && "opacity-50 cursor-not-allowed",
            triggerClassName,
          )}
          title={t("chat.screenshot", "截图")}
        >
          {isCapturing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={contentClassName}>
        <DropdownMenuItem onClick={() => takeScreenshot(false)}>
          <Camera className="h-4 w-4 mr-2" />
          {t("chat.screenshotDirect", "直接截图")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => takeScreenshot(true)}>
          <EyeOff className="h-4 w-4 mr-2" />
          {t("chat.screenshotHideWindow", "隐藏窗口截图")}
        </DropdownMenuItem>
        {monitors.length > 1 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Crosshair className="h-4 w-4 mr-2" />
              {t("chat.screenshotRegion", "区域截图")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className={contentClassName}>
              {monitors.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => startRegionScreenshot(m.id)}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  {m.name || `Monitor ${m.id}`}
                  {m.is_primary ? ` (${t("chat.primary", "主显示器")})` : ""}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {m.width}×{m.height}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <DropdownMenuItem onClick={() => startRegionScreenshot()}>
            <Crosshair className="h-4 w-4 mr-2" />
            {t("chat.screenshotRegion", "区域截图")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={async () => {
            const windows = await listWindows();
            if (windows.length > 0) {
              await takeWindowScreenshot(windows[0].id);
            }
          }}
        >
          <AppWindow className="h-4 w-4 mr-2" />
          {t("chat.screenshotWindow", "窗口截图")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
