/**
 * Skill CRUD operations
 *
 * Create, Read, Update, Delete operations for skills.
 * Pure functions following the task/ops pattern.
 */
import { readdir, readFile, rm, cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readYaml, writeYaml, fileExists, ensureDir } from "../../config/yaml";
import {
  resolveTargetDir,
  validateTargetOptions,
  getInstalledYamlPath,
  getSharedSkillsDir,
  getClaudeSkillsDir,
} from "./paths";
import { extractZipToDirectory, parseSkillMetadataFromContent } from "./extract";
import type {
  SkillTarget,
  InstallSkillOptions,
  InstallSkillResult,
  UninstallSkillOptions,
  UninstallSkillResult,
  ListSkillsOptions,
  ListSkillsResult,
  GetSkillResult,
  InstalledSkillsFile,
  InstalledSkillEntry,
  InstalledSkillInfo,
  SkillMetadata,
} from "./types";

// =============================================================================
// Install Skill
// =============================================================================

/**
 * Install a skill to the specified target
 *
 * @param options - Installation options
 * @returns Installation result
 */
export async function installSkill(
  options: InstallSkillOptions
): Promise<InstallSkillResult> {
  const {
    name,
    target,
    agentId,
    customPath,
    force,
    sourcePath,
    zipPath,
    onProgress,
    version,
    conflictResolution,
  } = options;

  // Parse name@version if present
  const { skillName, skillVersion } = parseSkillName(name, version);

  // Validate options
  const validation = validateTargetOptions(target, agentId, customPath);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
      name: skillName,
      version: skillVersion || "1.0.0",
      path: "",
      target,
      message: validation.error || "Validation failed",
    };
  }

  try {
    // Get target directory
    const targetDir = resolveTargetDir(target, agentId, customPath);
    const skillDir = join(targetDir, skillName);

    // Check if already installed
    if (fileExists(skillDir) && !force) {
      return {
        success: false,
        error: `Skill "${skillName}" already exists. Use force option to reinstall.`,
        name: skillName,
        version: skillVersion || "1.0.0",
        path: skillDir,
        target,
        message: `Skill "${skillName}" already exists`,
      };
    }

    // If force, remove existing
    if (fileExists(skillDir) && force) {
      await rm(skillDir, { recursive: true, force: true });
    }

    // Ensure target directory exists
    await ensureDir(targetDir);

    // Create skill directory
    await mkdir(skillDir, { recursive: true });

    // Install from appropriate source
    if (zipPath) {
      // Extract from zip file
      const extractResult = await extractZipToDirectory({
        zipPath,
        targetDir: skillDir,
        onProgress,
        overwrite: force,
        validate: true,
        conflictResolution,
      });

      // Use skill name from extracted SKILL.md if available
      const extractedSkillName = extractResult.skillName || skillName;

      // Update installed.yaml tracking
      await addToInstalledList(targetDir, {
        name: extractedSkillName,
        version: skillVersion || "1.0.0",
        path: skillDir,
        source: "marketplace",
        installedAt: new Date().toISOString(),
      });

      // Build success message with warnings if any
      let message = `Skill "${extractedSkillName}" installed successfully to ${target}`;
      if (extractResult.warnings && extractResult.warnings.length > 0) {
        message += ` (with ${extractResult.warnings.length} warning(s))`;
      }

      return {
        success: true,
        name: extractedSkillName,
        version: skillVersion || "1.0.0",
        path: skillDir,
        target,
        message,
      };
    } else if (sourcePath) {
      // Copy from local directory
      const copyResult = await copySkillFromLocal(sourcePath, skillDir);
      if (!copyResult.success) {
        return {
          success: false,
          error: copyResult.error,
          name: skillName,
          version: skillVersion || "1.0.0",
          path: skillDir,
          target,
          message: copyResult.error || "Failed to copy skill",
        };
      }
    } else {
      // Create a basic SKILL.md for now (marketplace download would go here)
      await createSkillPlaceholder(skillDir, skillName, skillVersion);
    }

    // Update installed.yaml tracking
    await addToInstalledList(targetDir, {
      name: skillName,
      version: skillVersion || "1.0.0",
      path: skillDir,
      source: sourcePath ? "local" : "marketplace",
      installedAt: new Date().toISOString(),
    });

    return {
      success: true,
      name: skillName,
      version: skillVersion || "1.0.0",
      path: skillDir,
      target,
      message: `Skill "${skillName}" installed successfully to ${target}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      name: skillName,
      version: skillVersion || "1.0.0",
      path: "",
      target,
      message: `Failed to install skill: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// =============================================================================
// Uninstall Skill
// =============================================================================

/**
 * Uninstall a skill from the specified target
 *
 * @param options - Uninstallation options
 * @returns Uninstallation result
 */
export async function uninstallSkill(
  options: UninstallSkillOptions
): Promise<UninstallSkillResult> {
  const { name, target, agentId, customPath } = options;

  // Validate options
  const validation = validateTargetOptions(target, agentId, customPath);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
      name,
      message: validation.error || "Validation failed",
    };
  }

  try {
    // Get target directory
    const targetDir = resolveTargetDir(target, agentId, customPath);
    const skillDir = join(targetDir, name);

    // Check if installed
    if (!fileExists(skillDir)) {
      return {
        success: false,
        error: `Skill "${name}" not found`,
        name,
        message: `Skill "${name}" not found in ${target}`,
      };
    }

    // Remove skill directory
    await rm(skillDir, { recursive: true, force: true });

    // Update installed.yaml tracking
    await removeFromInstalledList(targetDir, name);

    return {
      success: true,
      name,
      message: `Skill "${name}" uninstalled successfully from ${target}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      name,
      message: `Failed to uninstall skill: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// =============================================================================
// List Skills
// =============================================================================

/**
 * List installed skills for the specified target(s)
 * If no target specified, lists all installed skills from all targets
 *
 * @param options - List options
 * @returns List result with skills
 */
export async function listSkills(
  options?: ListSkillsOptions
): Promise<ListSkillsResult> {
  try {
    if (!options?.target) {
      // List from all targets
      const globalSkills = await listSkillsInDir(getSharedSkillsDir());
      const claudeSkills = await listSkillsInDir(getClaudeSkillsDir());
      const allSkills = [...globalSkills, ...claudeSkills];

      return {
        success: true,
        skills: allSkills,
        count: allSkills.length,
      };
    }

    const { target, agentId, customPath } = options;

    // Validate options
    const validation = validateTargetOptions(target, agentId, customPath);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
        skills: [],
        count: 0,
      };
    }

    const targetDir = resolveTargetDir(target, agentId, customPath);
    const skills = await listSkillsInDir(targetDir);

    return {
      success: true,
      skills,
      count: skills.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      skills: [],
      count: 0,
    };
  }
}

// =============================================================================
// Get Skill
// =============================================================================

/**
 * Get detailed information about a skill
 *
 * @param name - Skill name
 * @param options - List options for target filtering
 * @returns Skill info result
 */
export async function getSkill(
  name: string,
  options?: ListSkillsOptions
): Promise<GetSkillResult> {
  try {
    // Search in specified target or all targets
    const targets: { target: SkillTarget; agentId?: string }[] = options?.target
      ? [{ target: options.target, agentId: options.agentId }]
      : [{ target: "global" }, { target: "claude" }];

    for (const { target, agentId } of targets) {
      const targetDir = resolveTargetDir(target, agentId, options?.customPath);
      const skillDir = join(targetDir, name);

      if (fileExists(skillDir)) {
        const metadata = await readSkillMetadata(skillDir);
        return {
          success: true,
          skill: {
            id: name,
            name: metadata?.name || name,
            description: metadata?.description,
            version: metadata?.version || "1.0.0",
            path: skillDir,
            source: "local",
          },
        };
      }
    }

    return {
      success: false,
      error: `Skill "${name}" not found`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse skill name@version format
 */
function parseSkillName(
  nameWithVersion: string,
  explicitVersion?: string
): { skillName: string; skillVersion?: string } {
  const parts = nameWithVersion.split("@");
  const skillName = parts[0];
  const skillVersion = explicitVersion || (parts.length > 1 ? parts[1] : undefined);
  return { skillName, skillVersion };
}

/**
 * Copy skill from local source
 */
async function copySkillFromLocal(
  sourcePath: string,
  targetDir: string
): Promise<{ success: boolean; error?: string }> {
  if (!fileExists(sourcePath)) {
    return { success: false, error: `Source skill not found: ${sourcePath}` };
  }
  try {
    await cp(sourcePath, targetDir, { recursive: true });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to copy skill: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Create a placeholder SKILL.md for marketplace skills
 */
async function createSkillPlaceholder(
  skillDir: string,
  name: string,
  version?: string
): Promise<void> {
  const content = `---
name: ${name}
version: ${version || "1.0.0"}
description: Skill ${name}
---

# ${name}

This skill was installed from the marketplace.
`;
  await writeFile(join(skillDir, "SKILL.md"), content, "utf-8");
}

/**
 * Add entry to installed.yaml
 */
async function addToInstalledList(
  targetDir: string,
  entry: InstalledSkillEntry
): Promise<void> {
  const installedPath = getInstalledYamlPath(targetDir);
  const file = fileExists(installedPath)
    ? await readYaml<InstalledSkillsFile>(installedPath)
    : { installed: [] };

  const existingIndex = (file?.installed || []).findIndex(
    (e) => e.name === entry.name
  );

  if (existingIndex >= 0) {
    (file?.installed || [])[existingIndex] = entry;
  } else {
    (file?.installed || []).push(entry);
  }

  await writeYaml(installedPath, file);
}

/**
 * Remove entry from installed.yaml
 */
async function removeFromInstalledList(
  targetDir: string,
  name: string
): Promise<void> {
  const installedPath = getInstalledYamlPath(targetDir);
  if (!fileExists(installedPath)) {
    return;
  }

  const file = await readYaml<InstalledSkillsFile>(installedPath);
  if (!file?.installed) {
    return;
  }

  file.installed = file.installed.filter((e) => e.name !== name);
  await writeYaml(installedPath, file);
}

/**
 * List skills in a directory
 */
async function listSkillsInDir(skillsDir: string): Promise<InstalledSkillInfo[]> {
  const installedPath = getInstalledYamlPath(skillsDir);

  if (!fileExists(installedPath)) {
    // Try to build list from directories
    if (!fileExists(skillsDir)) {
      return [];
    }

    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      const skills: InstalledSkillInfo[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = join(skillsDir, entry.name);
          const metadata = await readSkillMetadata(skillPath);
          skills.push({
            name: metadata?.name || entry.name,
            version: metadata?.version || "1.0.0",
            path: skillPath,
            installedAt: new Date().toISOString(),
          });
        }
      }

      return skills;
    } catch {
      return [];
    }
  }

  const file = await readYaml<InstalledSkillsFile>(installedPath);
  return (file?.installed || []).map((entry) => ({
    name: entry.name,
    version: entry.version,
    path: entry.path,
    installedAt: entry.installedAt,
    source: entry.source,
  }));
}

/**
 * Read skill metadata from SKILL.md
 */
async function readSkillMetadata(skillPath: string): Promise<SkillMetadata | null> {
  const skillMdPath = join(skillPath, "SKILL.md");
  if (!fileExists(skillMdPath)) {
    return null;
  }

  try {
    const content = await readFile(skillMdPath, "utf-8");
    return parseSkillMetadataFromContent(content);
  } catch {
    return null;
  }
}
