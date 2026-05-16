import { createElement } from "react";
import { Settings } from "lucide-react";
import i18n from "@/i18n";
import type { SlashCommandDefinition } from "../../types";

export const configCommand: SlashCommandDefinition = {
  id: "config",
  name: "config",
  get description() { return i18n.t("chat.slashCommands.configDesc"); },
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
