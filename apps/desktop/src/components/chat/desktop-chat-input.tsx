/**
 * Desktop Chat Input Component
 *
 * A wrapper around @viben/chat's ChatInput that provides Tauri-specific
 * implementations for platform features:
 * - Screenshot capture via Tauri invoke
 * - File dialog via @tauri-apps/plugin-dialog
 * - Paste handling (uses default browser handling)
 *
 * Usage:
 * ```tsx
 * import { DesktopChatInput } from "@/components/chat";
 *
 * <DesktopChatInput
 *   onSend={handleSend}
 *   showConfigBar
 *   // ... other props from ChatInput
 * />
 * ```
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ChatInput, type ChatInputProps, type MessageAttachment } from "@viben/chat";

// ============================================================================
// Types
// ============================================================================

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
 * Props for DesktopChatInput
 * Omits platform-specific callbacks as they are implemented internally
 */
export type DesktopChatInputProps = Omit<
  ChatInputProps,
  "onScreenshot" | "onOpenFile" | "onPaste"
>;

// ============================================================================
// Component
// ============================================================================

/**
 * Desktop-specific ChatInput wrapper
 *
 * Provides Tauri implementations for:
 * - Screenshot capture (via invoke("take_screenshot"))
 * - File dialog (via @tauri-apps/plugin-dialog)
 */
export function DesktopChatInput(props: DesktopChatInputProps) {
  /**
   * Take a screenshot using Tauri backend
   *
   * @param hideWindow - If true, hides the window before capturing
   * @returns MessageAttachment containing the screenshot, or null on error
   */
  const handleScreenshot = React.useCallback(
    async (hideWindow?: boolean): Promise<MessageAttachment | null> => {
      try {
        const result = await invoke<ScreenshotResult>("take_screenshot", {
          hideWindow: hideWindow ?? false,
        });

        const attachment: MessageAttachment = {
          id: `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: "image",
          name: `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
          data: result.data,
          mimeType: "image/png",
          isLoading: false,
        };

        return attachment;
      } catch (err) {
        console.error("[DesktopChatInput] Screenshot failed:", err);
        return null;
      }
    },
    []
  );

  /**
   * Open file dialog using Tauri plugin
   *
   * @returns Array of MessageAttachment, or null if cancelled/error
   */
  const handleOpenFile = React.useCallback(async (): Promise<
    MessageAttachment[] | null
  > => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"],
          },
          {
            name: "Documents",
            extensions: ["pdf", "doc", "docx", "txt", "md", "json", "csv"],
          },
          {
            name: "Spreadsheets",
            extensions: ["xlsx", "xls"],
          },
          {
            name: "Presentations",
            extensions: ["pptx", "ppt"],
          },
          {
            name: "All Files",
            extensions: ["*"],
          },
        ],
      });

      // User cancelled
      if (!selected) {
        return null;
      }

      // Normalize to array
      const paths = Array.isArray(selected) ? selected : [selected];

      // Read files and create attachments
      const attachments: MessageAttachment[] = [];

      for (const path of paths) {
        try {
          // Read file via Tauri
          const { readFile } = await import("@tauri-apps/plugin-fs");
          const fileData = await readFile(path);

          // Convert to base64
          const base64 = btoa(
            new Uint8Array(fileData).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
          );

          // Determine MIME type from extension
          const ext = path.split(".").pop()?.toLowerCase() || "";
          const mimeType = getMimeType(ext);
          const isImage = mimeType.startsWith("image/");

          // Get filename from path
          const fileName = path.split(/[\\/]/).pop() || "file";

          const attachment: MessageAttachment = {
            id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            type: isImage ? "image" : "file",
            name: fileName,
            data: `data:${mimeType};base64,${base64}`,
            mimeType,
            isLoading: false,
          };

          attachments.push(attachment);
        } catch (readError) {
          console.error(
            `[DesktopChatInput] Failed to read file ${path}:`,
            readError
          );
        }
      }

      return attachments.length > 0 ? attachments : null;
    } catch (err) {
      console.error("[DesktopChatInput] File dialog failed:", err);
      return null;
    }
  }, []);

  return (
    <ChatInput
      {...props}
      onScreenshot={handleScreenshot}
      onOpenFile={handleOpenFile}
    />
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get MIME type from file extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    csv: "text/csv",
    // Spreadsheets
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    // Presentations
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
  };

  return mimeTypes[ext] || "application/octet-stream";
}
