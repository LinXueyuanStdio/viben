/**
 * Bundled CLI Detection
 *
 * Utilities for detecting and using the bundled Viben CLI sidecar.
 * When the bundled CLI is available, we can skip Node.js and npm-based
 * CLI installation entirely during onboarding.
 */

import { invoke } from "@tauri-apps/api/core";

// Debug logging helper
const log = (message: string, ...args: unknown[]) => {
  console.log(`[bundled-cli] ${message}`, ...args);
};

/**
 * Result of bundled CLI check
 */
export interface BundledCliResult {
  available: boolean;
  path: string | null;
  version: string | null;
  error?: string;
}

/**
 * Check if bundled Viben CLI sidecar is available
 *
 * This checks if the Tauri app has a bundled viben binary that can be used
 * instead of requiring Node.js and npm installation.
 *
 * @returns BundledCliResult indicating if bundled CLI is available
 */
export async function checkBundledCli(): Promise<BundledCliResult> {
  log("Checking for bundled CLI...");

  try {
    const result = await invoke<{
      available: boolean;
      path: string | null;
      version: string | null;
      error: string | null;
    }>("check_bundled_cli");

    log("Bundled CLI check result:", result);

    return {
      available: result.available,
      path: result.path,
      version: result.version,
      error: result.error ?? undefined,
    };
  } catch (error) {
    const errorStr = error instanceof Error ? error.message : String(error);
    log("Bundled CLI check failed:", errorStr);

    return {
      available: false,
      path: null,
      version: null,
      error: errorStr,
    };
  }
}

/**
 * Cache for bundled CLI check result
 * This is a module-level cache since the bundled CLI status won't change
 * during a single session.
 */
let cachedResult: BundledCliResult | null = null;

/**
 * Check if bundled CLI is available (with caching)
 *
 * This is the recommended function to use - it caches the result
 * since the bundled CLI status won't change during a session.
 */
export async function isBundledCliAvailable(): Promise<boolean> {
  if (cachedResult === null) {
    cachedResult = await checkBundledCli();
  }
  return cachedResult.available;
}

/**
 * Get cached bundled CLI result
 *
 * Returns null if check hasn't been performed yet.
 */
export function getCachedBundledCliResult(): BundledCliResult | null {
  return cachedResult;
}

/**
 * Clear the bundled CLI cache
 *
 * Call this if you need to re-check (e.g., after an update).
 */
export function clearBundledCliCache(): void {
  cachedResult = null;
}
