import { createElement } from "react";
import { FolderPlus } from "lucide-react";
import i18n from "@/i18n";
import type { DesktopSlashCommand } from "../../types";

export const initCommand: DesktopSlashCommand = {
  id: "init",
  name: "init",
  get description() { return i18n.t("chat.slashCommands.initDesc"); },
  icon: createElement(FolderPlus, { className: "h-4 w-4" }),
  category: "workspace",
  source: "builtin",
  execute: async (_payload, context) => {
    const { t } = context;

    if (!context.workspacePath) {
      return {
        type: "action",
        toast: { message: "chat.slashCommands.noWorkspaceSelected", type: "error", i18n: true },
      };
    }

    return {
      type: "prompt",
      prompt: t("chat.slashCommands.initPrompt", { workspacePath: context.workspacePath }),
    };
  },
};
