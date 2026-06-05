import { useState, useEffect, useMemo } from "react";
import { createElement } from "react";
import { FileText } from "lucide-react";
import { getGatewayClient } from "@/lib/gateway";
import type {
  DesktopSlashCommand,
  WorkspaceCommandFile,
  WorkspaceCommandsResponse,
} from "../types";

/**
 * Hook that loads workspace commands from .claude/commands directory
 */
export function useWorkspaceCommands(
  workspacePath?: string
): DesktopSlashCommand[] {
  const [commands, setCommands] = useState<WorkspaceCommandFile[]>([]);

  useEffect(() => {
    if (!workspacePath) {
      setCommands([]);
      return;
    }

    let cancelled = false;

    async function loadCommands() {
      try {
        const params = new URLSearchParams({
          workspace_path: workspacePath!,
        });
        const data = await getGatewayClient().get<WorkspaceCommandsResponse>(
          `/api/commands/workspace?${params.toString()}`
        );

        if (!cancelled && data?.commands) {
          setCommands(data.commands);
        }
      } catch (error) {
        console.error("Failed to load workspace commands:", error);
        if (!cancelled) {
          setCommands([]);
        }
      }
    }

    loadCommands();

    return () => {
      cancelled = true;
    };
  }, [workspacePath]);

  return useMemo(() => {
    return commands.map((cmd) => ({
      id: `workspace:${cmd.fullName}`,
      name: cmd.fullName,
      description: cmd.description,
      icon: createElement(FileText, { className: "h-4 w-4" }),
      category: "workspace" as const,
      source: "workspace" as const,
      execute: async () => {
        return {
          type: "prompt" as const,
          prompt: cmd.content,
        };
      },
    }));
  }, [commands]);
}
