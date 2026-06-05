import { createElement } from "react";
import { Edit3 } from "lucide-react";
import i18n from "@/i18n";
import type { DesktopSlashCommand } from "../../types";

export const vimCommand: DesktopSlashCommand = {
  id: "vim",
  name: "vim",
  get description() { return i18n.t("chat.slashCommands.vimDesc"); },
  icon: createElement(Edit3, { className: "h-4 w-4" }),
  category: "session",
  source: "builtin",
  execute: async () => {
    // In desktop app, we open the fullscreen writing mode
    return {
      type: "ui",
      dialog: { name: "writing-mode" },
    };
  },
};
