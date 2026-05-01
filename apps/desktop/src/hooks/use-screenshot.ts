/**
 * Hook for capturing screenshots via Tauri
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { MessageAttachment } from "@/types";

/**
 * Screenshot result from Tauri backend
 */
interface ScreenshotResult {
  data: string;
  width: number;
  height: number;
}

export interface UseScreenshotOptions {
  onSuccess?: (attachment: MessageAttachment) => void;
  onError?: (error: string) => void;
}

export interface ScreenshotWindowInfo {
  id: number;
  title: string;
  app_name: string;
}

export interface UseScreenshotReturn {
  takeScreenshot: (hideWindow?: boolean) => Promise<MessageAttachment | null>;
  takeScreenshotRegion: (
    x: number,
    y: number,
    width: number,
    height: number
  ) => Promise<MessageAttachment | null>;
  startRegionScreenshot: () => Promise<void>;
  listWindows: () => Promise<ScreenshotWindowInfo[]>;
  takeWindowScreenshot: (windowId: number) => Promise<MessageAttachment | null>;
  isCapturing: boolean;
  error: string | null;
}

/**
 * Create a MessageAttachment from screenshot data
 */
function createScreenshotAttachment(
  data: string,
  prefix = "screenshot"
): MessageAttachment {
  return {
    id: `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: "image",
    name: `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
    data,
    mimeType: "image/png",
    isLoading: false,
  };
}

export function useScreenshot(
  options: UseScreenshotOptions = {}
): UseScreenshotReturn {
  const { onSuccess, onError } = options;
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs for callbacks to avoid stale closures in event listeners
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  const takeScreenshot = useCallback(
    async (hideWindow = false): Promise<MessageAttachment | null> => {
      setIsCapturing(true);
      setError(null);

      try {
        const result = await invoke<ScreenshotResult>("take_screenshot", {
          hideWindow,
        });

        const attachment = createScreenshotAttachment(result.data, "screenshot");
        onSuccessRef.current?.(attachment);
        return attachment;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        onErrorRef.current?.(errorMessage);
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    []
  );

  const takeScreenshotRegion = useCallback(
    async (
      x: number,
      y: number,
      width: number,
      height: number
    ): Promise<MessageAttachment | null> => {
      setIsCapturing(true);
      setError(null);

      try {
        const result = await invoke<ScreenshotResult>(
          "take_screenshot_region",
          { x, y, width, height }
        );

        const attachment = createScreenshotAttachment(result.data, "screenshot-region");
        onSuccessRef.current?.(attachment);
        return attachment;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        onErrorRef.current?.(errorMessage);
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    []
  );

  const startRegionScreenshot = useCallback(async () => {
    setIsCapturing(true);
    setError(null);

    try {
      await invoke<string>("start_region_screenshot");
      // Result will come back via the screenshot-result event listener
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
      setIsCapturing(false);
    }
  }, []);

  const listWindows = useCallback(async (): Promise<ScreenshotWindowInfo[]> => {
    try {
      return await invoke<ScreenshotWindowInfo[]>("list_screenshot_windows");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
      return [];
    }
  }, []);

  const takeWindowScreenshot = useCallback(
    async (windowId: number): Promise<MessageAttachment | null> => {
      setIsCapturing(true);
      setError(null);

      try {
        const result = await invoke<ScreenshotResult>(
          "take_window_screenshot",
          { windowId }
        );

        const attachment = createScreenshotAttachment(result.data, "screenshot-window");
        onSuccessRef.current?.(attachment);
        return attachment;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        onErrorRef.current?.(errorMessage);
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    []
  );

  // Listen for screenshot results and cancellation from the overlay window
  // Register once (empty deps) - uses refs for callbacks to avoid stale closures
  useEffect(() => {
    const unlistenResult = listen<{ data: string; type: string }>(
      "screenshot-result",
      (event) => {
        const { data } = event.payload;
        const attachment = createScreenshotAttachment(data, "screenshot-region");
        onSuccessRef.current?.(attachment);
        setIsCapturing(false);
      }
    );

    const unlistenCancelled = listen("screenshot-cancelled", () => {
      setIsCapturing(false);
    });

    return () => {
      unlistenResult.then((fn) => fn());
      unlistenCancelled.then((fn) => fn());
    };
  }, []);

  return {
    takeScreenshot,
    takeScreenshotRegion,
    startRegionScreenshot,
    listWindows,
    takeWindowScreenshot,
    isCapturing,
    error,
  };
}
