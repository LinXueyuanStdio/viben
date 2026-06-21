import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import { useOverlayContext } from "./overlay-context";
import { useOverlay } from "@/hooks/use-overlay";
import { DOMZIndex } from "@/types/overlay";

export function OverlayCanvas(): ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const { app, isReady } = useOverlayContext();
  const { opacity } = useOverlay();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !app || !isReady) return;

    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);

    return () => {
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, [app, isReady]);

  if (!isReady) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: DOMZIndex.OverlayCanvas,
        opacity,
      }}
    />
  );
}
