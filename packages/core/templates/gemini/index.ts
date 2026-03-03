/**
 * Gemini CLI templates
 *
 * These are GENERIC templates for user projects.
 * Do NOT use Viben project's own .gemini/ directory (which may be customized).
 *
 * Directory structure:
 *   gemini/
 *   └── commands/viben/    # Slash commands (.toml files)
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readTemplate(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), "utf-8");
}

function listFiles(dir: string): string[] {
  try {
    return readdirSync(join(__dirname, dir));
  } catch {
    return [];
  }
}

export interface CommandTemplate {
  name: string;
  content: string;
}

/**
 * Get all command templates.
 * Gemini CLI uses TOML format (.toml) instead of Markdown.
 * Commands are in commands/viben/ subdirectory for namespace.
 */
export function getAllCommands(): CommandTemplate[] {
  const commands: CommandTemplate[] = [];
  const files = listFiles("commands/viben");

  for (const file of files) {
    if (file.endsWith(".toml")) {
      const name = file.replace(".toml", "");
      const content = readTemplate(`commands/viben/${file}`);
      commands.push({ name, content });
    }
  }

  return commands;
}
