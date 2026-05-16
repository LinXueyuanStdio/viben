import { createElement } from "react";
import { DollarSign } from "lucide-react";
import i18n from "@/i18n";
import type { SlashCommandDefinition } from "../../types";

export const costCommand: SlashCommandDefinition = {
  id: "cost",
  name: "cost",
  get description() { return i18n.t("chat.slashCommands.costDesc"); },
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
