import { createElement } from "react";
import { Minimize2 } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const compactCommand: SlashCommandDefinition = {
  id: "compact",
  name: "compact",
  description: "Compress conversation history to reduce token usage",
  icon: createElement(Minimize2, { className: "h-4 w-4" }),
  category: "session",
  source: "builtin",
  args: [
    {
      name: "summary",
      required: false,
      description: "Optional custom summary for the compression",
    },
  ],
  execute: async (context, args) => {
    const { t } = context;
    const prompt = args
      ? t("chat.slashCommands.compactPromptWithFocus", { focus: args })
      : t("chat.slashCommands.compactPromptDefault");

    return {
      type: "prompt",
      prompt,
    };
  },
};
