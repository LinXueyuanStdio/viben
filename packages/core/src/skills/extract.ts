/**
 * Zip extraction utilities for skills
 *
 * Provides functionality for:
 * - Extracting zip files to a target directory
 * - Progress tracking during extraction
 * - Validation of extracted skill packages
 * - Handling of extraction errors and edge cases
 */
import AdmZip from "adm-zip";
import { mkdir, access, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import { ValidationError } from "../error";
import { ensureDir } from "../config/yaml";

/**
 * Progress callback function type
 * Called during extraction with progress percentage (0-100)
 */
export type ProgressCallback = (progress: number) => void;

/**
 * Options for extracting a zip file
 */
export interface ExtractZipOptions {
  /** Path to the zip file to extract */
  zipPath: string;
  /** Target directory to extract to */
  targetDir: string;
  /** Optional progress callback */
  onProgress?: ProgressCallback;
  /** Whether to overwrite existing files (default: false) */
  overwrite?: boolean;
  /** Whether to validate the extracted skill (default: true) */
  validate?: boolean;
}

/**
 * Result of zip extraction
 */
export interface ExtractZipResult {
  /** Whether extraction was successful */
  success: boolean;
  /** Path to the extracted directory */
  extractedPath: string;
  /** List of extracted files */
  files: string[];
  /** Any warnings encountered during extraction */
  warnings?: string[];
  /** Extracted skill name (if SKILL.md found) */
  skillName?: string;
}

/**
 * Extract a zip file to a target directory
 *
 * @param options - Extraction options
 * @returns Extraction result
 * @throws ValidationError if zip is invalid or extraction fails
 */
export async function extractZipToDirectory(
  options: ExtractZipOptions
): Promise<ExtractZipResult> {
  const {
    zipPath,
    targetDir,
    onProgress,
    overwrite = false,
    validate = true,
  } = options;

  // Validate zip file exists
  if (!existsSync(zipPath)) {
    throw new ValidationError(`Zip file not found: ${zipPath}`);
  }

  // Ensure target directory exists
  await ensureDir(targetDir);

  // Check if target directory is empty (if not overwriting)
  if (!overwrite && existsSync(targetDir)) {
    // Directory exists - will be handled by caller (force flag)
  }

  let zip: AdmZip;
  try {
    // Load zip file
    zip = new AdmZip(zipPath);
  } catch (error) {
    throw new ValidationError(
      `Failed to read zip file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // Get all entries
  const entries = zip.getEntries();
  if (entries.length === 0) {
    throw new ValidationError("Zip file is empty");
  }

  const extractedFiles: string[] = [];
  const warnings: string[] = [];
  let skillName: string | undefined;

  // Report initial progress
  onProgress?.(0);

  try {
    // Extract all files
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Skip directories
      if (entry.isDirectory) {
        continue;
      }

      // Get entry name and remove any leading directory
      const entryName = entry.entryName;
      const parts = entryName.split("/");

      // Skip __MACOSX and other metadata directories
      if (parts.some((part: string) => part.startsWith("__MACOSX") || part.startsWith("."))) {
        continue;
      }

      // Remove the root directory from the path if all files are in a single root
      const extractPath = parts.length > 1 && isAllEntriesInSameRoot(entries)
        ? join(targetDir, ...parts.slice(1))
        : join(targetDir, entryName);

      // Ensure parent directory exists
      const parentDir = join(extractPath, "..");
      await ensureDir(parentDir);

      // Extract file
      try {
        zip.extractEntryTo(entry, parentDir, false, overwrite);
        extractedFiles.push(extractPath);

        // Check if this is SKILL.md
        if (basename(extractPath) === "SKILL.md") {
          // Try to extract skill name from SKILL.md
          try {
            const content = await readFile(extractPath, "utf-8");
            const nameMatch = content.match(/^name:\s*(.+)$/m);
            if (nameMatch) {
              skillName = nameMatch[1].trim();
            }
          } catch {
            // Ignore errors reading SKILL.md
          }
        }
      } catch (error) {
        warnings.push(
          `Failed to extract ${entryName}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }

      // Report progress
      const progress = Math.round(((i + 1) / entries.length) * 100);
      onProgress?.(progress);
    }
  } catch (error) {
    throw new ValidationError(
      `Extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  // Validate extracted skill if requested
  if (validate) {
    const validationWarnings = await validateExtractedSkill(targetDir);
    warnings.push(...validationWarnings);
  }

  return {
    success: true,
    extractedPath: targetDir,
    files: extractedFiles,
    warnings: warnings.length > 0 ? warnings : undefined,
    skillName,
  };
}

/**
 * Check if all entries in a zip are within the same root directory
 */
function isAllEntriesInSameRoot(entries: AdmZip.IZipEntry[]): boolean {
  const roots = new Set<string>();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const parts = entry.entryName.split("/");
    if (parts.length > 1) {
      roots.add(parts[0]);
    } else {
      // File at root level
      return false;
    }
  }

  return roots.size === 1;
}

/**
 * Validate an extracted skill directory
 *
 * Checks for:
 * - SKILL.md file exists
 * - SKILL.md has valid frontmatter
 *
 * @param skillDir - Path to the extracted skill directory
 * @returns Array of validation warnings (empty if valid)
 */
async function validateExtractedSkill(skillDir: string): Promise<string[]> {
  const warnings: string[] = [];

  // Check for SKILL.md
  const skillMdPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    warnings.push("SKILL.md not found - skill may not work correctly");
    return warnings;
  }

  // Try to read and validate SKILL.md
  try {
    const content = await readFile(skillMdPath, "utf-8");

    // Check for required frontmatter fields
    if (!content.includes("name:")) {
      warnings.push("SKILL.md missing 'name' field");
    }

    // Check if file is empty or too small
    if (content.trim().length < 10) {
      warnings.push("SKILL.md appears to be empty or invalid");
    }
  } catch (error) {
    warnings.push(
      `Failed to read SKILL.md: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return warnings;
}

/**
 * Get the root directory name from a zip file
 * (the common parent directory if all files are in one)
 *
 * @param zipPath - Path to the zip file
 * @returns Root directory name, or undefined if no common root
 */
export function getZipRootDirectory(zipPath: string): string | undefined {
  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    const roots = new Set<string>();
    for (const entry of entries) {
      const parts = entry.entryName.split("/");
      if (parts.length > 1) {
        roots.add(parts[0]);
      } else if (!entry.isDirectory) {
        // File at root level
        return undefined;
      }
    }

    return roots.size === 1 ? Array.from(roots)[0] : undefined;
  } catch {
    return undefined;
  }
}
