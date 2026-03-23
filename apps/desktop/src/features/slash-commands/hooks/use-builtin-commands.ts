import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SlashCommandDefinition } from "../types";

// Import command implementations
import { helpCommand } from "../commands/session/help";
import { clearCommand } from "../commands/session/clear";
import { compactCommand } from "../commands/session/compact";
import { statusCommand } from "../commands/session/status";
import { modelCommand } from "../commands/config/model";
import { configCommand } from "../commands/config/config";
import { memoryCommand } from "../commands/config/memory";
import { permissionsCommand } from "../commands/config/permissions";
import { costCommand } from "../commands/info/cost";
import { doctorCommand } from "../commands/info/doctor";
import { initCommand } from "../commands/workspace/init";
import { reviewCommand } from "../commands/workspace/review";
import { prCommentsCommand } from "../commands/workspace/pr-comments";
import { loginCommand } from "../commands/auth/login";
import { logoutCommand } from "../commands/auth/logout";
import { terminalSetupCommand } from "../commands/config/terminal-setup";
import { vimCommand } from "../commands/session/vim";

/**
 * Map of command IDs to their i18n description keys
 */
const COMMAND_I18N_KEYS: Record<string, string> = {
  help: "chat.slashCommands.helpDesc",
  clear: "chat.slashCommands.clearDesc",
  compact: "chat.slashCommands.compactDesc",
  status: "chat.slashCommands.statusDesc",
  vim: "chat.slashCommands.vimDesc",
  model: "chat.slashCommands.modelDesc",
  config: "chat.slashCommands.configDesc",
  memory: "chat.slashCommands.memoryDesc",
  permissions: "chat.slashCommands.permissionsDesc",
  "terminal-setup": "chat.slashCommands.terminalSetupDesc",
  cost: "chat.slashCommands.costDesc",
  doctor: "chat.slashCommands.doctorDesc",
  init: "chat.slashCommands.initDesc",
  review: "chat.slashCommands.reviewDesc",
  "pr-comments": "chat.slashCommands.prCommentsDesc",
  login: "chat.slashCommands.loginDesc",
  logout: "chat.slashCommands.logoutDesc",
};

/**
 * Map of command IDs to their i18n argument description keys
 */
const COMMAND_ARGS_I18N_KEYS: Record<string, string> = {
  model: "chat.slashCommands.modelArgDesc",
  compact: "chat.slashCommands.compactArgDesc",
  review: "chat.slashCommands.reviewArgDesc",
  "pr-comments": "chat.slashCommands.prCommentsArgDesc",
};

/**
 * Hook that provides all builtin slash commands with translated descriptions
 */
export function useBuiltinCommands(): SlashCommandDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () => {
      const commands = [
        // Session commands
        helpCommand,
        clearCommand,
        compactCommand,
        statusCommand,
        vimCommand,

        // Config commands
        modelCommand,
        configCommand,
        memoryCommand,
        permissionsCommand,
        terminalSetupCommand,

        // Info commands
        costCommand,
        doctorCommand,

        // Workspace commands
        initCommand,
        reviewCommand,
        prCommentsCommand,

        // Auth commands
        loginCommand,
        logoutCommand,
      ];

      // Apply translations to command descriptions and argument descriptions
      return commands.map((cmd) => {
        const descI18nKey = COMMAND_I18N_KEYS[cmd.id];
        const argI18nKey = COMMAND_ARGS_I18N_KEYS[cmd.id];

        let translatedCmd = cmd;

        // Translate command description
        if (descI18nKey) {
          translatedCmd = {
            ...translatedCmd,
            description: t(descI18nKey, cmd.description),
          };
        }

        // Translate argument descriptions
        if (argI18nKey && translatedCmd.args && translatedCmd.args.length > 0) {
          translatedCmd = {
            ...translatedCmd,
            args: translatedCmd.args.map((arg) => ({
              ...arg,
              description: t(argI18nKey, arg.description),
            })),
          };
        }

        return translatedCmd;
      });
    },
    [t]
  );
}
