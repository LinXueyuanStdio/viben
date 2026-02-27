import { useState, useEffect, useMemo } from "react";
import { createElement } from "react";
import { FileText } from "lucide-react";
import { getGatewayUrl } from "@/lib/gateway";
import type {
  SlashCommandDefinition,
  WorkspaceCommandFile,
  WorkspaceCommandsResponse,
} from "../types";

/**
 * Hook that loads workspace commands from .claude/commands directory
 */
export function useWorkspaceCommands(
  workspacePath?: string
): SlashCommandDefinition[] {
  const [commands, setCommands] = useState<WorkspaceCommandFile[]>([]);

  useEffect(() => {
    if (!workspacePath) {
      setCommands([]);
      return;
    }

    let cancelled = false;

    async function loadCommands() {
      try {
        const baseUrl = getGatewayUrl();
        const response = await fetch(
          `${baseUrl}/api/commands/workspace?workspace_path=${encodeURIComponent(workspacePath!)}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: WorkspaceCommandsResponse = await response.json();

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
      execute: async (_context) => {
        return {
          type: "prompt" as const,
          prompt: cmd.content,
        };
      },
    }));
  }, [commands]);
}
