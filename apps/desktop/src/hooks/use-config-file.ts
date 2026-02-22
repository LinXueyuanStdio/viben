/**
 * Generic hooks for reading/writing config files
 *
 * Unlike skill-specific hooks, these work with any file path directly.
 * Used for commands, prompts, MCP servers, and other file-based configs.
 */
import { useState, useCallback } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { SkillFileEntry } from "@/types";
import { invoke } from "@tauri-apps/api/core";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Hook for reading a config file's content
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
      const result = await readTextFile(filePath);
      setContent(result);
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
      await writeTextFile(filePath, content);
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
 * Hook for listing files in a directory
 * Reuses the list_skill_files Tauri command which works for any directory
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
      // Use the same Tauri command as skills - it works for any directory
      const result = await invoke<SkillFileEntry[]>("list_skill_files", {
        skillPath: dirPath,
        maxDepth: maxDepth ?? 3,
      });
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
