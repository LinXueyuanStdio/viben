import { createElement } from "react";
import { Stethoscope } from "lucide-react";
import i18n from "@/i18n";
import type { DesktopSlashCommand } from "../../types";

export const doctorCommand: DesktopSlashCommand = {
  id: "doctor",
  name: "doctor",
  get description() { return i18n.t("chat.slashCommands.doctorDesc"); },
  icon: createElement(Stethoscope, { className: "h-4 w-4" }),
  category: "info",
  source: "builtin",
  execute: async (_payload, context) => {
    const { t } = context;
    // Collect diagnostic information
    const diagnostics = [
      `**${t("chat.slashCommands.systemDiagnosticsTitle")}**`,
      "",
      `**${t("chat.slashCommands.diagnosticsEnvironment")}:**`,
      `- ${t("chat.slashCommands.diagnosticsPlatform")}: ${navigator.platform}`,
      `- ${t("chat.slashCommands.diagnosticsUserAgent")}: ${navigator.userAgent.slice(0, 50)}...`,
      "",
      `**${t("chat.slashCommands.diagnosticsConnection")}:**`,
      `- ${t("chat.slashCommands.diagnosticsOnline")}: ${navigator.onLine ? t("chat.slashCommands.diagnosticsYes") : t("chat.slashCommands.diagnosticsNo")}`,
      "",
      `**${t("chat.slashCommands.statusWorkspace")}:**`,
      `- ${t("chat.slashCommands.diagnosticsPath")}: ${context.workspacePath || t("chat.slashCommands.diagnosticsNotSet")}`,
      "",
      `**${t("chat.slashCommands.diagnosticsSession")}:**`,
      `- ${t("chat.slashCommands.statusAgent")}: ${context.agentId || t("chat.slashCommands.diagnosticsNone")}`,
      `- ${t("chat.slashCommands.statusModel")}: ${context.currentModel || t("chat.slashCommands.diagnosticsDefault")}`,
      `- ${t("chat.slashCommands.statusMessages")}: ${context.messages.length}`,
    ];

    return {
      type: "message",
      content: diagnostics.join("\n"),
    };
  },
};
