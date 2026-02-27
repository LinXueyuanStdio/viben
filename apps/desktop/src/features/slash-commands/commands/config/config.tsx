import { createElement } from "react";
import { Settings } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const configCommand: SlashCommandDefinition = {
  id: "config",
  name: "config",
  description: "Open settings panel",
  icon: createElement(Settings, { className: "h-4 w-4" }),
  category: "config",
  source: "builtin",
  execute: async (_context) => {
    return {
      type: "ui",
      navigateTo: "/settings",
    };
  },
};
