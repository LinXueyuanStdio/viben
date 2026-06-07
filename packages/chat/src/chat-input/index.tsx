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
 * - showTopToolbar: Emoji/File/Screenshot/Expand toolbar
 * - showConfigBar: Agent, Model, Tools, Skills, Context selectors and send button
 * - showResizeHandle: Draggable height adjustment
 * - enableWritingMode: Fullscreen writing mode
 */

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Paperclip,
  Image,
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
import { ChatInputConfigBar, ChatInputConfigControls, ChatInputSubmitControl } from "./config-bar";
import { AttachmentPreview } from "./attachment-preview";
import { SlashCommandMenu } from "./slash-command-menu";
import { WritingMode } from "./writing-mode";
import { HighlightedInput } from "./highlighted-input";
import {
  useAttachments,
  useSlashCommandMenu,
  useResizableHeight,
  useIMEComposition,
  useAutoFocus,
} from "./hooks";
import type { ChatInputProps } from "./types";
import { findSlashCommand, formatSlashCommandInput, parseSlashCommandInput } from "../slash-commands";
import { mergeQueuedInputRecallItems } from "../command-queue/merge-queued-content";

const DEFAULT_QUEUE_RECALL_JOINER = "\n\n";

export function ChatInput({
  // Basic Props
  onSend,
  value,
  defaultValue = "",
  onValueChange,
  onRecallQueuedInput,
  queuedInputRecallItems = [],
  queuedInputRecallJoiner = DEFAULT_QUEUE_RECALL_JOINER,
  onQueuedInputRecall,
  onCancel,
  isLoading,
  allowSendWhileLoading,
  disabled,
  blockedReason,
  sendDisabled,
  sendBlockedReason,
  placeholder,
  className,
  autoFocus = false,
  // Layout Control
  showTopToolbar = false,
  showBottomToolbar = true,
  showConfigBar = false,
  layoutVariant = "expanded",
  showResizeHandle = false,
  defaultHeight,
  minHeight,
  maxHeight,
  heightStorageKey,
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
  renderSlashCommandMenu,
  // Custom Content Slots
  configBarLeftExtra,
  renderEmojiPicker,
  renderTopToolbar,
  renderBottomToolbar,
  renderWritingMode,
}: ChatInputProps) {
  const { t } = useTranslation();

  // State
  const isControlled = value !== undefined;
  const [uncontrolledContent, setUncontrolledContent] = useState(defaultValue);
  const content = isControlled ? value : uncontrolledContent;
  const setContent = useCallback(
    (nextValue: string | ((previousValue: string) => string)) => {
      const resolvedValue = typeof nextValue === "function" ? nextValue(content) : nextValue;
      if (!isControlled) {
        setUncontrolledContent(resolvedValue);
      }
      onValueChange?.(resolvedValue);
    },
    [content, isControlled, onValueChange]
  );
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
    handleHover: handleSlashHover,
    handleKeyDown: handleSlashKeyDown,
  } = useSlashCommandMenu({
    commands: slashCommands,
    onSelect: (command) => {
      const parsedInput = parseSlashCommandInput(content);
      const args = parsedInput?.args || (typeof command.input?.hint === "string" ? command.input.hint : "");
      const nextValue = formatSlashCommandInput(command, args);
      setContent(nextValue);
      handleSlashContentChange(nextValue);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    enabled: slashCommands.length > 0 && !!onSlashCommand,
  });

  const { height: inputHeight, handleResizeStart } = useResizableHeight({
    enabled: showResizeHandle,
    defaultHeight,
    minHeight,
    maxHeight,
    storageKey: heightStorageKey,
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
  const shouldShowBottomToolbar = showBottomToolbar;
  const shouldShowConfigBar = shouldShowBottomToolbar && showConfigBar;
  const hasToolbar = showTopToolbar || shouldShowBottomToolbar || showResizeHandle;
  const isCompactLayout = layoutVariant === "compact";

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

  useEffect(() => {
    handleSlashContentChange(content);
  }, [content, handleSlashContentChange]);

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
    !sendDisabled &&
    !isAnyLoading;

  // Send handler
  const handleSend = useCallback(() => {
    if (!canSubmit || (isLoading && !allowSendWhileLoading)) {
      return;
    }

    const text = content.trim();
    const messageAttachments = attachments.length > 0 ? attachments : undefined;
    const parsedCommand = parseSlashCommandInput(text);
    const slashCommand = parsedCommand ? findSlashCommand(slashCommands, parsedCommand.name) : undefined;

    // Clear state first
    setContent("");
    clearAttachments();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (slashCommand && onSlashCommand) {
      onSlashCommand(slashCommand, {
        command: slashCommand,
        args: parsedCommand?.args ?? "",
        value: text,
        attachments: messageAttachments,
      });
      return;
    }

    // Call onSend
    onSend(text, messageAttachments);
  }, [canSubmit, isLoading, allowSendWhileLoading, content, attachments, slashCommands, clearAttachments, onSlashCommand, onSend]);

  const submitControl = (
    <ChatInputSubmitControl
      onSend={handleSend}
      onCancel={onCancel}
      isLoading={isLoading}
      canSubmit={canSubmit}
      allowSendWhileLoading={allowSendWhileLoading}
    />
  );

  // Key down handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle slash command navigation first
      if (handleSlashKeyDown(e)) {
        return;
      }

      if (e.key === "ArrowUp" && !isComposing && content.trim().length === 0) {
        e.preventDefault();
        if (queuedInputRecallItems.length > 0) {
          const recalledValue = mergeQueuedInputRecallItems(queuedInputRecallItems, queuedInputRecallJoiner);
          if (recalledValue) {
            setContent(recalledValue);
            requestAnimationFrame(() => {
              const textarea = textareaRef.current;
              if (!textarea) return;
              const nextCursorPosition = recalledValue.length;
              textarea.focus();
              textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
            });
            onQueuedInputRecall?.(queuedInputRecallItems, recalledValue);
            return;
          }
        }
        onRecallQueuedInput?.(content);
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
    [
      content,
      handleSlashKeyDown,
      isComposing,
      handleSend,
      isWritingMode,
      onRecallQueuedInput,
      onQueuedInputRecall,
      queuedInputRecallItems,
      queuedInputRecallJoiner,
      setContent,
    ]
  );

  const toolbarRenderProps = {
    onEmojiSelect: insertEmoji,
    onFileClick: handleFileClick,
    onScreenshot: onScreenshot ? handleScreenshot : undefined,
    onExpandClick: enableWritingMode ? () => setIsWritingMode(true) : undefined,
    isLoading,
    disabled,
    isScreenshotCapturing,
  };

  const configControls = (
    <ChatInputConfigControls
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
      isLoading={isLoading}
      disabled={disabled}
      leftExtraContent={configBarLeftExtra}
    />
  );

  const writingModeProps = {
    isOpen: isWritingMode,
    onClose: () => setIsWritingMode(false),
    content,
    onContentChange: setContent,
    attachments,
    onRemoveAttachment: removeAttachment,
    onSend: handleSend,
    onCancel,
    isLoading,
    disabled,
    canSubmit,
    placeholder,
    onEmojiSelect: insertEmoji,
    renderEmojiPicker,
    onFileClick: handleFileClick,
    onScreenshot: onScreenshot ? handleScreenshot : undefined,
    isScreenshotCapturing,
    onKeyDown: handleKeyDown,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onPaste: handlePaste,
    showConfigBar: shouldShowConfigBar,
    agents,
    selectedAgentId,
    onAgentChange,
    showAgentSelector: shouldShowAgentSelector,
    models,
    selectedModelId,
    onModelChange,
    showModelSelector: shouldShowModelSelector,
    textareaRef,
    configControls,
    submitControl,
    className,
  };

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

        {renderWritingMode ? (
          renderWritingMode(writingModeProps)
        ) : (
          <WritingMode {...writingModeProps} />
        )}
      </>
    );
  }

  const editor = (
    <div
      className={cn(
        "viben-chat-input-editor px-3 relative",
        !hasToolbar && "py-3",
        isCompactLayout && "min-w-0 flex-1 px-0"
      )}
      style={hasToolbar && !isCompactLayout ? { height: inputHeight } : undefined}
    >
      {/* Slash Command Menu */}
      {renderSlashCommandMenu ? (
        renderSlashCommandMenu({
          commands: filteredCommands,
          selectedIndex: slashSelectedIndex,
          onSelect: handleSlashSelect,
          onHover: handleSlashHover,
          isOpen: isSlashMenuOpen,
          query: slashQuery,
          anchorRef: containerRef as React.RefObject<HTMLElement>,
        })
      ) : (
        <SlashCommandMenu
          commands={filteredCommands}
          selectedIndex={slashSelectedIndex}
          onSelect={handleSlashSelect}
          onHover={handleSlashHover}
          isOpen={isSlashMenuOpen}
          query={slashQuery}
          anchorRef={containerRef as React.RefObject<HTMLElement>}
        />
      )}

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
          "w-full text-base",
          hasToolbar && !isCompactLayout && "h-full",
          isCompactLayout && "h-9"
        )}
        textareaClassName={cn(
          "resize-none border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none",
          hasToolbar && !isCompactLayout ? "py-3" : undefined,
          isCompactLayout && "min-h-9 py-2 leading-5"
        )}
        style={
          !hasToolbar
            ? {
                minHeight: "40px",
                maxHeight: "200px",
                overflowY: "hidden",
              }
            : isCompactLayout
              ? {
                  minHeight: "36px",
                  maxHeight: "36px",
                  overflowY: "hidden",
                }
              : undefined
        }
        rows={isCompactLayout ? 1 : 2}
        disabled={(isLoading && !allowSendWhileLoading) || disabled}
      />
    </div>
  );

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
      {showTopToolbar && !isCompactLayout && (
        renderTopToolbar ? (
          <ChatInputToolbar {...toolbarRenderProps} renderEmojiPicker={renderEmojiPicker}>
            {renderTopToolbar(toolbarRenderProps)}
          </ChatInputToolbar>
        ) : (
          <ChatInputToolbar
            {...toolbarRenderProps}
            renderEmojiPicker={renderEmojiPicker}
            showExpand={enableWritingMode}
          />
        )
      )}

      {/* Attachment Preview */}
      <AttachmentPreview
        attachments={attachments}
        onRemove={removeAttachment}
      />

      {/* Blocked reason indicator */}
      {((disabled && blockedReason) || (!disabled && sendDisabled && sendBlockedReason)) && (
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border-b border-border/40">
          <Shield className="size-3 text-amber-500" />
          <span>{disabled ? blockedReason : sendBlockedReason}</span>
        </div>
      )}

      {!isCompactLayout && editor}

      {/* Bottom Config Bar (when enabled) */}
      {shouldShowConfigBar && !isCompactLayout && (
        renderBottomToolbar ? (
          <div data-testid="chat-input-bottom-toolbar" className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/30">
            {renderBottomToolbar({
              leftContent: configControls,
              submitControl,
              isLoading,
              disabled,
              canSubmit,
            })}
          </div>
        ) : (
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
        )
      )}

      {shouldShowBottomToolbar && isCompactLayout && (
        <div data-testid="chat-input-compact-toolbar" className="flex min-w-0 items-center gap-2 border-t border-border/30 bg-muted/30 px-2 py-2">
          {renderBottomToolbar ? (
            renderBottomToolbar({
              leftContent: configControls,
              editor,
              submitControl,
              isLoading,
              disabled,
              canSubmit,
            })
          ) : (
            <>
              {editor}
              {shouldShowConfigBar && configControls}
              {submitControl}
            </>
          )}
        </div>
      )}

      {/* Bottom Actions (when no config bar) */}
      {shouldShowBottomToolbar && !showConfigBar && !isCompactLayout && (
        <div
          data-testid="chat-input-basic-actions"
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
            {submitControl}
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export types and sub-components for consumers
export type {
  ChatInputProps,
  SlashCommandMenuProps,
  AgentOption,
  ModelOption,
  ExecutorOption,
  GlobalChatConfig,
  ChatConfigVisibility,
  QueuedInputRecallItem,
  ChatInputToolbarRenderProps,
  ChatInputBottomToolbarRenderProps,
  ChatInputWritingModeRenderProps,
} from "./types";
export { ChatInputToolbar } from "./toolbar";
export { ChatInputConfigBar, ChatInputConfigControls, ChatInputSubmitControl } from "./config-bar";
export { AttachmentPreview } from "./attachment-preview";
export { SlashCommandMenu } from "./slash-command-menu";
export {
  WritingMode,
  WritingModeAttachments,
  WritingModeEditor,
  WritingModeFooter,
  WritingModeHeader,
  WritingModeRoot,
  WritingModeSubmitControl,
  WritingModeToolbar,
} from "./writing-mode";
export type {
  WritingModeAttachmentsProps,
  WritingModeEditorProps,
  WritingModeFooterProps,
  WritingModeHeaderProps,
  WritingModeProps,
  WritingModeRootProps,
  WritingModeSubmitControlProps,
  WritingModeToolbarProps,
} from "./writing-mode";
export { HighlightedInput } from "./highlighted-input";
export {
  useAttachments,
  useSlashCommandMenu,
  useSlashCommands,
  useResizableHeight,
  useIMEComposition,
  useAutoFocus,
} from "./hooks";
export type {
  UseSlashCommandMenuOptions,
  UseSlashCommandMenuReturn,
} from "./hooks";
