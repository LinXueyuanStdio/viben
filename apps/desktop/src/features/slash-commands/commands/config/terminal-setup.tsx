import { createElement } from "react";
import { Terminal } from "lucide-react";
import i18n from "@/i18n";
import type { DesktopSlashCommand } from "../../types";

export const terminalSetupCommand: DesktopSlashCommand = {
  id: "terminal-setup",
  name: "terminal-setup",
  get description() { return i18n.t("chat.slashCommands.terminalSetupDesc"); },
  icon: createElement(Terminal, { className: "h-4 w-4" }),
  category: "config",
  source: "builtin",
  execute: async () => {
    return {
      type: "ui",
      navigateTo: "/settings/terminal",
    };
  },
};
