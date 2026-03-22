import { createElement } from "react";
import { FileSearch } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const reviewCommand: SlashCommandDefinition = {
  id: "review",
  name: "review",
  description: "Request code review for files or commits",
  icon: createElement(FileSearch, { className: "h-4 w-4" }),
  category: "workspace",
  source: "builtin",
  args: [
    {
      name: "target",
      required: false,
      description: "File path or commit hash to review",
    },
  ],
  execute: async (context, args) => {
    const { t } = context;

    if (!context.workspacePath) {
      return {
        type: "action",
        toast: { message: "chat.slashCommands.noWorkspaceSelected", type: "error", i18n: true },
      };
    }

    const target = args?.trim();

    if (target) {
      return {
        type: "prompt",
        prompt: t("chat.slashCommands.reviewPromptWithTarget", { target }),
      };
    }

    return {
      type: "prompt",
      prompt: t("chat.slashCommands.reviewPromptDefault"),
    };
  },
};
