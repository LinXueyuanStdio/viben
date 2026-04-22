import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import * as yaml from "js-yaml";
import type { OverlaySettings } from "@/types/overlay";

const VIBEN_DIR = ".viben";
const CONFIG_FILENAME = "overlay.yaml";

/**
 * Deep merge defaults with partial config.
 * Recursively merges nested objects while preserving array values.
 */
function deepMerge<T>(defaults: T, partial: Partial<T> | undefined): T {
  if (!partial) return defaults;

  const result = { ...defaults } as T;
  for (const key of Object.keys(partial) as (keyof T)[]) {
    const defaultValue = defaults[key];
    const partialValue = partial[key];
    if (
      partialValue !== undefined &&
      typeof partialValue === "object" &&
      partialValue !== null &&
      !Array.isArray(partialValue) &&
      typeof defaultValue === "object" &&
      defaultValue !== null &&
      !Array.isArray(defaultValue)
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result[key] = deepMerge(defaultValue, partialValue as any) as T[keyof T];
    } else if (partialValue !== undefined) {
      result[key] = partialValue as T[keyof T];
    }
  }
  return result;
}

/**
 * Construct path with proper separator.
 */
function joinPath(base: string, ...segments: string[]): string {
  const separator = base.endsWith("/") || base.endsWith("\\") ? "" : "/";
  return base + separator + segments.join("/");
}

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  version: 1,
  default_enabled: false,
  opacity: 1,
  danmaku: {
    enabled: true,
    max_tracks: 8,
    speed: "normal",
    font_size: 24,
    opacity: 0.9,
  },
  subtitle: {
    enabled: true,
    position: "bottom",
    font_size: 20,
    background_color: "rgba(0,0,0,0.7)",
    default_animation: "fade",
  },
  click_indicator: {
    enabled: true,
    style: "ripple",
    color: "#ffffff",
    size: 40,
  },
  keystroke: {
    enabled: true,
    position: "bottom-right",
    show_modifiers_only: false,
    show_keys: ["Escape", "Enter", "Tab"],
    duration: 1500,
  },
  wave: {
    enabled: true,
    height: 60,
    opacity: 0.6,
    speed: 1,
    particles_enabled: true,
  },
  shortcuts: {
    toggleOverlay: "CommandOrControl+Option+O",
    toggleDanmaku: "CommandOrControl+Option+D",
    toggleKeystroke: "CommandOrControl+Option+K",
    toggleClickIndicator: "CommandOrControl+Option+C",
    toggleSubtitle: "CommandOrControl+Option+S",
  },
};

export async function loadOverlayConfig(): Promise<OverlaySettings> {
  try {
    const home = await homeDir();
    const configPath = joinPath(home, VIBEN_DIR, CONFIG_FILENAME);

    if (await exists(configPath)) {
      const content = await readTextFile(configPath);
      const loaded = yaml.load(content);
      // Validate parsed result is a non-null object
      if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
        return deepMerge<OverlaySettings>(
          DEFAULT_OVERLAY_SETTINGS,
          loaded as Partial<OverlaySettings>
        );
      }
    }
  } catch (error) {
    console.warn("[Overlay] Failed to load config:", error);
  }

  return DEFAULT_OVERLAY_SETTINGS;
}

export async function saveOverlayConfig(settings: OverlaySettings): Promise<void> {
  try {
    const home = await homeDir();
    const vibenDir = joinPath(home, VIBEN_DIR);
    const configPath = joinPath(home, VIBEN_DIR, CONFIG_FILENAME);

    if (!(await exists(vibenDir))) {
      await mkdir(vibenDir);
    }

    const content = yaml.dump(settings, {
      indent: 2,
      lineWidth: -1,
    });
    await writeTextFile(configPath, content);
  } catch (error) {
    console.error("[Overlay] Failed to save config:", error);
    throw error;
  }
}
