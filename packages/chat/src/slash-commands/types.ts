import type { ReactNode } from "react";

export interface SlashCommand {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
  keywords?: string[];
  group?: string;
  source?: string;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SlashCommandArgument {
  name: string;
  required?: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface SlashCommandDefinition<
  TContext = unknown,
  TResult = unknown
> extends SlashCommand {
  args?: SlashCommandArgument[];
  execute?: (context: TContext, args: string, command: SlashCommandDefinition<TContext, TResult>) => TResult | Promise<TResult>;
}

export interface SlashCommandSelection<TCommand extends SlashCommand = SlashCommand> {
  command: TCommand;
  args: string;
  value: string;
}

export type SlashCommandHandler<TCommand extends SlashCommand = SlashCommand> = (
  command: TCommand,
  selection: SlashCommandSelection<TCommand>
) => void;

export interface ParsedSlashCommandInput {
  name: string;
  args: string;
}

export interface SlashCommandProviderContext {
  workspacePath?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

export type SlashCommandProvider<
  TContext = unknown,
  TResult = unknown
> = (
  context: SlashCommandProviderContext
) =>
  | SlashCommandDefinition<TContext, TResult>[]
  | Promise<SlashCommandDefinition<TContext, TResult>[]>;
