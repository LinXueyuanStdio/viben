import type { WaveState, WaveColorTheme, WaveAnimationParams } from "@/types/overlay";

export const PERFORMANCE_LIMITS = {
  maxDanmakuOnScreen: 500,
  maxClickEffects: 10,
  maxKeystrokeItems: 5,
  maxInteractiveElements: 20,
  danmakuPoolSize: 350,
  clickEffectDuration: 400,
  keystrokeDuration: 1500,
  streamingCharInterval: 16,
  fpsThreshold: 30,
  degradedMaxDanmaku: 200,
  trackOverlapTolerance: 500,
} as const;

export const WAVE_THEMES: Record<WaveState, WaveColorTheme> = {
  idle: { primary: "#4a5568", secondary: "#2d3748" },
  listening: { primary: "#667eea", secondary: "#764ba2" },
  "speaking-calm": { primary: "#38b2ac", secondary: "#48bb78" },
  "speaking-excited": { primary: "#ed8936", secondary: "#f56565" },
  "speaking-happy": { primary: "#ed64a6", secondary: "#fbd38d", accent: "#faf089" },
  ending: { primary: "#a0aec0", secondary: "#718096" },
};

export const WAVE_PARAMS: Record<WaveState, WaveAnimationParams> = {
  idle: { amplitude: 5, frequency: 0.5, speed: 0.3, layers: 2 },
  listening: { amplitude: 15, frequency: 1, speed: 0.5, layers: 3 },
  "speaking-calm": { amplitude: 20, frequency: 1.2, speed: 0.6, layers: 3 },
  "speaking-excited": { amplitude: 35, frequency: 2, speed: 1.2, layers: 4 },
  "speaking-happy": {
    amplitude: 25,
    frequency: 1.5,
    speed: 0.8,
    layers: 4,
    particles: { count: 20, size: 4, speed: 1.5 },
  },
  ending: { amplitude: 10, frequency: 0.8, speed: 0.4, layers: 2 },
};

export const SPEED_VALUES: Record<"slow" | "normal" | "fast", number> = {
  slow: 80,
  normal: 150,
  fast: 250,
};
