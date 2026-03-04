import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InspectorConfig } from "@/components/inspector";

/**
 * Saved inspector configuration
 */
export interface SavedInspectorConfig {
  /** Unique identifier (cfg_timestamp_random) */
  id: string;
  /** User-defined name */
  name: string;
  /** Optional description */
  description?: string;
  /** Configuration content (reuses existing type) */
  config: InspectorConfig;
  /** Whether proxy is enabled */
  useProxy: boolean;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Pinned flag */
  isPinned?: boolean;
}

interface SavedConfigsState {
  configs: SavedInspectorConfig[];
  addConfig: (config: Omit<SavedInspectorConfig, "id" | "createdAt" | "updatedAt">) => SavedInspectorConfig;
  updateConfig: (id: string, updates: Partial<Omit<SavedInspectorConfig, "id" | "createdAt">>) => void;
  deleteConfig: (id: string) => void;
  duplicateConfig: (id: string) => SavedInspectorConfig | null;
  pinConfig: (id: string, pinned: boolean) => void;
  getConfig: (id: string) => SavedInspectorConfig | undefined;
  getSortedConfigs: () => SavedInspectorConfig[];
}

/**
 * Generate unique config ID
 */
function generateConfigId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `cfg_${timestamp}_${random}`;
}

export const useSavedConfigsStore = create<SavedConfigsState>()(
  persist(
    (set, get) => ({
      configs: [],

      addConfig: (configData) => {
        const now = new Date().toISOString();
        const newConfig: SavedInspectorConfig = {
          ...configData,
          id: generateConfigId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          configs: [...state.configs, newConfig],
        }));
        return newConfig;
      },

      updateConfig: (id, updates) => {
        set((state) => ({
          configs: state.configs.map((config) =>
            config.id === id
              ? {
                  ...config,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                }
              : config
          ),
        }));
      },

      deleteConfig: (id) => {
        set((state) => ({
          configs: state.configs.filter((config) => config.id !== id),
        }));
      },

      duplicateConfig: (id) => {
        const original = get().configs.find((c) => c.id === id);
        if (!original) return null;

        const now = new Date().toISOString();
        const newConfig: SavedInspectorConfig = {
          ...original,
          id: generateConfigId(),
          name: `${original.name} (Copy)`,
          isPinned: false,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          configs: [...state.configs, newConfig],
        }));
        return newConfig;
      },

      pinConfig: (id, pinned) => {
        set((state) => ({
          configs: state.configs.map((config) =>
            config.id === id
              ? {
                  ...config,
                  isPinned: pinned,
                  updatedAt: new Date().toISOString(),
                }
              : config
          ),
        }));
      },

      getConfig: (id) => {
        return get().configs.find((c) => c.id === id);
      },

      getSortedConfigs: () => {
        const configs = get().configs;
        // Sort: pinned first, then by updatedAt descending
        return [...configs].sort((a, b) => {
          // Pinned items first
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          // Then by updatedAt descending
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
      },
    }),
    {
      name: "inspector-saved-configs",
    }
  )
);
