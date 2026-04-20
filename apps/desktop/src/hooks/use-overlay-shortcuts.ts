import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { useOverlayStore } from "@/stores/overlay-store";
import { loadOverlayConfig } from "@/lib/overlay-config";
import type { OverlayShortcuts } from "@/types/overlay";

/**
 * Registers global keyboard shortcuts for overlay controls.
 *
 * This hook uses Tauri's global-shortcut plugin to register OS-level shortcuts
 * that work even when the app is not focused.
 *
 * Default shortcuts (configurable in ~/.viben/overlay.yaml):
 * - toggleOverlay: CommandOrControl+Shift+O - Show/hide overlay
 * - toggleDanmaku: CommandOrControl+Shift+D - Toggle danmaku
 * - toggleSubtitle: CommandOrControl+Shift+S - Toggle subtitle
 * - toggleClickIndicator: CommandOrControl+Shift+C - Toggle click indicator
 * - toggleKeystroke: CommandOrControl+Shift+K - Toggle keystroke visualization
 */
export function useOverlayShortcuts(): void {
  const actions = useOverlayStore((s) => s.actions);

  useEffect(() => {
    let shortcuts: OverlayShortcuts | null = null;
    let isUnmounted = false;

    const setupShortcuts = async (): Promise<void> => {
      try {
        const config = await loadOverlayConfig();
        shortcuts = config.shortcuts;

        if (isUnmounted) return;

        await register(shortcuts.toggleOverlay, () => {
          actions.toggle();
        });

        await register(shortcuts.toggleDanmaku, () => {
          const current = useOverlayStore.getState().danmakuEnabled;
          actions.setDanmakuEnabled(!current);
        });

        await register(shortcuts.toggleSubtitle, () => {
          const current = useOverlayStore.getState().subtitleEnabled;
          actions.setSubtitleEnabled(!current);
        });

        await register(shortcuts.toggleClickIndicator, () => {
          const current = useOverlayStore.getState().clickEnabled;
          actions.setClickEnabled(!current);
        });

        await register(shortcuts.toggleKeystroke, () => {
          const current = useOverlayStore.getState().keystrokeEnabled;
          actions.setKeystrokeEnabled(!current);
        });
      } catch (error) {
        console.warn("[Overlay] Failed to register shortcuts:", error);
      }
    };

    setupShortcuts();

    return () => {
      isUnmounted = true;
      if (shortcuts) {
        Promise.all([
          unregister(shortcuts.toggleOverlay),
          unregister(shortcuts.toggleDanmaku),
          unregister(shortcuts.toggleSubtitle),
          unregister(shortcuts.toggleClickIndicator),
          unregister(shortcuts.toggleKeystroke),
        ]).catch(console.warn);
      }
    };
  }, [actions]);
}
