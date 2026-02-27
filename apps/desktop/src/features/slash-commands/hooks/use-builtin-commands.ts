import { useMemo } from "react";
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
 * Hook that provides all builtin slash commands
 */
export function useBuiltinCommands(): SlashCommandDefinition[] {
  return useMemo(
    () => [
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
    ],
    []
  );
}
