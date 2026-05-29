/**
 * useImageUpload Hook
 *
 * Handles image upload for icon picker.
 * - Saves images to workspace .viben/icons/ directory
 * - Supports both local file upload and URL download
 */

import { useState, useCallback } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { generateIconFilename, getIconStoragePath } from "../utils";

export interface UseImageUploadOptions {
  /** Workspace path for saving uploaded images */
  workspacePath?: string;
}

export interface UseImageUploadResult {
  /** Upload a local file */
  uploadFile: (filePath: string) => Promise<string | null>;
  /** Download and save an image from URL */
  uploadUrl: (url: string) => Promise<string | null>;
  /** Whether an upload is in progress */
  uploading: boolean;
  /** Error message if upload failed */
  error: string | null;
  /** Clear the error */
  clearError: () => void;
}

/**
 * Read a file using Tauri FS API
 */
async function readLocalFile(path: string): Promise<Uint8Array> {
  return readFile(path);
}

/**
 * Write a file using Gateway API
 */
async function writeToWorkspace(
  workspacePath: string,
  relativePath: string,
  data: Uint8Array
): Promise<void> {
  const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || "http://127.0.0.1:18790";

  // First, ensure the directory exists
  const dirPath = relativePath.substring(0, relativePath.lastIndexOf("/"));
  await fetch(`${gatewayUrl}/api/file/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspace_path: workspacePath,
      dir_path: dirPath,
      recursive: true,
    }),
  });

  // Convert Uint8Array to base64 (chunked to avoid call stack overflow on large files)
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  // Write the file
  const response = await fetch(`${gatewayUrl}/api/file/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspace_path: workspacePath,
      file_path: relativePath,
      content: base64,
      encoding: "base64",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to write file: ${response.statusText}`);
  }
}

/**
 * Download an image from URL
 */
async function downloadImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Get file extension from path or URL
 */
function getFileExtension(pathOrUrl: string): string {
  const match = pathOrUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (match) {
    const ext = match[1].toLowerCase();
    // Normalize extensions
    if (ext === "jpg") return "jpeg";
    return ext;
  }
  return "png"; // Default
}

export function useImageUpload({ workspacePath }: UseImageUploadOptions = {}): UseImageUploadResult {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Process and save image data
   */
  const processAndSave = useCallback(
    async (imageData: Uint8Array, sourceExtension: string): Promise<string | null> => {
      if (!workspacePath) {
        setError("Workspace path is required");
        return null;
      }

      // Generate filename and save
      const filename = generateIconFilename(sourceExtension);
      const relativePath = getIconStoragePath(filename);

      await writeToWorkspace(workspacePath, relativePath, imageData);

      return relativePath;
    },
    [workspacePath]
  );

  /**
   * Upload a local file
   */
  const uploadFile = useCallback(
    async (filePath: string): Promise<string | null> => {
      setUploading(true);
      setError(null);

      try {
        const extension = getFileExtension(filePath);
        const imageData = await readLocalFile(filePath);
        return await processAndSave(imageData, extension);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to upload file";
        setError(message);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [processAndSave]
  );

  /**
   * Download and save an image from URL
   */
  const uploadUrl = useCallback(
    async (url: string): Promise<string | null> => {
      setUploading(true);
      setError(null);

      try {
        const extension = getFileExtension(url);
        const imageData = await downloadImage(url);
        return await processAndSave(imageData, extension);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to download image";
        setError(message);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [processAndSave]
  );

  return {
    uploadFile,
    uploadUrl,
    uploading,
    error,
    clearError,
  };
}

export default useImageUpload;
