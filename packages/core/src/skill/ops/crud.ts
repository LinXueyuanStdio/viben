/**
 * Skill CRUD operations
 *
 * Create, Read, Update, Delete operations for skills.
 * Pure functions following the task/ops pattern.
 */
import { readdir, readFile, rm, cp, mkdir, writeFile } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { readYaml, writeYaml, fileExists, ensureDir } from "../../config/yaml";
import { downloadFromGitHub } from "../../utils/github-download";
import {
  resolveTargetDir,
  validateTargetOptions,
  getInstalledYamlPath,
  getSharedSkillsDir,
  getClaudeSkillsDir,
} from "./paths";
import { extractZipToDirectory, parseSkillMetadataFromContent } from "./extract";
import { getSkillFromRegistry, downloadSkillFromRegistry } from "./registry";
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
    githubOwner,
    githubRepo,
    githubRef,
    onProgress,
    version,
    conflictResolution,
  } = options;

  // Parse spec (supports name, name@version, gh:user/repo, gh:user/repo#ref, local paths)
  const parsed = parseInstallSpec(name, version, githubOwner, githubRepo, githubRef);
  const skillName = parsed.name;
  const skillVersion = parsed.version;

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
        installed_at: new Date().toISOString(),
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
    } else if (sourcePath || parsed.source === "local") {
      // Copy from local directory
      const localPath = sourcePath || parsed.localPath;
      if (!localPath) {
        return {
          success: false,
          error: "Local path not specified",
          name: skillName,
          version: skillVersion || "1.0.0",
          path: skillDir,
          target,
          message: "Local path not specified",
        };
      }
      const copyResult = await copySkillFromLocal(localPath, skillDir);
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
    } else if (parsed.source === "github") {
      // Download from GitHub
      const ghOwner = parsed.githubOwner;
      const ghRepo = parsed.githubRepo;
      const ghRef = parsed.githubRef;

      if (!ghOwner || !ghRepo) {
        await rm(skillDir, { recursive: true, force: true });
        return {
          success: false,
          error: "Invalid GitHub spec: missing owner or repo",
          name: skillName,
          version: skillVersion || "1.0.0",
          path: "",
          target,
          message: "Invalid GitHub spec",
        };
      }

      const downloadResult = await downloadFromGitHub({
        owner: ghOwner,
        repo: ghRepo,
        ref: ghRef,
        targetDir: skillDir,
        onProgress,
      });

      if (!downloadResult.success) {
        await rm(skillDir, { recursive: true, force: true });
        return {
          success: false,
          error: downloadResult.error,
          name: skillName,
          version: skillVersion || "1.0.0",
          path: "",
          target,
          message: downloadResult.error || "GitHub download failed",
        };
      }

      // Try to read version from SKILL.md or use ref
      const skillMdPath = join(skillDir, "SKILL.md");
      let finalVersion = skillVersion || ghRef || "1.0.0";
      if (fileExists(skillMdPath)) {
        try {
          const content = await readFile(skillMdPath, "utf-8");
          const metadata = parseSkillMetadataFromContent(content);
          if (metadata?.version) {
            finalVersion = metadata.version;
          }
        } catch {
          // Ignore errors reading SKILL.md
        }
      }

      // Update installed.yaml with GitHub source
      await addToInstalledList(targetDir, {
        name: skillName,
        version: finalVersion,
        path: skillDir,
        source: "github",
        installed_at: new Date().toISOString(),
        spec: name,
      });

      return {
        success: true,
        name: skillName,
        version: finalVersion,
        path: skillDir,
        target,
        message: `Skill '${skillName}' installed successfully from GitHub (${ghOwner}/${ghRepo})`,
      };
    } else {
      // Download from marketplace
      const pkgInfo = await getSkillFromRegistry(skillName);
      if (!pkgInfo.success || !pkgInfo.skill) {
        // Clean up empty skill directory
        await rm(skillDir, { recursive: true, force: true });
        return {
          success: false,
          error: `Skill '${skillName}' not found in registry.`,
          name: skillName,
          version: skillVersion || "",
          path: "",
          target,
          message: `Skill '${skillName}' not found in registry`,
        };
      }

      const downloadVersion = skillVersion || pkgInfo.skill.version;

      // Download and extract
      const downloadResult = await downloadSkillFromRegistry(
        pkgInfo.skill.id,
        skillVersion,
        skillDir
      );

      if (!downloadResult.success) {
        // Clean up on failure
        await rm(skillDir, { recursive: true, force: true });
        return {
          success: false,
          error: downloadResult.error,
          name: skillName,
          version: downloadVersion,
          path: "",
          target,
          message: downloadResult.error || "Download failed",
        };
      }

      // Update installed.yaml with marketplace source
      await addToInstalledList(targetDir, {
        name: skillName,
        version: downloadVersion,
        path: skillDir,
        source: "marketplace",
        installed_at: new Date().toISOString(),
      });

      return {
        success: true,
        name: skillName,
        version: downloadVersion,
        path: skillDir,
        target,
        message: `Skill '${skillName}@${downloadVersion}' installed successfully from marketplace`,
      };
    }

    // Update installed.yaml tracking
    await addToInstalledList(targetDir, {
      name: skillName,
      version: skillVersion || "1.0.0",
      path: skillDir,
      source: sourcePath ? "local" : "marketplace",
      installed_at: new Date().toISOString(),
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
 * Parsed install spec result
 */
interface ParsedSkillInstallSpec {
  /** Skill name */
  name: string;
  /** Version (from @version or explicit) */
  version?: string;
  /** Source type */
  source: "marketplace" | "github" | "local";
  /** GitHub owner (for gh: source) */
  githubOwner?: string;
  /** GitHub repo (for gh: source) */
  githubRepo?: string;
  /** GitHub ref - tag/branch/commit (for gh: source) */
  githubRef?: string;
  /** Local path (for local source) */
  localPath?: string;
}

/**
 * Parse install spec into components
 *
 * Formats:
 * - foo                        # marketplace, latest version
 * - foo@1.2.3                  # marketplace, specific version
 * - gh:user/repo               # GitHub, default branch
 * - gh:user/repo#v1.0.0        # GitHub, specific ref
 * - ./path/to/skill            # local relative path
 * - /absolute/path             # local absolute path
 *
 * @param spec - Install spec string
 * @param explicitVersion - Explicitly provided version
 * @param explicitGhOwner - Explicitly provided GitHub owner
 * @param explicitGhRepo - Explicitly provided GitHub repo
 * @param explicitGhRef - Explicitly provided GitHub ref
 */
function parseInstallSpec(
  spec: string,
  explicitVersion?: string,
  explicitGhOwner?: string,
  explicitGhRepo?: string,
  explicitGhRef?: string
): ParsedSkillInstallSpec {
  // If explicit GitHub options are provided, use them
  if (explicitGhOwner && explicitGhRepo) {
    return {
      name: explicitGhRepo,
      version: explicitVersion,
      source: "github",
      githubOwner: explicitGhOwner,
      githubRepo: explicitGhRepo,
      githubRef: explicitGhRef,
    };
  }

  // Local path (starts with ./ or / or is absolute on Windows)
  if (spec.startsWith("./") || spec.startsWith("/") || /^[a-zA-Z]:/.test(spec)) {
    const name = spec.split("/").pop() || spec;
    return {
      name,
      version: explicitVersion,
      source: "local",
      localPath: isAbsolute(spec) ? spec : resolve(process.cwd(), spec),
    };
  }

  // GitHub (gh:user/repo or gh:user/repo#ref)
  if (spec.startsWith("gh:")) {
    const ghPart = spec.slice(3);
    const [repoPath, ref] = ghPart.split("#");
    const [owner, repo] = repoPath.split("/");

    return {
      name: repo,
      version: explicitVersion,
      source: "github",
      githubOwner: owner,
      githubRepo: repo,
      githubRef: ref,
    };
  }

  // Marketplace (name or name@version)
  const atIndex = spec.lastIndexOf("@");
  if (atIndex > 0) {
    return {
      name: spec.substring(0, atIndex),
      version: explicitVersion || spec.substring(atIndex + 1),
      source: "marketplace",
    };
  }

  return {
    name: spec,
    version: explicitVersion,
    source: "marketplace",
  };
}

/**
 * Parse skill name@version format
 * @deprecated Use parseInstallSpec instead
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
            installed_at: new Date().toISOString(),
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
    installed_at: entry.installed_at,
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
