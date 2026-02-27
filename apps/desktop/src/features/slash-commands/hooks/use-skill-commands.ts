import { useState, useEffect, useMemo } from "react";
import { createElement } from "react";
import { Zap } from "lucide-react";
import { getGatewayUrl } from "@/lib/gateway";
import type {
  SlashCommandDefinition,
  SkillCommandFile,
  SkillCommandsResponse,
} from "../types";

/**
 * Hook that loads skill commands from skills directories
 */
export function useSkillCommands(
  workspacePath?: string,
  agentId?: string
): SlashCommandDefinition[] {
  const [skills, setSkills] = useState<SkillCommandFile[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadSkills() {
      try {
        const baseUrl = getGatewayUrl();
        const params = new URLSearchParams();
        if (workspacePath) {
          params.set("workspace_path", workspacePath);
        }
        if (agentId) {
          params.set("agent_id", agentId);
        }

        const response = await fetch(
          `${baseUrl}/api/commands/skills?${params.toString()}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: SkillCommandsResponse = await response.json();

        if (!cancelled && data?.skills) {
          setSkills(data.skills);
        }
      } catch (error) {
        console.error("Failed to load skill commands:", error);
        if (!cancelled) {
          setSkills([]);
        }
      }
    }

    loadSkills();

    return () => {
      cancelled = true;
    };
  }, [workspacePath, agentId]);

  return useMemo(() => {
    const commandDefs: SlashCommandDefinition[] = [];

    for (const skill of skills) {
      // Create a command for each trigger
      for (const trigger of skill.triggers) {
        commandDefs.push({
          id: `skill:${skill.name}:${trigger}`,
          name: trigger,
          description: skill.description || `Skill: ${skill.name}`,
          icon: createElement(Zap, { className: "h-4 w-4" }),
          category: "workspace" as const,
          source: "skill" as const,
          execute: async (_context) => {
            return {
              type: "prompt" as const,
              prompt: `[Skill: ${skill.name}]\n\n${skill.content}`,
            };
          },
        });
      }
    }

    return commandDefs;
  }, [skills]);
}
