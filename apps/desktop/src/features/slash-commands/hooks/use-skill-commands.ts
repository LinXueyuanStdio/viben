import { useState, useEffect, useMemo } from "react";
import { createElement } from "react";
import { Zap } from "lucide-react";
import { getGatewayClient } from "@/lib/gateway";
import i18n from "@/i18n";
import type {
  DesktopSlashCommand,
  SkillCommandFile,
  SkillCommandsResponse,
} from "../types";

/**
 * Hook that loads skill commands from skills directories
 */
export function useSkillCommands(
  workspacePath?: string,
  agentId?: string
): DesktopSlashCommand[] {
  const [skills, setSkills] = useState<SkillCommandFile[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadSkills() {
      try {
        const params = new URLSearchParams();
        if (workspacePath) {
          params.set("workspace_path", workspacePath);
        }
        if (agentId) {
          params.set("agent_id", agentId);
        }

        const query = params.toString();
        const data = await getGatewayClient().get<SkillCommandsResponse>(
          `/api/commands/skills${query ? `?${query}` : ""}`
        );

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
    const commandDefs: DesktopSlashCommand[] = [];

    for (const skill of skills) {
      // Create a command for each trigger
      for (const trigger of skill.triggers) {
        commandDefs.push({
          id: `skill:${skill.name}:${trigger}`,
          name: trigger,
          description: skill.description || i18n.t("chat.slashCommands.skillFallbackDescription", { skillName: skill.name }),
          icon: createElement(Zap, { className: "h-4 w-4" }),
          category: "workspace" as const,
          source: "skill" as const,
          execute: async () => {
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
