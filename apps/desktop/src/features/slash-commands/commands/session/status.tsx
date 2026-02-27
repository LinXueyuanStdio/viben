import { createElement } from "react";
import { Activity } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const statusCommand: SlashCommandDefinition = {
  id: "status",
  name: "status",
  description: "Show current session status",
  icon: createElement(Activity, { className: "h-4 w-4" }),
  category: "session",
  source: "builtin",
  execute: async (context) => {
    const messageCount = context.messages.length;
    const model = context.currentModel || "unknown";
    const workspace = context.workspacePath || "No workspace";
    const agent = context.agentId || "No agent";

    const statusText = `**Session Status**

- Messages: ${messageCount}
- Model: ${model}
- Workspace: ${workspace}
- Agent: ${agent}
- Session ID: ${context.sessionId || "N/A"}`;

    return {
      type: "message",
      content: statusText,
    };
  },
};
