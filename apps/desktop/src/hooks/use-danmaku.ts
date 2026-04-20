import { useCallback, useMemo } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import type { DanmakuItem, DanmakuConfig } from "@/types/overlay";

interface UseDanmakuReturn {
  enabled: boolean;
  items: DanmakuItem[];
  config: DanmakuConfig;
  paused: boolean;
  send: (text: string, options?: Partial<DanmakuItem>) => void;
  sendBatch: (texts: string[], options?: Partial<DanmakuItem>) => void;
  clear: () => void;
  pause: () => void;
  resume: () => void;
  remove: (id: string) => void;
  setEnabled: (enabled: boolean) => void;
}

export function useDanmaku(): UseDanmakuReturn {
  const store = useOverlayStore();
  const {
    danmakuEnabled: enabled,
    danmakuItems: items,
    danmakuConfig: config,
    danmakuPaused: paused,
    actions,
  } = store;

  const sendBatch = useCallback(
    (texts: string[], options?: Partial<DanmakuItem>) => {
      const interval = 100;
      texts.forEach((text, i) => {
        setTimeout(() => {
          actions.sendDanmaku(text, options);
        }, i * interval);
      });
    },
    [actions]
  );

  return useMemo(
    () => ({
      enabled,
      items,
      config,
      paused,
      send: actions.sendDanmaku,
      sendBatch,
      clear: actions.clearDanmaku,
      pause: actions.pauseDanmaku,
      resume: actions.resumeDanmaku,
      remove: actions.removeDanmaku,
      setEnabled: actions.setDanmakuEnabled,
    }),
    [enabled, items, config, paused, actions, sendBatch]
  );
}
