import { createElement } from "react";
import { Minimize2 } from "lucide-react";
import i18n from "@/i18n";
import { getSlashCommandArg } from "../../types";
import type { DesktopSlashCommand } from "../../types";

export const compactCommand: DesktopSlashCommand = {
  id: "compact",
  name: "compact",
  get description() { return i18n.t("chat.slashCommands.compactDesc"); },
  icon: createElement(Minimize2, { className: "h-4 w-4" }),
  category: "session",
  source: "builtin",
  args: [
    {
      name: "summary",
      required: false,
      get description() { return i18n.t("chat.slashCommands.compactArgDesc"); },
    },
  ],
  execute: async (payload, context) => {
    const { t } = context;
    const args = getSlashCommandArg(payload).trim();
    const prompt = args
      ? t("chat.slashCommands.compactPromptWithFocus", { focus: args })
      : t("chat.slashCommands.compactPromptDefault");

    return {
      type: "prompt",
      prompt,
    };
  },
};
