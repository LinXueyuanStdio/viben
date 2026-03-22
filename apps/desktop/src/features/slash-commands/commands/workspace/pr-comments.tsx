import { createElement } from "react";
import { MessageSquare } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const prCommentsCommand: SlashCommandDefinition = {
  id: "pr-comments",
  name: "pr-comments",
  description: "View GitHub PR comments",
  icon: createElement(MessageSquare, { className: "h-4 w-4" }),
  category: "workspace",
  source: "builtin",
  args: [
    {
      name: "pr_number",
      required: false,
      description: "PR number to view comments for",
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

    const prNumber = args?.trim();

    if (prNumber) {
      return {
        type: "prompt",
        prompt: t("chat.slashCommands.prCommentsPromptWithNumber", { prNumber }),
      };
    }

    return {
      type: "prompt",
      prompt: t("chat.slashCommands.prCommentsPromptDefault"),
    };
  },
};
