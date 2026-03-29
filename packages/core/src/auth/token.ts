/**
 * Token storage and validation utilities
 */
import { existsSync } from "node:fs";
import { readFile, writeFile, unlink, mkdir, chmod } from "node:fs/promises";
import { getTokenPath, getStateDir } from "../config/paths";

/**
 * Token format: bmcp_XXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYY
 * - Prefix: bmcp_
 * - First part: 8 alphanumeric chars
 * - Second part: 24 alphanumeric chars
 */
export const TOKEN_REGEX = /^bmcp_[a-zA-Z0-9]{8}_[a-zA-Z0-9]{24}$/;

/**
 * Validate token format
 */
export function validateTokenFormat(token: string): boolean {
  return TOKEN_REGEX.test(token);
}

/**
 * Read token from environment or file
 * Priority: VIBEN_TOKEN env > ~/.viben/token file
 */
export async function readToken(): Promise<string | null> {
  // Check environment variable first
  const envToken = process.env.VIBEN_TOKEN;
  if (envToken) {
    return envToken;
  }

  // Check file
  const tokenPath = getTokenPath();
  if (!existsSync(tokenPath)) {
    return null;
  }

  try {
    const content = await readFile(tokenPath, "utf-8");
    return content.trim();
  } catch {
    return null;
  }
}

/**
 * Write token to file
 * Creates ~/.viben directory if needed
 * Sets file permission to 0600
 */
export async function writeToken(token: string): Promise<void> {
  const tokenPath = getTokenPath();
  const stateDir = getStateDir();

  // Create directory if needed
  if (!existsSync(stateDir)) {
    await mkdir(stateDir, { recursive: true, mode: 0o700 });
  }

  // Write token
  await writeFile(tokenPath, token, { encoding: "utf-8", mode: 0o600 });

  // Ensure permissions (in case file existed)
  await chmod(tokenPath, 0o600);
}

/**
 * Delete token file
 */
export async function deleteToken(): Promise<void> {
  const tokenPath = getTokenPath();
  if (existsSync(tokenPath)) {
    await unlink(tokenPath);
  }
}
