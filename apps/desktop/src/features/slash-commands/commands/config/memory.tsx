import { createElement } from "react";
import { Brain } from "lucide-react";
import i18n from "@/i18n";
import type { DesktopSlashCommand } from "../../types";

export const memoryCommand: DesktopSlashCommand = {
  id: "memory",
  name: "memory",
  get description() { return i18n.t("chat.slashCommands.memoryDesc"); },
  icon: createElement(Brain, { className: "h-4 w-4" }),
  category: "config",
  source: "builtin",
  execute: async (_payload, context) => {
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
