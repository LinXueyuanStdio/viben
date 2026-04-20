import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { useOverlayStore } from "@/stores/overlay-store";
import { loadOverlayConfig } from "@/lib/overlay-config";

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
    const registeredShortcuts: string[] = [];
    let isUnmounted = false;

    const setupShortcuts = async (): Promise<void> => {
      try {
        const config = await loadOverlayConfig();
        const shortcuts = config.shortcuts;

        const toRegister = [
          { key: shortcuts.toggleOverlay, handler: () => actions.toggle() },
          {
            key: shortcuts.toggleDanmaku,
            handler: () => {
              const current = useOverlayStore.getState().danmakuEnabled;
              actions.setDanmakuEnabled(!current);
            },
          },
          {
            key: shortcuts.toggleSubtitle,
            handler: () => {
              const current = useOverlayStore.getState().subtitleEnabled;
              actions.setSubtitleEnabled(!current);
            },
          },
          {
            key: shortcuts.toggleClickIndicator,
            handler: () => {
              const current = useOverlayStore.getState().clickEnabled;
              actions.setClickEnabled(!current);
            },
          },
          {
            key: shortcuts.toggleKeystroke,
            handler: () => {
              const current = useOverlayStore.getState().keystrokeEnabled;
              actions.setKeystrokeEnabled(!current);
            },
          },
        ];

        for (const { key, handler } of toRegister) {
          if (isUnmounted) break;
          await register(key, handler);
          registeredShortcuts.push(key);
        }
      } catch (error) {
        console.warn("[Overlay] Failed to register shortcuts:", error);
      }
    };

    setupShortcuts();

    return () => {
      isUnmounted = true;
      Promise.all(registeredShortcuts.map((key) => unregister(key))).catch(
        (err) => console.warn("[Overlay] Failed to unregister shortcuts:", err)
      );
    };
  }, [actions]);
}
