import { createElement } from "react";
import { LogOut } from "lucide-react";
import i18n from "@/i18n";
import type { DesktopSlashCommand } from "../../types";

export const logoutCommand: DesktopSlashCommand = {
  id: "logout",
  name: "logout",
  get description() { return i18n.t("chat.slashCommands.logoutDesc"); },
  icon: createElement(LogOut, { className: "h-4 w-4" }),
  category: "auth",
  source: "builtin",
  execute: async () => {
    return {
      type: "ui",
      dialog: { name: "logout-confirm" },
    };
  },
};
