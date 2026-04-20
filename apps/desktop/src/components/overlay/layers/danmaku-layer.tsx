import { useEffect, useRef, useCallback } from "react";
import { Container, Text, TextStyle } from "pixi.js";
import { useOverlayContext } from "../overlay-provider";
import { useDanmaku } from "@/hooks/use-danmaku";
import { PixiZIndex } from "@/types/overlay";
import type { DanmakuItem } from "@/types/overlay";
import { SPEED_VALUES, PERFORMANCE_LIMITS } from "@/lib/overlay/constants";

interface ActiveDanmaku {
  item: DanmakuItem;
  text: Text;
  x: number;
  track: number;
  speed: number;
}

export function DanmakuLayer(): null {
  const { app, trackAllocator, isReady } = useOverlayContext();
  const { enabled, items, config, paused, remove } = useDanmaku();

  const containerRef = useRef<Container | null>(null);
  const activeDanmakuRef = useRef<Map<string, ActiveDanmaku>>(new Map());
  const processedIdsRef = useRef<Set<string>>(new Set());

  const getTrackY = useCallback(
    (track: number): number => {
      const trackHeight = (config.maxTracks > 0 ? window.innerHeight * 0.4 : 200) / config.maxTracks;
      return 20 + track * trackHeight;
    },
    [config.maxTracks]
  );

  useEffect(() => {
    if (!app || !isReady) return;

    const container = new Container();
    container.zIndex = PixiZIndex.Danmaku;
    container.sortableChildren = true;
    app.stage.addChild(container);
    containerRef.current = container;

    return () => {
      container.destroy({ children: true });
      containerRef.current = null;
      activeDanmakuRef.current.clear();
      processedIdsRef.current.clear();
    };
  }, [app, isReady]);

  useEffect(() => {
    if (!containerRef.current || !enabled) return;

    const container = containerRef.current;

    for (const item of items) {
      if (processedIdsRef.current.has(item.id)) continue;
      if (activeDanmakuRef.current.size >= PERFORMANCE_LIMITS.maxDanmakuOnScreen) continue;

      processedIdsRef.current.add(item.id);

      const speedKey = item.speed ?? "normal";
      const pixelSpeed = SPEED_VALUES[speedKey];
      const duration = (window.innerWidth + 400) / pixelSpeed * 1000;

      const track = trackAllocator.allocate(item, duration);
      if (track < 0) {
        remove(item.id);
        continue;
      }

      const style = new TextStyle({
        fontFamily: config.fontFamily,
        fontSize: item.fontSize ?? 24,
        fill: item.color ?? "#ffffff",
        dropShadow: {
          color: "#000000",
          blur: 2,
          distance: 1,
        },
      });

      const text = new Text({ text: item.text, style });
      text.x = window.innerWidth + 10;
      text.y = getTrackY(track);
      text.alpha = config.opacity;

      container.addChild(text);

      activeDanmakuRef.current.set(item.id, {
        item,
        text,
        x: text.x,
        track,
        speed: pixelSpeed,
      });
    }
  }, [items, enabled, config, trackAllocator, remove, getTrackY]);

  useEffect(() => {
    if (!app || !isReady || !enabled) return;

    const tick = (ticker: { deltaMS: number }): void => {
      if (paused) return;

      const delta = ticker.deltaMS / 1000;
      const toRemove: string[] = [];

      for (const [id, active] of activeDanmakuRef.current) {
        active.x -= active.speed * delta;
        active.text.x = active.x;

        if (active.x < -active.text.width - 50) {
          toRemove.push(id);
        }
      }

      for (const id of toRemove) {
        const active = activeDanmakuRef.current.get(id);
        if (active) {
          trackAllocator.release(active.track, id);
          active.text.destroy();
          activeDanmakuRef.current.delete(id);
          processedIdsRef.current.delete(id);
          remove(id);
        }
      }
    };

    app.ticker.add(tick);
    return () => {
      app.ticker.remove(tick);
    };
  }, [app, isReady, enabled, paused, trackAllocator, remove]);

  return null;
}
