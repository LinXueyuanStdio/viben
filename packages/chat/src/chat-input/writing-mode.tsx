/**
 * Writing Mode components
 *
 * Controlled building blocks for focused message composition. ChatInput owns the
 * state and passes it in; consumers can either use the composed WritingMode or
 * assemble their own page from the exported parts.
 */

import * as React from "react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Camera,
  ChevronDown,
  EyeOff,
  Loader2,
  Paperclip,
  Send,
  Smile,
  Square,
  X,
} from "lucide-react";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@viben/ui";
import { AttachmentPreview } from "./attachment-preview";
import type { MessageAttachment } from "../types";
import type { ChatInputWritingModeRenderProps } from "./types";

export interface WritingModeRootProps {
  isOpen?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
}

export function WritingModeRoot({
  isOpen = true,
  onClose,
  children,
  className,
  backdropClassName,
}: WritingModeRootProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className={cn("fixed inset-0 z-40 bg-background/80 backdrop-blur-sm", backdropClassName)}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-4 z-50 flex flex-col rounded-xl border border-border bg-background shadow-2xl",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

export interface WritingModeHeaderProps {
  children?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
}

export function WritingModeHeader({
  children,
  onClose,
  closeLabel,
  className,
}: WritingModeHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex items-center justify-between border-b border-border/50 px-4 py-3", className)}>
      <div className="flex items-center gap-1">{children}</div>
      {onClose && (
        <Button
          aria-label={closeLabel ?? t("chat.writingMode.close", "Close writing mode")}
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}

export interface WritingModeToolbarProps {
  onEmojiSelect: (emoji: string) => void;
  renderEmojiPicker?: (props: { onSelect: (emoji: string) => void }) => React.ReactNode;
  onFileClick: () => void;
  onScreenshot?: (hideWindow?: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
  isScreenshotCapturing?: boolean;
  className?: string;
}

export function WritingModeToolbar({
  onEmojiSelect,
  renderEmojiPicker,
  onFileClick,
  onScreenshot,
  isLoading,
  disabled,
  isScreenshotCapturing,
  className,
}: WritingModeToolbarProps) {
  const { t } = useTranslation();
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      onEmojiSelect(emoji);
      setIsEmojiOpen(false);
    },
    [onEmojiSelect]
  );

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  aria-label={t("chat.emoji", "Emoji")}
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

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={t("chat.attachFile", "Attach File")}
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              disabled={isLoading || disabled}
              onClick={onFileClick}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("chat.attachFile", "Attach File")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {onScreenshot && (
        <DropdownMenu>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={t("chat.screenshot", "Screenshot")}
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1 px-2"
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
              <TooltipContent>{t("chat.screenshot", "Screenshot")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onScreenshot(false)}>
              <Camera className="mr-2 h-4 w-4" />
              {t("chat.screenshotDirect", "Direct Screenshot")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onScreenshot(true)}>
              <EyeOff className="mr-2 h-4 w-4" />
              {t("chat.screenshotHideWindow", "Hide Window & Screenshot")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export interface WritingModeAttachmentsProps {
  attachments: MessageAttachment[];
  onRemove: (id: string) => void;
  className?: string;
}

export function WritingModeAttachments({
  attachments,
  onRemove,
  className,
}: WritingModeAttachmentsProps) {
  return (
    <AttachmentPreview
      attachments={attachments}
      onRemove={onRemove}
      className={cn("border-b border-border/30 px-4 py-3", className)}
    />
  );
}

export interface WritingModeEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onPaste: (event: React.ClipboardEvent) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  textareaClassName?: string;
}

export function WritingModeEditor({
  content,
  onContentChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onPaste,
  textareaRef,
  placeholder,
  isLoading,
  disabled,
  className,
  textareaClassName,
}: WritingModeEditorProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("min-h-0 flex-1 p-4", className)}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        onKeyDown={onKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onPaste={onPaste}
        placeholder={placeholder || t("chat.inputPlaceholder")}
        className={cn(
          "h-full w-full resize-none border-0 bg-transparent text-lg leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none",
          textareaClassName
        )}
        disabled={isLoading || disabled}
        autoFocus
      />
    </div>
  );
}

export interface WritingModeSubmitControlProps {
  onSend: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  canSubmit: boolean;
  className?: string;
}

export function WritingModeSubmitControl({
  onSend,
  onCancel,
  isLoading,
  canSubmit,
  className,
}: WritingModeSubmitControlProps) {
  const { t } = useTranslation();

  return isLoading ? (
    <Button
      size="sm"
      variant="destructive"
      className={cn("h-9 px-4", className)}
      onClick={onCancel}
    >
      <Square className="mr-2 h-4 w-4" />
      {t("common.stop", "Stop")}
    </Button>
  ) : (
    <Button
      size="sm"
      className={cn("h-9 px-4", className)}
      disabled={!canSubmit}
      onClick={onSend}
    >
      <Send className="mr-2 h-4 w-4" />
      {t("chat.send", "Send")}
    </Button>
  );
}

export interface WritingModeFooterProps {
  showConfigBar?: boolean;
  configControls?: React.ReactNode;
  submitControl: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function WritingModeFooter({
  showConfigBar,
  configControls,
  submitControl,
  children,
  className,
}: WritingModeFooterProps) {
  if (children) {
    return (
      <div className={cn("border-t border-border/50 px-4 py-3", className)}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center border-t border-border/50 px-4 py-3",
        showConfigBar ? "justify-between bg-muted/30" : "justify-end",
        className
      )}
    >
      {showConfigBar && <div className="flex min-w-0 items-center gap-2">{configControls}</div>}
      <div className="flex items-center gap-2">{submitControl}</div>
    </div>
  );
}

export type WritingModeProps = ChatInputWritingModeRenderProps;

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
  textareaRef,
  configControls,
  className,
}: WritingModeProps) {
  return (
    <WritingModeRoot isOpen={isOpen} onClose={onClose} className={className}>
      <WritingModeHeader onClose={onClose}>
        <WritingModeToolbar
          onEmojiSelect={onEmojiSelect}
          renderEmojiPicker={renderEmojiPicker}
          onFileClick={onFileClick}
          onScreenshot={onScreenshot}
          isLoading={isLoading}
          disabled={disabled}
          isScreenshotCapturing={isScreenshotCapturing}
        />
      </WritingModeHeader>

      <WritingModeAttachments
        attachments={attachments}
        onRemove={onRemoveAttachment}
      />

      <WritingModeEditor
        content={content}
        onContentChange={onContentChange}
        onKeyDown={onKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onPaste={onPaste}
        textareaRef={textareaRef}
        placeholder={placeholder}
        isLoading={isLoading}
        disabled={disabled}
      />

      <WritingModeFooter
        showConfigBar={showConfigBar}
        configControls={configControls}
        submitControl={(
          <WritingModeSubmitControl
            onSend={onSend}
            onCancel={onCancel}
            isLoading={isLoading}
            canSubmit={canSubmit}
          />
        )}
      />
    </WritingModeRoot>
  );
}
