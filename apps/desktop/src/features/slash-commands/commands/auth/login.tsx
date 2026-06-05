import { createElement } from "react";
import { LogIn } from "lucide-react";
import i18n from "@/i18n";
import type { DesktopSlashCommand } from "../../types";

export const loginCommand: DesktopSlashCommand = {
  id: "login",
  name: "login",
  get description() { return i18n.t("chat.slashCommands.loginDesc"); },
  icon: createElement(LogIn, { className: "h-4 w-4" }),
  category: "auth",
  source: "builtin",
  execute: async () => {
    return {
      type: "ui",
      dialog: { name: "login" },
    };
  },
};
