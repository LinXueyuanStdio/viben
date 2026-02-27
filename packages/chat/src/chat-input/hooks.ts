/**
 * ChatInput Hooks
 *
 * Custom hooks for managing ChatInput state and behavior.
 */

import * as React from "react";
import type { MessageAttachment, SlashCommand } from "../types";
import { isImageFile } from "../utils";

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
  const [attachments, setAttachments] = React.useState<MessageAttachment[]>([]);

  // Create preview for files with error handling
  const createFilePreview = React.useCallback((file: File): Promise<string> => {
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
  const addFiles = React.useCallback(
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
  const addAttachment = React.useCallback((attachment: MessageAttachment) => {
    setAttachments((prev) => [...prev, attachment]);
  }, []);

  // Remove attachment by id
  const removeAttachment = React.useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Clear all attachments
  const clearAttachments = React.useCallback(() => {
    setAttachments([]);
  }, []);

  // Check if any attachment is loading
  const isAnyLoading = React.useMemo(
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

export interface UseSlashCommandsOptions {
  commands: SlashCommand[];
  onSelect: (command: SlashCommand) => void;
  enabled?: boolean;
}

export interface UseSlashCommandsReturn {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  filteredCommands: SlashCommand[];
  handleContentChange: (content: string) => void;
  handleSelect: (command: SlashCommand) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  close: () => void;
}

/**
 * Hook for managing slash command autocomplete
 */
export function useSlashCommands(
  options: UseSlashCommandsOptions
): UseSlashCommandsReturn {
  const { commands, onSelect, enabled = true } = options;
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Filter commands based on query
  const filteredCommands = React.useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Reset selected index when filtered commands change
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Handle content change to detect slash commands
  const handleContentChange = React.useCallback(
    (content: string) => {
      if (!enabled || commands.length === 0) {
        setIsOpen(false);
        return;
      }

      if (content.startsWith("/")) {
        // Extract the command part (before any space)
        const cmdQuery = content.slice(1).split(/\s/)[0];

        // Close menu if:
        // 1. User typed space right after "/" (e.g., "/ ")
        // 2. User typed space after command (e.g., "/help ")
        const hasSpaceAfterSlash = content.length > 1 && content[1] === " ";
        const hasSpaceAfterCommand = content.includes(" ");

        if (hasSpaceAfterSlash || hasSpaceAfterCommand) {
          setIsOpen(false);
          setQuery("");
        } else {
          setQuery(cmdQuery);
          setIsOpen(true);
          setSelectedIndex(0);
        }
      } else {
        setIsOpen(false);
        setQuery("");
      }
    },
    [enabled, commands.length]
  );

  // Handle command selection
  const handleSelect = React.useCallback(
    (command: SlashCommand) => {
      setIsOpen(false);
      setQuery("");
      onSelect(command);
    },
    [onSelect]
  );

  // Handle keyboard navigation
  const handleKeyDown = React.useCallback(
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
            handleSelect(filteredCommands[selectedIndex]);
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
  const close = React.useCallback(() => {
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
    handleKeyDown,
    close,
  };
}

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

  const [height, setHeight] = React.useState(defaultHeight);
  const isDraggingRef = React.useRef(false);
  const startYRef = React.useRef(0);
  const startHeightRef = React.useRef(0);

  // Load saved height from localStorage
  React.useEffect(() => {
    if (!enabled) return;

    try {
      const savedHeight = localStorage.getItem(storageKey);
      if (savedHeight) {
        const parsedHeight = parseInt(savedHeight, 10);
        if (parsedHeight >= minHeight && parsedHeight <= maxHeight) {
          setHeight(parsedHeight);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [enabled, storageKey, minHeight, maxHeight]);

  // Save height to localStorage
  const saveHeight = React.useCallback(
    (newHeight: number) => {
      try {
        localStorage.setItem(storageKey, newHeight.toString());
      } catch {
        // Ignore localStorage errors
      }
    },
    [storageKey]
  );

  // Handle resize start
  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;

      e.preventDefault();
      isDraggingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = height;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = startYRef.current - e.clientY;
        const newHeight = Math.min(
          Math.max(startHeightRef.current + delta, minHeight),
          maxHeight
        );
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          saveHeight(height);
        }
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [enabled, height, minHeight, maxHeight, saveHeight]
  );

  return {
    height,
    handleResizeStart,
  };
}

// ============================================================================
// useIMEComposition Hook
// ============================================================================

export interface UseIMECompositionReturn {
  isComposing: boolean;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
}

/**
 * Hook for tracking IME composition state
 */
export function useIMEComposition(): UseIMECompositionReturn {
  const isComposingRef = React.useRef(false);
  const [, forceUpdate] = React.useState({});

  const handleCompositionStart = React.useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = React.useCallback(() => {
    // Delay reset to handle composition end event order
    setTimeout(() => {
      isComposingRef.current = false;
      forceUpdate({});
    }, 10);
  }, []);

  return {
    isComposing: isComposingRef.current,
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
  const prevIsLoadingRef = React.useRef(isLoading);

  // Auto focus on mount
  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus, textareaRef]);

  // Focus when loading completes
  React.useEffect(() => {
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
