/**
 * ChatInput Top Toolbar Component
 *
 * Top toolbar with emoji picker, file attachment, screenshot, expand buttons,
 * and optional task/background task popup triggers.
 */

import type { ReactNode } from "react";
import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Smile,
  Paperclip,
  Camera,
  Maximize2,
  ChevronDown,
  EyeOff,
  Loader2,
  ListTodo,
  Clock3,
} from "lucide-react";
import {
  cn,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@viben/ui";
import type { TodoListItem } from "../todo-list/types";
import type { BackgroundTaskItem } from "../background-task-list/types";

export interface TasksSummary {
  items: TodoListItem[];
  completedCount: number;
  totalCount: number;
}

export interface BackgroundTasksSummary {
  items: BackgroundTaskItem[];
  runningCount: number;
  totalCount: number;
}

export interface ChatInputTopToolbarProps {
  /** Callback when emoji is selected */
  onEmojiSelect: (emoji: string) => void;
  /** Render the picker shown inside the emoji popover. Toolbar does not own a picker implementation. */
  renderEmojiPicker?: (props: { onSelect: (emoji: string) => void }) => ReactNode;
  /** Callback when file button is clicked */
  onFileClick: () => void;
  /** Callback when screenshot is requested. If undefined, screenshot button is hidden */
  onScreenshot?: (hideWindow?: boolean) => void;
  /** Callback when expand button is clicked */
  onExpandClick?: () => void;
  /** Whether the chat is loading */
  isLoading?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether screenshot is currently being captured */
  isScreenshotCapturing?: boolean;
  /** Whether to show the expand button */
  showExpand?: boolean;
  /** Extra action buttons to render after the built-in actions (emoji, file, screenshot) */
  extraActions?: ReactNode;
  /** Extra action buttons to render at the trailing edge of the toolbar */
  endActions?: ReactNode;
  /** Fully custom toolbar content. */
  children?: ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Tasks summary for displaying task button */
  tasksSummary?: TasksSummary;
  /** Background tasks summary for displaying background tasks button */
  backgroundTasksSummary?: BackgroundTasksSummary;
  /** Render custom tasks popup content */
  renderTasksPopup?: () => ReactNode;
  /** Render custom background tasks popup content */
  renderBackgroundTasksPopup?: () => ReactNode;
}

export function ChatInputTopToolbar({
  onEmojiSelect,
  renderEmojiPicker,
  onFileClick,
  onScreenshot,
  onExpandClick,
  isLoading,
  disabled,
  isScreenshotCapturing,
  showExpand,
  extraActions,
  endActions,
  children,
  className,
  tasksSummary,
  backgroundTasksSummary,
  renderTasksPopup,
  renderBackgroundTasksPopup,
}: ChatInputTopToolbarProps) {
  const { t } = useTranslation();
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isTasksHovered, setIsTasksHovered] = useState(false);
  const [isBackgroundTasksHovered, setIsBackgroundTasksHovered] = useState(false);
  const tasksHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundTasksHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      onEmojiSelect(emoji);
      setIsEmojiOpen(false);
    },
    [onEmojiSelect]
  );

  const handleTasksMouseEnter = useCallback(() => {
    if (tasksHoverTimeoutRef.current) {
      clearTimeout(tasksHoverTimeoutRef.current);
    }
    setIsTasksHovered(true);
  }, []);

  const handleTasksMouseLeave = useCallback(() => {
    tasksHoverTimeoutRef.current = setTimeout(() => {
      setIsTasksHovered(false);
    }, 150);
  }, []);

  const handleBackgroundTasksMouseEnter = useCallback(() => {
    if (backgroundTasksHoverTimeoutRef.current) {
      clearTimeout(backgroundTasksHoverTimeoutRef.current);
    }
    setIsBackgroundTasksHovered(true);
  }, []);

  const handleBackgroundTasksMouseLeave = useCallback(() => {
    backgroundTasksHoverTimeoutRef.current = setTimeout(() => {
      setIsBackgroundTasksHovered(false);
    }, 150);
  }, []);

  const showTasksButton = tasksSummary && tasksSummary.totalCount > 0;
  const showBackgroundTasksButton = backgroundTasksSummary && backgroundTasksSummary.totalCount > 0;

  return (
    <div
      ref={toolbarRef}
      data-testid="chat-input-toolbar"
      className={cn(
        "relative flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/30",
        className
      )}
    >
      {children ?? (
        <>
      <div className="flex items-center gap-1">
        {/* Emoji */}
        <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={isLoading || disabled}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("chat.emoji", "Emoji")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {renderEmojiPicker && (
            <PopoverContent className="w-auto p-2" align="start">
              {renderEmojiPicker({ onSelect: handleEmojiSelect })}
            </PopoverContent>
          )}
        </Popover>

        {/* File Attachment */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isLoading || disabled}
                onClick={onFileClick}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("chat.attachFile", "Attach File")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Screenshot - only shown if onScreenshot is provided */}
        {onScreenshot && (
          <DropdownMenu>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 gap-1"
                      disabled={isLoading || disabled || isScreenshotCapturing}
                    >
                      {isScreenshotCapturing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {t("chat.screenshot", "Screenshot")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onScreenshot(false)}>
                <Camera className="h-4 w-4 mr-2" />
                {t("chat.screenshotDirect", "Direct Screenshot")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onScreenshot(true)}>
                <EyeOff className="h-4 w-4 mr-2" />
                {t("chat.screenshotHideWindow", "Hide Window & Screenshot")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Extra actions slot for platform-specific buttons */}
        {extraActions}
      </div>

      <div className="flex items-center gap-1">
        {/* Tasks Button */}
        {showTasksButton && (
          <div
            onMouseEnter={handleTasksMouseEnter}
            onMouseLeave={handleTasksMouseLeave}
          >
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs font-normal"
                  >
                    <ListTodo className="h-3.5 w-3.5" />
                    <span>
                      {t("chat.tasks", "Tasks")} ({tasksSummary.completedCount}/{tasksSummary.totalCount})
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t("chat.tasks.tooltip", "View tasks")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Tasks Popup - positioned relative to toolbar, full width and centered */}
        {isTasksHovered && renderTasksPopup && (
          <div
            className="absolute left-0 right-0 bottom-full z-50 mb-1 px-2"
            onMouseEnter={handleTasksMouseEnter}
            onMouseLeave={handleTasksMouseLeave}
          >
            <div className="mx-auto max-w-full">
              {renderTasksPopup()}
            </div>
          </div>
        )}

        {/* Background Tasks Button */}
        {showBackgroundTasksButton && (
          <div
            onMouseEnter={handleBackgroundTasksMouseEnter}
            onMouseLeave={handleBackgroundTasksMouseLeave}
          >
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs font-normal"
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>
                      {t("chat.backgroundTasks", "Background Tasks")} ({backgroundTasksSummary.totalCount})
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t("chat.backgroundTasks.tooltip", "View background tasks")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Background Tasks Popup - positioned relative to toolbar, full width and centered */}
        {isBackgroundTasksHovered && renderBackgroundTasksPopup && (
          <div
            className="absolute left-0 right-0 bottom-full z-50 mb-1 px-2"
            onMouseEnter={handleBackgroundTasksMouseEnter}
            onMouseLeave={handleBackgroundTasksMouseLeave}
          >
            <div className="mx-auto max-w-full">
              {renderBackgroundTasksPopup()}
            </div>
          </div>
        )}

        {endActions}

        {/* Expand Button */}
        {showExpand && onExpandClick && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={onExpandClick}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("chat.expand", "Expand")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
        </>
      )}
    </div>
  );
}
