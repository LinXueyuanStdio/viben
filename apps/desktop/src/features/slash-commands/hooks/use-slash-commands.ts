import { useMemo, useCallback, useState } from "react";
import { useSlashCommands as useChatSlashCommands } from "@viben/chat";
import type { SlashCommand } from "@viben/chat";
import type { SlashCommandDefinition, CommandContext, CommandResult } from "../types";
import { useBuiltinCommands } from "./use-builtin-commands";
import { useWorkspaceCommands } from "./use-workspace-commands";
import { useSkillCommands } from "./use-skill-commands";
import i18n from "@/i18n";

export interface UseSlashCommandsOptions {
  workspacePath?: string;
  agentId?: string;
}

export interface UseSlashCommandsReturn {
  /** All available commands as SlashCommand for ChatInput */
  commands: SlashCommand[];
  /** All command definitions with full execution logic */
  definitions: SlashCommandDefinition[];
  /** Execute a command by SlashCommand */
  execute: (
    command: SlashCommand,
    context: CommandContext,
    args?: string
  ) => Promise<CommandResult | null>;
  /** Find a command definition by name */
  find: (name: string) => SlashCommandDefinition | undefined;
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

  const [lastResult, setLastResult] = useState<CommandResult | null>(null);

  // Load commands from all sources
  const builtinCommands = useBuiltinCommands();
  const workspaceCommands = useWorkspaceCommands(workspacePath);
  const skillCommands = useSkillCommands(workspacePath, agentId);

  const orderedDefinitions = useMemo(
    () => [...skillCommands, ...workspaceCommands, ...builtinCommands],
    [builtinCommands, workspaceCommands, skillCommands]
  );

  const registry = useChatSlashCommands<CommandContext, CommandResult>({
    commands: orderedDefinitions,
  });

  const registryExecute = registry.execute;
  const registryFind = registry.find;
  const commands = useMemo<SlashCommand[]>(
    () => registry.commands,
    [registry.commands]
  );
  const definitions = registry.definitions;

  // Execute a command
  const execute = useCallback(
    async (
      command: SlashCommand,
      context: CommandContext,
      args?: string
    ): Promise<CommandResult | null> => {
      const definition = definitions.find(
        (def) => def.id === command.id || def.name === command.name
      );

      if (!definition) {
        console.warn(`Command not found: ${command.name}`);
        return null;
      }

      try {
        const result = await registryExecute(command, context, args);
        if (!result) return null;
        setLastResult(result);
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
    [definitions, registryExecute]
  );

  // Find a command by name
  const find = useCallback((name: string) => registryFind(name), [registryFind]);

  // Clear last result
  const clearLastResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    commands,
    definitions,
    execute,
    find,
    lastResult,
    clearLastResult,
  };
}
