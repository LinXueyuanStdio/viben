/**
 * Writing Mode Component
 *
 * Fullscreen writing mode dialog for focused message composition.
 */

import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Smile,
  Paperclip,
  Camera,
  ChevronDown,
  EyeOff,
  Loader2,
  Send,
  Square,
  Bot,
  Cpu,
  Check,
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
import { AttachmentPreview } from "./attachment-preview";
import type { MessageAttachment } from "../types";
import type { AgentOption, ModelOption } from "./types";

export interface WritingModeProps {
  /** Whether writing mode is open */
  isOpen: boolean;
  /** Close writing mode */
  onClose: () => void;
  /** Current content */
  content: string;
  /** Set content */
  onContentChange: (content: string) => void;
  /** Attachments */
  attachments: MessageAttachment[];
  /** Remove attachment */
  onRemoveAttachment: (id: string) => void;
  /** Handle send */
  onSend: () => void;
  /** Handle cancel */
  onCancel?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Can submit */
  canSubmit: boolean;
  /** Placeholder */
  placeholder?: string;
  /** Emoji select handler */
  onEmojiSelect: (emoji: string) => void;
  /** Render the picker shown inside the emoji popover. Writing mode does not own a picker implementation. */
  renderEmojiPicker?: (props: { onSelect: (emoji: string) => void }) => React.ReactNode;
  /** File click handler */
  onFileClick: () => void;
  /** Screenshot handler */
  onScreenshot?: (hideWindow?: boolean) => void;
  /** Whether screenshot is capturing */
  isScreenshotCapturing?: boolean;
  /** Handle key down */
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Handle composition start */
  onCompositionStart: () => void;
  /** Handle composition end */
  onCompositionEnd: () => void;
  /** Handle paste */
  onPaste: (e: React.ClipboardEvent) => void;
  /** Show config bar */
  showConfigBar?: boolean;
  /** Agent options */
  agents?: AgentOption[];
  /** Selected agent ID */
  selectedAgentId?: string | null;
  /** Agent change handler */
  onAgentChange?: (agentId: string) => void;
  /** Show agent selector */
  showAgentSelector?: boolean;
  /** Model options */
  models?: ModelOption[];
  /** Selected model ID */
  selectedModelId?: string | null;
  /** Model change handler */
  onModelChange?: (modelId: string) => void;
  /** Show model selector */
  showModelSelector?: boolean;
  /** Textarea ref */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Additional className */
  className?: string;
}

export function WritingMode({
  isOpen,
  onClose,
  content,
  onContentChange,
  attachments,
  onRemoveAttachment,
  onSend,
  onCancel,
  isLoading,
  disabled,
  canSubmit,
  placeholder,
  onEmojiSelect,
  renderEmojiPicker,
  onFileClick,
  onScreenshot,
  isScreenshotCapturing,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onPaste,
  showConfigBar,
  agents = [],
  selectedAgentId,
  onAgentChange,
  showAgentSelector,
  models = [],
  selectedModelId,
  onModelChange,
  showModelSelector,
  textareaRef,
  className,
}: WritingModeProps) {
  const { t } = useTranslation();
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleEmojiSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    setIsEmojiOpen(false);
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedModel = models.find((m) => m.id === selectedModelId);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      {/* Writing mode container */}
      <div
        className={cn(
          "fixed inset-4 z-50 flex flex-col bg-background rounded-xl border border-border shadow-2xl",
          className
        )}
      >
        {/* Top: Toolbar + Close button */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
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
                        className="h-9 w-9 p-0"
                        disabled={isLoading || disabled}
                      >
                        <Smile className="h-5 w-5" />
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

            {/* File */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    disabled={isLoading || disabled}
                    onClick={onFileClick}
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t("chat.attachFile", "Attach File")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Screenshot */}
            {onScreenshot && (
              <DropdownMenu>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2 gap-1"
                          disabled={isLoading || disabled || isScreenshotCapturing}
                        >
                          {isScreenshotCapturing ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Camera className="h-5 w-5" />
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
          </div>

          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Attachment Preview */}
        <AttachmentPreview
          attachments={attachments}
          onRemove={onRemoveAttachment}
          className="px-4 py-3 border-b border-border/30"
        />

        {/* Middle: Large textarea */}
        <div className="flex-1 p-4 min-h-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onKeyDown={onKeyDown}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            onPaste={onPaste}
            placeholder={placeholder || t("chat.inputPlaceholder")}
            className="w-full h-full resize-none border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-lg leading-relaxed"
            disabled={isLoading || disabled}
            autoFocus
          />
        </div>

        {/* Bottom: Config bar or simple send button */}
        {showConfigBar ? (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/30">
            <div className="flex items-center gap-2">
              {/* Agent Selector */}
              {showAgentSelector && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 gap-1.5"
                      disabled={isLoading || disabled}
                    >
                      <Bot className="h-4 w-4" />
                      <span className="max-w-[100px] truncate">
                        {selectedAgent?.name || t("chat.selectAgent", "Agent")}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start">
                    {agents.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        {t("chat.noAgents", "No agents")}
                      </div>
                    ) : (
                      agents.map((agent) => (
                        <Button
                          key={agent.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-8"
                          onClick={() => onAgentChange?.(agent.id)}
                        >
                          {agent.id === selectedAgentId && (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span
                            className={agent.id !== selectedAgentId ? "ml-5" : ""}
                          >
                            {agent.name}
                          </span>
                        </Button>
                      ))
                    )}
                  </PopoverContent>
                </Popover>
              )}

              {/* Model Selector */}
              {showModelSelector && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 gap-1.5"
                      disabled={isLoading || disabled}
                    >
                      <Cpu className="h-4 w-4" />
                      <span className="max-w-[100px] truncate">
                        {selectedModel?.name || t("chat.selectModel", "Model")}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" align="start">
                    {models.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        {t("chat.noModels", "No models")}
                      </div>
                    ) : (
                      models.map((model) => (
                        <Button
                          key={model.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-8"
                          onClick={() => onModelChange?.(model.id)}
                        >
                          {model.id === selectedModelId && (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span
                            className={model.id !== selectedModelId ? "ml-5" : ""}
                          >
                            {model.name}
                          </span>
                        </Button>
                      ))
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Send/Stop Button */}
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-9 px-4"
                  onClick={onCancel}
                >
                  <Square className="h-4 w-4 mr-2" />
                  {t("common.stop", "Stop")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-9 px-4"
                  disabled={!canSubmit}
                  onClick={onSend}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {t("chat.send", "Send")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end px-4 py-3 border-t border-border/50">
            {isLoading ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-9 px-4"
                onClick={onCancel}
              >
                <Square className="h-4 w-4 mr-2" />
                {t("common.stop", "Stop")}
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-9 px-4"
                disabled={!canSubmit}
                onClick={onSend}
              >
                <Send className="h-4 w-4 mr-2" />
                {t("chat.send", "Send")}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
