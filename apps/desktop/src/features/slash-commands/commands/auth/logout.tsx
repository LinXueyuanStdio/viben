import { createElement } from "react";
import { LogOut } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const logoutCommand: SlashCommandDefinition = {
  id: "logout",
  name: "logout",
  description: "Sign out of your account",
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
