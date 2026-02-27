import { createElement } from "react";
import { DollarSign } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const costCommand: SlashCommandDefinition = {
  id: "cost",
  name: "cost",
  description: "Show token usage and cost statistics",
  icon: createElement(DollarSign, { className: "h-4 w-4" }),
  category: "info",
  source: "builtin",
  execute: async (_context) => {
    // This will be enhanced to show actual usage stats
    return {
      type: "ui",
      dialog: { name: "usage-stats" },
    };
  },
};
