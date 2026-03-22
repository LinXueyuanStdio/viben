import { createElement } from "react";
import { FolderPlus } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const initCommand: SlashCommandDefinition = {
  id: "init",
  name: "init",
  description: "Initialize project configuration (CLAUDE.md)",
  icon: createElement(FolderPlus, { className: "h-4 w-4" }),
  category: "workspace",
  source: "builtin",
  execute: async (context) => {
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
