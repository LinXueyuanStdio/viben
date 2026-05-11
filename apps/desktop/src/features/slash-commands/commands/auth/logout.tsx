import { createElement } from "react";
import { LogOut } from "lucide-react";
import i18n from "@/i18n";
import type { SlashCommandDefinition } from "../../types";

export const logoutCommand: SlashCommandDefinition = {
  id: "logout",
  name: "logout",
  get description() { return i18n.t("chat.slashCommands.logoutDesc"); },
  icon: createElement(LogOut, { className: "h-4 w-4" }),
  category: "auth",
  source: "builtin",
  execute: async (_context) => {
    return {
      type: "ui",
      dialog: { name: "logout-confirm" },
    };
  },
};
