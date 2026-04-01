/**
 * MCP CRUD operations
 *
 * Create, Read, Update, Delete operations for MCP packages.
 * Pure functions following the task/ops pattern.
 */
import { readdir, rm, cp, mkdir } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { readYaml, writeYaml, fileExists, ensureDir, readJson } from "../../config/yaml";
import {
  resolveTargetDir,
  validateTargetOptions,
  getInstalledYamlPath,
  getProjectMcpDir,
  getGlobalMcpDir,
} from "./paths";
import {
  getFromMarketplace,
  downloadFromMarketplace,
} from "./registry";
import type {
  McpTarget,
  InstallMcpOptions,
  InstallMcpResult,
  UninstallMcpOptions,
  UninstallMcpResult,
  ListMcpOptions,
  ListMcpResult,
  GetMcpResult,
  InstalledMcpsFile,
  InstalledMcpEntry,
  InstalledMcpInfo,
  ParsedInstallSpec,
} from "./types";

// =============================================================================
// Install MCP
// =============================================================================

/**
 * Install an MCP package to the specified target
 *
 * @param options - Installation options
 * @returns Installation result
 */
export async function installMcp(
  options: InstallMcpOptions
): Promise<InstallMcpResult> {
  const { spec, target, force } = options;

  // Validate target
  const validation = validateTargetOptions(target);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
      name: "",
      version: "",
      path: "",
      target,
      source: "marketplace",
      message: validation.error || "Validation failed",
    };
  }

  // Parse install spec
  const parsed = parseInstallSpec(spec);

  try {
    // Get target directory
    const targetDir = resolveTargetDir(target);
    const mcpDir = join(targetDir, parsed.name);

    // Check if already installed
    if (fileExists(mcpDir) && !force) {
      return {
        success: false,
        error: `Package '${parsed.name}' is already installed. Use --force to reinstall.`,
        name: parsed.name,
        version: parsed.version || "",
        path: mcpDir,
        target,
        source: parsed.source,
        message: `Package '${parsed.name}' is already installed`,
      };
    }

    // If force, remove existing
    if (fileExists(mcpDir) && force) {
      await rm(mcpDir, { recursive: true, force: true });
    }

    // Ensure target directory exists
    await ensureDir(targetDir);

    let version = parsed.version || "latest";

    // Install based on source
    switch (parsed.source) {
      case "local": {
        const localPath = parsed.local_path!;
        const absolutePath = isAbsolute(localPath)
          ? localPath
          : resolve(process.cwd(), localPath);

        if (!fileExists(absolutePath)) {
          return {
            success: false,
            error: `Path '${localPath}' does not exist.`,
            name: parsed.name,
            version: "",
            path: "",
            target,
            source: "local",
            message: `Path '${localPath}' does not exist`,
          };
        }

        // Copy from local path
        await mkdir(mcpDir, { recursive: true });
        await cp(absolutePath, mcpDir, { recursive: true });

        // Try to read version from package.json
        const pkgJsonPath = join(mcpDir, "package.json");
        if (fileExists(pkgJsonPath)) {
          const pkgJson = await readJson<{ version?: string }>(pkgJsonPath);
          version = pkgJson?.version || "1.0.0";
        } else {
          version = "1.0.0";
        }
        break;
      }

      case "github": {
        // TODO: Implement GitHub installation
        return {
          success: false,
          error: "GitHub installation is not yet implemented",
          name: parsed.name,
          version: "",
          path: "",
          target,
          source: "github",
          message: "GitHub installation is not yet implemented",
        };
      }

      case "marketplace": {
        // Get package info from marketplace
        const pkgInfo = await getFromMarketplace(parsed.name);
        if (!pkgInfo.success || !pkgInfo.mcp) {
          return {
            success: false,
            error: `Package '${parsed.name}' not found in registry.`,
            name: parsed.name,
            version: "",
            path: "",
            target,
            source: "marketplace",
            message: `Package '${parsed.name}' not found`,
          };
        }

        version = parsed.version || pkgInfo.mcp.version;

        // Download and extract
        const downloadResult = await downloadFromMarketplace(
          pkgInfo.mcp.id,
          parsed.version,
          mcpDir
        );

        if (!downloadResult.success) {
          return {
            success: false,
            error: downloadResult.error,
            name: parsed.name,
            version,
            path: "",
            target,
            source: "marketplace",
            message: downloadResult.error || "Download failed",
          };
        }
        break;
      }
    }

    // Update installed.yaml tracking
    await addToInstalledList(targetDir, {
      name: parsed.name,
      version,
      path: mcpDir,
      source: parsed.source,
      installed_at: new Date().toISOString(),
      spec,
    });

    return {
      success: true,
      name: parsed.name,
      version,
      path: mcpDir,
      target,
      source: parsed.source,
      message: `Package '${parsed.name}@${version}' installed successfully`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      name: parsed.name,
      version: "",
      path: "",
      target,
      source: parsed.source,
      message: `Failed to install package: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// =============================================================================
// Uninstall MCP
// =============================================================================

/**
 * Uninstall an MCP package from the specified target
 *
 * @param options - Uninstallation options
 * @returns Uninstallation result
 */
export async function uninstallMcp(
  options: UninstallMcpOptions
): Promise<UninstallMcpResult> {
  const { name, target } = options;

  // Validate options
  const validation = validateTargetOptions(target);
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
    const targetDir = resolveTargetDir(target);
    const mcpDir = join(targetDir, name);

    // Check if installed
    if (!fileExists(mcpDir)) {
      return {
        success: false,
        error: `Package '${name}' not found`,
        name,
        message: `Package '${name}' not found in ${target}`,
      };
    }

    // Remove package directory
    await rm(mcpDir, { recursive: true, force: true });

    // Update installed.yaml tracking
    await removeFromInstalledList(targetDir, name);

    return {
      success: true,
      name,
      message: `Package '${name}' uninstalled successfully from ${target}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      name,
      message: `Failed to uninstall package: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// =============================================================================
// List MCPs
// =============================================================================

/**
 * List installed MCP packages for the specified target(s)
 *
 * @param options - List options
 * @returns List result with MCPs
 */
export async function listMcps(options?: ListMcpOptions): Promise<ListMcpResult> {
  try {
    const mcps: InstalledMcpInfo[] = [];

    if (!options?.target || options.all) {
      // List from all targets
      const projectMcps = await listMcpsInDir(getProjectMcpDir(), "project");
      const globalMcps = await listMcpsInDir(getGlobalMcpDir(), "global");
      mcps.push(...projectMcps, ...globalMcps);
    } else {
      // List from specific target
      const targetDir = resolveTargetDir(options.target);
      const targetMcps = await listMcpsInDir(targetDir, options.target);
      mcps.push(...targetMcps);
    }

    return {
      success: true,
      mcps,
      count: mcps.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      mcps: [],
      count: 0,
    };
  }
}

// =============================================================================
// Get MCP
// =============================================================================

/**
 * Get detailed information about an installed MCP package
 *
 * @param name - Package name
 * @param options - List options for target filtering
 * @returns MCP info result
 */
export async function getMcp(
  name: string,
  options?: ListMcpOptions
): Promise<GetMcpResult> {
  try {
    // Search in specified target or all targets
    const targets: McpTarget[] = options?.target
      ? [options.target]
      : ["project", "global"];

    for (const target of targets) {
      const targetDir = resolveTargetDir(target);
      const mcpDir = join(targetDir, name);

      if (fileExists(mcpDir)) {
        // Try to read package.json for details
        const pkgJsonPath = join(mcpDir, "package.json");
        let version = "1.0.0";
        let description: string | undefined;

        if (fileExists(pkgJsonPath)) {
          const pkgJson = await readJson<{
            version?: string;
            description?: string;
          }>(pkgJsonPath);
          version = pkgJson?.version || version;
          description = pkgJson?.description;
        }

        // Get source from installed.yaml
        const installedPath = getInstalledYamlPath(targetDir);
        let source: "marketplace" | "github" | "local" = "local";
        if (fileExists(installedPath)) {
          const file = await readYaml<InstalledMcpsFile>(installedPath);
          const entry = file?.installed?.find((e) => e.name === name);
          if (entry) {
            source = entry.source;
          }
        }

        return {
          success: true,
          mcp: {
            name,
            version,
            description,
            path: mcpDir,
            source,
            target,
          },
        };
      }
    }

    return {
      success: false,
      error: `Package '${name}' not found`,
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
 * Parse install spec into components
 *
 * Formats:
 * - foo                        # marketplace, latest version
 * - foo@1.2.3                  # marketplace, specific version
 * - gh:user/repo               # GitHub, default branch
 * - gh:user/repo#v1.0.0        # GitHub, specific ref
 * - ./path/to/package          # local relative path
 * - /absolute/path             # local absolute path
 */
export function parseInstallSpec(spec: string): ParsedInstallSpec {
  // Local path (starts with ./ or / or is absolute on Windows)
  if (spec.startsWith("./") || spec.startsWith("/") || /^[a-zA-Z]:/.test(spec)) {
    const name = spec.split("/").pop() || spec;
    return {
      name,
      source: "local",
      local_path: spec,
    };
  }

  // GitHub (gh:user/repo or gh:user/repo#ref)
  if (spec.startsWith("gh:")) {
    const ghPart = spec.slice(3);
    const [repoPath, ref] = ghPart.split("#");
    const [owner, repo] = repoPath.split("/");

    return {
      name: repo,
      source: "github",
      github_owner: owner,
      github_repo: repo,
      github_ref: ref,
    };
  }

  // Marketplace (name or name@version)
  const atIndex = spec.lastIndexOf("@");
  if (atIndex > 0) {
    return {
      name: spec.substring(0, atIndex),
      version: spec.substring(atIndex + 1),
      source: "marketplace",
    };
  }

  return {
    name: spec,
    source: "marketplace",
  };
}

/**
 * Add entry to installed.yaml
 */
async function addToInstalledList(
  targetDir: string,
  entry: InstalledMcpEntry
): Promise<void> {
  const installedPath = getInstalledYamlPath(targetDir);
  const file = fileExists(installedPath)
    ? await readYaml<InstalledMcpsFile>(installedPath)
    : { installed: [] };

  const installed = file?.installed || [];
  const existingIndex = installed.findIndex((e) => e.name === entry.name);

  if (existingIndex >= 0) {
    installed[existingIndex] = entry;
  } else {
    installed.push(entry);
  }

  await writeYaml(installedPath, { installed });
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

  const file = await readYaml<InstalledMcpsFile>(installedPath);
  if (!file?.installed) {
    return;
  }

  file.installed = file.installed.filter((e) => e.name !== name);
  await writeYaml(installedPath, file);
}

/**
 * List MCPs in a directory
 */
async function listMcpsInDir(
  mcpDir: string,
  target: McpTarget
): Promise<InstalledMcpInfo[]> {
  const installedPath = getInstalledYamlPath(mcpDir);

  if (!fileExists(installedPath)) {
    // Try to build list from directories
    if (!fileExists(mcpDir)) {
      return [];
    }

    try {
      const entries = await readdir(mcpDir, { withFileTypes: true });
      const mcps: InstalledMcpInfo[] = [];

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== "installed.yaml") {
          const pkgPath = join(mcpDir, entry.name);
          const pkgJsonPath = join(pkgPath, "package.json");

          let version = "1.0.0";
          if (fileExists(pkgJsonPath)) {
            const pkgJson = await readJson<{ version?: string }>(pkgJsonPath);
            version = pkgJson?.version || version;
          }

          mcps.push({
            name: entry.name,
            version,
            path: pkgPath,
            installed_at: new Date().toISOString(),
            target,
          });
        }
      }

      return mcps;
    } catch {
      return [];
    }
  }

  const file = await readYaml<InstalledMcpsFile>(installedPath);
  return (file?.installed || []).map((entry) => ({
    name: entry.name,
    version: entry.version,
    path: entry.path,
    installed_at: entry.installed_at,
    source: entry.source,
    spec: entry.spec,
    target,
  }));
}
