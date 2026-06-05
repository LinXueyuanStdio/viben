import { createElement } from "react";
import { HelpCircle } from "lucide-react";
import i18n from "@/i18n";
import type { DesktopSlashCommand } from "../../types";

export const helpCommand: DesktopSlashCommand = {
  id: "help",
  name: "help",
  get description() { return i18n.t("chat.slashCommands.helpDesc"); },
  icon: createElement(HelpCircle, { className: "h-4 w-4" }),
  category: "session",
  source: "builtin",
  execute: async () => {
    return {
      type: "ui",
      dialog: { name: "command-help" },
    };
  },
};
