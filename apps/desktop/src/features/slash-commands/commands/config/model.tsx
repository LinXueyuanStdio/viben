import { createElement } from "react";
import { Cpu } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const modelCommand: SlashCommandDefinition = {
  id: "model",
  name: "model",
  description: "View or switch the current model",
  icon: createElement(Cpu, { className: "h-4 w-4" }),
  category: "config",
  source: "builtin",
  args: [
    {
      name: "model_name",
      required: false,
      description: "Model name to switch to (e.g., sonnet, opus, haiku)",
    },
  ],
  execute: async (context, args) => {
    if (args && context.setModel) {
      // Switch to specified model
      context.setModel(args.trim());
      return {
        type: "action",
        toast: { message: `Switched to model: ${args.trim()}`, type: "success" },
      };
    }

    // Show model selector dialog
    return {
      type: "ui",
      dialog: { name: "model-selector" },
    };
  },
};
