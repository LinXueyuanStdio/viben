import { useEffect, useRef } from "react";
import { Container, Graphics } from "pixi.js";
import { useOverlayContext } from "../overlay-context";
import { useWave } from "@/hooks/use-wave";
import { PixiZIndex } from "@/types/overlay";
import type { WaveAnimationParams } from "@/types/overlay";
import { WAVE_PARAMS } from "@/lib/overlay/constants";

// 黄金比例，用于波形频率比
const PHI = 1.618033988749895;

// 音量映射常量 (dBFS)
const MIN_DB = -60;
const MAX_DB = -10; // 人声通常在 -30 到 -10 dB

// 彩虹色相循环速度 (度/秒)
const RAINBOW_HUE_SPEED = 30;

/**
 * HSV 转 RGB
 * @param h 色相 0-360
 * @param s 饱和度 0-1
 * @param v 明度 0-1
 * @returns [r, g, b] 0-255
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

/**
 * dBFS 音量映射 - 更敏感的对数映射
 * 将线性音量 (0-1) 转换为感知音量
 */
function mapAudioLevel(linearLevel: number): number {
  if (linearLevel <= 0.001) return 0;

  // 转换为 dBFS
  const dbfs = 20 * Math.log10(linearLevel);

  // 映射到 0-1 范围 (使用更宽的动态范围)
  const normalized = (dbfs - MIN_DB) / (MAX_DB - MIN_DB);

  // 限制范围
  const clamped = Math.max(0, Math.min(1, normalized));

  // 使用立方根进一步增强低音量响应（比平方根更敏感）
  return Math.pow(clamped, 0.33);
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

function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

export function WaveLayer(): null {
  const { app, isReady } = useOverlayContext();
  const { enabled, state, config } = useWave();

  const containerRef = useRef<Container | null>(null);
  const graphicsRef = useRef<Graphics | null>(null);
  const timeRef = useRef(0);
  const breathTimeRef = useRef(0); // 呼吸感时间
  const rainbowHueRef = useRef(0); // 彩虹色相 (0-360)

  // 平滑过渡相关 - 修复：保存 fromSnapshot
  const fromParamsSnapshotRef = useRef<WaveAnimationParams | null>(null);
  const currentParamsRef = useRef<WaveAnimationParams | null>(null);
  const targetParamsRef = useRef<WaveAnimationParams | null>(null);
  const transitionProgressRef = useRef(1);
  const prevStateRef = useRef(state);

  // 展开/收缩动画
  const spreadProgressRef = useRef(0);
  const isExpandingRef = useRef(false);
  const isCollapsingRef = useRef(false);

  // 使用 ref 跟踪 audioLevel 以避免闭包问题
  const audioLevelRef = useRef(config.audioLevel ?? 0);

  // 缓存窗口宽度，避免每帧读取
  const windowWidthRef = useRef(window.innerWidth);

  useEffect(() => {
    if (!app || !isReady) return;

    const container = new Container();
    container.zIndex = PixiZIndex.StatusWave;
    app.stage.addChild(container);
    containerRef.current = container;

    const graphics = new Graphics();
    container.addChild(graphics);
    graphicsRef.current = graphics;

    // 监听窗口大小变化
    const handleResize = () => {
      windowWidthRef.current = window.innerWidth;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      container.destroy({ children: true });
      containerRef.current = null;
      graphicsRef.current = null;
    };
  }, [app, isReady]);

  // 更新 audioLevel ref 并添加调试日志
  useEffect(() => {
    const newLevel = config.audioLevel ?? 0;
    if (newLevel > 0.01 && Math.random() < 0.05) {
      console.log("[WaveLayer] audioLevel updated:", newLevel.toFixed(3));
    }
    audioLevelRef.current = newLevel;
  }, [config.audioLevel]);

  useEffect(() => {
    if (!app || !isReady || !enabled) return;

    const graphics = graphicsRef.current;
    if (!graphics) return;

    const height = config.height;
    const transitionDuration = 0.7; // P1: 延长过渡时间
    const expandDuration = 0.5;     // 展开快速
    const collapseDuration = 0.9;   // 收缩缓慢（不对称时间）

    // 检测状态变化
    if (prevStateRef.current !== state) {
      // 保存当前参数作为起始快照（修复 P0 bug）
      fromParamsSnapshotRef.current = currentParamsRef.current
        ? { ...currentParamsRef.current }
        : { ...WAVE_PARAMS[prevStateRef.current] };
      targetParamsRef.current = { ...WAVE_PARAMS[state] };
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
      currentParamsRef.current = { ...WAVE_PARAMS[state] };
      targetParamsRef.current = { ...WAVE_PARAMS[state] };
      fromParamsSnapshotRef.current = { ...WAVE_PARAMS[state] };
      if (state !== "idle") {
        spreadProgressRef.current = 1;
      }
    }

    const tick = (ticker: { deltaMS: number }): void => {
      const deltaSeconds = ticker.deltaMS * 0.001;

      // 更新呼吸时间（P1: 添加呼吸感）
      breathTimeRef.current += deltaSeconds;

      // 更新彩虹色相 - 连续循环
      rainbowHueRef.current = (rainbowHueRef.current + deltaSeconds * RAINBOW_HUE_SPEED) % 360;

      // 更新参数过渡（修复 P0: 使用 fromSnapshot）
      if (transitionProgressRef.current < 1 && fromParamsSnapshotRef.current && targetParamsRef.current) {
        transitionProgressRef.current = Math.min(1, transitionProgressRef.current + deltaSeconds / transitionDuration);
        // 使用 easeInOutQuart 替代 easeOutCubic，两端都有缓冲
        const easedProgress = easeInOutQuart(transitionProgressRef.current);
        currentParamsRef.current = lerpParams(
          fromParamsSnapshotRef.current,  // 固定的起始快照
          targetParamsRef.current,
          easedProgress
        );
      }

      // 更新展开动画
      if (isExpandingRef.current) {
        spreadProgressRef.current = Math.min(1, spreadProgressRef.current + deltaSeconds / expandDuration);
        if (spreadProgressRef.current >= 1) {
          isExpandingRef.current = false;
        }
      }

      // 更新收缩动画 - 使用更平滑的缓动
      if (isCollapsingRef.current) {
        // 使用 ease-in-out 让收缩末端更柔和
        const collapseSpeed = 1 / collapseDuration;
        // 末端减速：当接近 0 时减慢收缩速度
        const speedFactor = 0.5 + spreadProgressRef.current * 0.5;
        spreadProgressRef.current = Math.max(0, spreadProgressRef.current - deltaSeconds * collapseSpeed * speedFactor);
        if (spreadProgressRef.current <= 0.01) {
          spreadProgressRef.current = 0;
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

      // dBFS 音量映射 - 对数映射更符合人耳感知
      const rawAudioLevel = audioLevelRef.current;
      const audioLevel = mapAudioLevel(rawAudioLevel);

      // 音量驱动波浪振幅（现在同时监控麦克风和系统音频）
      const audioBoost = 1 + audioLevel * 3;

      // 调试：确认 tick 中的音量值
      if (rawAudioLevel > 0.05 && Math.random() < 0.02) {
        console.log("[WaveLayer tick] state:", state, "raw:", rawAudioLevel.toFixed(3), "boost:", audioBoost.toFixed(2));
      }

      // P1: 添加呼吸感 - 周期性振幅调制 (0.4Hz，即 2.5 秒一个呼吸周期)
      const breathCycle = Math.sin(breathTimeRef.current * 0.4 * Math.PI * 2) * 0.5 + 0.5; // 0-1
      const breathModulation = 0.85 + breathCycle * 0.15; // 0.85 - 1.0

      // 限制最大振幅
      const maxAmplitude = height * 0.45;
      const effectiveAmplitude = Math.min(params.amplitude * audioBoost * breathModulation, maxAmplitude);

      timeRef.current += deltaSeconds * params.speed * config.speed;
      const width = windowWidthRef.current;
      const centerX = width / 2;

      // 展开/收缩都使用 easeOutCubic（末段柔和）
      const easedSpread = easeOutCubic(spreadProgressRef.current);

      const spreadWidth = width * easedSpread;
      const leftEdge = centerX - spreadWidth / 2;
      const rightEdge = centerX + spreadWidth / 2;

      // 收缩时的垂直偏移：从底部向顶部收拢
      // spreadProgress: 1 -> 0，verticalOffset: 0 -> height * 0.5（移动到顶部）
      const collapseVerticalProgress = isCollapsingRef.current ? (1 - spreadProgressRef.current) : 0;
      const verticalOffset = collapseVerticalProgress * height * 0.4; // 向上移动

      // 收缩时振幅逐渐减小
      const collapseAmplitudeScale = isCollapsingRef.current ? spreadProgressRef.current : 1;

      graphics.clear();

      // 收缩到很小时提前退出，避免截断
      if (spreadWidth < 30 || (isCollapsingRef.current && spreadProgressRef.current < 0.05)) {
        graphics.clear();
        return;
      }

      // 边缘渐隐 - 收缩时增加渐隐范围，使末端更柔和
      const baseEdgeFadeRatio = 0.25;
      // 收缩时渐隐区域扩大，使两端消失更自然
      const collapseEdgeFadeBoost = isCollapsingRef.current ? (1 - spreadProgressRef.current) * 0.5 : 0;
      const edgeFadeRatio = baseEdgeFadeRatio + collapseEdgeFadeBoost;
      const edgeFadeWidth = spreadWidth * edgeFadeRatio;

      for (let layer = 0; layer < params.layers; layer++) {
        // P2: 层间相位使用更大偏移，产生立体感
        const layerOffset = layer * (Math.PI * 2 / params.layers);

        // P2: 透明度使用指数衰减，增强层次感
        const baseAlpha = Math.min(1, Math.max(0, (config.opacity ?? 0.7) * Math.pow(0.65, layer)));

        // 彩虹色：每层色相偏移，产生渐变效果
        const layerHueOffset = layer * 25; // 每层偏移 25 度
        const layerHue = (rainbowHueRef.current + layerHueOffset) % 360;

        // P2: 明度随层递减，后层更暗
        const layerBrightness = 0.95 - layer * 0.06; // 0.95, 0.89, 0.83, 0.77
        const [baseR, baseG, baseB] = hsvToRgb(layerHue, 0.85, layerBrightness);
        const r = baseR;
        const g = baseG;
        const b = baseB;

        const step = 6;

        for (let segX = leftEdge; segX < rightEdge; segX += step) {
          const segmentRight = Math.min(segX + step, rightEdge);
          const segmentCenterX = (segX + segmentRight) / 2;

          const distFromLeft = segmentCenterX - leftEdge;
          const distFromRight = rightEdge - segmentCenterX;
          const minDistFromEdge = Math.min(distFromLeft, distFromRight);

          const safeEdgeFadeWidth = Math.max(1, edgeFadeWidth);
          const edgeFade = Math.min(1, Math.max(0, minDistFromEdge / safeEdgeFadeWidth));

          const smoothEdgeFade = edgeFade * edgeFade * (3 - 2 * edgeFade);
          const segmentAlpha = Math.min(1, Math.max(0, baseAlpha * smoothEdgeFade));

          if (segmentAlpha < 0.01) continue;

          const wavePoints: { x: number; y: number }[] = [];

          for (let wx = segX; wx <= segmentRight + 1; wx += 2) {
            const clampedWx = Math.min(wx, segmentRight);
            const normalizedX = clampedWx / width;

            // P2: 波形频率比使用黄金比例，避免周期重复
            const wave1 = Math.sin((normalizedX * params.frequency * Math.PI * 2) + timeRef.current + layerOffset);
            const wave2 = Math.sin((normalizedX * params.frequency * PHI * Math.PI * 2) + timeRef.current * Math.sqrt(1.5) + layerOffset);
            const combined = (wave1 + wave2 * 0.5) / 1.5;

            const concaveFactor = config.concave
              ? Math.max(0.1, 4 * Math.pow(normalizedX - 0.5, 2))
              : 1;

            // 基础 Y 位置 + 收缩时的振幅衰减和垂直偏移
            const baseY = height * 0.5 - verticalOffset;
            const y = baseY + combined * effectiveAmplitude * concaveFactor * collapseAmplitudeScale;
            wavePoints.push({ x: clampedWx, y });
          }

          if (wavePoints.length < 2) continue;

          const hexColor = (r << 16) | (g << 8) | b;

          graphics.moveTo(wavePoints[0].x, 0);
          graphics.lineTo(wavePoints[wavePoints.length - 1].x, 0);

          for (let i = wavePoints.length - 1; i >= 0; i--) {
            graphics.lineTo(wavePoints[i].x, wavePoints[i].y);
          }

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
