import type { ParsedSlashCommandInput } from "./types";

export function parseSlashCommandInput(input: string): ParsedSlashCommandInput | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const withoutSlash = trimmed.slice(1);
  if (!withoutSlash) return null;

  const spaceIndex = withoutSlash.search(/\s/);
  if (spaceIndex === -1) {
    return { name: withoutSlash, args: "" };
  }

  return {
    name: withoutSlash.slice(0, spaceIndex),
    args: withoutSlash.slice(spaceIndex + 1).trim(),
  };
}

export function getSlashCommandQuery(input: string): string | null {
  if (!input.startsWith("/")) return null;
  if (input.length > 1 && input[1] === " ") return null;
  if (/\s/.test(input)) return null;
  return input.slice(1);
}
