import { useEffect, useCallback, useRef } from "react";
import { useUiStore, useAppStore } from "@/stores";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { useTabStore } from "@/stores/tab-store";

/**
 * Parse a shortcut string like "Shift+Cmd+J" into components.
 */
export function parseShortcut(shortcut: string): {
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
export function matchesShortcut(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">, shortcut: string): boolean {
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

export function isReopenClosedTabShortcut(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey">
): boolean {
  return (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "t";
}

export function isNewTabShortcut(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey">
): boolean {
  return (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "t";
}

export function isCloseTabShortcut(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey">
): boolean {
  return (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "w";
}

export function getTabSwitchIndexFromShortcut(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">
): number | null {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) {
    return null;
  }

  if (!/^[1-9]$/.test(e.key)) {
    return null;
  }

  return Number(e.key) - 1;
}

type EditableTargetLike = {
  tagName?: string | null;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
};

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  const element = target as EditableTargetLike | null;
  if (!element) return false;

  const tagName = element.tagName?.toUpperCase();
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }

  if (element.isContentEditable) {
    return true;
  }

  if (element.getAttribute?.("role") === "textbox") {
    return true;
  }

  try {
    return Boolean(
      element.closest?.(
        'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable], [role="textbox"]'
      )
    );
  } catch {
    return false;
  }
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
  const openTab = useTabStore((state) => state.openTab);
  const closeTab = useTabStore((state) => state.closeTab);
  const setActiveTab = useTabStore((state) => state.setActiveTab);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const reopenClosedTab = useTabStore((state) => state.reopenClosedTab);

  // Read tab state via ref to avoid recreating the callback on every tab change
  const tabStateRef = useRef({ activeTabId: "", tabIds: [] as string[], tabCount: 0 });
  const activeTabId = useTabStore((state) => state.activeTabId);
  const tabs = useTabStore((state) => state.tabs);
  tabStateRef.current = {
    activeTabId,
    tabIds: tabs.map((tab) => tab.id),
    tabCount: tabs.length,
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Create Task shortcut
      if (matchesShortcut(e, shortcuts.createTask)) {
        e.preventDefault();
        // Only open if there's an active workspace
        if (activeWorkspaceId) {
          openCreateTaskDialog();
        }
        return;
      }

      if (isEditableShortcutTarget(e.target)) {
        return;
      }

      if (isNewTabShortcut(e)) {
        e.preventDefault();
        openTab(
          {
            type: "new-tab",
            name: "New Tab",
            icon: { type: "lucide", value: "plus" },
            pinned: false,
          },
          "/documents"
        );
        return;
      }

      const { activeTabId: currentTabId, tabIds, tabCount } = tabStateRef.current;

      if (isCloseTabShortcut(e)) {
        if (!currentTabId || tabCount <= 1) {
          return;
        }
        e.preventDefault();
        closeTab(currentTabId);
        return;
      }

      const tabSwitchIndex = getTabSwitchIndexFromShortcut(e);
      if (tabSwitchIndex !== null) {
        const targetTabId =
          tabSwitchIndex >= 8
            ? tabIds[tabIds.length - 1]
            : tabIds[tabSwitchIndex];

        if (!targetTabId) {
          return;
        }

        e.preventDefault();
        setActiveTab(targetTabId);
        return;
      }

      // Browser-like shortcut: Reopen Closed Tab
      if (isReopenClosedTabShortcut(e)) {
        e.preventDefault();
        reopenClosedTab();
      }
    },
    [
      shortcuts.createTask,
      activeWorkspaceId,
      openCreateTaskDialog,
      openTab,
      closeTab,
      setActiveTab,
      reopenClosedTab,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
