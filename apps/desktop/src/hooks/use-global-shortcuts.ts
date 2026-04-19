import { useEffect } from "react";
import { useUiStore } from "@/stores";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";

/**
 * Global keyboard shortcuts for the application.
 *
 * Registered shortcuts:
 * - Ctrl+Shift+J: Open create task dialog
 */
export function useGlobalShortcuts() {
  const { openCreateTaskDialog } = useUiStore();
  const { activeWorkspaceId } = useLocalWorkspaces();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+J: Open create task dialog
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        // Only open if there's an active workspace
        if (activeWorkspaceId) {
          openCreateTaskDialog();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCreateTaskDialog, activeWorkspaceId]);
}
