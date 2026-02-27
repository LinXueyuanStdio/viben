import { useState, useCallback } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type { SkillFileEntry } from "@/types";

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
      const client = getGatewayClient();
      // Try SKILL.md first, then README.md
      try {
        const result = await client.readFile(`${skillPath}/SKILL.md`);
        setContent(result.content);
      } catch {
        try {
          const result = await client.readFile(`${skillPath}/README.md`);
          setContent(result.content);
        } catch {
          setContent(null);
        }
      }
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
      const client = getGatewayClient();
      const depth = maxDepth ?? 3;
      const result = await loadDirectoryRecursive(client, skillPath, 0, depth);
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

  const readFile = useCallback(async (filePath: string, _skillPath: string) => {
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

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Hook for writing a file to skill folder
 */
export function useSkillFileWriter() {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const writeFile = useCallback(async (filePath: string, _skillPath: string, content: string) => {
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
