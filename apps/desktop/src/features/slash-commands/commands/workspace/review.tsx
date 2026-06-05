import { createElement } from "react";
import { FileSearch } from "lucide-react";
import i18n from "@/i18n";
import { getSlashCommandArg } from "../../types";
import type { DesktopSlashCommand } from "../../types";

export const reviewCommand: DesktopSlashCommand = {
  id: "review",
  name: "review",
  get description() { return i18n.t("chat.slashCommands.reviewDesc"); },
  icon: createElement(FileSearch, { className: "h-4 w-4" }),
  category: "workspace",
  source: "builtin",
  args: [
    {
      name: "target",
      required: false,
      get description() { return i18n.t("chat.slashCommands.reviewArgDesc"); },
    },
  ],
  execute: async (payload, context) => {
    const { t } = context;

    if (!context.workspacePath) {
      return {
        type: "action",
        toast: { message: "chat.slashCommands.noWorkspaceSelected", type: "error", i18n: true },
      };
    }

    const target = getSlashCommandArg(payload).trim();

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
