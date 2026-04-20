import { useEffect, useRef } from "react";
import { Container, Graphics } from "pixi.js";
import { useOverlayContext } from "../overlay-provider";
import { useWave } from "@/hooks/use-wave";
import { PixiZIndex } from "@/types/overlay";
import { WAVE_THEMES, WAVE_PARAMS } from "@/lib/overlay/constants";

export function WaveLayer(): null {
  const { app, isReady } = useOverlayContext();
  const { enabled, state, config } = useWave();

  const containerRef = useRef<Container | null>(null);
  const graphicsRef = useRef<Graphics | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    if (!app || !isReady) return;

    const container = new Container();
    container.zIndex = PixiZIndex.StatusWave;
    app.stage.addChild(container);
    containerRef.current = container;

    const graphics = new Graphics();
    container.addChild(graphics);
    graphicsRef.current = graphics;

    return () => {
      container.destroy({ children: true });
      containerRef.current = null;
      graphicsRef.current = null;
    };
  }, [app, isReady]);

  useEffect(() => {
    if (!app || !isReady || !enabled || state === "idle") return;

    const graphics = graphicsRef.current;
    if (!graphics) return;

    // Reset time when state changes for smooth transition
    timeRef.current = 0;

    const theme = config.customThemes?.[state] ?? WAVE_THEMES[state];
    const params = WAVE_PARAMS[state];
    const height = config.height;

    const tick = (ticker: { deltaMS: number }): void => {
      timeRef.current += ticker.deltaMS * 0.001 * params.speed * config.speed;
      const t = timeRef.current;
      const width = window.innerWidth; // Read inside tick for resize support

      graphics.clear();

      for (let layer = 0; layer < params.layers; layer++) {
        const layerOffset = layer * 0.3;
        const layerAlpha = config.opacity * (1 - layer * 0.2);
        const color = layer % 2 === 0 ? theme.primary : theme.secondary;

        graphics.moveTo(0, 0);

        for (let x = 0; x <= width; x += 4) {
          const normalizedX = x / width;
          const wave1 = Math.sin((normalizedX * params.frequency * Math.PI * 2) + t + layerOffset);
          const wave2 = Math.sin((normalizedX * params.frequency * 1.5 * Math.PI * 2) + t * 1.3 + layerOffset);
          const combined = (wave1 + wave2 * 0.5) / 1.5;
          const y = height * 0.5 + combined * params.amplitude;

          graphics.lineTo(x, y);
        }

        graphics.lineTo(width, height);
        graphics.lineTo(0, height);
        graphics.closePath();
        graphics.fill({ color, alpha: layerAlpha });
      }
    };

    app.ticker.add(tick);
    return () => {
      app.ticker.remove(tick);
      if (graphicsRef.current) {
        graphicsRef.current.clear();
      }
    };
  }, [app, isReady, enabled, state, config]);

  return null;
}
