/**
 * ChatInput Hooks
 *
 * Custom hooks for managing ChatInput state and behavior.
 */

import * as React from "react";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { MessageAttachment, SlashCommand } from "../types";
import { isImageFile } from "../utils";
import { filterSlashCommands, getSlashCommandQuery } from "../slash-commands";

// ============================================================================
// useAttachments Hook
// ============================================================================

export interface UseAttachmentsOptions {
  /** Maximum number of attachments allowed */
  maxAttachments?: number;
}

export interface UseAttachmentsReturn {
  attachments: MessageAttachment[];
  addFiles: (files: FileList | File[], forceImage?: boolean) => Promise<void>;
  addAttachment: (attachment: MessageAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  isAnyLoading: boolean;
}

/**
 * Hook for managing message attachments
 */
export function useAttachments(
  options: UseAttachmentsOptions = {}
): UseAttachmentsReturn {
  const { maxAttachments = 10 } = options;
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);

  // Create preview for files with error handling
  const createFilePreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsDataURL(file);
    });
  }, []);

  // Add files to attachments
  const addFiles = useCallback(
    async (files: FileList | File[], forceImage = false) => {
      const fileArray = Array.from(files);

      // Check max attachments limit
      const remainingSlots = maxAttachments - attachments.length;
      const filesToAdd = fileArray.slice(0, remainingSlots);

      for (const file of filesToAdd) {
        const isImage = forceImage || isImageFile(file);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        // Add loading attachment
        setAttachments((prev) => [
          ...prev,
          {
            id,
            type: isImage ? "image" : "file",
            name: file.name,
            isLoading: true,
          },
        ]);

        try {
          const data = await createFilePreview(file);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id
                ? {
                    ...a,
                    data,
                    mimeType:
                      file.type ||
                      (isImage ? "image/png" : "application/octet-stream"),
                    isLoading: false,
                  }
                : a
            )
          );
        } catch (error) {
          console.error("[ChatInput] Failed to read file:", error);
          // Remove failed attachment
          setAttachments((prev) => prev.filter((a) => a.id !== id));
        }
      }
    },
    [attachments.length, createFilePreview, maxAttachments]
  );

  // Add a single attachment directly
  const addAttachment = useCallback((attachment: MessageAttachment) => {
    setAttachments((prev) => [...prev, attachment]);
  }, []);

  // Remove attachment by id
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Clear all attachments
  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  // Check if any attachment is loading
  const isAnyLoading = useMemo(
    () => attachments.some((a) => a.isLoading),
    [attachments]
  );

  return {
    attachments,
    addFiles,
    addAttachment,
    removeAttachment,
    clearAttachments,
    isAnyLoading,
  };
}

// ============================================================================
// useSlashCommands Hook
// ============================================================================

export interface UseSlashCommandMenuOptions {
  commands: SlashCommand[];
  onSelect: (command: SlashCommand) => void;
  enabled?: boolean;
}

export interface UseSlashCommandMenuReturn {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  filteredCommands: SlashCommand[];
  handleContentChange: (content: string) => void;
  handleSelect: (command: SlashCommand) => void;
  handleHover: (index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  close: () => void;
}

/**
 * Hook for managing slash command autocomplete
 */
export function useSlashCommandMenu(
  options: UseSlashCommandMenuOptions
): UseSlashCommandMenuReturn {
  const { commands, onSelect, enabled = true } = options;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    return filterSlashCommands(commands, query);
  }, [commands, query]);

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Handle content change to detect slash commands
  const handleContentChange = useCallback(
    (content: string) => {
      if (!enabled || commands.length === 0) {
        setIsOpen(false);
        return;
      }

      const cmdQuery = getSlashCommandQuery(content);
      if (cmdQuery !== null) {
        setQuery(cmdQuery);
        setIsOpen(true);
        setSelectedIndex(0);
      } else {
        setIsOpen(false);
        setQuery("");
      }
    },
    [enabled, commands.length]
  );

  // Handle command selection
  const handleSelect = useCallback(
    (command: SlashCommand) => {
      setIsOpen(false);
      setQuery("");
      onSelect(command);
    },
    [onSelect]
  );

  const handleHover = useCallback(
    (index: number) => {
      if (index >= 0 && index < filteredCommands.length) {
        setSelectedIndex(index);
      }
    },
    [filteredCommands.length]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen || filteredCommands.length === 0) {
        return false;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          return true;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          return true;
        case "Enter":
        case "Tab":
          if (!e.shiftKey) {
            e.preventDefault();
            const command = filteredCommands[selectedIndex];
            if (command) {
              handleSelect(command);
            }
            return true;
          }
          return false;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setQuery("");
          return true;
        default:
          return false;
      }
    },
    [isOpen, filteredCommands, selectedIndex, handleSelect]
  );

  // Close the menu
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  return {
    isOpen,
    query,
    selectedIndex,
    filteredCommands,
    handleContentChange,
    handleSelect,
    handleHover,
    handleKeyDown,
    close,
  };
}

/** @deprecated Use useSlashCommandMenu for input autocomplete, or useSlashCommands from ../slash-commands for registry/execution. */
export const useSlashCommands = useSlashCommandMenu;

// ============================================================================
// useResizableHeight Hook
// ============================================================================

export interface UseResizableHeightOptions {
  /** Storage key for persisting height */
  storageKey?: string;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Default height in pixels */
  defaultHeight?: number;
  /** Whether resize is enabled */
  enabled?: boolean;
}

export interface UseResizableHeightReturn {
  height: number;
  isResizing: boolean;
  handleResizeStart: (e: React.MouseEvent) => void;
}

/**
 * Hook for managing resizable textarea height
 */
export function useResizableHeight(
  options: UseResizableHeightOptions = {}
): UseResizableHeightReturn {
  const {
    storageKey = "chat_input_height",
    minHeight = 80,
    maxHeight = 400,
    defaultHeight = 80,
    enabled = true,
  } = options;

  const [height, setHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef({
    isDragging: false,
    startY: 0,
    startHeight: defaultHeight,
    latestHeight: defaultHeight,
  });

  // Load saved height from localStorage
  useEffect(() => {
    if (!enabled) return;

    try {
      const savedHeight = localStorage.getItem(storageKey);
      if (savedHeight) {
        const parsedHeight = parseInt(savedHeight, 10);
        if (parsedHeight >= minHeight && parsedHeight <= maxHeight) {
          setHeight(parsedHeight);
          resizeRef.current.latestHeight = parsedHeight;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [enabled, storageKey, minHeight, maxHeight]);

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;

      e.preventDefault();
      e.stopPropagation();

      resizeRef.current = {
        isDragging: true,
        startY: e.clientY,
        startHeight: height,
        latestHeight: height,
      };
      setIsResizing(true);

      // Prevent text selection and set resize cursor during drag
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizeRef.current.isDragging) return;

        // Dragging up (negative deltaY) should increase height
        const deltaY = resizeRef.current.startY - moveEvent.clientY;
        const newHeight = Math.min(
          Math.max(resizeRef.current.startHeight + deltaY, minHeight),
          maxHeight
        );
        resizeRef.current.latestHeight = newHeight;
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        if (resizeRef.current.isDragging) {
          resizeRef.current.isDragging = false;
          setIsResizing(false);

          // Save to localStorage using the latest height from ref
          try {
            localStorage.setItem(storageKey, resizeRef.current.latestHeight.toString());
          } catch {
            // Ignore localStorage errors
          }
        }

        // Restore cursor and user-select
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [enabled, height, minHeight, maxHeight, storageKey]
  );

  return {
    height,
    isResizing,
    handleResizeStart,
  };
}

// ============================================================================
// useIMEComposition Hook
// ============================================================================

export interface UseIMECompositionReturn {
  isComposing: boolean;
  isComposingEvent: (event?: React.KeyboardEvent<HTMLElement> | KeyboardEvent) => boolean;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
}

/**
 * Hook for tracking IME composition state
 */
export function useIMEComposition(): UseIMECompositionReturn {
  const isComposingRef = useRef(false);
  const [, forceUpdate] = useState({});

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
    forceUpdate({});
  }, []);

  const handleCompositionEnd = useCallback(() => {
    // Delay reset to handle composition end event order
    setTimeout(() => {
      isComposingRef.current = false;
      forceUpdate({});
    }, 10);
  }, []);

  const isComposingEvent = useCallback(
    (event?: React.KeyboardEvent<HTMLElement> | KeyboardEvent) => {
      const nativeEvent = "nativeEvent" in (event ?? {})
        ? (event as React.KeyboardEvent<HTMLElement>).nativeEvent
        : event;
      const eventWithComposition = nativeEvent as KeyboardEvent & { isComposing?: boolean };
      const reactEventWithKeyCode = event as React.KeyboardEvent<HTMLElement> & { keyCode?: number };

      return (
        isComposingRef.current ||
        eventWithComposition?.isComposing === true ||
        eventWithComposition?.keyCode === 229 ||
        reactEventWithKeyCode?.keyCode === 229
      );
    },
    []
  );

  return {
    isComposing: isComposingRef.current,
    isComposingEvent,
    handleCompositionStart,
    handleCompositionEnd,
  };
}

// ============================================================================
// useAutoFocus Hook
// ============================================================================

export interface UseAutoFocusOptions {
  /** Whether to auto focus on mount */
  autoFocus?: boolean;
  /** Whether to focus when loading completes */
  focusOnLoadComplete?: boolean;
  /** Current loading state */
  isLoading?: boolean;
}

/**
 * Hook for managing textarea auto-focus behavior
 */
export function useAutoFocus(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  options: UseAutoFocusOptions = {}
): void {
  const { autoFocus = false, focusOnLoadComplete = true, isLoading } = options;
  const prevIsLoadingRef = useRef(isLoading);

  // Auto focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus, textareaRef]);

  // Focus when loading completes
  useEffect(() => {
    if (
      focusOnLoadComplete &&
      prevIsLoadingRef.current &&
      !isLoading &&
      textareaRef.current
    ) {
      textareaRef.current.focus();
    }
    prevIsLoadingRef.current = isLoading;
  }, [focusOnLoadComplete, isLoading, textareaRef]);
}
