import { useMemo, useCallback, useState } from "react";
import type { SlashCommand } from "@viben/chat";
import type { SlashCommandDefinition, CommandContext, CommandResult } from "../types";
import { useBuiltinCommands } from "./use-builtin-commands";
import { useWorkspaceCommands } from "./use-workspace-commands";
import { useSkillCommands } from "./use-skill-commands";
import { findCommand } from "../executor";

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

  // Merge all commands, removing duplicates (builtin takes priority)
  const definitions = useMemo(() => {
    const commandMap = new Map<string, SlashCommandDefinition>();

    // Add in reverse priority order (later additions override earlier)
    for (const cmd of skillCommands) {
      commandMap.set(cmd.name, cmd);
    }
    for (const cmd of workspaceCommands) {
      commandMap.set(cmd.name, cmd);
    }
    for (const cmd of builtinCommands) {
      commandMap.set(cmd.name, cmd);
    }

    return Array.from(commandMap.values());
  }, [builtinCommands, workspaceCommands, skillCommands]);

  // Convert to SlashCommand format for ChatInput component
  const commands = useMemo<SlashCommand[]>(() => {
    return definitions.map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
    }));
  }, [definitions]);

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
        const result = await definition.execute(context, args);
        setLastResult(result);
        return result;
      } catch (error) {
        console.error(`Failed to execute command /${command.name}:`, error);
        const errorResult: CommandResult = {
          type: "action",
          toast: {
            message: `Failed to execute /${command.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
            type: "error",
          },
        };
        setLastResult(errorResult);
        return errorResult;
      }
    },
    [definitions]
  );

  // Find a command by name
  const find = useCallback(
    (name: string) => findCommand(definitions, name),
    [definitions]
  );

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
