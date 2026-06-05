import { createElement } from "react";
import { Shield } from "lucide-react";
import i18n from "@/i18n";
import type { DesktopSlashCommand } from "../../types";

export const permissionsCommand: DesktopSlashCommand = {
  id: "permissions",
  name: "permissions",
  get description() { return i18n.t("chat.slashCommands.permissionsDesc"); },
  icon: createElement(Shield, { className: "h-4 w-4" }),
  category: "config",
  source: "builtin",
  execute: async () => {
    return {
      type: "ui",
      navigateTo: "/settings/permissions",
    };
  },
};
