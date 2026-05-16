import { createElement } from "react";
import { Activity } from "lucide-react";
import i18n from "@/i18n";
import type { SlashCommandDefinition } from "../../types";

export const statusCommand: SlashCommandDefinition = {
  id: "status",
  name: "status",
  get description() { return i18n.t("chat.slashCommands.statusDesc"); },
  icon: createElement(Activity, { className: "h-4 w-4" }),
  category: "session",
  source: "builtin",
  execute: async (context) => {
    const { t } = context;
    const messageCount = context.messages.length;
    const model = context.currentModel || t("chat.slashCommands.statusUnknown");
    const workspace = context.workspacePath || t("chat.slashCommands.statusNoWorkspace");
    const agent = context.agentId || t("chat.slashCommands.statusNoAgent");
    const sessionId = context.sessionId || t("chat.slashCommands.statusNotAvailable");

    const statusText = `**${t("chat.slashCommands.sessionStatusTitle")}**

- ${t("chat.slashCommands.statusMessages")}: ${messageCount}
- ${t("chat.slashCommands.statusModel")}: ${model}
- ${t("chat.slashCommands.statusWorkspace")}: ${workspace}
- ${t("chat.slashCommands.statusAgent")}: ${agent}
- ${t("chat.slashCommands.statusSessionId")}: ${sessionId}`;

    return {
      type: "message",
      content: statusText,
    };
  },
};
