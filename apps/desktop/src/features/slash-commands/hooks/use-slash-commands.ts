import { useMemo, useCallback, useState } from "react";
import { useSlashCommands as useChatSlashCommands } from "@viben/chat";
import type { SlashCommand } from "@viben/chat";
import type {
  DesktopSlashCommand,
  CommandContext,
  CommandResult,
  SlashCommandPayload,
} from "../types";
import { useBuiltinCommands } from "./use-builtin-commands";
import { useWorkspaceCommands } from "./use-workspace-commands";
import { useSkillCommands } from "./use-skill-commands";
import { toChatSlashCommandData } from "../slash-command-data";
import i18n from "@/i18n";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";

export interface UseSlashCommandsOptions {
  workspacePath?: string;
  agentId?: string;
}

export interface UseSlashCommandsReturn {
  /** All available commands as SlashCommand for ChatInput */
  commands: SlashCommand[];
  /** Execute a command by SlashCommand */
  execute: (
    command: SlashCommand,
    payload: SlashCommandPayload,
    context: CommandContext
  ) => Promise<CommandResult | null>;
  /** Find a desktop command by name or id */
  find: (name: string) => DesktopSlashCommand | undefined;
  /** Last command result for display */
  lastResult: CommandResult | null;
  /** Clear last result */
  clearLastResult: () => void;
}

/**
 * Main hook that combines all slash command sources
 */
export function useSlashCommands(
  options: UseSlashCommandsOptions = {}
): UseSlashCommandsReturn {
  const { workspacePath, agentId } = options;
  const { logEvent } = useAnalytics();

  const [lastResult, setLastResult] = useState<CommandResult | null>(null);

  // Load commands from all sources
  const builtinCommands = useBuiltinCommands();
  const workspaceCommands = useWorkspaceCommands(workspacePath);
  const skillCommands = useSkillCommands(workspacePath, agentId);

  const orderedDefinitions = useMemo(
    () => [...skillCommands, ...workspaceCommands, ...builtinCommands],
      [skillCommands, workspaceCommands, builtinCommands]
  );

  const commandData = useMemo<SlashCommand[]>(
    () => orderedDefinitions.map(toChatSlashCommandData),
    [orderedDefinitions]
  );

  const registry = useChatSlashCommands({
    commands: commandData,
  });

  const commands = useMemo<SlashCommand[]>(
    () => registry.commands,
    [registry.commands]
  );
  const commandIndex = useMemo(() => {
    const byName = new Map<string, DesktopSlashCommand>();
    for (const command of orderedDefinitions) {
      byName.set(command.name, command);
    }
    return { byName };
  }, [orderedDefinitions]);

  // Execute a command
  const execute = useCallback(
    async (
      command: SlashCommand,
      payload: SlashCommandPayload,
      context: CommandContext
    ): Promise<CommandResult | null> => {
      const definition = commandIndex.byName.get(command.name);

      if (!definition) {
        console.warn(`Command not found: ${command.name}`);
        return null;
      }

      const startTime = Date.now();
      try {
        const result = await definition.execute(payload, context);
        setLastResult(result);
        try {
          logEvent(AnalyticsEvents.SLASH_COMMAND_EXECUTED, {
            command_name: command.name,
            command_category: definition.category || "general",
            execution_type: result?.type || "ui",
            duration_ms: Date.now() - startTime,
          });
        } catch {}
        return result;
      } catch (error) {
        console.error(`Failed to execute command /${command.name}:`, error);
        const errorResult: CommandResult = {
          type: "action",
          toast: {
            message: i18n.t("chat.slashCommands.executionFailed", { commandName: command.name, error: error instanceof Error ? error.message : i18n.t("common.unknownError") }),
            type: "error",
          },
        };
        setLastResult(errorResult);
        return errorResult;
      }
    },
    [commandIndex, logEvent]
  );

  // Find a command by name
  const find = useCallback(
    (name: string) => commandIndex.byName.get(name),
    [commandIndex]
  );

  // Clear last result
  const clearLastResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    commands,
    execute,
    find,
    lastResult,
    clearLastResult,
  };
}
