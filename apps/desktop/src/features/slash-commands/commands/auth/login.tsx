import { createElement } from "react";
import { LogIn } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const loginCommand: SlashCommandDefinition = {
  id: "login",
  name: "login",
  description: "Sign in to your account",
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
