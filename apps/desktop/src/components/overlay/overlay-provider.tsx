import type { ReactNode, ReactElement } from "react";
import { useMemo, useEffect, useState } from "react";
import { Application } from "pixi.js";
import { useOverlay } from "@/hooks/use-overlay";
import { useGlobalInput } from "@/hooks/use-global-input";
import { useOverlayShortcuts } from "@/hooks/use-overlay-shortcuts";
import { DanmakuPool } from "@/lib/overlay/danmaku-pool";
import { GreedyTrackAllocator } from "@/lib/overlay/track-allocator";
import { VoiceSubtitleLayer } from "./layers/voice-subtitle-layer";
import { AgentPopup } from "./agent-popup";
import { OverlayContext } from "./overlay-context";

// Re-export for backwards compatibility
export { useOverlayContext } from "./overlay-context";

interface OverlayProviderProps {
  children: ReactNode;
}

export function OverlayProvider({ children }: OverlayProviderProps): ReactElement {
  const { configLoaded } = useOverlay();
  const [app, setApp] = useState<Application | null>(null);
  const [isReady, setIsReady] = useState(false);

  useGlobalInput();
  useOverlayShortcuts();

  const danmakuPool = useMemo(() => new DanmakuPool(), []);
  const trackAllocator = useMemo(() => new GreedyTrackAllocator(), []);

  useEffect(() => {
    if (!configLoaded) return;

    let pixiApp: Application | null = null;
    let resizeHandler: (() => void) | null = null;

    const initApp = async () => {
      pixiApp = new Application();

      await pixiApp.init({
        backgroundAlpha: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      // 手动处理 resize，避免 PixiJS v8 的 resizeTo bug
      resizeHandler = () => {
        if (pixiApp?.renderer) {
          pixiApp.renderer.resize(window.innerWidth, window.innerHeight);
        }
      };
      window.addEventListener("resize", resizeHandler);

      setApp(pixiApp);
      setIsReady(true);
    };

    initApp().catch(console.error);

    return () => {
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      if (pixiApp) {
        pixiApp.destroy(true, { children: true });
      }
      danmakuPool.destroy();
    };
  }, [configLoaded, danmakuPool]);

  const value = useMemo(
    () => ({ app, danmakuPool, trackAllocator, isReady }),
    [app, danmakuPool, trackAllocator, isReady]
  );

  return (
    <OverlayContext.Provider value={value}>
      <VoiceSubtitleLayer />
      <AgentPopup />
      {children}
    </OverlayContext.Provider>
  );
}
