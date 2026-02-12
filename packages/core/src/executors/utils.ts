/**
 * Executor utilities
 */
import { access, constants } from "node:fs/promises";
import { existsSync } from "node:fs";
import { delimiter, join, sep } from "node:path";
import { homedir, platform } from "node:os";

/**
 * Check if a command exists in PATH
 * Returns the full path if found, null otherwise
 */
export async function which(command: string): Promise<string | null> {
  // If command is already an absolute path
  if (command.includes(sep)) {
    try {
      await access(command, constants.X_OK);
      return command;
    } catch {
      return null;
    }
  }

  const pathEnv = process.env.PATH || "";
  const paths = pathEnv.split(delimiter);

  // Add common paths that might not be in PATH
  const commonPaths = platform() === "win32"
    ? []
    : ["/usr/local/bin", "/usr/bin", "/bin", "/opt/homebrew/bin"];

  const allPaths = [...new Set([...paths, ...commonPaths])];

  for (const dir of allPaths) {
    const fullPath = join(dir, command);
    try {
      await access(fullPath, constants.X_OK);
      return fullPath;
    } catch {
      // Continue to next path
    }

    // On Windows, try with common extensions
    if (platform() === "win32") {
      const extensions = [".exe", ".cmd", ".bat", ".ps1"];
      for (const ext of extensions) {
        const fullPathWithExt = fullPath + ext;
        try {
          await access(fullPathWithExt, constants.X_OK);
          return fullPathWithExt;
        } catch {
          // Continue
        }
      }
    }
  }

  return null;
}

/**
 * Check if a command exists (synchronous)
 */
export function whichSync(command: string): string | null {
  // If command is already an absolute path
  if (command.includes(sep)) {
    if (existsSync(command)) {
      return command;
    }
    return null;
  }

  const pathEnv = process.env.PATH || "";
  const paths = pathEnv.split(delimiter);

  // Add common paths that might not be in PATH
  const commonPaths = platform() === "win32"
    ? []
    : ["/usr/local/bin", "/usr/bin", "/bin", "/opt/homebrew/bin"];

  const allPaths = [...new Set([...paths, ...commonPaths])];

  for (const dir of allPaths) {
    const fullPath = join(dir, command);
    if (existsSync(fullPath)) {
      return fullPath;
    }

    // On Windows, try with common extensions
    if (platform() === "win32") {
      const extensions = [".exe", ".cmd", ".bat", ".ps1"];
      for (const ext of extensions) {
        const fullPathWithExt = fullPath + ext;
        if (existsSync(fullPathWithExt)) {
          return fullPathWithExt;
        }
      }
    }
  }

  return null;
}

/**
 * Get config directory based on platform
 */
export function getConfigDir(): string {
  const home = homedir();

  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support");
    case "win32":
      return process.env.APPDATA || join(home, "AppData", "Roaming");
    default:
      return process.env.XDG_CONFIG_HOME || join(home, ".config");
  }
}

/**
 * Get data directory based on platform
 */
export function getDataDir(): string {
  const home = homedir();

  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support");
    case "win32":
      return process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    default:
      return process.env.XDG_DATA_HOME || join(home, ".local", "share");
  }
}
