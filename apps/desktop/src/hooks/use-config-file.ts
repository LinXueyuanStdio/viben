/**
 * Generic hooks for reading/writing config files
 *
 * Uses Gateway API for file operations to ensure web compatibility.
 * Used for commands, prompts, MCP servers, and other file-based configs.
 */
import { useState, useCallback } from "react";
import type { SkillFileEntry } from "@/types";
import { getGatewayClient } from "@/lib/gateway";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Hook for reading a config file's content
 * Uses Gateway API for proper path handling
 */
export function useConfigFileContent() {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = useCallback(async (filePath: string) => {
    if (!filePath) {
      setContent(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const result = await client.readFile(filePath);
      setContent(result.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setContent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearContent = useCallback(() => {
    setContent(null);
    setError(null);
  }, []);

  return { content, loading, error, readFile, clearContent };
}

/**
 * Hook for writing a config file
 * Uses Gateway API for proper path handling
 */
export function useConfigFileWriter() {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const writeFile = useCallback(async (filePath: string, content: string) => {
    setSaving(true);
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const client = getGatewayClient();
      await client.writeFile(filePath, content);
      setSaveStatus("saved");
      // Reset to idle after 2 seconds
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveError(message);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }, []);

  const resetStatus = useCallback(() => {
    setSaveStatus("idle");
    setSaveError(null);
  }, []);

  return { saving, saveStatus, saveError, writeFile, resetStatus };
}

/**
 * Convert gateway file entry to SkillFileEntry format
 */
function convertToSkillFileEntry(
  entry: { name: string; path: string; is_directory: boolean },
  children?: SkillFileEntry[]
): SkillFileEntry {
  return {
    name: entry.name,
    path: entry.path,
    is_directory: entry.is_directory,
    children,
  };
}

/**
 * Recursively load directory structure
 */
async function loadDirectoryRecursive(
  client: ReturnType<typeof getGatewayClient>,
  dirPath: string,
  currentDepth: number,
  maxDepth: number
): Promise<SkillFileEntry[]> {
  const result = await client.listFiles(dirPath, true);
  const entries: SkillFileEntry[] = [];

  for (const entry of result.entries) {
    if (entry.is_directory && currentDepth < maxDepth) {
      const children = await loadDirectoryRecursive(
        client,
        entry.path,
        currentDepth + 1,
        maxDepth
      );
      entries.push(convertToSkillFileEntry(entry, children));
    } else {
      entries.push(convertToSkillFileEntry(entry));
    }
  }

  return entries;
}

/**
 * Hook for listing files in a directory
 * Uses Gateway API for directory listing
 */
export function useConfigFiles(dirPath: string | null) {
  const [files, setFiles] = useState<SkillFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async (maxDepth?: number) => {
    if (!dirPath) {
      setFiles([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const depth = maxDepth ?? 3;
      const result = await loadDirectoryRecursive(client, dirPath, 0, depth);
      setFiles(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [dirPath]);

  return { files, loading, error, loadFiles };
}

/**
 * Get the parent directory of a file path
 */
export function getParentDir(filePath: string): string {
  const parts = filePath.split("/");
  parts.pop();
  return parts.join("/");
}

/**
 * Get the filename from a file path
 */
export function getFilename(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}
