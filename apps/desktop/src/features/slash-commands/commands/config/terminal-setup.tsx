import { createElement } from "react";
import { Terminal } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const terminalSetupCommand: SlashCommandDefinition = {
  id: "terminal-setup",
  name: "terminal-setup",
  description: "Configure terminal integration settings",
  icon: createElement(Terminal, { className: "h-4 w-4" }),
  category: "config",
  source: "builtin",
  execute: async (_context) => {
    return {
      type: "ui",
      navigateTo: "/settings/terminal",
    };
  },
};
