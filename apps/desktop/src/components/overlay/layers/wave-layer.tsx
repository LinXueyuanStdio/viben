import { useEffect, useRef } from "react";
import { Container, Graphics } from "pixi.js";
import { useOverlayContext } from "../overlay-context";
import { useWave } from "@/hooks/use-wave";
import { PixiZIndex } from "@/types/overlay";
import type { WaveAnimationParams } from "@/types/overlay";
import { WAVE_PARAMS } from "@/lib/overlay/constants";

/**
 * HSV 转 RGB
 */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpParams(from: WaveAnimationParams, to: WaveAnimationParams, t: number): WaveAnimationParams {
  return {
    amplitude: lerp(from.amplitude, to.amplitude, t),
    frequency: lerp(from.frequency, to.frequency, t),
    speed: lerp(from.speed, to.speed, t),
    layers: Math.round(lerp(from.layers, to.layers, t)),
  };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

export function WaveLayer(): null {
  const { app, isReady } = useOverlayContext();
  const { enabled, state, config } = useWave();

  const containerRef = useRef<Container | null>(null);
  const graphicsRef = useRef<Graphics | null>(null);
  const timeRef = useRef(0);

  // 平滑过渡相关
  const currentParamsRef = useRef<WaveAnimationParams | null>(null);
  const targetParamsRef = useRef<WaveAnimationParams | null>(null);
  const transitionProgressRef = useRef(1);
  const prevStateRef = useRef(state);

  // 展开/收缩动画
  const spreadProgressRef = useRef(0); // 0 = 完全收缩, 1 = 完全展开
  const isExpandingRef = useRef(false);
  const isCollapsingRef = useRef(false);

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
    if (!app || !isReady || !enabled) return;

    const graphics = graphicsRef.current;
    if (!graphics) return;

    const height = config.height;
    const transitionDuration = 0.5;
    const spreadDuration = 0.6;

    // 检测状态变化
    if (prevStateRef.current !== state) {
      const fromParams = currentParamsRef.current ?? WAVE_PARAMS[prevStateRef.current];
      const toParams = WAVE_PARAMS[state];

      currentParamsRef.current = fromParams;
      targetParamsRef.current = toParams;
      transitionProgressRef.current = 0;

      // 从 idle 进入其他状态：展开动画
      if (prevStateRef.current === "idle" && state !== "idle") {
        isExpandingRef.current = true;
        isCollapsingRef.current = false;
        spreadProgressRef.current = 0;
      }
      // 进入 idle 或 ending 状态：收缩动画
      else if (state === "idle" || state === "ending") {
        isExpandingRef.current = false;
        isCollapsingRef.current = true;
      }

      prevStateRef.current = state;
    }

    // 初始化参数
    if (!currentParamsRef.current) {
      currentParamsRef.current = WAVE_PARAMS[state];
      targetParamsRef.current = WAVE_PARAMS[state];
      if (state !== "idle") {
        spreadProgressRef.current = 1;
      }
    }

    const tick = (ticker: { deltaMS: number }): void => {
      const deltaSeconds = ticker.deltaMS * 0.001;

      // 更新参数过渡
      if (transitionProgressRef.current < 1) {
        transitionProgressRef.current = Math.min(1, transitionProgressRef.current + deltaSeconds / transitionDuration);
        const easedProgress = easeOutCubic(transitionProgressRef.current);
        currentParamsRef.current = lerpParams(
          currentParamsRef.current!,
          targetParamsRef.current!,
          easedProgress
        );
      }

      // 更新展开动画
      if (isExpandingRef.current) {
        spreadProgressRef.current = Math.min(1, spreadProgressRef.current + deltaSeconds / spreadDuration);
        if (spreadProgressRef.current >= 1) {
          isExpandingRef.current = false;
        }
      }

      // 更新收缩动画
      if (isCollapsingRef.current) {
        spreadProgressRef.current = Math.max(0, spreadProgressRef.current - deltaSeconds / spreadDuration);
        if (spreadProgressRef.current <= 0) {
          isCollapsingRef.current = false;
          graphics.clear();
          return;
        }
      }

      // 完全收缩时不绘制
      if (spreadProgressRef.current <= 0 && !isExpandingRef.current) {
        graphics.clear();
        return;
      }

      const params = currentParamsRef.current!;
      const audioBoost = 1 + (config.audioLevel ?? 0) * 1.5;
      const effectiveAmplitude = params.amplitude * audioBoost;

      timeRef.current += deltaSeconds * params.speed * config.speed;
      const width = window.innerWidth;
      const centerX = width / 2;

      // 计算展开进度（带缓动）
      const easedSpread = isExpandingRef.current
        ? easeOutCubic(spreadProgressRef.current)
        : isCollapsingRef.current
          ? easeInCubic(spreadProgressRef.current)
          : spreadProgressRef.current;

      const spreadWidth = width * easedSpread;
      const leftEdge = centerX - spreadWidth / 2;
      const rightEdge = centerX + spreadWidth / 2;

      graphics.clear();

      if (spreadWidth < 10) return;

      // 边缘渐隐宽度（占展开宽度的比例）
      const edgeFadeRatio = 0.2;
      const edgeFadeWidth = spreadWidth * edgeFadeRatio;

      for (let layer = 0; layer < params.layers; layer++) {
        const layerOffset = layer * 0.3;
        // 确保 baseAlpha 在 0-1 范围
        const baseAlpha = Math.min(1, Math.max(0, (config.opacity ?? 0.7) * (1 - layer * 0.15)));

        // 计算当前时间对应的色相（缓慢变化的彩虹色）
        const hue = ((timeRef.current * 20) + (layer * 60)) % 360;
        const [r, g, b] = hsvToRgb(hue, 0.7, 1.0);

        // 使用更小的段宽度以获得更平滑的边缘渐隐
        const step = 6; // 每段宽度

        for (let segX = leftEdge; segX < rightEdge; segX += step) {
          const segmentRight = Math.min(segX + step, rightEdge);
          const segmentCenterX = (segX + segmentRight) / 2;

          // 计算该段的边缘渐隐系数
          const distFromLeft = segmentCenterX - leftEdge;
          const distFromRight = rightEdge - segmentCenterX;
          const minDistFromEdge = Math.min(distFromLeft, distFromRight);

          // 确保 edgeFadeWidth 不为 0
          const safeEdgeFadeWidth = Math.max(1, edgeFadeWidth);
          const edgeFade = Math.min(1, Math.max(0, minDistFromEdge / safeEdgeFadeWidth));

          // smoothstep 边缘渐隐
          const smoothEdgeFade = edgeFade * edgeFade * (3 - 2 * edgeFade);

          // 该段的透明度（确保在 0-1 范围）
          const segmentAlpha = Math.min(1, Math.max(0, baseAlpha * smoothEdgeFade));

          // 跳过几乎透明的段
          if (segmentAlpha < 0.01) continue;

          // 计算该段的波浪点
          const wavePoints: { x: number; y: number }[] = [];

          // 从左到右计算波浪形状
          for (let wx = segX; wx <= segmentRight + 1; wx += 2) {
            const clampedWx = Math.min(wx, segmentRight);
            const normalizedX = clampedWx / width;
            const wave1 = Math.sin((normalizedX * params.frequency * Math.PI * 2) + timeRef.current + layerOffset);
            const wave2 = Math.sin((normalizedX * params.frequency * 1.5 * Math.PI * 2) + timeRef.current * 1.3 + layerOffset);
            const combined = (wave1 + wave2 * 0.5) / 1.5;

            const concaveFactor = config.concave
              ? Math.max(0.1, 4 * Math.pow(normalizedX - 0.5, 2))
              : 1;

            const y = height * 0.5 + combined * effectiveAmplitude * concaveFactor;
            wavePoints.push({ x: clampedWx, y });
          }

          if (wavePoints.length < 2) continue;

          // 使用纯色填充，通过 alpha 控制透明度
          // 边缘渐隐已经通过 segmentAlpha 实现
          const hexColor = (r << 16) | (g << 8) | b;

          // 绘制填充形状（顶部边缘 -> 波浪线 -> 顶部边缘）
          graphics.moveTo(wavePoints[0].x, 0);

          // 顶部直线到右端
          graphics.lineTo(wavePoints[wavePoints.length - 1].x, 0);

          // 从右到左绘制波浪线
          for (let i = wavePoints.length - 1; i >= 0; i--) {
            graphics.lineTo(wavePoints[i].x, wavePoints[i].y);
          }

          // 回到起点
          graphics.lineTo(wavePoints[0].x, 0);

          graphics.fill({ color: hexColor, alpha: segmentAlpha });
        }
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
