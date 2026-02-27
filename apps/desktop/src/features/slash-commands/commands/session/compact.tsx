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
  execute: async (_context, args) => {
    const prompt = args
      ? `Please compress the conversation history with this focus: ${args}`
      : `Please compress and summarize the conversation history so far, keeping only the essential context needed to continue our work. Remove redundant information while preserving key decisions, code changes, and important details.`;

    return {
      type: "prompt",
      prompt,
    };
  },
};
