import { useCallback, useMemo } from "react";
import type { SlashCommand } from "./types";

function commandSearchText(command: SlashCommand): string {
  return [
    command.name,
    command.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function findSlashCommand<TCommand extends SlashCommand>(
  commands: TCommand[],
  name: string
): TCommand | undefined {
  const exact = commands.find((command) => command.name === name);
  if (exact) return exact;

  const normalizedName = name.toLowerCase();
  return commands.find((command) => command.name.toLowerCase() === normalizedName);
}

export function filterSlashCommands<TCommand extends SlashCommand>(
  commands: TCommand[],
  query: string
): TCommand[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return commands;
  return commands.filter((command) => commandSearchText(command).includes(normalizedQuery));
}

export function mergeSlashCommands<TCommand extends SlashCommand>(
  commandLists: Array<readonly TCommand[]>
): TCommand[] {
  const commandMap = new Map<string, TCommand>();

  for (const commands of commandLists) {
    for (const command of commands) {
      commandMap.set(command.name, command);
    }
  }

  return Array.from(commandMap.values());
}

export interface UseSlashCommandsOptions {
  commands?: SlashCommand[];
}

export interface UseSlashCommandsReturn {
  commands: SlashCommand[];
  find: (name: string) => SlashCommand | undefined;
}

export function useSlashCommands(options: UseSlashCommandsOptions = {}): UseSlashCommandsReturn {
  const { commands } = options;

  const find = useCallback(
    (name: string) => commands ? findSlashCommand(commands, name) : undefined,
    [commands]
  );

  return {
    commands: commands ?? [],
    find,
  };
}
