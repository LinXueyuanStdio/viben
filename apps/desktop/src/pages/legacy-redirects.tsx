/**
 * Legacy Route Redirects
 *
 * Redirects old URL patterns to new query-param based routes:
 * - /workspace/:workspaceId/agent/:agentId → /agent/:agentId?workspace_path=...
 * - /workspace/:workspaceId/agent/:agentId/skill/:skillId → /skill/:skillId?workspace_path=...&agent_id=...
 * - /agents/:agentId → /agent/:agentId
 */

import { Navigate, useParams } from "react-router-dom";
import { useLocalWorkspaces } from "@/hooks";

/**
 * Redirect /agents/:agentId to /agent/:agentId
 */
export function LegacyAgentRedirect() {
  const { agentId } = useParams<{ agentId: string }>();
  return <Navigate to={`/agent/${agentId}`} replace />;
}

/**
 * Redirect /workspace/:workspaceId/agent/:agentId to /agent/:agentId?workspace_path=...
 */
export function LegacyWorkspaceAgentRedirect() {
  const { workspaceId, agentId } = useParams<{
    workspaceId: string;
    agentId: string;
  }>();
  const { getWorkspace } = useLocalWorkspaces();

  const workspace = workspaceId ? getWorkspace(workspaceId) : null;
  const params = new URLSearchParams();

  if (workspace?.path) {
    params.set("workspace_path", workspace.path);
  }

  const queryString = params.toString();
  const url = `/agent/${agentId}${queryString ? `?${queryString}` : ""}`;

  return <Navigate to={url} replace />;
}

/**
 * Redirect /workspace/:workspaceId/agent/:agentId/skill/:skillId
 * to /skill/:skillId?workspace_path=...&agent_id=...
 */
export function LegacyWorkspaceSkillRedirect() {
  const { workspaceId, agentId, skillId } = useParams<{
    workspaceId: string;
    agentId: string;
    skillId: string;
  }>();
  const { getWorkspace } = useLocalWorkspaces();

  const workspace = workspaceId ? getWorkspace(workspaceId) : null;
  const params = new URLSearchParams();

  if (workspace?.path) {
    params.set("workspace_path", workspace.path);
  }
  if (agentId) {
    params.set("agent_id", agentId);
  }

  const queryString = params.toString();
  const url = `/skill/${skillId}${queryString ? `?${queryString}` : ""}`;

  return <Navigate to={url} replace />;
}
