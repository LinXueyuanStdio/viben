/**
 * Template path utilities
 *
 * Shared utility for locating templates directory across different environments:
 * - Development (monorepo): packages/core/templates/
 * - Production (npm package): dist/templates/
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Get the templates directory path.
 *
 * Templates can be located in:
 * 1. packages/core/templates/ (development, monorepo - src or dist)
 * 2. dist/templates/ (npm package, bundled CLI - templates copied to dist)
 *
 * @param metaUrl - The import.meta.url from the calling module
 * @returns Absolute path to templates directory
 */
export function getTemplatesDir(metaUrl: string): string {
  const currentDir = dirname(fileURLToPath(metaUrl));
  const executableDir = dirname(process.execPath);

  // Try multiple possible locations
  const candidates = [
    // packages/core/templates (monorepo development)
    resolve(currentDir, "../../../templates"),
    resolve(currentDir, "../../templates"),
    // dist/templates (npm package - templates in same dir as bundled code)
    resolve(currentDir, "./templates"),
    // Standalone sidecar artifact: templates copied next to the compiled binary
    resolve(executableDir, "templates"),
    // Tauri resources: sidecar may be in Resources/binaries and templates in Resources/resources/templates
    resolve(executableDir, "../resources/templates"),
    // macOS app bundle: sidecar may be in Contents/MacOS and templates in Contents/Resources/resources/templates
    resolve(executableDir, "../Resources/resources/templates"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to first candidate (will error when trying to read)
  return candidates[0];
}
