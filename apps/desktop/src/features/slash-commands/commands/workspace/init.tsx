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
    if (!context.workspacePath) {
      return {
        type: "action",
        toast: { message: "No workspace selected", type: "error" },
      };
    }

    return {
      type: "prompt",
      prompt: `Please initialize this project by creating a CLAUDE.md file in the workspace root (${context.workspacePath}).

The CLAUDE.md should include:
1. Project overview and architecture
2. Key directories and their purposes
3. Build and test commands
4. Important conventions and patterns
5. Any project-specific instructions for AI assistants

Analyze the existing codebase structure first to generate accurate and helpful content.`,
    };
  },
};
