/**
 * Viben Platform Integration
 *
 * Desktop app utilities for consuming the Viben platform API.
 * Provides client initialization, package management, and workspace sync.
 */

import {
  VibenClient,
  type McpPackage,
  type SkillPackage,
  type PaginatedResponse,
} from '@viben/api-client';
import { appDataDir, join } from '@tauri-apps/api/path';
import { mkdir, writeFile, exists } from '@tauri-apps/plugin-fs';

// ============================================
// Configuration
// ============================================

/**
 * Default platform URL
 */
const PLATFORM_URL = 'https://viben-web.vercel.app';

/**
 * Singleton client instance
 */
let client: VibenClient | null = null;

// ============================================
// Client Management
// ============================================

/**
 * Initialize the API client with optional API key
 *
 * @param apiKey - Optional API key for authenticated requests
 * @returns The initialized client instance
 *
 * @example
 * ```ts
 * // Initialize without auth (public endpoints only)
 * const client = initClient();
 *
 * // Initialize with API key
 * const client = initClient('bmcp_xxx...');
 * ```
 */
export function initClient(apiKey?: string): VibenClient {
  client = new VibenClient({
    baseUrl: PLATFORM_URL,
    apiKey,
    timeout: 30000,
  });
  return client;
}

/**
 * Get the current client instance, creating one if needed
 *
 * @returns The client instance
 */
export function getClient(): VibenClient {
  if (!client) {
    client = new VibenClient({ baseUrl: PLATFORM_URL });
  }
  return client;
}

/**
 * Set the API key on the current client
 *
 * @param apiKey - API key to set, or undefined to clear
 */
export function setClientApiKey(apiKey: string | undefined): void {
  const c = getClient();
  c.setApiKey(apiKey);
}

// ============================================
// Package Search
// ============================================

/**
 * Search for packages on the platform
 *
 * @param query - Search query string
 * @param type - Package type to search ('mcp' or 'skill')
 * @returns Paginated response with matching packages
 *
 * @example
 * ```ts
 * // Search MCP packages
 * const mcpResults = await searchPackages('search', 'mcp');
 *
 * // Search skills
 * const skillResults = await searchPackages('git', 'skill');
 * ```
 */
export async function searchPackages(
  query: string,
  type: 'mcp' | 'skill' = 'mcp'
): Promise<PaginatedResponse<McpPackage> | PaginatedResponse<SkillPackage>> {
  const api = getClient();
  if (type === 'mcp') {
    return api.mcp.search(query);
  }
  return api.skill.search(query);
}

/**
 * List packages from the platform
 *
 * @param type - Package type ('mcp' or 'skill')
 * @param params - Optional pagination and filtering parameters
 * @returns Paginated response with packages
 */
export async function listPackages(
  type: 'mcp' | 'skill' = 'mcp',
  params?: {
    page?: number;
    limit?: number;
    category?: string;
    sort?: 'latest' | 'popular' | 'downloads';
  }
): Promise<PaginatedResponse<McpPackage> | PaginatedResponse<SkillPackage>> {
  const api = getClient();
  if (type === 'mcp') {
    return api.mcp.list(params);
  }
  return api.skill.list(params);
}

// ============================================
// Package Installation
// ============================================

/**
 * Install an MCP package to the local app data directory
 *
 * @param pkg - MCP package to install
 * @returns Path to the installed package directory
 *
 * @example
 * ```ts
 * const packagePath = await installMcpPackage(pkg);
 * console.log('Installed to:', packagePath);
 * ```
 */
export async function installMcpPackage(pkg: McpPackage): Promise<string> {
  const api = getClient();

  // Download package
  const blob = await api.mcp.download(pkg.id);

  // Get app data directory
  const dataDir = await appDataDir();
  const packagesDir = await join(dataDir, 'packages', 'mcp');
  const packageDir = await join(packagesDir, pkg.slug);

  // Ensure directory exists
  if (!(await exists(packagesDir))) {
    await mkdir(packagesDir, { recursive: true });
  }

  if (!(await exists(packageDir))) {
    await mkdir(packageDir, { recursive: true });
  }

  // Save archive
  const zipPath = await join(packageDir, `${pkg.slug}-${pkg.version}.zip`);
  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(zipPath, new Uint8Array(arrayBuffer));

  // TODO: Extract zip to packageDir using unzip command or library

  return packageDir;
}

/**
 * Install a skill package to the local app data directory
 *
 * @param pkg - Skill package to install
 * @returns Path to the installed package directory
 */
export async function installSkillPackage(pkg: SkillPackage): Promise<string> {
  const api = getClient();

  const blob = await api.skill.download(pkg.id);

  const dataDir = await appDataDir();
  const packagesDir = await join(dataDir, 'packages', 'skills');
  const packageDir = await join(packagesDir, pkg.slug);

  if (!(await exists(packagesDir))) {
    await mkdir(packagesDir, { recursive: true });
  }

  if (!(await exists(packageDir))) {
    await mkdir(packageDir, { recursive: true });
  }

  const zipPath = await join(packageDir, `${pkg.slug}-${pkg.version}.zip`);
  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(zipPath, new Uint8Array(arrayBuffer));

  return packageDir;
}

// ============================================
// Workspace Sync
// ============================================

/**
 * Result of workspace sync operation
 */
export interface WorkspaceSyncResult {
  /** Enabled MCP packages */
  mcps: McpPackage[];
  /** Enabled skill packages */
  skills: SkillPackage[];
  /** Package configurations */
  configs: Array<{
    packageId: string;
    packageType: 'mcp' | 'skill';
    config: Record<string, unknown> | null;
    enabled: boolean;
  }>;
}

/**
 * Sync packages from a workspace
 *
 * Fetches all enabled packages from a workspace for local installation.
 *
 * @param workspaceId - ID of the workspace to sync
 * @returns Enabled packages and their configurations
 *
 * @example
 * ```ts
 * const { mcps, skills, configs } = await syncWorkspace(workspaceId);
 *
 * // Install enabled MCPs
 * for (const mcp of mcps) {
 *   await installMcpPackage(mcp);
 * }
 * ```
 */
export async function syncWorkspace(
  workspaceId: string
): Promise<WorkspaceSyncResult> {
  const api = getClient();

  const { packages, configs } = await api.workspaces.packages(workspaceId);

  // Filter to only enabled packages
  const enabledMcps = packages.mcp.filter((pkg) => {
    const config = configs.find(
      (c) => c.packageId === pkg.id && c.packageType === 'mcp'
    );
    return config?.enabled !== false;
  });

  const enabledSkills = packages.skills.filter((pkg) => {
    const config = configs.find(
      (c) => c.packageId === pkg.id && c.packageType === 'skill'
    );
    return config?.enabled !== false;
  });

  return {
    mcps: enabledMcps,
    skills: enabledSkills,
    configs,
  };
}

// ============================================
// Authentication
// ============================================

/**
 * Set API key and verify it works
 *
 * @param apiKey - API key to set and verify
 * @returns true if key is valid, false otherwise
 *
 * @example
 * ```ts
 * const isValid = await setApiKey('bmcp_xxx...');
 * if (isValid) {
 *   console.log('API key is valid');
 * } else {
 *   console.log('Invalid API key');
 * }
 * ```
 */
export async function setApiKey(apiKey: string): Promise<boolean> {
  initClient(apiKey);

  try {
    // Verify key by fetching user info
    await getClient().user.me();
    return true;
  } catch {
    // Invalid key, reset to unauthenticated client
    client = new VibenClient({ baseUrl: PLATFORM_URL });
    return false;
  }
}

/**
 * Clear the current API key
 */
export function clearApiKey(): void {
  initClient(undefined);
}

/**
 * Check if the client has a valid API key set
 *
 * @returns true if an API key is configured
 */
export function hasApiKey(): boolean {
  return !!getClient().getApiKey();
}

// ============================================
// Export types for convenience
// ============================================

export type {
  McpPackage,
  SkillPackage,
  PaginatedResponse,
  Workspace,
  User,
} from '@viben/api-client';
