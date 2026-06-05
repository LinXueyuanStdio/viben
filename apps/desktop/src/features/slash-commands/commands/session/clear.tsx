import { createElement } from "react";
import { Trash2 } from "lucide-react";
import i18n from "@/i18n";
import type { DesktopSlashCommand } from "../../types";

export const clearCommand: DesktopSlashCommand = {
  id: "clear",
  name: "clear",
  get description() { return i18n.t("chat.slashCommands.clearDesc"); },
  icon: createElement(Trash2, { className: "h-4 w-4" }),
  category: "session",
  source: "builtin",
  execute: async (_payload, context) => {
    context.clearMessages();
    return {
      type: "action",
      toast: { message: "chat.slashCommands.clearSuccess", type: "success", i18n: true },
    };
  },
};
