import { create } from "zustand";
import type { GatewayChannel } from "@/types/channel";

/**
 * Channel sync task - tracks channel loading progress
 */
export interface ChannelSyncTask {
  status: "idle" | "loading" | "completed" | "error";
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

interface ChannelState {
  // Channel instances
  channels: GatewayChannel[];

  // Sync task status
  syncTask: ChannelSyncTask;

  // Actions
  setChannels: (channels: GatewayChannel[]) => void;
  addChannel: (channel: GatewayChannel) => void;
  updateChannel: (id: string, updates: Partial<GatewayChannel>) => void;
  removeChannel: (id: string) => void;

  // Sync task actions
  startSync: () => void;
  completeSync: (channels: GatewayChannel[]) => void;
  failSync: (error: string) => void;
  resetSync: () => void;

  // Getters
  getChannel: (id: string) => GatewayChannel | undefined;
  getChannelsByType: (type: string) => GatewayChannel[];
  getEnabledChannels: () => GatewayChannel[];
  getDefaultChannel: () => GatewayChannel | undefined;

  // Status checks
  isLoading: () => boolean;
  hasLoadedOnce: () => boolean;
}

export const useChannelStore = create<ChannelState>()((set, get) => ({
  // Initial state
  channels: [],
  syncTask: { status: "idle" },

  // Channel management
  setChannels: (channels) => set({ channels }),

  addChannel: (channel) =>
    set((state) => ({
      channels: [...state.channels, channel],
    })),

  updateChannel: (id, updates) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  removeChannel: (id) =>
    set((state) => ({
      channels: state.channels.filter((c) => c.id !== id),
    })),

  // Sync task actions
  startSync: () =>
    set({
      syncTask: {
        status: "loading",
        startedAt: Date.now(),
      },
    }),

  completeSync: (channels) =>
    set({
      channels,
      syncTask: {
        status: "completed",
        completedAt: Date.now(),
      },
    }),

  failSync: (error) =>
    set((state) => ({
      syncTask: {
        ...state.syncTask,
        status: "error",
        completedAt: Date.now(),
        error,
      },
    })),

  resetSync: () =>
    set({
      syncTask: { status: "idle" },
    }),

  // Getters
  getChannel: (id) => get().channels.find((c) => c.id === id),

  getChannelsByType: (type) =>
    get().channels.filter((c) => c.channel_type === type),

  getEnabledChannels: () => get().channels.filter((c) => c.enabled),

  getDefaultChannel: () => get().channels.find((c) => c.is_default),

  // Status checks
  isLoading: () => get().syncTask.status === "loading",

  hasLoadedOnce: () =>
    get().syncTask.status === "completed" ||
    get().syncTask.status === "error",
}));
