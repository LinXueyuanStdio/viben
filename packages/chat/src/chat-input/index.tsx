/**
 * Unified Chat Input Component
 *
 * A flexible, platform-agnostic chat input that supports multiple configurations via props.
 * Platform-specific features (screenshot, file dialog) are handled via callback props.
 *
 * Base functionality (always present):
 * - Auto-resizing textarea (40-200px)
 * - Attachment preview area
 * - IME composition handling
 * - Paste image support
 *
 * Features controlled by props:
 * - topToolbar: Custom top toolbar content (ReactNode)
 * - bottomToolbar: Custom bottom toolbar content (ReactNode)
 * - showResizeHandle: Draggable height adjustment
 *
 * The component exports sub-components (ChatInputTopToolbar, ChatInputBottomToolbar,
 * ChatInputConfigControls, ChatInputSubmitControl) for consumers to compose
 * their own toolbars.
 */

import * as React from "react";
import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Shield, Plus } from "lucide-react";
import { cn, Button } from "@viben/ui";

import { AttachmentPreview } from "./attachment-preview";
import { ChatInputSubmitControl } from "./bottom-toolbar";
import { SlashCommandMenu } from "./slash-command-menu";
import { HighlightedInput } from "./highlighted-input";
import {
  useAttachments,
  useSlashCommandMenu,
  useResizableHeight,
  useIMEComposition,
  useAutoFocus,
} from "./hooks";
import type { ChatInputProps, ChatInputContextValue } from "./types";
import { findSlashCommand, formatSlashCommandInput, parseSlashCommandInput } from "../slash-commands";
import { mergeQueuedInputRecallItems } from "../command-queue/merge-queued-content";

const DEFAULT_QUEUE_RECALL_JOINER = "\n\n";

const ChatInputContext = createContext<ChatInputContextValue | null>(null);

function hasDraggedFiles(event: React.DragEvent<HTMLElement>) {
  const types = Array.from(event.dataTransfer.types ?? []);
  return types.includes("Files") || event.dataTransfer.files.length > 0;
}

export function useChatInput() {
  const context = useContext(ChatInputContext);
  if (!context) {
    throw new Error("useChatInput must be used within a ChatInput component");
  }
  return context;
}

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
  layoutVariant = "expanded",
  onRequestExpand,
  showResizeHandle = false,
  defaultHeight,
  minHeight,
  maxHeight,
  heightStorageKey,
  // Attachments
  attachments: controlledAttachments,
  onAttachmentsChange,
  isAttachmentLoading: externalAttachmentLoading,
  // Platform-specific callbacks
  onOpenFile,
  onPaste: customOnPaste,
  // Slash Commands
  slashCommands = [],
  onSlashCommand,
  renderSlashCommandMenu,
  // Toolbar Slots
  topToolbar,
  bottomToolbar,
  // Refs
  textareaRef: externalTextareaRef,
  containerRef: externalContainerRef,
}: ChatInputProps) {
  const { t } = useTranslation();

  // State
  const isControlled = value !== undefined;
  const [uncontrolledContent, setUncontrolledContent] = useState(defaultValue);
  const [isDragOver, setIsDragOver] = useState(false);
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

  // Refs
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = externalTextareaRef ?? internalTextareaRef;
  const containerRef = externalContainerRef ?? internalContainerRef;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  // Hooks - use controlled attachments if provided
  const {
    attachments: internalAttachments,
    addFiles,
    addAttachment,
    removeAttachment,
    clearAttachments,
    isAnyLoading: internalIsAnyLoading,
  } = useAttachments();

  const attachments = controlledAttachments ?? internalAttachments;
  const isAnyLoading = externalAttachmentLoading ?? internalIsAnyLoading;

  // Sync attachments if controlled
  useEffect(() => {
    if (controlledAttachments !== undefined && onAttachmentsChange) {
      // When using controlled attachments, delegate to parent
    }
  }, [controlledAttachments, onAttachmentsChange]);

  const handleAddAttachment = useCallback(
    (attachment: Parameters<typeof addAttachment>[0]) => {
      if (onAttachmentsChange && controlledAttachments) {
        onAttachmentsChange([...controlledAttachments, attachment]);
      } else {
        addAttachment(attachment);
      }
    },
    [addAttachment, controlledAttachments, onAttachmentsChange]
  );

  const handleAddFiles = useCallback(
    async (files: FileList | File[], isImage?: boolean) => {
      // For now, use internal addFiles - parent can listen via onAttachmentsChange
      await addFiles(files, isImage);
    },
    [addFiles]
  );

  const handleRemoveAttachment = useCallback(
    (id: string) => {
      if (onAttachmentsChange && controlledAttachments) {
        onAttachmentsChange(controlledAttachments.filter((a) => a.id !== id));
      } else {
        removeAttachment(id);
      }
    },
    [controlledAttachments, onAttachmentsChange, removeAttachment]
  );

  const handleClearAttachments = useCallback(() => {
    if (onAttachmentsChange) {
      onAttachmentsChange([]);
    } else {
      clearAttachments();
    }
  }, [clearAttachments, onAttachmentsChange]);

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
      requestAnimationFrame(() => {
        const textarea = textareaRef.current ?? internalTextareaRef.current;
        textarea?.focus();
      });
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

  useAutoFocus(textareaRef as React.RefObject<HTMLTextAreaElement>, {
    autoFocus,
    focusOnLoadComplete: true,
    isLoading,
  });

  // Determine if we have toolbar features enabled
  const hasToolbar = showTopToolbar || showBottomToolbar || showResizeHandle;
  const isCompactLayout = layoutVariant === "compact";
  const isInputDisabled = disabled || (isLoading && !allowSendWhileLoading);

  // Auto-resize textarea based on content (only for non-toolbar mode)
  useEffect(() => {
    if (hasToolbar) return;

    const textarea = textareaRef.current ?? internalTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const maxH = 200;
    const minH = 40;
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minH), maxH);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxH ? "auto" : "hidden";
  }, [content, hasToolbar, textareaRef]);

  // Content change handler
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      handleSlashContentChange(newContent);
    },
    [handleSlashContentChange, setContent]
  );

  useEffect(() => {
    handleSlashContentChange(content);
  }, [content, handleSlashContentChange]);

  // Paste handler
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (customOnPaste) {
        const pastedAttachments = await customOnPaste(e);
        if (pastedAttachments && pastedAttachments.length > 0) {
          e.preventDefault();
          pastedAttachments.forEach((a) => handleAddAttachment(a));
          return;
        }
      }

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
        await handleAddFiles(imageFiles, true);
      }
    },
    [customOnPaste, handleAddAttachment, handleAddFiles]
  );

  // File input handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(e.target.files, true);
      e.target.value = "";
    }
  };

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;

    if (!isInputDisabled) {
      setIsDragOver(true);
    }
  }, [isInputDisabled]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = isInputDisabled ? "none" : "copy";

    if (!isInputDisabled) {
      setIsDragOver(true);
    }
  }, [isInputDisabled]);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    const relatedTarget = event.relatedTarget;
    const isStillInside =
      typeof Node !== "undefined" &&
      relatedTarget instanceof Node &&
      event.currentTarget.contains(relatedTarget);

    if (dragDepthRef.current === 0 || !isStillInside) {
      dragDepthRef.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragOver(false);

    if (isInputDisabled || event.dataTransfer.files.length === 0) {
      return;
    }

    await handleAddFiles(event.dataTransfer.files);
  }, [handleAddFiles, isInputDisabled]);

  // File button click handler (exposed via context)
  const handleFileClick = useCallback(async () => {
    if (onOpenFile) {
      const openedAttachments = await onOpenFile();
      if (openedAttachments && openedAttachments.length > 0) {
        openedAttachments.forEach((a) => handleAddAttachment(a));
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [onOpenFile, handleAddAttachment]);

  // Insert at cursor (for emoji, etc.)
  const insertAtCursor = useCallback(
    (text: string) => {
      const textarea = textareaRef.current ?? internalTextareaRef.current;
      if (!textarea) {
        setContent((prev) => prev + text);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + text + content.substring(end);
      setContent(newContent);

      requestAnimationFrame(() => {
        if (textarea) {
          const newPosition = start + text.length;
          textarea.setSelectionRange(newPosition, newPosition);
          textarea.focus();
        }
      });
    },
    [content, setContent, textareaRef]
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

    setContent("");
    handleClearAttachments();

    const textarea = textareaRef.current ?? internalTextareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
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

    onSend(text, messageAttachments);
  }, [
    canSubmit,
    isLoading,
    allowSendWhileLoading,
    content,
    attachments,
    slashCommands,
    handleClearAttachments,
    onSlashCommand,
    onSend,
    setContent,
    textareaRef,
  ]);

  // Key down handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
              const textarea = textareaRef.current ?? internalTextareaRef.current;
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

      if (e.key === "Enter") {
        if (e.shiftKey && isCompactLayout && onRequestExpand) {
          e.preventDefault();
          onRequestExpand();
          return;
        }
        if (!e.shiftKey && !isComposing) {
          e.preventDefault();
          handleSend();
        }
      }
    },
    [
      content,
      handleSlashKeyDown,
      isComposing,
      isCompactLayout,
      handleSend,
      onRecallQueuedInput,
      onRequestExpand,
      onQueuedInputRecall,
      queuedInputRecallItems,
      queuedInputRecallJoiner,
      setContent,
      textareaRef,
    ]
  );

  // Context value for child components
  const contextValue: ChatInputContextValue = {
    content,
    setContent,
    attachments,
    addAttachment: handleAddAttachment,
    addFiles: handleAddFiles,
    removeAttachment: handleRemoveAttachment,
    clearAttachments: handleClearAttachments,
    isAnyLoading,
    canSubmit,
    handleSend,
    handleFileClick,
    isLoading,
    disabled,
    textareaRef: textareaRef as React.RefObject<HTMLTextAreaElement | null>,
    insertAtCursor,
  };

  const editor = (
    <div
      className={cn(
        "viben-chat-input-editor px-3 relative",
        !hasToolbar && "py-3",
        isCompactLayout && "min-w-0 flex-1 px-0"
      )}
      style={hasToolbar && !isCompactLayout ? { height: inputHeight } : undefined}
    >
      {renderSlashCommandMenu ? (
        renderSlashCommandMenu({
          commands: filteredCommands,
          selectedIndex: slashSelectedIndex,
          onSelect: handleSlashSelect,
          onHover: handleSlashHover,
          isOpen: isSlashMenuOpen,
          query: slashQuery,
          anchorRef: (containerRef as React.RefObject<HTMLElement>) ?? (internalContainerRef as React.RefObject<HTMLElement>),
        })
      ) : (
        <SlashCommandMenu
          commands={filteredCommands}
          selectedIndex={slashSelectedIndex}
          onSelect={handleSlashSelect}
          onHover={handleSlashHover}
          isOpen={isSlashMenuOpen}
          query={slashQuery}
          anchorRef={(containerRef as React.RefObject<HTMLElement>) ?? (internalContainerRef as React.RefObject<HTMLElement>)}
        />
      )}

      <HighlightedInput
        ref={(textareaRef as React.RefObject<HTMLTextAreaElement>) ?? internalTextareaRef}
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
        disabled={isInputDisabled}
      />
    </div>
  );

  return (
    <ChatInputContext.Provider value={contextValue}>
      <div
        ref={(containerRef as React.RefObject<HTMLDivElement>) ?? internalContainerRef}
        className={cn(
          "w-full bg-background transition-[box-shadow,border-color] duration-150",
          isDragOver && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
          className
        )}
        data-drag-over={isDragOver ? "true" : undefined}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Resize handle */}
        {showResizeHandle && (
          <div
            className="h-1 cursor-ns-resize hover:bg-primary/20 transition-colors"
            onMouseDown={handleResizeStart}
          />
        )}

        {/* Top Toolbar */}
        {showTopToolbar && !isCompactLayout && topToolbar}

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

        {/* Attachment Preview */}
        <AttachmentPreview
          attachments={attachments}
          onRemove={handleRemoveAttachment}
        />

        {/* Blocked reason indicator */}
        {((disabled && blockedReason) || (!disabled && sendDisabled && sendBlockedReason)) && (
          <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border-b border-border/40">
            <Shield className="size-3 text-amber-500" />
            <span>{disabled ? blockedReason : sendBlockedReason}</span>
          </div>
        )}

        {/* Expanded layout: editor shown separately */}
        {!isCompactLayout && editor}

        {/* Compact layout: single-line with + button, input, submit */}
        {isCompactLayout && (
          <div className="flex h-12 items-center gap-2 px-2" data-testid="compact-chat-input-row">
            {/* Plus button for file attachment */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={isInputDisabled}
              onClick={handleFileClick}
            >
              <Plus className="h-4 w-4" />
            </Button>

            {/* Input field */}
            <input
              ref={textareaRef as unknown as React.RefObject<HTMLInputElement | null>}
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.shiftKey && onRequestExpand) {
                    e.preventDefault();
                    onRequestExpand();
                    return;
                  }
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }
              }}
              onPaste={handlePaste as unknown as React.ClipboardEventHandler<HTMLInputElement>}
              placeholder={placeholder || t("chat.inputPlaceholder")}
              disabled={isInputDisabled}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              data-testid="compact-chat-input-field"
            />

            {/* Attachment count badge */}
            {attachments.length > 0 && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {attachments.length}
              </span>
            )}

            {/* Submit / Stop buttons */}
            <ChatInputSubmitControl
              onSend={handleSend}
              onCancel={onCancel}
              isLoading={isLoading}
              canSubmit={canSubmit}
              allowSendWhileLoading={allowSendWhileLoading}
            />
          </div>
        )}

        {/* Bottom Toolbar (only for expanded layout) */}
        {showBottomToolbar && !isCompactLayout && bottomToolbar}
      </div>
    </ChatInputContext.Provider>
  );
}

// Re-export types and sub-components for consumers
export type {
  ChatInputProps,
  ChatInputContextValue,
  SlashCommandMenuProps,
  AgentOption,
  ModelOption,
  ExecutorOption,
  GlobalChatConfig,
  ChatConfigVisibility,
  QueuedInputRecallItem,
} from "./types";
export { ChatInputTopToolbar } from "./top-toolbar";
export type { ChatInputTopToolbarProps, TasksSummary, BackgroundTasksSummary } from "./top-toolbar";
export {
  ChatInputBottomToolbar,
  ChatInputSubmitControl,
} from "./bottom-toolbar";
export type {
  ChatInputBottomToolbarProps,
  ChatInputSubmitControlProps,
} from "./bottom-toolbar";
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
