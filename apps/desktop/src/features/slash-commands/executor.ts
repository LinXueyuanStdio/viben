import type {
  SlashCommandDefinition,
  CommandContext,
  CommandResult,
} from "./types";

/**
 * Execute a slash command and handle its result
 */
export async function executeCommand(
  command: SlashCommandDefinition,
  context: CommandContext,
  args?: string
): Promise<void> {
  try {
    const result = await command.execute(context, args);
    handleCommandResult(result, context);
  } catch (error) {
    console.error(`Failed to execute command /${command.name}:`, error);
    context.showToast(
      `Failed to execute /${command.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      "error"
    );
  }
}

/**
 * Handle command result based on its type
 */
function handleCommandResult(result: CommandResult, context: CommandContext) {
  switch (result.type) {
    case "message":
      // Display as system message in chat
      if (result.content) {
        // The content will be displayed by the caller
        // This is handled in the hook
      }
      break;

    case "ui":
      // Open dialog or navigate
      if (result.dialog) {
        context.openDialog(result.dialog.name, result.dialog.props);
      }
      if (result.navigateTo) {
        context.navigate(result.navigateTo);
      }
      break;

    case "action":
      // Show toast notification
      if (result.toast) {
        const message = result.toast.i18n
          ? context.t(result.toast.message, result.toast.params)
          : result.toast.message;
        context.showToast(message, result.toast.type);
      }
      break;

    case "prompt":
      // Send prompt to AI
      if (result.prompt) {
        context.sendMessage(result.prompt);
      }
      break;
  }
}

/**
 * Find a command by name from the list
 */
export function findCommand(
  commands: SlashCommandDefinition[],
  name: string
): SlashCommandDefinition | undefined {
  // Exact match first
  const exact = commands.find((cmd) => cmd.name === name);
  if (exact) return exact;

  // Try with namespace (e.g., trellis:start)
  return commands.find((cmd) => cmd.name === name || cmd.id === name);
}

/**
 * Filter commands by search query
 */
export function filterCommands(
  commands: SlashCommandDefinition[],
  query: string
): SlashCommandDefinition[] {
  const lowerQuery = query.toLowerCase();
  return commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Group commands by category
 */
export function groupCommandsByCategory(
  commands: SlashCommandDefinition[]
): Map<string, SlashCommandDefinition[]> {
  const groups = new Map<string, SlashCommandDefinition[]>();

  for (const cmd of commands) {
    const category = cmd.category;
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(cmd);
  }

  return groups;
}

/**
 * Group commands by source
 */
export function groupCommandsBySource(
  commands: SlashCommandDefinition[]
): Map<string, SlashCommandDefinition[]> {
  const groups = new Map<string, SlashCommandDefinition[]>();

  for (const cmd of commands) {
    const source = cmd.source;
    if (!groups.has(source)) {
      groups.set(source, []);
    }
    groups.get(source)!.push(cmd);
  }

  return groups;
}
