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
    if (!context.workspacePath) {
      return {
        type: "action",
        toast: { message: "No workspace selected", type: "error" },
      };
    }

    const target = args?.trim();

    if (target) {
      return {
        type: "prompt",
        prompt: `Please review the following: ${target}

Provide a thorough code review including:
1. Code quality and readability
2. Potential bugs or issues
3. Performance considerations
4. Security concerns
5. Suggestions for improvement

Be specific and actionable in your feedback.`,
      };
    }

    return {
      type: "prompt",
      prompt: `Please review the recent changes in this workspace.

Run \`git diff\` to see unstaged changes, and \`git diff --staged\` for staged changes.

Provide a thorough code review including:
1. Code quality and readability
2. Potential bugs or issues
3. Performance considerations
4. Security concerns
5. Suggestions for improvement`,
    };
  },
};
