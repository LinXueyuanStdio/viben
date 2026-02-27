import { createElement } from "react";
import { Stethoscope } from "lucide-react";
import type { SlashCommandDefinition } from "../../types";

export const doctorCommand: SlashCommandDefinition = {
  id: "doctor",
  name: "doctor",
  description: "Diagnose system configuration and connectivity",
  icon: createElement(Stethoscope, { className: "h-4 w-4" }),
  category: "info",
  source: "builtin",
  execute: async (context) => {
    // Collect diagnostic information
    const diagnostics = [
      "**System Diagnostics**",
      "",
      "**Environment:**",
      `- Platform: ${navigator.platform}`,
      `- User Agent: ${navigator.userAgent.slice(0, 50)}...`,
      "",
      "**Connection:**",
      `- Online: ${navigator.onLine ? "Yes" : "No"}`,
      "",
      "**Workspace:**",
      `- Path: ${context.workspacePath || "Not set"}`,
      "",
      "**Session:**",
      `- Agent: ${context.agentId || "None"}`,
      `- Model: ${context.currentModel || "Default"}`,
      `- Messages: ${context.messages.length}`,
    ];

    return {
      type: "message",
      content: diagnostics.join("\n"),
    };
  },
};
