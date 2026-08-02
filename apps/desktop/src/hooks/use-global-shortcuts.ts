import { useEffect, useCallback, useMemo, useRef } from "react";
import { useUiStore, useAppStore, useWorkspaceStore } from "@/stores";
import { getCurrentWindowTabStore } from "@/stores/tab-store";
import { createTabNavigationState } from "@/navigation/tab-navigation";
import { buildColdStartBreadcrumb } from "@/navigation/navigate";

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
export function matchesShortcut(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
  shortcut: string,
): boolean {
  if (!shortcut) return false;

  const parsed = parseShortcut(shortcut);

  // For modifier keys (Ctrl/Cmd), we check if either is pressed
  // This allows cross-platform shortcuts to work
  const modifierMatch =
    parsed.ctrl || parsed.meta
      ? e.ctrlKey || e.metaKey
      : !e.ctrlKey && !e.metaKey;

  const shiftMatch = parsed.shift ? e.shiftKey : !e.shiftKey;
  const altMatch = parsed.alt ? e.altKey : !e.altKey;
  const keyMatch = e.key.toLowerCase() === parsed.key;

  return modifierMatch && shiftMatch && altMatch && keyMatch;
}

export function isShortcutPressed(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
  shortcut: string,
): boolean {
  return matchesShortcut(e, shortcut);
}

export function getTabSwitchIndexFromShortcut(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
): number | null {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) {
    return null;
  }

  if (!/^[1-9]$/.test(e.key)) {
    return null;
  }

  return Number(e.key) - 1;
}

export type EditableTargetLike = {
  tagName?: string | null;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
};

export function isEditableShortcutTarget(
  target: EventTarget | EditableTargetLike | null,
): boolean {
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
        'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable], [role="textbox"]',
      ),
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
  const openCreateTaskDialog = useUiStore(
    (state) => state.openCreateTaskDialog,
  );
  const shortcuts = useAppStore((state) => state.shortcuts);
  const activeWorkspaceId = useWorkspaceStore(
    (state) => state.activeWorkspaceId,
  );
  const tabStore = useMemo(() => getCurrentWindowTabStore(), []);
  const openTab = tabStore((state) => state.openTab);
  const closeTab = tabStore((state) => state.closeTab);
  const setActiveTab = tabStore((state) => state.setActiveTab);
  const reopenClosedTab = tabStore((state) => state.reopenClosedTab);

  // Read tab state via ref to avoid recreating the callback on every tab change.
  // Using .map() in a zustand selector creates a new array each time, which
  // triggers infinite re-renders via useSyncExternalStore.
  const tabStateRef = useRef({
    activeTabId: null as string | null,
    tabIds: [] as string[],
    tabCount: 0,
  });
  const activeTabId = tabStore((state) => state.activeTabId);
  const tabs = tabStore((state) => state.tabs);
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

      if (isShortcutPressed(e, shortcuts.newTab)) {
        e.preventDefault();
        const url = "/workspace/global";
        openTab({
          navigationState: createTabNavigationState(
            url,
            buildColdStartBreadcrumb(url),
          ),
          pinned: false,
        });
        return;
      }

      const {
        activeTabId: currentTabId,
        tabIds,
        tabCount,
      } = tabStateRef.current;

      if (isShortcutPressed(e, shortcuts.closeTab)) {
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
      if (isShortcutPressed(e, shortcuts.reopenClosedTab)) {
        e.preventDefault();
        reopenClosedTab();
      }
    },
    [
      shortcuts.createTask,
      shortcuts.newTab,
      shortcuts.closeTab,
      shortcuts.reopenClosedTab,
      activeWorkspaceId,
      openCreateTaskDialog,
      openTab,
      closeTab,
      setActiveTab,
      reopenClosedTab,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
