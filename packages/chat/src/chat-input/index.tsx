/**
 * Unified Chat Input Component
 *
 * A flexible, platform-agnostic chat input that supports multiple configurations via props.
 * Platform-specific features (screenshot, file dialog) are handled via callback props.
 *
 * Base functionality (always present):
 * - Auto-resizing textarea (40-200px)
 * - Attachment preview area
 * - Bottom action bar with add button and send button
 * - IME composition handling
 * - Paste image support
 *
 * Features controlled by props:
 * - showTopToolbar: Emoji, File, Screenshot, Expand buttons above textarea
 * - showConfigBar: Agent, Model, Tools, Skills, Context selectors (replaces basic bottom bar)
 * - showResizeHandle: Draggable height adjustment
 * - enableWritingMode: Fullscreen writing mode
 */

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Send,
  Plus,
  Paperclip,
  Image,
  Square,
  Shield,
} from "lucide-react";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@viben/ui";

import { ChatInputToolbar } from "./toolbar";
import { ChatInputConfigBar } from "./config-bar";
import { AttachmentPreview } from "./attachment-preview";
import { SlashCommandMenu } from "./slash-command-menu";
import { WritingMode } from "./writing-mode";
import { HighlightedInput } from "./highlighted-input";
import {
  useAttachments,
  useSlashCommands,
  useResizableHeight,
  useIMEComposition,
  useAutoFocus,
} from "./hooks";
import type { ChatInputProps } from "./types";

export function ChatInput({
  // Basic Props
  onSend,
  onCancel,
  isLoading,
  allowSendWhileLoading,
  disabled,
  blockedReason,
  placeholder,
  className,
  autoFocus = false,
  // Layout Control
  showTopToolbar = false,
  showConfigBar = false,
  showResizeHandle = false,
  enableWritingMode = false,
  // Selector Visibility Override
  hideAgentSelector = false,
  hideModelSelector = false,
  hideExecutorSelector = false,
  // Agent/Model/Executor
  agents = [],
  selectedAgentId = null,
  onAgentChange,
  onAgentSettings,
  models = [],
  selectedModelId = null,
  onModelChange,
  executors = [],
  selectedExecutor = "CLAUDE_CODE",
  onExecutorChange,
  // Tools/Skills
  tools = [],
  onToggleTool,
  enabledToolsCount = 0,
  onToolsClick,
  skills = [],
  onToggleSkill,
  enabledSkillsCount = 0,
  onSkillsClick,
  // Context
  contextTokens = 0,
  contextBreakdown,
  onContextClick,
  // Platform-specific callbacks
  onScreenshot,
  onOpenFile,
  onPaste: customOnPaste,
  // Slash Commands
  slashCommands = [],
  onSlashCommand,
  // Custom Content Slots
  configBarLeftExtra,
}: ChatInputProps) {
  const { t } = useTranslation();

  // State
  const [content, setContent] = useState("");
  const [isWritingMode, setIsWritingMode] = useState(false);
  const [isScreenshotCapturing, setIsScreenshotCapturing] = useState(false);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hooks
  const {
    attachments,
    addFiles,
    addAttachment,
    removeAttachment,
    clearAttachments,
    isAnyLoading,
  } = useAttachments();

  const {
    isOpen: isSlashMenuOpen,
    query: slashQuery,
    selectedIndex: slashSelectedIndex,
    filteredCommands,
    handleContentChange: handleSlashContentChange,
    handleSelect: handleSlashSelect,
    handleKeyDown: handleSlashKeyDown,
  } = useSlashCommands({
    commands: slashCommands,
    onSelect: (command) => {
      setContent("");
      onSlashCommand?.(command);
      textareaRef.current?.focus();
    },
    enabled: slashCommands.length > 0 && !!onSlashCommand,
  });

  const { height: inputHeight, handleResizeStart } = useResizableHeight({
    enabled: showResizeHandle,
  });

  const {
    isComposing,
    handleCompositionStart,
    handleCompositionEnd,
  } = useIMEComposition();

  useAutoFocus(textareaRef, {
    autoFocus,
    focusOnLoadComplete: true,
    isLoading,
  });

  // Determine if we have toolbar/config bar features enabled
  const hasToolbar = showTopToolbar || showConfigBar || showResizeHandle;

  // Determine selector visibility
  const shouldShowAgentSelector = !hideAgentSelector;
  const shouldShowModelSelector = !hideModelSelector;
  const shouldShowExecutorSelector = !hideExecutorSelector && executors.length > 0 && !!onExecutorChange;

  // Auto-resize textarea based on content (only for non-toolbar mode)
  useEffect(() => {
    if (hasToolbar && !isWritingMode) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Calculate the new height (min 40px, max 200px)
    const maxHeight = 200;
    const minHeight = 40;
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

    textarea.style.height = `${newHeight}px`;

    // Enable/disable overflow based on content height
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [content, hasToolbar, isWritingMode]);

  // Content change handler
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      handleSlashContentChange(newContent);
    },
    [handleSlashContentChange]
  );

  // Paste handler
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      // Try custom paste handler first
      if (customOnPaste) {
        const attachments = await customOnPaste(e);
        if (attachments && attachments.length > 0) {
          e.preventDefault();
          attachments.forEach((a) => addAttachment(a));
          return;
        }
      }

      // Default paste handling for images
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await addFiles(imageFiles, true);
      }
    },
    [customOnPaste, addAttachment, addFiles]
  );

  // File input handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files, true);
      e.target.value = "";
    }
  };

  // File button click handler
  const handleFileClick = useCallback(async () => {
    if (onOpenFile) {
      const attachments = await onOpenFile();
      if (attachments && attachments.length > 0) {
        attachments.forEach((a) => addAttachment(a));
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [onOpenFile, addAttachment]);

  // Screenshot handler
  const handleScreenshot = useCallback(
    async (hideWindow?: boolean) => {
      if (!onScreenshot) return;

      setIsScreenshotCapturing(true);
      try {
        const attachment = await onScreenshot(hideWindow);
        if (attachment) {
          addAttachment(attachment);
        }
      } catch (error) {
        console.error("[ChatInput] Screenshot failed:", error);
      } finally {
        setIsScreenshotCapturing(false);
      }
    },
    [onScreenshot, addAttachment]
  );

  // Emoji insert handler
  const insertEmoji = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setContent((prev) => prev + emoji);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + emoji + content.substring(end);
      setContent(newContent);

      // Set cursor position after emoji
      requestAnimationFrame(() => {
        if (textarea) {
          const newPosition = start + emoji.length;
          textarea.setSelectionRange(newPosition, newPosition);
          textarea.focus();
        }
      });
    },
    [content]
  );

  // Submit validation
  const canSubmit =
    (content.trim().length > 0 || attachments.length > 0) &&
    !disabled &&
    !isAnyLoading;

  // Send handler
  const handleSend = useCallback(() => {
    if (!canSubmit || (isLoading && !allowSendWhileLoading)) {
      return;
    }

    const text = content.trim();
    const messageAttachments = attachments.length > 0 ? attachments : undefined;

    // Clear state first
    setContent("");
    clearAttachments();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Call onSend
    onSend(text, messageAttachments);
  }, [canSubmit, isLoading, allowSendWhileLoading, content, attachments, clearAttachments, onSend]);

  // Key down handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle slash command navigation first
      if (handleSlashKeyDown(e)) {
        return;
      }

      // Don't send on Enter during IME composition
      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
        handleSend();
      }

      // Exit writing mode with Escape
      if (e.key === "Escape" && isWritingMode) {
        setIsWritingMode(false);
      }
    },
    [handleSlashKeyDown, isComposing, handleSend, isWritingMode]
  );

  // Render fullscreen writing mode
  if (isWritingMode && enableWritingMode) {
    return (
      <>
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.pptx,.ppt"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
          multiple
        />

        <WritingMode
          isOpen={isWritingMode}
          onClose={() => setIsWritingMode(false)}
          content={content}
          onContentChange={setContent}
          attachments={attachments}
          onRemoveAttachment={removeAttachment}
          onSend={handleSend}
          onCancel={onCancel}
          isLoading={isLoading}
          disabled={disabled}
          canSubmit={canSubmit}
          placeholder={placeholder}
          onEmojiSelect={insertEmoji}
          onFileClick={handleFileClick}
          onScreenshot={onScreenshot ? handleScreenshot : undefined}
          isScreenshotCapturing={isScreenshotCapturing}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={handlePaste}
          showConfigBar={showConfigBar}
          agents={agents}
          selectedAgentId={selectedAgentId}
          onAgentChange={onAgentChange}
          showAgentSelector={shouldShowAgentSelector}
          models={models}
          selectedModelId={selectedModelId}
          onModelChange={onModelChange}
          showModelSelector={shouldShowModelSelector}
          textareaRef={textareaRef}
          className={className}
        />
      </>
    );
  }

  // Render unified input (with optional toolbar/config bar)
  return (
    <div
      ref={containerRef}
      className={cn("w-full bg-background", className)}
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.pptx,.ppt"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
        multiple
      />

      {/* Resize handle */}
      {showResizeHandle && (
        <div
          className="h-1 cursor-ns-resize hover:bg-primary/20 transition-colors"
          onMouseDown={handleResizeStart}
        />
      )}

      {/* Top Toolbar */}
      {showTopToolbar && (
        <ChatInputToolbar
          onEmojiSelect={insertEmoji}
          onFileClick={handleFileClick}
          onScreenshot={onScreenshot ? handleScreenshot : undefined}
          onExpandClick={enableWritingMode ? () => setIsWritingMode(true) : undefined}
          isLoading={isLoading}
          disabled={disabled}
          isScreenshotCapturing={isScreenshotCapturing}
          showExpand={enableWritingMode}
        />
      )}

      {/* Attachment Preview */}
      <AttachmentPreview
        attachments={attachments}
        onRemove={removeAttachment}
      />

      {/* Blocked reason indicator */}
      {disabled && blockedReason && (
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border-b border-border/40">
          <Shield className="size-3 text-amber-500" />
          <span>{blockedReason}</span>
        </div>
      )}

      {/* Textarea with Slash Command Menu */}
      <div
        className={cn("px-3 relative", !hasToolbar && "py-3")}
        style={hasToolbar ? { height: inputHeight } : undefined}
      >
        {/* Slash Command Menu */}
        <SlashCommandMenu
          commands={filteredCommands}
          selectedIndex={slashSelectedIndex}
          onSelect={handleSlashSelect}
          onHover={() => {
            // Update selected index on hover - handled internally by slash command hook
          }}
          isOpen={isSlashMenuOpen}
          query={slashQuery}
          anchorRef={containerRef as React.RefObject<HTMLElement>}
        />

        <HighlightedInput
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={handlePaste}
          placeholder={placeholder || t("chat.inputPlaceholder")}
          highlightSlashCommand={slashCommands.length > 0}
          isSlashMenuOpen={isSlashMenuOpen}
          className={cn(
            "w-full resize-none border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none",
            hasToolbar ? "h-full py-3 text-base" : "text-base"
          )}
          style={
            !hasToolbar
              ? {
                  minHeight: "40px",
                  maxHeight: "200px",
                  overflowY: "hidden",
                }
              : undefined
          }
          rows={1}
          disabled={(isLoading && !allowSendWhileLoading) || disabled}
        />
      </div>

      {/* Bottom Config Bar (when enabled) */}
      {showConfigBar && (
        <ChatInputConfigBar
          agents={agents}
          selectedAgentId={selectedAgentId}
          onAgentChange={onAgentChange}
          onAgentSettings={onAgentSettings}
          showAgentSelector={shouldShowAgentSelector}
          models={models}
          selectedModelId={selectedModelId}
          onModelChange={onModelChange}
          showModelSelector={shouldShowModelSelector}
          executors={executors}
          selectedExecutor={selectedExecutor}
          onExecutorChange={onExecutorChange}
          showExecutorSelector={shouldShowExecutorSelector}
          tools={tools}
          onToggleTool={onToggleTool}
          enabledToolsCount={enabledToolsCount}
          onToolsClick={onToolsClick}
          skills={skills}
          onToggleSkill={onToggleSkill}
          enabledSkillsCount={enabledSkillsCount}
          onSkillsClick={onSkillsClick}
          contextTokens={contextTokens}
          contextBreakdown={contextBreakdown}
          onContextClick={onContextClick}
          onSend={handleSend}
          onCancel={onCancel}
          isLoading={isLoading}
          disabled={disabled}
          canSubmit={canSubmit}
          allowSendWhileLoading={allowSendWhileLoading}
          leftExtraContent={configBarLeftExtra}
        />
      )}

      {/* Bottom Actions (when no config bar) */}
      {!showConfigBar && (
        <div
          className={cn(
            "flex items-center justify-between px-4",
            hasToolbar ? "py-2" : "pb-3"
          )}
        >
          {/* Add Button with Dropdown */}
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={isLoading || disabled}
                className={cn(
                  "flex items-center justify-center transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                  "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground size-8 rounded-full border"
                )}
              >
                <Plus className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="z-50 w-56">
                <DropdownMenuItem
                  onSelect={() => imageInputRef.current?.click()}
                  className="cursor-pointer gap-3 py-2.5"
                >
                  <Image className="size-4" />
                  <span>{t("chat.attachImage")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleFileClick}
                  className="cursor-pointer gap-3 py-2.5"
                >
                  <Paperclip className="size-4" />
                  <span>{t("chat.attachFile")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Submit/Stop Button */}
          <div className="flex items-center gap-1">
            {isLoading ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
              >
                <Square className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSubmit}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-all",
                  canSubmit
                    ? "bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export types and sub-components for consumers
export type { ChatInputProps, AgentOption, ModelOption, ExecutorOption, GlobalChatConfig, ChatConfigVisibility } from "./types";
export { ChatInputToolbar } from "./toolbar";
export { ChatInputConfigBar } from "./config-bar";
export { AttachmentPreview } from "./attachment-preview";
export { SlashCommandMenu } from "./slash-command-menu";
export { WritingMode } from "./writing-mode";
export { HighlightedInput } from "./highlighted-input";
export {
  useAttachments,
  useSlashCommands,
  useResizableHeight,
  useIMEComposition,
  useAutoFocus,
} from "./hooks";
