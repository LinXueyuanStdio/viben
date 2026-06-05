import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SlashCommand,
  SlashCommandProvider,
} from "./types";

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
  return commands.find((command) => command.name === name);
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
  providers?: SlashCommandProvider[];
  providerContext?: unknown;
  onError?: (error: Error) => void;
}

export interface UseSlashCommandsReturn {
  commands: SlashCommand[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  find: (nameOrId: string) => SlashCommand | undefined;
}

export function useSlashCommands({
  commands = [],
  providers = [],
  providerContext,
  onError,
}: UseSlashCommandsOptions = {}): UseSlashCommandsReturn {
  const [providedCommands, setProvidedCommands] = useState<SlashCommand[]>([]);
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
        providers.map((provider) => Promise.resolve(provider(providerContext)))
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
          providers.map((provider) => Promise.resolve(provider(providerContext)))
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

  const mergedCommands = useMemo(
    () => mergeSlashCommands([providedCommands, commands]),
    [commands, providedCommands]
  );

  const find = useCallback(
    (nameOrId: string) => findSlashCommand(mergedCommands, nameOrId),
    [mergedCommands]
  );

  return {
    commands: mergedCommands,
    isLoading,
    error,
    refresh,
    find,
  };
}
