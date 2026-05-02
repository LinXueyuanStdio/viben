/**
 * Hook for capturing screenshots via Tauri
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { tempDir, join } from "@tauri-apps/api/path";
import { writeFile, mkdir, exists } from "@tauri-apps/plugin-fs";
import type { MessageAttachment } from "@/types";

/**
 * Screenshot result from Tauri backend
 */
interface ScreenshotResult {
  data: string;
  width: number;
  height: number;
}

async function logScreenshotTrace(
  traceId: string,
  source: string,
  stage: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await invoke("log_screenshot_trace", {
      traceId,
      source,
      stage,
      details,
    });
  } catch (error) {
    console.error("[ScreenshotTrace] Failed to write trace log:", error);
  }
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

export interface ScreenshotMonitorInfo {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_primary: boolean;
  scale_factor: number;
}

export interface UseScreenshotReturn {
  takeScreenshot: (hideWindow?: boolean) => Promise<MessageAttachment | null>;
  takeScreenshotRegion: (
    x: number,
    y: number,
    width: number,
    height: number
  ) => Promise<MessageAttachment | null>;
  startRegionScreenshot: (monitorId?: number) => Promise<void>;
  listMonitors: () => Promise<ScreenshotMonitorInfo[]>;
  listWindows: () => Promise<ScreenshotWindowInfo[]>;
  takeWindowScreenshot: (windowId: number) => Promise<MessageAttachment | null>;
  isCapturing: boolean;
  error: string | null;
}

/**
 * Save base64 data URL to a temp file and return the file path
 */
async function saveScreenshotToTempFile(
  data: string,
  fileName: string
): Promise<string> {
  const dir = await tempDir();
  const screenshotDir = await join(dir, "viben-screenshots");
  if (!(await exists(screenshotDir))) {
    await mkdir(screenshotDir, { recursive: true });
  }
  const filePath = await join(screenshotDir, fileName);

  // Extract base64 content from data URL (strip "data:image/png;base64," prefix)
  const base64Content = data.replace(/^data:image\/\w+;base64,/, "");
  const binaryData = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
  await writeFile(filePath, binaryData);

  return filePath;
}

/**
 * Create a MessageAttachment from screenshot data
 * Saves the image to a temp file so agents can reference it by path
 */
async function createScreenshotAttachment(
  data: string,
  prefix = "screenshot"
): Promise<MessageAttachment> {
  const mimeType = data.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png";
  const extension = mimeType === "image/jpeg" ? "jpg" : "png";
  const fileName = `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;

  let filePath: string | undefined;
  try {
    filePath = await saveScreenshotToTempFile(data, fileName);
  } catch (err) {
    console.warn("[Screenshot] Failed to save to temp file:", err);
  }

  return {
    id: `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: "image",
    name: fileName,
    data,
    path: filePath,
    mimeType,
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

        const attachment = await createScreenshotAttachment(result.data, "screenshot");
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

        const attachment = await createScreenshotAttachment(result.data, "screenshot-region");
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

  const listMonitors = useCallback(async (): Promise<ScreenshotMonitorInfo[]> => {
    try {
      return await invoke<ScreenshotMonitorInfo[]>("list_monitors");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
      return [];
    }
  }, []);

  const startRegionScreenshot = useCallback(async (monitorId?: number) => {
    setIsCapturing(true);
    setError(null);
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();

    try {
      await logScreenshotTrace(traceId, "frontend", "region_screenshot_requested", {
        monitorId: monitorId ?? null,
        startedAt,
      });
      await invoke<string>("start_region_screenshot", {
        monitorId: monitorId ?? null,
        traceId,
        clientStartedAtMs: startedAt,
      });
      await logScreenshotTrace(traceId, "frontend", "region_screenshot_command_resolved", {
        elapsedMs: Date.now() - startedAt,
      });
      // Result will come back via the screenshot-result event listener
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      await logScreenshotTrace(traceId, "frontend", "region_screenshot_command_failed", {
        elapsedMs: Date.now() - startedAt,
        error: errorMessage,
      });
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

        const attachment = await createScreenshotAttachment(result.data, "screenshot-window");
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
  // Uses a flag to prevent cancelled event from firing after result is received
  useEffect(() => {
    let gotResult = false;

    const unlistenResult = listen<{ data: string; type: string }>(
      "screenshot-result",
      async (event) => {
        gotResult = true;
        const { data } = event.payload;
        const attachment = await createScreenshotAttachment(data, "screenshot-region");
        onSuccessRef.current?.(attachment);
        setIsCapturing(false);
      }
    );

    const unlistenCancelled = listen("screenshot-cancelled", () => {
      if (!gotResult) {
        setIsCapturing(false);
      }
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
    listMonitors,
    listWindows,
    takeWindowScreenshot,
    isCapturing,
    error,
  };
}
