/**
 * Legacy Route Redirects
 *
 * These components handle backward compatibility for old URL structures
 * by redirecting to the new query-param based routes.
 */
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useLocalWorkspaces, isExecutorType } from "@/hooks";
import { buildWorkspaceUrl } from "@/hooks/use-workspace-param";

/**
 * Redirects from /workspace/:workspaceId/agent/:agentId
 * to /agent/:agentId?workspace_path=...
 *
 * Also handles /executor/:executorType?workspace_path=... for executor types
 */
export function LegacyAgentRedirect() {
  const navigate = useNavigate();
  const { workspaceId, agentId } = useParams<{
    workspaceId: string;
    agentId: string;
  }>();
  const { workspaces, isLoading } = useLocalWorkspaces();

  useEffect(() => {
    if (isLoading || !workspaceId || !agentId) return;

    // Find workspace by ID to get its path
    const workspace = workspaces.find((w) => w.id === workspaceId);
    const workspacePath = workspace?.path;

    if (isExecutorType(agentId)) {
      // Redirect to executor detail page
      const url = buildWorkspaceUrl(`/executor/${agentId}`, workspacePath);
      navigate(url, { replace: true });
    } else {
      // Redirect to agent detail page
      const url = buildWorkspaceUrl(`/agent/${agentId}`, workspacePath);
      navigate(url, { replace: true });
    }
  }, [navigate, workspaceId, agentId, workspaces, isLoading]);

  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Redirects from /workspace/:workspaceId/agent/:agentId/skill/:skillId
 * to /skill/:skillId?workspace_path=...&agent_id=...
 */
export function LegacySkillRedirect() {
  const navigate = useNavigate();
  const { workspaceId, agentId, skillId } = useParams<{
    workspaceId: string;
    agentId: string;
    skillId: string;
  }>();
  const { workspaces, isLoading } = useLocalWorkspaces();

  useEffect(() => {
    if (isLoading || !workspaceId || !agentId || !skillId) return;

    // Find workspace by ID to get its path
    const workspace = workspaces.find((w) => w.id === workspaceId);
    const workspacePath = workspace?.path;

    // Redirect to skill detail page with query params
    const url = buildWorkspaceUrl(`/skill/${skillId}`, workspacePath, {
      agent_id: agentId,
    });
    navigate(url, { replace: true });
  }, [navigate, workspaceId, agentId, skillId, workspaces, isLoading]);

  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
