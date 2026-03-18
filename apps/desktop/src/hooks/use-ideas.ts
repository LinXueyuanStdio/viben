/**
 * Ideas Management Hook
 * 想法管理 Hook
 *
 * Provides functions for managing AI-generated ideas via Gateway API.
 * 通过 Gateway API 管理 AI 生成的想法。
 */

import { useState, useCallback, useEffect } from "react";
import { getGatewayClient } from "@/lib/gateway";

// =============================================================================
// Types
// =============================================================================

export type EffortLevel = "trivial" | "small" | "medium" | "large" | "complex";
export type IdeaStatus = "pending" | "promoted" | "dismissed";

export interface Idea {
  id: string;
  type: string;
  name: string | null;
  title: string;
  description: string;
  rationale: string;
  estimated_effort: EffortLevel;
  status: IdeaStatus;
  promoted_to: string | null;
  created_at: string;
  // Optional fields
  affected_files?: string[] | null;
  existing_patterns?: string[] | null;
  builds_upon?: string[] | null;
  implementation_approach?: string | null;
  category?: string | null;
  severity?: string | null;
  target_audience?: string | null;
  related_docs?: string[] | null;
  metrics?: Record<string, unknown> | null;
  ui_components?: string[] | null;
  user_stories?: string[] | null;
}

export interface IdeaType {
  name: string;
  description: string;
  max_ideas: number | null;
  source: "builtin" | "custom";
  prompt_path: string;
}

export interface IdeaTypeInput {
  name: string;
  description: string;
  max_ideas?: number;
  prompt_content: string;
}

export interface IdeaListOptions {
  type?: string;
  effort?: EffortLevel;
  status?: IdeaStatus;
}

export interface IdeaPromoteOptions {
  slug?: string;
  priority?: string;
  assignee?: string;
  branch?: string;
  description?: string;
  agent?: string;
  executor?: string;
  model?: string;
  start?: boolean;
  worktree?: boolean;
}

export interface IdeaGenerateOptions {
  types: string[];
  output?: string;
  model?: string;
  max_ideas?: number;
  append?: boolean;
  override?: boolean;
}

// =============================================================================
// API Response Types
// =============================================================================

interface ListIdeasResponse {
  success: boolean;
  ideas: Idea[];
  count: number;
  error?: string;
}

interface ViewIdeaResponse {
  success: boolean;
  idea: Idea;
  session_dir: string | null;
  file_path: string | null;
  error?: string;
}

interface ListTypesResponse {
  success: boolean;
  types: IdeaType[];
  count: number;
  error?: string;
}

interface PromoteIdeaResponse {
  success: boolean;
  idea_id: string;
  idea_title: string;
  task_id: string;
  task_dir: string;
  dir_name: string;
  priority: string;
  status: string;
  worktree: boolean;
  error?: string;
}

interface GenerateIdeasResponse {
  success: boolean;
  session_id: string;
  session_dir: string;
  ideas: Idea[];
  by_type: Record<string, number>;
  total_ideas: number;
  errors: string[];
  error?: string;
}

interface DismissIdeaResponse {
  success: boolean;
  idea_id: string;
  error?: string;
}

interface RemoveIdeasResponse {
  success: boolean;
  removed: string[];
  count: number;
  error?: string;
}

interface CreateIdeaTypeResponse {
  success: boolean;
  idea_type: IdeaType | null;
  error?: string;
}

interface UpdateIdeaTypeResponse {
  success: boolean;
  idea_type: IdeaType | null;
  error?: string;
}

interface DeleteIdeaTypeResponse {
  success: boolean;
  name: string;
  error?: string;
}

// =============================================================================
// Helper: Gateway Fetch
// =============================================================================

/**
 * Helper to make API requests to the gateway
 */
async function gatewayFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const client = getGatewayClient();
  const baseUrl = client.getBaseUrl();

  // Build headers - only set Content-Type for requests with body
  const headers: HeadersInit = {
    Accept: "application/json",
    ...options?.headers,
  };

  // For POST/PUT/PATCH requests, always send JSON body (empty object if no body provided)
  const method = options?.method?.toUpperCase();
  const needsBody = method === "POST" || method === "PUT" || method === "PATCH";
  let body = options?.body;

  if (needsBody) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
    // If no body provided, send empty JSON object to avoid "Body cannot be empty" error
    if (!body) {
      body = "{}";
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.error?.message || errorBody?.error || errorBody?.message || JSON.stringify(errorBody);
    } catch {
      // Keep statusText as fallback
    }
    throw new Error(errorMessage);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

// =============================================================================
// Hook: useIdeas
// =============================================================================

export interface UseIdeasOptions {
  workspacePath: string | null;
  type?: string;
  effort?: EffortLevel;
  status?: IdeaStatus;
  autoFetch?: boolean;
}

export interface UseIdeasReturn {
  ideas: Idea[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  promoteIdea: (ideaId: string, options?: IdeaPromoteOptions) => Promise<PromoteIdeaResponse | null>;
  dismissIdea: (ideaId: string) => Promise<boolean>;
  removeIdea: (ideaId: string) => Promise<boolean>;
}

export function useIdeas(options: UseIdeasOptions): UseIdeasReturn {
  const { workspacePath, type, effort, status, autoFetch = true } = options;
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setIdeas([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ workspace_path: workspacePath });
      if (type) params.append("type", type);
      if (effort) params.append("effort", effort);
      if (status) params.append("status", status);

      const response = await gatewayFetch<ListIdeasResponse>(`/api/ideas?${params}`);
      if (response.success) {
        setIdeas(response.ideas);
      } else {
        setError(response.error || "Failed to fetch ideas");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [workspacePath, type, effort, status]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  const promoteIdea = useCallback(
    async (ideaId: string, promoteOptions?: IdeaPromoteOptions): Promise<PromoteIdeaResponse | null> => {
      if (!workspacePath) return null;

      try {
        const response = await gatewayFetch<PromoteIdeaResponse>(`/api/ideas/${ideaId}/promote`, {
          method: "POST",
          body: JSON.stringify({
            workspace_path: workspacePath,
            ...promoteOptions,
          }),
        });
        if (response.success) {
          await refresh();
          return response;
        } else {
          setError(response.error || "Failed to promote idea");
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [workspacePath, refresh]
  );

  const dismissIdea = useCallback(
    async (ideaId: string): Promise<boolean> => {
      if (!workspacePath) return false;

      try {
        const response = await gatewayFetch<DismissIdeaResponse>(`/api/ideas/${ideaId}/dismiss`, {
          method: "POST",
          body: JSON.stringify({
            workspace_path: workspacePath,
          }),
        });
        if (response.success) {
          await refresh();
          return true;
        } else {
          setError(response.error || "Failed to dismiss idea");
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [workspacePath, refresh]
  );

  const removeIdea = useCallback(
    async (ideaId: string): Promise<boolean> => {
      if (!workspacePath) return false;

      try {
        const response = await gatewayFetch<RemoveIdeasResponse>(
          `/api/ideas/${ideaId}?workspace_path=${encodeURIComponent(workspacePath)}`,
          { method: "DELETE" }
        );
        if (response.success) {
          await refresh();
          return true;
        } else {
          setError(response.error || "Failed to remove idea");
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [workspacePath, refresh]
  );

  return {
    ideas,
    loading,
    error,
    refresh,
    promoteIdea,
    dismissIdea,
    removeIdea,
  };
}

// =============================================================================
// Hook: useIdeaTypes
// =============================================================================

export interface UseIdeaTypesOptions {
  workspacePath: string | null;
  autoFetch?: boolean;
}

export interface UseIdeaTypesReturn {
  types: IdeaType[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createType: (input: IdeaTypeInput) => Promise<IdeaType | null>;
  updateType: (name: string, input: Partial<IdeaTypeInput>) => Promise<IdeaType | null>;
  deleteType: (name: string) => Promise<boolean>;
}

export function useIdeaTypes(options: UseIdeaTypesOptions): UseIdeaTypesReturn {
  const { workspacePath, autoFetch = true } = options;
  const [types, setTypes] = useState<IdeaType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspacePath) {
      setTypes([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await gatewayFetch<ListTypesResponse>(
        `/api/idea-types?workspace_path=${encodeURIComponent(workspacePath)}`
      );
      if (response.success) {
        setTypes(response.types);
      } else {
        setError(response.error || "Failed to fetch idea types");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  const createType = useCallback(
    async (input: IdeaTypeInput): Promise<IdeaType | null> => {
      if (!workspacePath) return null;

      try {
        const response = await gatewayFetch<CreateIdeaTypeResponse>("/api/idea-types", {
          method: "POST",
          body: JSON.stringify({
            workspace_path: workspacePath,
            name: input.name,
            description: input.description,
            max_ideas: input.max_ideas,
            prompt_content: input.prompt_content,
          }),
        });
        if (response.success && response.idea_type) {
          await refresh();
          return response.idea_type;
        } else {
          setError(response.error || "Failed to create idea type");
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [workspacePath, refresh]
  );

  const updateType = useCallback(
    async (name: string, input: Partial<IdeaTypeInput>): Promise<IdeaType | null> => {
      if (!workspacePath) return null;

      try {
        const response = await gatewayFetch<UpdateIdeaTypeResponse>(`/api/idea-types/${name}`, {
          method: "PUT",
          body: JSON.stringify({
            workspace_path: workspacePath,
            description: input.description,
            max_ideas: input.max_ideas,
            prompt_content: input.prompt_content,
          }),
        });
        if (response.success && response.idea_type) {
          await refresh();
          return response.idea_type;
        } else {
          setError(response.error || "Failed to update idea type");
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [workspacePath, refresh]
  );

  const deleteType = useCallback(
    async (name: string): Promise<boolean> => {
      if (!workspacePath) return false;

      try {
        const response = await gatewayFetch<DeleteIdeaTypeResponse>(
          `/api/idea-types/${name}?workspace_path=${encodeURIComponent(workspacePath)}`,
          { method: "DELETE" }
        );
        if (response.success) {
          await refresh();
          return true;
        } else {
          setError(response.error || "Failed to delete idea type");
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [workspacePath, refresh]
  );

  return {
    types,
    loading,
    error,
    refresh,
    createType,
    updateType,
    deleteType,
  };
}

// =============================================================================
// Hook: useIdeaDetail
// =============================================================================

export interface UseIdeaDetailOptions {
  workspacePath: string | null;
  ideaId: string | null;
}

export interface UseIdeaDetailReturn {
  idea: Idea | null;
  sessionDir: string | null;
  filePath: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useIdeaDetail(options: UseIdeaDetailOptions): UseIdeaDetailReturn {
  const { workspacePath, ideaId } = options;
  const [idea, setIdea] = useState<Idea | null>(null);
  const [sessionDir, setSessionDir] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspacePath || !ideaId) {
      setIdea(null);
      setSessionDir(null);
      setFilePath(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await gatewayFetch<ViewIdeaResponse>(
        `/api/ideas/${ideaId}?workspace_path=${encodeURIComponent(workspacePath)}`
      );
      if (response.success) {
        setIdea(response.idea);
        setSessionDir(response.session_dir);
        setFilePath(response.file_path);
      } else {
        setError(response.error || "Failed to fetch idea");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [workspacePath, ideaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    idea,
    sessionDir,
    filePath,
    loading,
    error,
    refresh,
  };
}

// =============================================================================
// Hook: useGenerateIdeas
// =============================================================================

export interface UseGenerateIdeasReturn {
  generating: boolean;
  error: string | null;
  generateIdeas: (
    workspacePath: string,
    options: IdeaGenerateOptions
  ) => Promise<GenerateIdeasResponse | null>;
}

export function useGenerateIdeas(): UseGenerateIdeasReturn {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateIdeas = useCallback(
    async (
      workspacePath: string,
      options: IdeaGenerateOptions
    ): Promise<GenerateIdeasResponse | null> => {
      setGenerating(true);
      setError(null);

      try {
        const response = await gatewayFetch<GenerateIdeasResponse>("/api/ideas/generate", {
          method: "POST",
          body: JSON.stringify({
            workspace_path: workspacePath,
            ...options,
          }),
        });
        if (response.success || response.ideas.length > 0) {
          return response;
        } else {
          setError(response.error || "Failed to generate ideas");
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setGenerating(false);
      }
    },
    []
  );

  return {
    generating,
    error,
    generateIdeas,
  };
}

// =============================================================================
// Hook: useIdeaFileContent
// =============================================================================

export interface UseIdeaFileContentReturn {
  content: string | null;
  loading: boolean;
  error: string | null;
  readFile: (filePath: string) => Promise<void>;
  clearContent: () => void;
}

interface ReadFileResponse {
  path: string;
  content: string;
  size: number;
  encoding: string;
  error?: string;
}

export function useIdeaFileContent(): UseIdeaFileContentReturn {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = useCallback(async (filePath: string) => {
    setLoading(true);
    setError(null);

    try {
      // Use /api/files/content endpoint
      const response = await gatewayFetch<ReadFileResponse>(
        `/api/files/content?path=${encodeURIComponent(filePath)}`
      );
      if (response.content !== undefined) {
        setContent(response.content);
      } else {
        setError(response.error || "Failed to read file");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const clearContent = useCallback(() => {
    setContent(null);
    setError(null);
  }, []);

  return {
    content,
    loading,
    error,
    readFile,
    clearContent,
  };
}
