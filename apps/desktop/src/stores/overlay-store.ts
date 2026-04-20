import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  DanmakuItem,
  DanmakuConfig,
  SubtitleItem,
  SubtitleConfig,
  StreamingSubtitleState,
  ClickEffect,
  ClickStyle,
  KeystrokeItem,
  KeystrokePosition,
  WaveState,
  WaveConfig,
  OverlaySettings,
} from "@/types/overlay";
import { PERFORMANCE_LIMITS } from "@/lib/overlay/constants";

interface OverlayState {
  // Global
  visible: boolean;
  opacity: number;
  configLoaded: boolean;

  // Danmaku
  danmakuEnabled: boolean;
  danmakuItems: DanmakuItem[];
  danmakuConfig: DanmakuConfig;
  danmakuPaused: boolean;

  // Subtitle
  subtitleEnabled: boolean;
  currentSubtitle: SubtitleItem | null;
  subtitleQueue: SubtitleItem[];
  subtitleConfig: SubtitleConfig;
  streamingSubtitle: StreamingSubtitleState | null;

  // Click
  clickEnabled: boolean;
  clickStyle: ClickStyle;
  clickEffects: ClickEffect[];

  // Keystroke
  keystrokeEnabled: boolean;
  keystrokePosition: KeystrokePosition;
  keystrokeItems: KeystrokeItem[];
  keystrokeShowModifiersOnly: boolean;
  keystrokeShowKeys: string[];

  // Wave
  waveEnabled: boolean;
  waveState: WaveState;
  waveConfig: WaveConfig;
}

interface OverlayActions {
  // Config
  loadConfig: (settings: OverlaySettings) => void;

  // Global
  show: () => void;
  hide: () => void;
  toggle: () => void;
  setOpacity: (opacity: number) => void;

  // Danmaku
  sendDanmaku: (text: string, options?: Partial<DanmakuItem>) => void;
  clearDanmaku: () => void;
  pauseDanmaku: () => void;
  resumeDanmaku: () => void;
  removeDanmaku: (id: string) => void;
  setDanmakuEnabled: (enabled: boolean) => void;

  // Subtitle
  showSubtitle: (text: string, options?: Partial<SubtitleItem>) => void;
  hideSubtitle: () => void;
  setSubtitleEnabled: (enabled: boolean) => void;
  startStream: (options?: Partial<SubtitleItem>) => string;
  appendStream: (chunk: string) => void;
  finishStream: () => void;
  cancelStream: () => void;

  // Click
  setClickEnabled: (enabled: boolean) => void;
  setClickStyle: (style: ClickStyle) => void;
  addClickEffect: (effect: ClickEffect) => void;
  removeClickEffect: (id: string) => void;

  // Keystroke
  setKeystrokeEnabled: (enabled: boolean) => void;
  setKeystrokePosition: (position: KeystrokePosition) => void;
  addKeystroke: (item: KeystrokeItem) => void;
  removeKeystroke: (id: string) => void;

  // Wave
  setWaveEnabled: (enabled: boolean) => void;
  setWaveState: (state: WaveState) => void;
  setWaveConfig: (config: Partial<WaveConfig>) => void;
}

const initialState: OverlayState = {
  visible: false,
  opacity: 1,
  configLoaded: false,

  danmakuEnabled: true,
  danmakuItems: [],
  danmakuConfig: {
    maxTracks: 8,
    defaultSpeed: 150,
    opacity: 0.9,
    fontFamily: "system-ui",
  },
  danmakuPaused: false,

  subtitleEnabled: true,
  currentSubtitle: null,
  subtitleQueue: [],
  subtitleConfig: {
    defaultPosition: "bottom",
    defaultDuration: 5000,
    fontSize: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 12,
  },
  streamingSubtitle: null,

  clickEnabled: true,
  clickStyle: "ripple",
  clickEffects: [],

  keystrokeEnabled: true,
  keystrokePosition: "bottom-right",
  keystrokeItems: [],
  keystrokeShowModifiersOnly: true,
  keystrokeShowKeys: ["Escape", "Enter", "Tab"],

  waveEnabled: true,
  waveState: "idle",
  waveConfig: {
    enabled: true,
    height: 60,
    opacity: 0.6,
    speed: 1,
    particlesEnabled: true,
  },
};

export const useOverlayStore = create<OverlayState & { actions: OverlayActions }>((set, get) => ({
  ...initialState,

  actions: {
    loadConfig: (settings) => {
      set({
        configLoaded: true,
        visible: settings.default_enabled,
        opacity: settings.opacity,
        danmakuEnabled: settings.danmaku.enabled,
        danmakuConfig: {
          maxTracks: settings.danmaku.max_tracks,
          defaultSpeed: settings.danmaku.speed === "slow" ? 80 : settings.danmaku.speed === "fast" ? 250 : 150,
          opacity: settings.danmaku.opacity,
          fontFamily: "system-ui",
        },
        subtitleEnabled: settings.subtitle.enabled,
        subtitleConfig: {
          defaultPosition: settings.subtitle.position,
          defaultDuration: 5000,
          fontSize: settings.subtitle.font_size,
          backgroundColor: settings.subtitle.background_color,
          padding: 12,
        },
        clickEnabled: settings.click_indicator.enabled,
        clickStyle: settings.click_indicator.style,
        keystrokeEnabled: settings.keystroke.enabled,
        keystrokePosition: settings.keystroke.position,
        keystrokeShowModifiersOnly: settings.keystroke.show_modifiers_only,
        keystrokeShowKeys: settings.keystroke.show_keys,
        waveEnabled: settings.wave.enabled,
        waveConfig: {
          enabled: settings.wave.enabled,
          height: settings.wave.height,
          opacity: settings.wave.opacity,
          speed: settings.wave.speed,
          particlesEnabled: settings.wave.particles_enabled,
          customThemes: settings.wave.custom_themes,
        },
      });
    },

    show: () => set({ visible: true }),
    hide: () => set({ visible: false }),
    toggle: () => set((s) => ({ visible: !s.visible })),
    setOpacity: (opacity) => set({ opacity }),

    sendDanmaku: (text, options) => {
      const item: DanmakuItem = {
        id: nanoid(),
        text,
        timestamp: Date.now(),
        ...options,
      };
      set((s) => ({
        danmakuItems: [...s.danmakuItems, item].slice(-PERFORMANCE_LIMITS.maxDanmakuOnScreen),
      }));
    },
    clearDanmaku: () => set({ danmakuItems: [] }),
    pauseDanmaku: () => set({ danmakuPaused: true }),
    resumeDanmaku: () => set({ danmakuPaused: false }),
    removeDanmaku: (id) => set((s) => ({ danmakuItems: s.danmakuItems.filter((d) => d.id !== id) })),
    setDanmakuEnabled: (enabled) => set({ danmakuEnabled: enabled }),

    showSubtitle: (text, options) => {
      const item: SubtitleItem = {
        id: nanoid(),
        text,
        position: options?.position ?? get().subtitleConfig.defaultPosition,
        style: options?.style ?? "plain",
        ...options,
      };
      set({ currentSubtitle: item });
    },
    hideSubtitle: () => set({ currentSubtitle: null }),
    setSubtitleEnabled: (enabled) => set({ subtitleEnabled: enabled }),

    startStream: (options) => {
      const id = nanoid();
      set({
        streamingSubtitle: {
          id,
          text: "",
          isStreaming: true,
          cursor: true,
          options,
        },
      });
      return id;
    },
    appendStream: (chunk) => {
      set((s) => {
        if (!s.streamingSubtitle) return s;
        return {
          streamingSubtitle: {
            ...s.streamingSubtitle,
            text: s.streamingSubtitle.text + chunk,
          },
        };
      });
    },
    finishStream: () => {
      set((s) => {
        if (!s.streamingSubtitle) return s;
        return {
          streamingSubtitle: {
            ...s.streamingSubtitle,
            isStreaming: false,
            cursor: false,
          },
        };
      });
    },
    cancelStream: () => set({ streamingSubtitle: null }),

    setClickEnabled: (enabled) => set({ clickEnabled: enabled }),
    setClickStyle: (style) => set({ clickStyle: style }),
    addClickEffect: (effect) => {
      set((s) => ({
        clickEffects: [...s.clickEffects, effect].slice(-PERFORMANCE_LIMITS.maxClickEffects),
      }));
    },
    removeClickEffect: (id) => set((s) => ({ clickEffects: s.clickEffects.filter((e) => e.id !== id) })),

    setKeystrokeEnabled: (enabled) => set({ keystrokeEnabled: enabled }),
    setKeystrokePosition: (position) => set({ keystrokePosition: position }),
    addKeystroke: (item) => {
      set((s) => ({
        keystrokeItems: [...s.keystrokeItems, item].slice(-PERFORMANCE_LIMITS.maxKeystrokeItems),
      }));
    },
    removeKeystroke: (id) => set((s) => ({ keystrokeItems: s.keystrokeItems.filter((k) => k.id !== id) })),

    setWaveEnabled: (enabled) => set({ waveEnabled: enabled }),
    setWaveState: (state) => set({ waveState: state }),
    setWaveConfig: (config) => set((s) => ({ waveConfig: { ...s.waveConfig, ...config } })),
  },
}));
