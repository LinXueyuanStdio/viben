// Claude Code injects XML tags into user prompts to pass context (IDE state, commands, etc.).
// These tags are machine-generated noise that would pollute the conversation history shown
// to the next agent. Strip them before storing or rendering turns.
const SYSTEM_TAG_PATTERNS: RegExp[] = [
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  /<command-name>[\s\S]*?<\/command-name>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<user-prompt-submit-hook>[\s\S]*?<\/user-prompt-submit-hook>/g,
  /<ide_selection>[\s\S]*?<\/ide_selection>/g,
  /<ide_context>[\s\S]*?<\/ide_context>/g,
  /<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g,
  /<cursor_context>[\s\S]*?<\/cursor_context>/g,
  /<attached_files>[\s\S]*?<\/attached_files>/g,
  /<repo_context>[\s\S]*?<\/repo_context>/g,
  /<task-notification>[\s\S]*?<\/task-notification>/g,
];

// `<command-args>` is special: its content is the user-visible portion of a slash command.
// Preserve that text while stripping the wrapping tag.
const COMMAND_ARGS_RE = /<command-args>([\s\S]*?)<\/command-args>/;

/**
 * Remove Claude Code XML injection tags from a user message.
 *
 * `<command-args>` content is extracted and appended as plain text so the
 * human-readable portion of slash commands survives after tag removal.
 */
export function cleanSystemTags(text: string): string {
  const argsMatch = COMMAND_ARGS_RE.exec(text);
  const userArgs = argsMatch?.[1]?.trim() ?? "";
  text = text.replace(/<command-args>[\s\S]*?<\/command-args>/g, "");
  for (const pat of SYSTEM_TAG_PATTERNS) {
    text = text.replace(new RegExp(pat.source, pat.flags), "");
  }
  text = text.trim();
  if (!text && userArgs) return userArgs;
  if (text && userArgs && text !== userArgs) return `${text}\n${userArgs}`;
  return text || userArgs;
}

// Skill prompts are large structured instructions injected by the slash-command system.
// They're not real user messages — including them in history would add thousands of tokens
// of structured boilerplate that provides no useful context for subsequent agents.
const SKILL_INDICATORS = [
  "Base directory for this skill:",
  "<HARD-GATE>",
  "## Checklist",
  "## Process Flow",
  "## Key Principles",
  "digraph brainstorming",
  "You MUST create a task for each",
];

/**
 * Returns true for injected skill/command prompts that should be omitted from history.
 * Heuristic: known indicator strings OR very long prompts with many H2 headers.
 */
export function isSkillPrompt(text: string): boolean {
  for (const indicator of SKILL_INDICATORS) {
    if (text.includes(indicator)) return true;
  }
  // Long prompts with 3+ H2 headers are almost certainly structured skill instructions
  if (text.length > 2000) {
    const headerCount = (text.match(/## /g) || []).length;
    if (headerCount >= 3) return true;
  }
  return false;
}

/**
 * Returns true for short, meaningless messages that don't belong in history.
 * Covers: blank messages after tag removal, model-select commands, deprecated command stubs.
 */
export function isNoiseMessage(text: string): boolean {
  const cleaned = cleanSystemTags(text);
  if (!cleaned) return true;
  if (/^(ready|ready\.)$/i.test(cleaned)) return true;
  if (cleaned.includes("Tell your human partner that this command is deprecated")) return true;
  if (cleaned.startsWith("Read the output file to retrieve the result:")) return true;
  // Model selection shortcuts (e.g. "sonnet", "opus[1m]") — not real user messages
  if (/^(opus|sonnet|haiku|claude)(\[.*\])?$/i.test(cleaned)) return true;
  return false;
}
