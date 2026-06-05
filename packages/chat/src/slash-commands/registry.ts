import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SlashCommand,
  SlashCommandDefinition,
  SlashCommandProvider,
} from "./types";

function commandSearchText(command: SlashCommand): string {
  return [
    command.name,
    command.description,
    command.group,
    command.source,
    ...(command.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function findSlashCommand<TCommand extends SlashCommand>(
  commands: TCommand[],
  nameOrId: string
): TCommand | undefined {
  return commands.find((command) => command.name === nameOrId || command.id === nameOrId);
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

export interface UseSlashCommandsOptions<
  TProviderContext = unknown,
  TContext = unknown,
  TResult = unknown
> {
  commands?: SlashCommandDefinition<TContext, TResult>[];
  providers?: SlashCommandProvider<TProviderContext, TContext, TResult>[];
  providerContext?: TProviderContext;
  onError?: (error: Error) => void;
}

export interface UseSlashCommandsReturn<TContext = unknown, TResult = unknown> {
  commands: SlashCommand[];
  definitions: SlashCommandDefinition<TContext, TResult>[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  find: (nameOrId: string) => SlashCommandDefinition<TContext, TResult> | undefined;
  execute: (
    command: SlashCommand,
    context: TContext,
    args?: string
  ) => Promise<TResult | undefined>;
}

export function useSlashCommands<
  TProviderContext = unknown,
  TContext = unknown,
  TResult = unknown
>({
  commands = [],
  providers = [],
  providerContext,
  onError,
}: UseSlashCommandsOptions<TProviderContext, TContext, TResult> = {}): UseSlashCommandsReturn<TContext, TResult> {
  const [providedCommands, setProvidedCommands] = useState<SlashCommandDefinition<TContext, TResult>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (providers.length === 0) {
      setProvidedCommands([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const loaded = await Promise.all(
        providers.map((provider) => Promise.resolve(provider(providerContext as TProviderContext)))
      );
      setProvidedCommands(mergeSlashCommands(loaded));
    } catch (unknownError) {
      const nextError = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
      setProvidedCommands([]);
      setError(nextError);
      onError?.(nextError);
    } finally {
      setIsLoading(false);
    }
  }, [onError, providerContext, providers]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (providers.length === 0) {
        setProvidedCommands([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const loaded = await Promise.all(
          providers.map((provider) => Promise.resolve(provider(providerContext as TProviderContext)))
        );
        if (!cancelled) setProvidedCommands(mergeSlashCommands(loaded));
      } catch (unknownError) {
        if (cancelled) return;
        const nextError = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
        setProvidedCommands([]);
        setError(nextError);
        onError?.(nextError);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [onError, providerContext, providers]);

  const definitions = useMemo(
    () => mergeSlashCommands([providedCommands, commands]),
    [commands, providedCommands]
  );

  const publicCommands = useMemo<SlashCommand[]>(
    () => definitions.map(({ execute: _execute, args: _args, ...command }) => command),
    [definitions]
  );

  const find = useCallback(
    (nameOrId: string) => findSlashCommand(definitions, nameOrId),
    [definitions]
  );

  const execute = useCallback(
    async (command: SlashCommand, context: TContext, args = "") => {
      const definition = find(command.id) ?? find(command.name);
      if (definition?.disabled) return undefined;
      return definition?.execute?.(context, args, definition);
    },
    [find]
  );

  return {
    commands: publicCommands,
    definitions,
    isLoading,
    error,
    refresh,
    find,
    execute,
  };
}
