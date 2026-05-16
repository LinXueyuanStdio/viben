import { createElement } from "react";
import { LogIn } from "lucide-react";
import i18n from "@/i18n";
import type { SlashCommandDefinition } from "../../types";

export const loginCommand: SlashCommandDefinition = {
  id: "login",
  name: "login",
  get description() { return i18n.t("chat.slashCommands.loginDesc"); },
  icon: createElement(LogIn, { className: "h-4 w-4" }),
  category: "auth",
  source: "builtin",
  execute: async (_context) => {
    return {
      type: "ui",
      dialog: { name: "login" },
    };
  },
};
