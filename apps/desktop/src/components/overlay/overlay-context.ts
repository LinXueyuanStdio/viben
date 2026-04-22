import { createContext, useContext } from "react";
import type { Application } from "pixi.js";
import type { DanmakuPool } from "@/lib/overlay/danmaku-pool";
import type { GreedyTrackAllocator } from "@/lib/overlay/track-allocator";

export interface OverlayContextValue {
  app: Application | null;
  danmakuPool: DanmakuPool;
  trackAllocator: GreedyTrackAllocator;
  isReady: boolean;
}

export const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOverlayContext(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) {
    throw new Error("useOverlayContext must be used within OverlayProvider");
  }
  return ctx;
}
