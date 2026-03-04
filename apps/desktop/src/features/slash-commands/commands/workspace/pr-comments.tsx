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
        prompt: `Please fetch and display the comments from GitHub PR #${prNumber}.

Use the \`gh\` CLI to get PR comments:
\`\`\`
gh pr view ${prNumber} --comments
\`\`\`

Summarize the feedback and any action items.`,
      };
    }

    return {
      type: "prompt",
      prompt: `Please check if there's an open PR for the current branch and display its comments.

Use the \`gh\` CLI:
\`\`\`
gh pr view --comments
\`\`\`

If there's no PR, let me know. Otherwise, summarize the feedback and any action items.`,
    };
  },
};
