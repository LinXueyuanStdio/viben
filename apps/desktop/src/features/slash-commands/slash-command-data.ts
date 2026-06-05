import type { SlashCommand } from "@viben/chat";
import type { DesktopSlashCommand } from "./types";

export function toChatSlashCommandData(command: DesktopSlashCommand): SlashCommand {
  return {
    name: command.name,
    description: command.description,
    input: command.input ?? argsToInput(command.args),
  };
}

function argsToInput(args: DesktopSlashCommand["args"]): SlashCommand["input"] {
  if (!args || args.length === 0) return null;
  return {
    hint: args.map((arg) => `[${arg.name}]`).join(" "),
  };
}
