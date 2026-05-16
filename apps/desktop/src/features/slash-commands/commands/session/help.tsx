import { createElement } from "react";
import { HelpCircle } from "lucide-react";
import i18n from "@/i18n";
import type { SlashCommandDefinition } from "../../types";

export const helpCommand: SlashCommandDefinition = {
  id: "help",
  name: "help",
  get description() { return i18n.t("chat.slashCommands.helpDesc"); },
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
