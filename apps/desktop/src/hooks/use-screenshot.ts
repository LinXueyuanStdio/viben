/**
 * Hook for capturing screenshots via Tauri
 *
 * This hook provides functions to take screenshots using the Tauri backend.
 * It supports two modes:
 * - Direct screenshot: capture screen immediately
 * - Hide window screenshot: hide the app window, capture screen, then show window again
 */

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MessageAttachment } from "@/types";

/**
 * Screenshot result from Tauri backend
 */
interface ScreenshotResult {
  /** Base64 encoded PNG image data (as data URL) */
  data: string;
  /** Width of the captured screenshot */
  width: number;
  /** Height of the captured screenshot */
  height: number;
}

/**
 * Options for the useScreenshot hook
 */
export interface UseScreenshotOptions {
  /** Callback when screenshot is taken successfully */
  onSuccess?: (attachment: MessageAttachment) => void;
  /** Callback when screenshot fails */
  onError?: (error: string) => void;
}

/**
 * Return type of the useScreenshot hook
 */
export interface UseScreenshotReturn {
  /** Take a screenshot of the primary screen */
  takeScreenshot: (hideWindow?: boolean) => Promise<MessageAttachment | null>;
  /** Take a screenshot of a specific region */
  takeScreenshotRegion: (
    x: number,
    y: number,
    width: number,
    height: number
  ) => Promise<MessageAttachment | null>;
  /** Whether a screenshot is currently being taken */
  isCapturing: boolean;
  /** Error message if screenshot failed */
  error: string | null;
}

/**
 * Hook for capturing screenshots
 *
 * @example
 * ```tsx
 * const { takeScreenshot, isCapturing } = useScreenshot({
 *   onSuccess: (attachment) => {
 *     setAttachments(prev => [...prev, attachment]);
 *   },
 *   onError: (error) => {
 *     console.error('Screenshot failed:', error);
 *   },
 * });
 *
 * // Direct screenshot
 * await takeScreenshot();
 *
 * // Screenshot with window hidden
 * await takeScreenshot(true);
 * ```
 */
export function useScreenshot(
  options: UseScreenshotOptions = {}
): UseScreenshotReturn {
  const { onSuccess, onError } = options;
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Take a screenshot of the primary screen
   *
   * @param hideWindow - If true, hide the main window before capturing
   * @returns MessageAttachment containing the screenshot, or null on error
   */
  const takeScreenshot = useCallback(
    async (hideWindow = false): Promise<MessageAttachment | null> => {
      setIsCapturing(true);
      setError(null);

      try {
        const result = await invoke<ScreenshotResult>("take_screenshot", {
          hideWindow,
        });

        const attachment: MessageAttachment = {
          id: `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: "image",
          name: `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
          data: result.data,
          mimeType: "image/png",
          isLoading: false,
        };

        onSuccess?.(attachment);
        return attachment;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        onError?.(errorMessage);
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    [onSuccess, onError]
  );

  /**
   * Take a screenshot of a specific region
   *
   * @param x - X coordinate of the region
   * @param y - Y coordinate of the region
   * @param width - Width of the region
   * @param height - Height of the region
   * @returns MessageAttachment containing the screenshot, or null on error
   */
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
          {
            x,
            y,
            width,
            height,
          }
        );

        const attachment: MessageAttachment = {
          id: `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: "image",
          name: `screenshot-region-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
          data: result.data,
          mimeType: "image/png",
          isLoading: false,
        };

        onSuccess?.(attachment);
        return attachment;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        onError?.(errorMessage);
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    [onSuccess, onError]
  );

  return {
    takeScreenshot,
    takeScreenshotRegion,
    isCapturing,
    error,
  };
}
