/**
 * Hook for managing channel configurations
 *
 * Stores channel configs in localStorage for now.
 * Will be integrated with gateway backend later.
 */

import { useState, useEffect, useCallback } from "react";
import i18n from "@/i18n";
import {
  ChannelsConfig,
  TelegramConfig,
  DiscordConfig,
  FeishuConfig,
  WhatsAppConfig,
  DEFAULT_CHANNELS_CONFIG,
} from "@/types/channel";

const STORAGE_KEY = "viben_channels_config";

export interface UseChannelsReturn {
  config: ChannelsConfig;
  isLoading: boolean;
  error: string | null;
  // Individual channel updates
  updateTelegram: (config: Partial<TelegramConfig>) => void;
  updateDiscord: (config: Partial<DiscordConfig>) => void;
  updateFeishu: (config: Partial<FeishuConfig>) => void;
  updateWhatsApp: (config: Partial<WhatsAppConfig>) => void;
  // Bulk operations
  resetConfig: () => void;
  saveConfig: () => Promise<void>;
}

export function useChannels(): UseChannelsReturn {
  const [config, setConfig] = useState<ChannelsConfig>(DEFAULT_CHANNELS_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load config from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ChannelsConfig>;
        setConfig({
          telegram: { ...DEFAULT_CHANNELS_CONFIG.telegram, ...parsed.telegram },
          discord: { ...DEFAULT_CHANNELS_CONFIG.discord, ...parsed.discord },
          feishu: { ...DEFAULT_CHANNELS_CONFIG.feishu, ...parsed.feishu },
          whatsapp: { ...DEFAULT_CHANNELS_CONFIG.whatsapp, ...parsed.whatsapp },
        });
      }
    } catch (e) {
      console.error("Failed to load channels config:", e);
      setError(i18n.t("errors.channels.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save config to localStorage
  const saveConfig = useCallback(async () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setError(null);
    } catch (e) {
      console.error("Failed to save channels config:", e);
      setError(i18n.t("errors.channels.saveFailed"));
    }
  }, [config]);

  // Auto-save on config change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  }, [config, isLoading]);

  const updateTelegram = useCallback((update: Partial<TelegramConfig>) => {
    setConfig((prev) => ({
      ...prev,
      telegram: { ...prev.telegram, ...update },
    }));
  }, []);

  const updateDiscord = useCallback((update: Partial<DiscordConfig>) => {
    setConfig((prev) => ({
      ...prev,
      discord: { ...prev.discord, ...update },
    }));
  }, []);

  const updateFeishu = useCallback((update: Partial<FeishuConfig>) => {
    setConfig((prev) => ({
      ...prev,
      feishu: { ...prev.feishu, ...update },
    }));
  }, []);

  const updateWhatsApp = useCallback((update: Partial<WhatsAppConfig>) => {
    setConfig((prev) => ({
      ...prev,
      whatsapp: { ...prev.whatsapp, ...update },
    }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CHANNELS_CONFIG);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    config,
    isLoading,
    error,
    updateTelegram,
    updateDiscord,
    updateFeishu,
    updateWhatsApp,
    resetConfig,
    saveConfig,
  };
}
