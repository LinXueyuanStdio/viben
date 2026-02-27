import { createElement } from "react";
import { Edit3 } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const vimCommand: SlashCommandDefinition = {
  id: "vim",
  name: "vim",
  description: "Toggle vim editing mode (desktop: opens fullscreen editor)",
  icon: createElement(Edit3, { className: "h-4 w-4" }),
  category: "session",
  source: "builtin",
  execute: async (_context) => {
    // In desktop app, we open the fullscreen writing mode
    return {
      type: "ui",
      dialog: { name: "writing-mode" },
    };
  },
};
