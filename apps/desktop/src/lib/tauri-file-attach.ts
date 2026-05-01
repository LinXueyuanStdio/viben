/**
 * Tauri File Attach Utility
 *
 * Shared logic for opening a native file dialog via Tauri,
 * reading files, and converting them to MessageAttachment objects.
 */

import { open } from "@tauri-apps/plugin-dialog";
import type { MessageAttachment } from "@viben/chat";
import { getMimeType } from "@viben/chat";

export interface FileFilter {
  name: string;
  extensions: string[];
}

export const DEFAULT_FILE_FILTERS: FileFilter[] = [
  { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] },
  { name: "Documents", extensions: ["pdf", "doc", "docx", "txt", "md", "json", "csv"] },
  { name: "Spreadsheets", extensions: ["xlsx", "xls"] },
  { name: "Presentations", extensions: ["pptx", "ppt"] },
  { name: "All Files", extensions: ["*"] },
];

export interface OpenAndReadFilesOptions {
  filters?: FileFilter[];
  multiple?: boolean;
}

/**
 * Open a native file dialog, read selected files, and return as MessageAttachment[].
 * Returns null if the user cancels the dialog or no files are successfully read.
 */
export async function openAndReadFiles(
  options?: OpenAndReadFilesOptions,
): Promise<MessageAttachment[] | null> {
  const { filters = DEFAULT_FILE_FILTERS, multiple = true } = options ?? {};

  try {
    const selected = await open({ multiple, filters });
    if (!selected) return null;

    const paths = Array.isArray(selected) ? selected : [selected];
    const attachments: MessageAttachment[] = [];

    for (const path of paths) {
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const fileData = await readFile(path);

        const base64 = btoa(
          new Uint8Array(fileData).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            "",
          ),
        );

        const ext = path.split(".").pop()?.toLowerCase() || "";
        const mimeType = getMimeType(ext);
        const isImage = mimeType.startsWith("image/");
        const fileName = path.split(/[\\/]/).pop() || "file";

        attachments.push({
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: isImage ? "image" : "file",
          name: fileName,
          data: `data:${mimeType};base64,${base64}`,
          mimeType,
          isLoading: false,
        });
      } catch (readErr) {
        console.error(`[tauri-file-attach] Failed to read file ${path}:`, readErr);
      }
    }

    return attachments.length > 0 ? attachments : null;
  } catch (err) {
    console.error("[tauri-file-attach] File dialog failed:", err);
    return null;
  }
}
