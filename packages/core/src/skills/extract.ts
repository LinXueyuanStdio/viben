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
import { ValidationError, FileConflictError } from "../error";
import { ensureDir } from "../config/yaml";

/**
 * Progress callback function type
 * Called during extraction with progress percentage (0-100)
 */
export type ProgressCallback = (progress: number) => void;

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = "skip" | "overwrite" | "fail";

/**
 * Information about a file conflict
 */
export interface FileConflict {
  /** Path to the conflicting file */
  path: string;
  /** Entry name in the zip */
  entryName: string;
  /** Whether the file was overwritten */
  overwritten: boolean;
}

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
  /** Conflict resolution strategy (default: "fail") */
  conflictResolution?: ConflictResolution;
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
  /** Files that conflicted with existing files */
  conflicts?: FileConflict[];
  /** Number of files skipped due to conflicts */
  skippedCount?: number;
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
    conflictResolution = "fail",
  } = options;

  // Validate zip file exists
  if (!existsSync(zipPath)) {
    throw new ValidationError(`Zip file not found: ${zipPath}`);
  }

  // Ensure target directory exists
  await ensureDir(targetDir);

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

  // Determine the actual conflict resolution strategy
  // overwrite flag takes precedence for backward compatibility
  const actualResolution: ConflictResolution = overwrite ? "overwrite" : conflictResolution;

  // Detect conflicts before extraction
  const conflicts = await detectFileConflicts(entries, targetDir);

  // Handle conflicts based on resolution strategy
  if (conflicts.length > 0 && actualResolution === "fail") {
    throw FileConflictError.filesExist(conflicts.map((c) => c.path));
  }

  const extractedFiles: string[] = [];
  const warnings: string[] = [];
  const fileConflicts: FileConflict[] = [];
  let skillName: string | undefined;
  let skippedCount = 0;

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

      // Check if file exists and handle conflict
      const fileExists = existsSync(extractPath);
      const conflictInfo = conflicts.find((c) => c.path === extractPath);

      if (fileExists && conflictInfo) {
        if (actualResolution === "skip") {
          // Skip this file
          fileConflicts.push({
            path: extractPath,
            entryName,
            overwritten: false,
          });
          skippedCount++;
          continue;
        } else if (actualResolution === "overwrite") {
          // Record that we're overwriting
          fileConflicts.push({
            path: extractPath,
            entryName,
            overwritten: true,
          });
        }
      }

      // Ensure parent directory exists
      const parentDir = join(extractPath, "..");
      await ensureDir(parentDir);

      // Extract file
      try {
        zip.extractEntryTo(entry, parentDir, false, actualResolution === "overwrite");
        extractedFiles.push(extractPath);

        // Check if this is SKILL.md
        if (basename(extractPath) === "SKILL.md") {
          // Try to extract skill name from SKILL.md using shared parser
          try {
            const content = await readFile(extractPath, "utf-8");
            const metadata = parseSkillMetadataFromContent(content);
            if (metadata?.name) {
              skillName = metadata.name;
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
    conflicts: fileConflicts.length > 0 ? fileConflicts : undefined,
    skippedCount: skippedCount > 0 ? skippedCount : undefined,
  };
}

/**
 * Detect file conflicts before extraction
 *
 * Scans the zip entries and checks which files already exist in the target directory
 *
 * @param entries - Zip entries to check
 * @param targetDir - Target directory path
 * @returns Array of file conflicts
 */
async function detectFileConflicts(
  entries: AdmZip.IZipEntry[],
  targetDir: string
): Promise<FileConflict[]> {
  const conflicts: FileConflict[] = [];
  const hasCommonRoot = isAllEntriesInSameRoot(entries);

  for (const entry of entries) {
    // Skip directories
    if (entry.isDirectory) {
      continue;
    }

    const entryName = entry.entryName;
    const parts = entryName.split("/");

    // Skip __MACOSX and other metadata directories
    if (parts.some((part: string) => part.startsWith("__MACOSX") || part.startsWith("."))) {
      continue;
    }

    // Calculate the extraction path (same logic as in main extraction)
    const extractPath = parts.length > 1 && hasCommonRoot
      ? join(targetDir, ...parts.slice(1))
      : join(targetDir, entryName);

    // Check if file exists
    if (existsSync(extractPath)) {
      conflicts.push({
        path: extractPath,
        entryName,
        overwritten: false,
      });
    }
  }

  return conflicts;
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
 * Skill metadata extracted from SKILL.md frontmatter
 */
export interface SkillMetadataFromContent {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  triggers?: string[];
  tools?: string[];
}

/**
 * Parse skill metadata from SKILL.md content
 *
 * This is a shared utility for parsing SKILL.md frontmatter consistently
 * across the codebase (used by both extract.ts and SkillsManager).
 *
 * @param content - Content of SKILL.md file
 * @returns Parsed metadata or null if invalid
 */
export function parseSkillMetadataFromContent(content: string): SkillMetadataFromContent | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return null;
  }

  try {
    const frontmatter = match[1];
    const metadata: SkillMetadataFromContent = { name: "" };
    const arrayFields: Record<string, string[]> = {};
    let currentArrayField: string | null = null;

    for (const line of frontmatter.split("\n")) {
      // Handle array continuation
      if (currentArrayField && line.trim().startsWith("-")) {
        const value = line.trim().slice(1).trim();
        if (value) {
          arrayFields[currentArrayField].push(value);
        }
        continue;
      }
      currentArrayField = null;

      const [key, ...valueParts] = line.split(":");
      const value = valueParts.join(":").trim();

      if (key && value) {
        const cleanKey = key.trim();
        if (cleanKey === "name") metadata.name = value;
        else if (cleanKey === "description") metadata.description = value;
        else if (cleanKey === "version") metadata.version = value;
        else if (cleanKey === "author") metadata.author = value;
      } else if (key && !value) {
        // Could be start of an array field
        const cleanKey = key.trim();
        if (["tags", "triggers", "tools"].includes(cleanKey)) {
          currentArrayField = cleanKey;
          arrayFields[cleanKey] = [];
        }
      }
    }

    // Add array fields to metadata
    if (arrayFields.tags) metadata.tags = arrayFields.tags;
    if (arrayFields.triggers) metadata.triggers = arrayFields.triggers;
    if (arrayFields.tools) metadata.tools = arrayFields.tools;

    return metadata.name ? metadata : null;
  } catch {
    return null;
  }
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
