/**
 * Executor Utilities
 *
 * Shared utility functions for executor operations.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Synchronously find executable path
 */
export function whichSync(command: string): string | null {
  try {
    const result = execSync(`which ${command}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Asynchronously find executable path
 */
export async function which(command: string): Promise<string | null> {
  return whichSync(command);
}

/**
 * Get user's home directory
 */
export function getHomeDir(): string {
  return homedir();
}

/**
 * Get Viben data directory (~/.viben)
 */
export function getDataDir(): string {
  return join(homedir(), ".viben");
}

/**
 * Check if file exists
 */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

/**
 * Join paths
 */
export function joinPath(...parts: string[]): string {
  return join(...parts);
}
