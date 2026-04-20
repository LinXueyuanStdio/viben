import { useEffect, useCallback } from "react";
import { useUiStore, useAppStore } from "@/stores";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";

/**
 * Parse a shortcut string like "Shift+Cmd+J" into components.
 */
function parseShortcut(shortcut: string): {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
} {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  return {
    ctrl: parts.includes("ctrl"),
    meta: parts.includes("cmd") || parts.includes("meta"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt") || parts.includes("option"),
    key,
  };
}

/**
 * Check if a keyboard event matches a shortcut configuration.
 */
function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  if (!shortcut) return false;

  const parsed = parseShortcut(shortcut);

  // For modifier keys (Ctrl/Cmd), we check if either is pressed
  // This allows cross-platform shortcuts to work
  const modifierMatch =
    (parsed.ctrl || parsed.meta)
      ? (e.ctrlKey || e.metaKey)
      : (!e.ctrlKey && !e.metaKey);

  const shiftMatch = parsed.shift ? e.shiftKey : !e.shiftKey;
  const altMatch = parsed.alt ? e.altKey : !e.altKey;
  const keyMatch = e.key.toLowerCase() === parsed.key;

  return modifierMatch && shiftMatch && altMatch && keyMatch;
}

/**
 * Global keyboard shortcuts for the application.
 *
 * Registered shortcuts (configurable in Settings > Shortcuts):
 * - createTask: Open create task dialog (default: Shift+Cmd+J)
 */
export function useGlobalShortcuts() {
  const { openCreateTaskDialog } = useUiStore();
  const { shortcuts } = useAppStore();
  const { activeWorkspaceId } = useLocalWorkspaces();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Create Task shortcut
      if (matchesShortcut(e, shortcuts.createTask)) {
        e.preventDefault();
        // Only open if there's an active workspace
        if (activeWorkspaceId) {
          openCreateTaskDialog();
        }
      }
    },
    [shortcuts.createTask, activeWorkspaceId, openCreateTaskDialog]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
