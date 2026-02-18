import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useLocalWorkspaces } from "./use-workspaces";
import type { Workspace } from "@/types";
import type { ExecutorType } from "@viben/core/shared";

/**
 * Set of known executor types for quick lookup.
 * This should match the ExecutorType union type from @viben/core.
 */
const EXECUTOR_TYPES: Set<string> = new Set([
  "CLAUDE_CODE",
  "AMP",
  "GEMINI",
  "CODEX",
  "OPENCODE",
  "CURSOR_AGENT",
  "QWEN_CODE",
  "COPILOT",
  "DROID",
]);

/**
 * Check if an ID represents an executor type.
 *
 * @param id - The ID to check
 * @returns True if the ID is a known executor type
 */
export function isExecutorType(id: string): id is ExecutorType {
  return EXECUTOR_TYPES.has(id);
}

export interface UseWorkspaceParamReturn {
  /** The workspace path from URL query param or global workspace path */
  workspacePath: string | null;
  /** The workspace object matching the path */
  workspace: Workspace | undefined;
  /** True if using global workspace (no workspace_path param or global type) */
  isGlobal: boolean;
}

/**
 * Hook to get workspace information from URL query parameters.
 *
 * Reads `workspace_path` from query params. If not present or empty,
 * falls back to the global workspace.
 *
 * Usage:
 * ```tsx
 * // URL: /agent/my-agent?workspace_path=/path/to/project
 * const { workspacePath, workspace, isGlobal } = useWorkspaceParam();
 * // workspacePath = "/path/to/project"
 * // workspace = { id: "...", path: "/path/to/project", ... }
 * // isGlobal = false
 *
 * // URL: /agent/my-agent (no workspace_path)
 * const { workspacePath, workspace, isGlobal } = useWorkspaceParam();
 * // workspacePath = "~/.viben" (global workspace path)
 * // workspace = { id: "global", type: "global", ... }
 * // isGlobal = true
 * ```
 */
export function useWorkspaceParam(): UseWorkspaceParamReturn {
  const [searchParams] = useSearchParams();
  const { workspaces } = useLocalWorkspaces();

  return useMemo(() => {
    const workspacePathParam = searchParams.get("workspace_path");

    // Find global workspace
    const globalWorkspace = workspaces.find((w) => w.type === "global");

    // If no workspace_path provided, use global workspace
    if (!workspacePathParam) {
      return {
        workspacePath: globalWorkspace?.path || null,
        workspace: globalWorkspace,
        isGlobal: true,
      };
    }

    // Find workspace by path
    const workspace = workspaces.find((w) => w.path === workspacePathParam);

    return {
      workspacePath: workspacePathParam,
      workspace,
      isGlobal: workspace?.type === "global",
    };
  }, [searchParams, workspaces]);
}

/**
 * Build URL with workspace_path query parameter.
 *
 * @param basePath - The base path (e.g., "/agent/my-agent")
 * @param workspacePath - The workspace path to include as query param (optional)
 * @param additionalParams - Additional query parameters to include
 * @returns The full URL with query parameters
 *
 * Usage:
 * ```tsx
 * buildWorkspaceUrl("/agent/my-agent", "/path/to/project")
 * // Returns: "/agent/my-agent?workspace_path=%2Fpath%2Fto%2Fproject"
 *
 * buildWorkspaceUrl("/skill/my-skill", "/path/to/project", { agent_id: "claude" })
 * // Returns: "/skill/my-skill?workspace_path=%2Fpath%2Fto%2Fproject&agent_id=claude"
 * ```
 */
export function buildWorkspaceUrl(
  basePath: string,
  workspacePath?: string | null,
  additionalParams?: Record<string, string>
): string {
  const params = new URLSearchParams();

  if (workspacePath) {
    params.set("workspace_path", workspacePath);
  }

  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}
