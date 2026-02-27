import { createElement } from "react";
import { HelpCircle } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const helpCommand: SlashCommandDefinition = {
  id: "help",
  name: "help",
  description: "Show all available commands",
  icon: createElement(HelpCircle, { className: "h-4 w-4" }),
  category: "session",
  source: "builtin",
  execute: async (_context) => {
    return {
      type: "ui",
      dialog: { name: "command-help" },
    };
  },
};
