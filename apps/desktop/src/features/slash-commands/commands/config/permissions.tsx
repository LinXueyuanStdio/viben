import { createElement } from "react";
import { Shield } from "lucide-react";
import i18n from "@/i18n";
import type { SlashCommandDefinition } from "../../types";

export const permissionsCommand: SlashCommandDefinition = {
  id: "permissions",
  name: "permissions",
  get description() { return i18n.t("chat.slashCommands.permissionsDesc"); },
  icon: createElement(Shield, { className: "h-4 w-4" }),
  category: "config",
  source: "builtin",
  execute: async (_context) => {
    return {
      type: "ui",
      navigateTo: "/settings/permissions",
    };
  },
};
