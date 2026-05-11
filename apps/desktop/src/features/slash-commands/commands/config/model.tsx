import { createElement } from "react";
import { Cpu } from "lucide-react";
import i18n from "@/i18n";
import type { SlashCommandDefinition } from "../../types";

export const modelCommand: SlashCommandDefinition = {
  id: "model",
  name: "model",
  get description() { return i18n.t("chat.slashCommands.modelDesc"); },
  icon: createElement(Cpu, { className: "h-4 w-4" }),
  category: "config",
  source: "builtin",
  args: [
    {
      name: "model_name",
      required: false,
      get description() { return i18n.t("chat.slashCommands.modelArgDesc"); },
    },
  ],
  execute: async (context, args) => {
    if (args && context.setModel) {
      // Switch to specified model
      context.setModel(args.trim());
      return {
        type: "action",
        toast: { message: "chat.slashCommands.modelSwitched", type: "success", i18n: true, params: { model: args.trim() } },
      };
    }

    // Show model selector dialog
    return {
      type: "ui",
      dialog: { name: "model-selector" },
    };
  },
};
