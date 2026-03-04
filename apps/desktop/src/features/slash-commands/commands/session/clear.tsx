import { createElement } from "react";
import { Trash2 } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const clearCommand: SlashCommandDefinition = {
  id: "clear",
  name: "clear",
  description: "Clear conversation history",
  icon: createElement(Trash2, { className: "h-4 w-4" }),
  category: "session",
  source: "builtin",
  execute: async (context) => {
    context.clearMessages();
    return {
      type: "action",
      toast: { message: "chat.slashCommands.clearSuccess", type: "success", i18n: true },
    };
  },
};
