import type { MessageAttachment } from "../types";

export interface SlashCommand {
  name: string;
  description: string;
  input: Record<string, unknown> | null;
}

export interface SlashCommandSelection {
  command: SlashCommand;
  args: string;
  value: string;
  attachments?: MessageAttachment[];
}

export type SlashCommandHandler = (
  command: SlashCommand,
  selection: SlashCommandSelection
) => void;

export interface ParsedSlashCommandInput {
  name: string;
  args: string;
}

