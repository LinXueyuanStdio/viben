import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SkillFileEntry } from "@/types";

/**
 * Hook for fetching skill SKILL.md content
 */
export function useSkillReadme(skillPath: string | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReadme = useCallback(async () => {
    if (!skillPath) {
      setContent(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string>("get_skill_readme", { skillPath });
      setContent(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setContent(null);
    } finally {
      setLoading(false);
    }
  }, [skillPath]);

  return { content, loading, error, loadReadme };
}

/**
 * Hook for listing skill folder files
 */
export function useSkillFiles(skillPath: string | null) {
  const [files, setFiles] = useState<SkillFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async (maxDepth?: number) => {
    if (!skillPath) {
      setFiles([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await invoke<SkillFileEntry[]>("list_skill_files", {
        skillPath,
        maxDepth
      });
      setFiles(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [skillPath]);

  return { files, loading, error, loadFiles };
}

/**
 * Hook for reading a file from skill folder
 */
export function useSkillFileContent() {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = useCallback(async (filePath: string, skillPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string>("read_skill_file", { filePath, skillPath });
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
