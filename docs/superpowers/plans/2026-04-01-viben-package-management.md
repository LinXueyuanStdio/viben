# Viben Package Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `viben mcp` and `viben skill` package management commands with pip-like UX

**Architecture:** Extend existing mcp/ and skill/ops/ modules with registry integration. CLI commands invoke ops functions. Uses @viben/api-client for marketplace API, proxyFetch for HTTP requests.

**Tech Stack:** TypeScript, Commander.js, @viben/api-client, undici (proxy support), YAML config

---

## Chunk 1: MCP Ops Module

### File Structure

```
packages/core/src/mcp/ops/
├── index.ts          # ops entry, re-exports all functions
├── types.ts          # ops-specific types (mirrors skill/ops/types.ts)
├── paths.ts          # path utilities (getProjectMcpDir, getGlobalMcpDir, etc.)
├── crud.ts           # install/uninstall/list/get operations
└── registry.ts       # marketplace API integration
```

---

### Task 1: Create MCP ops types

**Files:**
- Create: `packages/core/src/mcp/ops/types.ts`

- [ ] **Step 1: Write the type definitions**

```typescript
/**
 * MCP ops module type definitions
 *
 * Mirrors skill/ops/types.ts structure for consistency.
 */

// Re-export core types
export type { McpServer, InstalledMcp } from "../../types/index";

// =============================================================================
// Target Types
// =============================================================================

/**
 * Installation target for MCP packages
 * - "project": Install to .viben/mcp/ (default)
 * - "global": Install to ~/.viben/mcp/
 */
export type McpTarget = "project" | "global";

// =============================================================================
// Base Result Type
// =============================================================================

/**
 * Base result type following task ops pattern
 */
export interface McpResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// Installation Types
// =============================================================================

/**
 * Install spec parsed result
 */
export interface ParsedInstallSpec {
  /** Package name */
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
 * Options for installing an MCP package
 */
export interface InstallMcpOptions {
  /** Install spec (name, name@version, gh:user/repo, ./path) */
  spec: string;
  /** Installation target */
  target: McpTarget;
  /** Force reinstall if already exists */
  force?: boolean;
  /** Progress callback for installation */
  onProgress?: (progress: number) => void;
}

/**
 * Result of MCP installation
 */
export interface InstallMcpResult extends McpResult {
  name: string;
  version: string;
  path: string;
  target: McpTarget;
  source: "marketplace" | "github" | "local";
  message: string;
}

/**
 * Options for uninstalling an MCP package
 */
export interface UninstallMcpOptions {
  /** Package name */
  name: string;
  /** Installation target */
  target: McpTarget;
}

/**
 * Result of MCP uninstallation
 */
export interface UninstallMcpResult extends McpResult {
  name: string;
  message: string;
}

// =============================================================================
// List/Query Types
// =============================================================================

/**
 * Options for listing installed MCPs
 */
export interface ListMcpOptions {
  /** Filter by target (if not specified, list all) */
  target?: McpTarget;
  /** Include both project and global */
  all?: boolean;
}

/**
 * Installed MCP info for list results
 */
export interface InstalledMcpInfo {
  name: string;
  version: string;
  path: string;
  installed_at: string;
  source?: "marketplace" | "github" | "local";
  spec?: string;
  target: McpTarget;
}

/**
 * Result of listing installed MCPs
 */
export interface ListMcpResult extends McpResult {
  mcps: InstalledMcpInfo[];
  count: number;
}

/**
 * MCP info for get results
 */
export interface McpInfo {
  name: string;
  version: string;
  description?: string;
  path: string;
  source: "marketplace" | "github" | "local";
  target: McpTarget;
}

/**
 * Result of getting MCP details
 */
export interface GetMcpResult extends McpResult {
  mcp?: McpInfo;
}

// =============================================================================
// Marketplace Types
// =============================================================================

/**
 * Options for searching marketplace
 */
export interface MarketplaceSearchOptions {
  /** Search query */
  query: string;
  /** Maximum results */
  limit?: number;
  /** Page number */
  page?: number;
}

/**
 * MCP package from marketplace
 */
export interface MarketplaceMcp {
  id: string;
  name: string;
  slug: string;
  version: string;
  description?: string;
  author?: {
    username: string;
    displayName: string;
  };
  downloadsCount: number;
  favoritesCount: number;
}

/**
 * Result of marketplace search
 */
export interface MarketplaceSearchResult extends McpResult {
  mcps: MarketplaceMcp[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Result of marketplace get
 */
export interface MarketplaceGetResult extends McpResult {
  mcp?: MarketplaceMcp;
}

// =============================================================================
// Installed File Types
// =============================================================================

/**
 * Installed MCPs tracking file (installed.yaml)
 */
export interface InstalledMcpsFile {
  installed: InstalledMcpEntry[];
}

/**
 * Installed MCP entry
 */
export interface InstalledMcpEntry {
  name: string;
  version: string;
  path: string;
  source: "marketplace" | "github" | "local";
  installed_at: string;
  spec?: string;
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to mcp/ops/types.ts

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/mcp/ops/types.ts
git commit -m "$(cat <<'EOF'
feat(mcp): add ops module types

Add type definitions for MCP package management operations:
- McpTarget for project/global installation
- Install/Uninstall options and results
- List/Get query types
- Marketplace search types
- InstalledMcpsFile for installed.yaml tracking

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create MCP paths utilities

**Files:**
- Create: `packages/core/src/mcp/ops/paths.ts`

- [ ] **Step 1: Write the path utilities**

```typescript
/**
 * Path resolution utilities for MCP packages
 *
 * Pure functions, no side effects.
 */
import { join } from "node:path";
import { getStateDir, getSharedMcpDir } from "../../config/paths";
import type { McpTarget } from "./types";

// =============================================================================
// Base Directory Paths
// =============================================================================

/**
 * Get the project-level MCP directory path
 * Default: .viben/mcp
 */
export function getProjectMcpDir(): string {
  return join(process.cwd(), ".viben", "mcp");
}

/**
 * Get the global MCP directory path
 * Default: ~/.viben/mcp
 */
export function getGlobalMcpDir(): string {
  return getSharedMcpDir();
}

// =============================================================================
// MCP-Specific Paths
// =============================================================================

/**
 * Get the directory path for a specific MCP package
 *
 * @param target - Target location type
 * @param name - Name of the MCP package
 * @returns Path to the MCP directory
 */
export function getMcpDir(target: McpTarget, name: string): string {
  const targetDir = resolveTargetDir(target);
  return join(targetDir, name);
}

/**
 * Get the path to installed.yaml in a target directory
 *
 * @param targetDir - Target directory path
 * @returns Path to installed.yaml
 */
export function getInstalledYamlPath(targetDir: string): string {
  return join(targetDir, "installed.yaml");
}

// =============================================================================
// Target Resolution
// =============================================================================

/**
 * Resolve target directory based on target type
 *
 * @param target - Target location type
 * @returns Resolved directory path
 */
export function resolveTargetDir(target: McpTarget): string {
  switch (target) {
    case "project":
      return getProjectMcpDir();
    case "global":
      return getGlobalMcpDir();
    default:
      throw new Error(`Unknown target: ${target}`);
  }
}

/**
 * Validate target options
 *
 * @param target - Target location type
 * @returns Object with isValid and error message
 */
export function validateTargetOptions(target: McpTarget): {
  isValid: boolean;
  error?: string;
} {
  if (target !== "project" && target !== "global") {
    return { isValid: false, error: `Invalid target: ${target}` };
  }
  return { isValid: true };
}
```

- [ ] **Step 2: Verify paths compile**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/mcp/ops/paths.ts
git commit -m "$(cat <<'EOF'
feat(mcp): add ops path utilities

Add path resolution utilities for MCP packages:
- getProjectMcpDir() for .viben/mcp
- getGlobalMcpDir() for ~/.viben/mcp
- getMcpDir() for specific package paths
- resolveTargetDir() for target-based resolution

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Create MCP registry integration

**Files:**
- Create: `packages/core/src/mcp/ops/registry.ts`

- [ ] **Step 1: Write the registry integration**

```typescript
/**
 * MCP marketplace registry integration
 *
 * Uses @viben/api-client for API calls with proxy support.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VibenClient } from "@viben/api-client";
import { proxyFetch } from "../../http";
import { getAuthToken, getVibenWebUrl } from "../../auth/api";
import { ensureDir } from "../../config/yaml";
import type {
  MarketplaceSearchOptions,
  MarketplaceSearchResult,
  MarketplaceGetResult,
  MarketplaceMcp,
} from "./types";

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Create a Viben API client with proxy support
 */
function createClient(): VibenClient {
  const client = new VibenClient({
    baseUrl: getVibenWebUrl(),
  });

  // Set auth token if available
  const token = getAuthToken();
  if (token) {
    client.setAccessToken(token);
  }

  return client;
}

// =============================================================================
// Search Operations
// =============================================================================

/**
 * Search MCP packages in marketplace
 */
export async function searchMarketplace(
  options: MarketplaceSearchOptions
): Promise<MarketplaceSearchResult> {
  try {
    const client = createClient();
    const response = await client.mcp.search(options.query, {
      page: options.page,
      limit: options.limit,
    });

    return {
      success: true,
      mcps: response.data.map(toMarketplaceMcp),
      total: response.pagination.total,
      page: response.pagination.page,
      totalPages: response.pagination.totalPages,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
      mcps: [],
      total: 0,
      page: 1,
      totalPages: 0,
    };
  }
}

/**
 * Get MCP package details from marketplace
 */
export async function getFromMarketplace(
  idOrSlug: string
): Promise<MarketplaceGetResult> {
  try {
    const client = createClient();
    const response = await client.mcp.get(idOrSlug);

    return {
      success: true,
      mcp: toMarketplaceMcp(response.package),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Package not found",
    };
  }
}

/**
 * Download MCP package from marketplace
 *
 * @param idOrSlug - Package ID or slug
 * @param version - Optional version
 * @param targetDir - Directory to extract to
 */
export async function downloadFromMarketplace(
  idOrSlug: string,
  version: string | undefined,
  targetDir: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createClient();
    const blob = await client.mcp.download(idOrSlug, version);

    // Ensure target directory exists
    await ensureDir(targetDir);

    // Write the zip file
    const zipPath = join(targetDir, "package.zip");
    const buffer = Buffer.from(await blob.arrayBuffer());
    await writeFile(zipPath, buffer);

    // Extract the zip (reuse skill extraction logic)
    const { extractZipToDirectory } = await import("../../skill/ops/extract");
    await extractZipToDirectory({
      zipPath,
      targetDir,
      overwrite: true,
      validate: false, // MCP doesn't have SKILL.md
    });

    // Remove the zip file
    const { rm } = await import("node:fs/promises");
    await rm(zipPath, { force: true });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert API response to MarketplaceMcp
 */
function toMarketplaceMcp(pkg: {
  id: string;
  name: string;
  slug: string;
  version: string;
  description?: string | null;
  author?: { username: string; displayName: string } | null;
  downloadsCount: number;
  favoritesCount: number;
}): MarketplaceMcp {
  return {
    id: pkg.id,
    name: pkg.name,
    slug: pkg.slug,
    version: pkg.version,
    description: pkg.description ?? undefined,
    author: pkg.author ?? undefined,
    downloadsCount: pkg.downloadsCount,
    favoritesCount: pkg.favoritesCount,
  };
}
```

- [ ] **Step 2: Verify registry compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/mcp/ops/registry.ts
git commit -m "$(cat <<'EOF'
feat(mcp): add registry integration for marketplace

Add marketplace API integration using @viben/api-client:
- searchMarketplace() for searching packages
- getFromMarketplace() for package details
- downloadFromMarketplace() for downloading and extracting

Uses proxyFetch for proxy-aware HTTP requests.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Create MCP CRUD operations

**Files:**
- Create: `packages/core/src/mcp/ops/crud.ts`

- [ ] **Step 1: Write the CRUD operations**

```typescript
/**
 * MCP CRUD operations
 *
 * Create, Read, Update, Delete operations for MCP packages.
 * Pure functions following the task/ops pattern.
 */
import { readdir, rm, cp, mkdir } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { readYaml, writeYaml, fileExists, ensureDir } from "../../config/yaml";
import {
  resolveTargetDir,
  validateTargetOptions,
  getInstalledYamlPath,
  getProjectMcpDir,
  getGlobalMcpDir,
} from "./paths";
import {
  searchMarketplace,
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
  const { spec, target, force, onProgress } = options;

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
        const localPath = parsed.localPath!;
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
          const pkgJson = await readYaml<{ version?: string }>(pkgJsonPath);
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
          const pkgJson = await readYaml<{
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
      localPath: spec,
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
            const pkgJson = await readYaml<{ version?: string }>(pkgJsonPath);
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
```

- [ ] **Step 2: Verify CRUD compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/mcp/ops/crud.ts
git commit -m "$(cat <<'EOF'
feat(mcp): add CRUD operations for package management

Add core operations for MCP package management:
- installMcp() with marketplace/github/local support
- uninstallMcp() for package removal
- listMcps() for listing installed packages
- getMcp() for package details
- parseInstallSpec() for spec format parsing

Supports install specs: name, name@version, gh:user/repo, ./path

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Create MCP ops index

**Files:**
- Create: `packages/core/src/mcp/ops/index.ts`

- [ ] **Step 1: Write the ops index**

```typescript
/**
 * MCP ops module
 *
 * Entry point for MCP package management operations.
 */

// Types
export * from "./types";

// Path utilities
export * from "./paths";

// CRUD operations
export {
  installMcp,
  uninstallMcp,
  listMcps,
  getMcp,
  parseInstallSpec,
} from "./crud";

// Registry operations
export {
  searchMarketplace,
  getFromMarketplace,
  downloadFromMarketplace,
} from "./registry";
```

- [ ] **Step 2: Verify ops index compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/mcp/ops/index.ts
git commit -m "$(cat <<'EOF'
feat(mcp): add ops module entry point

Export all MCP ops functions and types from single entry point.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Skill Ops Extension

### Task 6: Add registry integration to skill ops

**Files:**
- Create: `packages/core/src/skill/ops/registry.ts`
- Modify: `packages/core/src/skill/ops/index.ts`
- Modify: `packages/core/src/skill/ops/types.ts`

- [ ] **Step 1: Update skill ops types to add github source**

In `packages/core/src/skill/ops/types.ts`, update:

```typescript
// In InstalledSkillEntry interface, change source type:
export interface InstalledSkillEntry {
  name: string;
  version: string;
  path: string;
  source: "local" | "marketplace" | "github";  // Add "github"
  installed_at: string;
  spec?: string;  // Add spec field
}

// In InstalledSkillInfo interface:
export interface InstalledSkillInfo {
  name: string;
  version: string;
  path: string;
  installed_at: string;
  source?: "local" | "marketplace" | "github";  // Add "github"
  spec?: string;  // Add spec field
}

// In SkillInfo interface:
export interface SkillInfo {
  id: string;
  name: string;
  description?: string;
  version: string;
  path: string;
  source: "local" | "marketplace" | "github";  // Add "github"
}
```

- [ ] **Step 2: Create skill registry integration**

```typescript
/**
 * Skill marketplace registry integration
 *
 * Uses @viben/api-client for API calls with proxy support.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VibenClient } from "@viben/api-client";
import { getAuthToken, getVibenWebUrl } from "../../auth/api";
import { ensureDir } from "../../config/yaml";

// Types for marketplace operations
export interface MarketplaceSkill {
  id: string;
  name: string;
  slug: string;
  version: string;
  description?: string;
  author?: {
    username: string;
    displayName: string;
  };
  downloadsCount: number;
  favoritesCount: number;
  skillType: "command" | "prompt" | "agent";
}

export interface SkillSearchOptions {
  query: string;
  limit?: number;
  page?: number;
  type?: "command" | "prompt" | "agent";
}

export interface SkillSearchResult {
  success: boolean;
  error?: string;
  skills: MarketplaceSkill[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SkillGetResult {
  success: boolean;
  error?: string;
  skill?: MarketplaceSkill;
}

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Create a Viben API client with auth
 */
function createClient(): VibenClient {
  const client = new VibenClient({
    baseUrl: getVibenWebUrl(),
  });

  const token = getAuthToken();
  if (token) {
    client.setAccessToken(token);
  }

  return client;
}

// =============================================================================
// Search Operations
// =============================================================================

/**
 * Search skill packages in marketplace
 */
export async function searchSkillMarketplace(
  options: SkillSearchOptions
): Promise<SkillSearchResult> {
  try {
    const client = createClient();
    const response = await client.skill.search(options.query, {
      page: options.page,
      limit: options.limit,
      type: options.type,
    });

    return {
      success: true,
      skills: response.data.map(toMarketplaceSkill),
      total: response.pagination.total,
      page: response.pagination.page,
      totalPages: response.pagination.totalPages,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
      skills: [],
      total: 0,
      page: 1,
      totalPages: 0,
    };
  }
}

/**
 * Get skill package details from marketplace
 */
export async function getSkillFromMarketplace(
  idOrSlug: string
): Promise<SkillGetResult> {
  try {
    const client = createClient();
    const response = await client.skill.get(idOrSlug);

    return {
      success: true,
      skill: toMarketplaceSkill(response.package),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Skill not found",
    };
  }
}

/**
 * Download skill package from marketplace
 */
export async function downloadSkillFromMarketplace(
  idOrSlug: string,
  version: string | undefined,
  targetDir: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createClient();
    const blob = await client.skill.download(idOrSlug, version);

    await ensureDir(targetDir);

    const zipPath = join(targetDir, "package.zip");
    const buffer = Buffer.from(await blob.arrayBuffer());
    await writeFile(zipPath, buffer);

    const { extractZipToDirectory } = await import("./extract");
    await extractZipToDirectory({
      zipPath,
      targetDir,
      overwrite: true,
      validate: true,
    });

    const { rm } = await import("node:fs/promises");
    await rm(zipPath, { force: true });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

function toMarketplaceSkill(pkg: {
  id: string;
  name: string;
  slug: string;
  version: string;
  description?: string | null;
  author?: { username: string; displayName: string } | null;
  downloadsCount: number;
  favoritesCount: number;
  skillType: "command" | "prompt" | "agent";
}): MarketplaceSkill {
  return {
    id: pkg.id,
    name: pkg.name,
    slug: pkg.slug,
    version: pkg.version,
    description: pkg.description ?? undefined,
    author: pkg.author ?? undefined,
    downloadsCount: pkg.downloadsCount,
    favoritesCount: pkg.favoritesCount,
    skillType: pkg.skillType,
  };
}
```

- [ ] **Step 3: Update skill ops index to export registry**

In `packages/core/src/skill/ops/index.ts`, add:

```typescript
// Registry operations
export {
  searchSkillMarketplace,
  getSkillFromMarketplace,
  downloadSkillFromMarketplace,
} from "./registry";
export type {
  MarketplaceSkill,
  SkillSearchOptions,
  SkillSearchResult,
  SkillGetResult,
} from "./registry";
```

- [ ] **Step 4: Verify skill ops compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/skill/ops/
git commit -m "$(cat <<'EOF'
feat(skill): add registry integration for marketplace

Add marketplace API integration for skills:
- searchSkillMarketplace() for searching
- getSkillFromMarketplace() for details
- downloadSkillFromMarketplace() for downloading

Also add "github" to source types and spec field to entries.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 3: CLI Command Updates

### Task 7: Update MCP CLI command

**Files:**
- Modify: `packages/core/src/cli/commands/mcp.ts`

- [ ] **Step 1: Add package management subcommands**

Add these subcommands to the existing mcp command:

```typescript
// Add imports at top
import {
  installMcp,
  uninstallMcp,
  listMcps,
  getMcp,
  searchMarketplace,
  getFromMarketplace,
  parseInstallSpec,
} from "../../mcp/ops";
import type { McpTarget } from "../../mcp/ops/types";

// Add after existing subcommands:

// mcp search <query> - search marketplace
mcp
  .command("search <query>")
  .description("Search MCP packages in marketplace")
  .option("-l, --limit <n>", "Maximum results", "10")
  .action(async (query: string, options: { limit: string }) => {
    const ctx = getOutputContext(program);
    try {
      const result = await searchMarketplace({
        query,
        limit: parseInt(options.limit, 10),
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      output(
        ctx,
        successResponse({ packages: result.mcps, total: result.total }),
        () => {
          if (result.mcps.length === 0) {
            console.log(chalk.gray(`No packages found for "${query}".`));
            return;
          }

          console.log(chalk.bold(`Search Results for "${query}":`));
          console.log();
          outputTable(
            ctx,
            ["Name", "Version", "Downloads", "Description"],
            result.mcps.map((p) => [
              p.name,
              p.version,
              String(p.downloadsCount),
              truncate(p.description || "-", 40),
            ])
          );
        }
      );
    } catch (error) {
      handleCommandError(ctx, error);
    }
  });

// mcp install <spec> - install package
mcp
  .command("install <spec>")
  .description("Install an MCP package")
  .option("-g, --global", "Install globally (default is project)")
  .option("-f, --force", "Force reinstall")
  .action(
    async (
      spec: string,
      options: {
        global?: boolean;
        force?: boolean;
      }
    ) => {
      const ctx = getOutputContext(program);
      try {
        const target: McpTarget = options.global ? "global" : "project";

        console.log(`Installing ${spec}...`);

        const result = await installMcp({
          spec,
          target,
          force: options.force,
        });

        if (!result.success) {
          throw new Error(result.error || result.message);
        }

        output(ctx, successResponse({ result }), () => {
          outputSuccess(ctx, result.message);
          console.log();
          outputKeyValue(ctx, {
            Name: result.name,
            Version: result.version,
            Path: result.path,
            Target: result.target,
            Source: result.source,
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    }
  );

// mcp uninstall <name> - uninstall package
mcp
  .command("uninstall <name>")
  .description("Uninstall an MCP package")
  .option("-g, --global", "Uninstall from global (default is project)")
  .action(async (name: string, options: { global?: boolean }) => {
    const ctx = getOutputContext(program);
    try {
      const target: McpTarget = options.global ? "global" : "project";

      const result = await uninstallMcp({ name, target });

      if (!result.success) {
        throw new Error(result.error || result.message);
      }

      output(ctx, successResponse({ result }), () => {
        outputSuccess(ctx, result.message);
      });
    } catch (error) {
      handleCommandError(ctx, error);
    }
  });

// mcp download <name> [version] - download without installing
mcp
  .command("download <name> [version]")
  .description("Download an MCP package to current directory")
  .action(async (name: string, version?: string) => {
    const ctx = getOutputContext(program);
    try {
      const { downloadFromMarketplace } = await import("../../mcp/ops");
      const { getFromMarketplace } = await import("../../mcp/ops");

      // Get package info
      const pkgInfo = await getFromMarketplace(name);
      if (!pkgInfo.success || !pkgInfo.mcp) {
        throw new Error(`Package '${name}' not found`);
      }

      const targetDir = join(process.cwd(), pkgInfo.mcp.slug);

      console.log(`Downloading ${name}@${version || pkgInfo.mcp.version}...`);

      const result = await downloadFromMarketplace(
        pkgInfo.mcp.id,
        version,
        targetDir
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      output(ctx, successResponse({ path: targetDir }), () => {
        outputSuccess(ctx, `Downloaded to ${targetDir}`);
      });
    } catch (error) {
      handleCommandError(ctx, error);
    }
  });

// Helper function
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + "...";
}
```

- [ ] **Step 2: Update existing list command**

Modify the existing `mcp list` command to support project/global:

```typescript
// Replace the existing mcp list command
mcp
  .command("list")
  .description("List installed MCP packages")
  .option("-g, --global", "List global packages only")
  .option("-a, --all", "List all packages (project + global)")
  .option("--agent <id>", "List MCP servers for a specific agent")
  .action(
    async (options: { global?: boolean; all?: boolean; agent?: string }) => {
      const ctx = getOutputContext(program);
      try {
        if (options.agent) {
          // Existing agent-specific logic
          const servers = await mcpManager.getAgentServers(options.agent);
          // ... rest of agent logic
        } else {
          // New package listing logic
          let target: McpTarget | undefined;
          if (options.global) {
            target = "global";
          } else if (!options.all) {
            target = "project";
          }

          const result = await listMcps(
            target ? { target } : { all: true }
          );

          if (!result.success) {
            throw new Error(result.error);
          }

          output(
            ctx,
            successResponse({ packages: result.mcps, count: result.count }),
            () => {
              if (result.mcps.length === 0) {
                console.log(chalk.gray("No MCP packages installed."));
                console.log();
                console.log("Install a package with:");
                console.log(chalk.cyan("  viben mcp install <name>"));
                return;
              }

              console.log(chalk.bold("Installed MCP Packages:"));
              console.log();
              outputTable(
                ctx,
                ["Name", "Version", "Target", "Source", "Installed At"],
                result.mcps.map((m) => [
                  m.name,
                  m.version,
                  m.target,
                  m.source || "-",
                  formatDate(m.installed_at),
                ])
              );
            }
          );
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    }
  );
```

- [ ] **Step 3: Verify MCP CLI compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/cli/commands/mcp.ts
git commit -m "$(cat <<'EOF'
feat(cli): add mcp package management commands

Add pip-like package management commands:
- mcp search <query> - search marketplace
- mcp install <spec> - install package (project/global)
- mcp uninstall <name> - uninstall package
- mcp download <name> - download without installing

Supports install specs: name, name@version, gh:user/repo, ./path

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Update Skill CLI command

**Files:**
- Modify: `packages/core/src/cli/commands/skill.ts`

- [ ] **Step 1: Add search subcommand**

Add marketplace search to skill command:

```typescript
// Add imports
import {
  searchSkillMarketplace,
  getSkillFromMarketplace,
} from "../../skill/ops";

// Add search command after existing commands
skill
  .command("search <query>")
  .description("Search skill packages in marketplace")
  .option("-l, --limit <n>", "Maximum results", "10")
  .option("-t, --type <type>", "Filter by type (command, prompt, agent)")
  .action(
    async (
      query: string,
      options: { limit: string; type?: "command" | "prompt" | "agent" }
    ) => {
      const ctx = getOutputContext(program);
      try {
        const result = await searchSkillMarketplace({
          query,
          limit: parseInt(options.limit, 10),
          type: options.type,
        });

        if (!result.success) {
          throw new Error(result.error);
        }

        output(
          ctx,
          successResponse({ skills: result.skills, total: result.total }),
          () => {
            if (result.skills.length === 0) {
              console.log(chalk.gray(`No skills found for "${query}".`));
              return;
            }

            console.log(chalk.bold(`Search Results for "${query}":`));
            console.log();
            outputTable(
              ctx,
              ["Name", "Type", "Version", "Downloads", "Description"],
              result.skills.map((s) => [
                s.name,
                s.skillType,
                s.version,
                String(s.downloadsCount),
                truncate(s.description || "-", 35),
              ])
            );
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    }
  );

// Add download command
skill
  .command("download <name> [version]")
  .description("Download a skill package to current directory")
  .action(async (name: string, version?: string) => {
    const ctx = getOutputContext(program);
    try {
      const { downloadSkillFromMarketplace } = await import("../../skill/ops");

      const pkgInfo = await getSkillFromMarketplace(name);
      if (!pkgInfo.success || !pkgInfo.skill) {
        throw new Error(`Skill '${name}' not found`);
      }

      const targetDir = join(process.cwd(), pkgInfo.skill.slug);

      console.log(`Downloading ${name}@${version || pkgInfo.skill.version}...`);

      const result = await downloadSkillFromMarketplace(
        pkgInfo.skill.id,
        version,
        targetDir
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      output(ctx, successResponse({ path: targetDir }), () => {
        outputSuccess(ctx, `Downloaded to ${targetDir}`);
      });
    } catch (error) {
      handleCommandError(ctx, error);
    }
  });

// Helper function
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + "...";
}
```

- [ ] **Step 2: Update list and install to support project-level**

Update install command to default to project-level:

```typescript
// Update default target in install command
let target: SkillTarget = "global";  // Change to check for project first
if (options.agent) {
  target = "agent";
} else if (options.claude) {
  target = "claude";
} else if (options.path) {
  target = "custom";
} else if (options.global) {
  target = "global";
} else if (options.executor) {
  target = getTargetFromExecutor(options.executor);
}
// Note: Default is "global" for backward compatibility
// Project-level will be added in future when SkillTarget supports it
```

- [ ] **Step 3: Verify skill CLI compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/cli/commands/skill.ts
git commit -m "$(cat <<'EOF'
feat(cli): add skill search and download commands

Add marketplace commands for skills:
- skill search <query> - search marketplace with type filter
- skill download <name> - download skill to current directory

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 4: Tests

### Task 9: Add MCP ops tests

**Files:**
- Create: `packages/core/src/mcp/ops/crud.test.ts`

- [ ] **Step 1: Write CRUD tests**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  installMcp,
  uninstallMcp,
  listMcps,
  getMcp,
  parseInstallSpec,
} from "./crud";

// Mock the registry module
vi.mock("./registry", () => ({
  searchMarketplace: vi.fn(),
  getFromMarketplace: vi.fn(),
  downloadFromMarketplace: vi.fn(),
}));

describe("parseInstallSpec", () => {
  it("parses simple name", () => {
    const result = parseInstallSpec("foo");
    expect(result).toEqual({
      name: "foo",
      source: "marketplace",
    });
  });

  it("parses name@version", () => {
    const result = parseInstallSpec("foo@1.2.3");
    expect(result).toEqual({
      name: "foo",
      version: "1.2.3",
      source: "marketplace",
    });
  });

  it("parses GitHub spec", () => {
    const result = parseInstallSpec("gh:user/repo");
    expect(result).toEqual({
      name: "repo",
      source: "github",
      githubOwner: "user",
      githubRepo: "repo",
      githubRef: undefined,
    });
  });

  it("parses GitHub spec with ref", () => {
    const result = parseInstallSpec("gh:user/repo#v1.0.0");
    expect(result).toEqual({
      name: "repo",
      source: "github",
      githubOwner: "user",
      githubRepo: "repo",
      githubRef: "v1.0.0",
    });
  });

  it("parses relative path", () => {
    const result = parseInstallSpec("./my-package");
    expect(result).toEqual({
      name: "my-package",
      source: "local",
      localPath: "./my-package",
    });
  });

  it("parses absolute path", () => {
    const result = parseInstallSpec("/home/user/my-package");
    expect(result).toEqual({
      name: "my-package",
      source: "local",
      localPath: "/home/user/my-package",
    });
  });
});

describe("MCP CRUD operations", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mcp-test-"));
    // Mock process.cwd to return tempDir
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("installMcp - local source", () => {
    it("installs from local path", async () => {
      // Create a local package
      const localPkgDir = join(tempDir, "local-pkg");
      await mkdir(localPkgDir, { recursive: true });
      await writeFile(
        join(localPkgDir, "package.json"),
        JSON.stringify({ name: "local-pkg", version: "1.0.0" })
      );

      const result = await installMcp({
        spec: localPkgDir,
        target: "project",
      });

      expect(result.success).toBe(true);
      expect(result.name).toBe("local-pkg");
      expect(result.source).toBe("local");
    });

    it("fails for non-existent local path", async () => {
      const result = await installMcp({
        spec: "./non-existent",
        target: "project",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });
  });

  describe("listMcps", () => {
    it("returns empty list when no packages installed", async () => {
      const result = await listMcps({ target: "project" });

      expect(result.success).toBe(true);
      expect(result.mcps).toEqual([]);
      expect(result.count).toBe(0);
    });
  });

  describe("getMcp", () => {
    it("returns not found for non-existent package", async () => {
      const result = await getMcp("non-existent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("uninstallMcp", () => {
    it("fails for non-existent package", async () => {
      const result = await uninstallMcp({
        name: "non-existent",
        target: "project",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd packages/core && pnpm test src/mcp/ops/crud.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/mcp/ops/crud.test.ts
git commit -m "$(cat <<'EOF'
test(mcp): add CRUD operations tests

Add tests for MCP package management:
- parseInstallSpec() format parsing
- installMcp() local installation
- listMcps() empty list handling
- getMcp() not found handling
- uninstallMcp() not found handling

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Update existing MCP tests

**Files:**
- Modify: `packages/core/src/cli/commands/mcp-execution.test.ts`

- [ ] **Step 1: Add tests for new commands**

Add tests for search, install, uninstall commands to the existing test file.

- [ ] **Step 2: Run all MCP tests**

Run: `cd packages/core && pnpm test src/mcp`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/cli/commands/mcp-execution.test.ts
git commit -m "$(cat <<'EOF'
test(cli): add mcp package management command tests

Add CLI execution tests for new mcp commands:
- mcp search
- mcp install
- mcp uninstall
- mcp download

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 5: Integration and Documentation

### Task 11: Update MCP module exports

**Files:**
- Modify: `packages/core/src/mcp/index.ts`

- [ ] **Step 1: Export ops module**

```typescript
// Add at end of file
export * from "./ops";
```

- [ ] **Step 2: Verify exports compile**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/mcp/index.ts
git commit -m "$(cat <<'EOF'
feat(mcp): export ops module from main entry

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Final integration test

**Files:**
- None (manual testing)

- [ ] **Step 1: Build the package**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds

- [ ] **Step 2: Test CLI commands**

```bash
# Test mcp commands
viben mcp list
viben mcp search "file"
viben mcp install ./test-package  # Create a test local package first

# Test skill commands
viben skill list
viben skill search "git"
```

- [ ] **Step 3: Run full test suite**

Run: `cd packages/core && pnpm test`
Expected: All tests pass

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(mcp): integration fixes from manual testing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This plan implements:

1. **MCP ops module** (`packages/core/src/mcp/ops/`)
   - Types, paths, CRUD, registry integration
   - Mirrors skill/ops structure

2. **Skill ops extension**
   - Registry integration for marketplace
   - GitHub source support

3. **CLI commands**
   - `viben mcp search/install/uninstall/download`
   - `viben skill search/download`

4. **Tests**
   - Unit tests for CRUD operations
   - CLI execution tests

Total: 12 tasks across 5 chunks
