import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DesktopSlashCommand } from "../types";

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
 * Map of command ID + arg name to their i18n description keys
 * Key format: "commandId:argName"
 */
const COMMAND_ARGS_I18N_KEYS: Record<string, string> = {
  "compact:summary": "chat.slashCommands.compactArgDesc",
  "model:model_name": "chat.slashCommands.modelArgDesc",
  "review:target": "chat.slashCommands.reviewArgDesc",
  "pr-comments:pr_number": "chat.slashCommands.prCommentsArgDesc",
};

/**
 * Hook that provides all builtin slash commands with translated descriptions
 */
export function useBuiltinCommands(): DesktopSlashCommand[] {
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

      // Apply translations to command descriptions and args descriptions
      return commands.map((cmd) => {
        const descKey = COMMAND_I18N_KEYS[cmd.id];
        const translatedDesc = descKey ? t(descKey, cmd.description) : cmd.description;

        // Translate args descriptions if present
        const translatedArgs = cmd.args?.map((arg) => {
          const argKey = COMMAND_ARGS_I18N_KEYS[`${cmd.id}:${arg.name}`];
          if (argKey) {
            return {
              ...arg,
              description: t(argKey, arg.description ?? arg.name),
            };
          }
          return arg;
        });

        return {
          ...cmd,
          description: translatedDesc,
          ...(translatedArgs && { args: translatedArgs }),
        };
      });
    },
    [t]
  );
}
