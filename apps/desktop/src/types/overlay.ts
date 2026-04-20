// === Z-Index 定义 ===
export enum PixiZIndex {
  Background = 0,
  StatusWave = 5,
  Live2D = 10,
  Subtitle = 20,
  DialogueBox = 30,
  ClickIndicator = 40,
  Keystroke = 50,
  Danmaku = 60,
  Custom = 100,
}

export enum DOMZIndex {
  OverlayCanvas = 9998,
  InteractiveLayer = 9999,
}

// === 弹幕 ===
export interface DanmakuItem {
  id: string;
  text: string;
  color?: string;
  fontSize?: number;
  speed?: "slow" | "normal" | "fast";
  track?: number;
  timestamp: number;
}

export interface DanmakuConfig {
  maxTracks: number;
  defaultSpeed: number;
  opacity: number;
  fontFamily: string;
}

// === 字幕 ===
export interface SubtitleItem {
  id: string;
  text: string;
  position: "top" | "center" | "bottom";
  style: "plain" | "dialogue" | "narrator";
  speaker?: string;
  duration?: number;
  animation?: "fade" | "typewriter" | "slide";
}

export interface SubtitleConfig {
  defaultPosition: "top" | "center" | "bottom";
  defaultDuration: number;
  fontSize: number;
  backgroundColor: string;
  padding: number;
}

export interface StreamingSubtitleState {
  id: string;
  text: string;
  isStreaming: boolean;
  cursor?: boolean;
  options?: Partial<SubtitleItem>;
}

// === 点击指示器 ===
export interface ClickEffect {
  id: string;
  x: number;
  y: number;
  button: "left" | "right" | "middle";
  timestamp: number;
}

export type ClickStyle = "ripple" | "spotlight" | "ring";

// === 按键可视化 ===
export interface KeystrokeItem {
  id: string;
  keys: string[];
  displayText: string;
  timestamp: number;
}

export type KeystrokePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// === 状态波浪 ===
export type WaveState =
  | "idle"
  | "listening"
  | "speaking-calm"
  | "speaking-excited"
  | "speaking-happy"
  | "ending";

export interface WaveColorTheme {
  primary: string;
  secondary: string;
  accent?: string;
}

export interface WaveConfig {
  enabled: boolean;
  height: number;
  opacity: number;
  speed: number;
  particlesEnabled: boolean;
  customThemes?: Partial<Record<WaveState, WaveColorTheme>>;
}

export interface WaveAnimationParams {
  amplitude: number;
  frequency: number;
  speed: number;
  layers: number;
  particles?: {
    count: number;
    size: number;
    speed: number;
  };
}

// === 快捷键 ===
export interface OverlayShortcuts {
  toggleOverlay: string;
  toggleDanmaku: string;
  toggleKeystroke: string;
  toggleClickIndicator: string;
  toggleSubtitle: string;
}

// === 完整设置 ===
export interface OverlaySettings {
  version: number;
  default_enabled: boolean;
  opacity: number;

  danmaku: {
    enabled: boolean;
    max_tracks: number;
    speed: "slow" | "normal" | "fast";
    font_size: number;
    opacity: number;
  };

  subtitle: {
    enabled: boolean;
    position: "top" | "center" | "bottom";
    font_size: number;
    background_color: string;
    default_animation: "fade" | "typewriter" | "slide";
  };

  click_indicator: {
    enabled: boolean;
    style: ClickStyle;
    color: string;
    size: number;
  };

  keystroke: {
    enabled: boolean;
    position: KeystrokePosition;
    show_modifiers_only: boolean;
    show_keys: string[];
    duration: number;
  };

  wave: {
    enabled: boolean;
    height: number;
    opacity: number;
    speed: number;
    particles_enabled: boolean;
    custom_themes?: Partial<Record<WaveState, WaveColorTheme>>;
  };

  shortcuts: OverlayShortcuts;
}
