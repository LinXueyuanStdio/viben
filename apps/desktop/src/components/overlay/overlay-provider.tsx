import type { ReactNode, ReactElement } from "react";
import { createContext, useContext, useMemo, useEffect, useState } from "react";
import { Application } from "pixi.js";
import { useOverlay } from "@/hooks/use-overlay";
import { useGlobalInput } from "@/hooks/use-global-input";
import { useOverlayShortcuts } from "@/hooks/use-overlay-shortcuts";
import { DanmakuPool } from "@/lib/overlay/danmaku-pool";
import { GreedyTrackAllocator } from "@/lib/overlay/track-allocator";

interface OverlayContextValue {
  app: Application | null;
  danmakuPool: DanmakuPool;
  trackAllocator: GreedyTrackAllocator;
  isReady: boolean;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOverlayContext(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) {
    throw new Error("useOverlayContext must be used within OverlayProvider");
  }
  return ctx;
}

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

    const pixiApp = new Application();

    pixiApp
      .init({
        backgroundAlpha: 0,
        resizeTo: window,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        setApp(pixiApp);
        setIsReady(true);
      })
      .catch(console.error);

    return () => {
      pixiApp.destroy(true, { children: true });
      danmakuPool.destroy();
    };
  }, [configLoaded, danmakuPool]);

  const value = useMemo(
    () => ({ app, danmakuPool, trackAllocator, isReady }),
    [app, danmakuPool, trackAllocator, isReady]
  );

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}
