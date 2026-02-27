import { createElement } from "react";
import { Shield } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const permissionsCommand: SlashCommandDefinition = {
  id: "permissions",
  name: "permissions",
  description: "View and manage tool permissions",
  icon: createElement(Shield, { className: "h-4 w-4" }),
  category: "config",
  source: "builtin",
  execute: async (_context) => {
    return {
      type: "ui",
      navigateTo: "/settings/permissions",
    };
  },
};
