import { createElement } from "react";
import { Brain } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const memoryCommand: SlashCommandDefinition = {
  id: "memory",
  name: "memory",
  description: "Manage agent memory and context",
  icon: createElement(Brain, { className: "h-4 w-4" }),
  category: "config",
  source: "builtin",
  execute: async (context) => {
    if (!context.agentId) {
      return {
        type: "action",
        toast: { message: "chat.slashCommands.noAgentSelected", type: "error", i18n: true },
      };
    }

    return {
      type: "ui",
      dialog: { name: "agent-memory", props: { agentId: context.agentId } },
    };
  },
};
