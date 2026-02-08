/**
 * Workspace management for Viben CLI
 *
 * Handles workspace detection, listing, and information retrieval.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { getStateDir, getWorkspaceDir, findWorkspaceRoot, CONFIG_FILE } from './scope';

/**
 * Workspace information
 */
export interface WorkspaceInfo {
  path: string;
  name: string;
  configPath: string;
  mcp?: {
    enabled: string[];
    disabled?: string[];
  };
  skills?: {
    enabled: string[];
    disabled?: string[];
  };
  agents?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Known workspaces storage file
 */
const KNOWN_WORKSPACES_FILE = 'workspaces.yaml';

/**
 * Known workspaces structure
 */
interface KnownWorkspaces {
  version: number;
  workspaces: Array<{
    path: string;
    name?: string;
    lastAccessed?: string;
  }>;
}

/**
 * Get the path to known workspaces file
 */
function getKnownWorkspacesPath(): string {
  return path.join(getStateDir(), KNOWN_WORKSPACES_FILE);
}

/**
 * Read known workspaces from state directory
 */
export function readKnownWorkspaces(): KnownWorkspaces {
  const filePath = getKnownWorkspacesPath();

  if (!fs.existsSync(filePath)) {
    return { version: 1, workspaces: [] };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return yaml.parse(content) as KnownWorkspaces;
  } catch {
    return { version: 1, workspaces: [] };
  }
}

/**
 * Write known workspaces to state directory
 */
export function writeKnownWorkspaces(workspaces: KnownWorkspaces): void {
  const filePath = getKnownWorkspacesPath();
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const content = yaml.stringify(workspaces, { indent: 2 });
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Add a workspace to known workspaces
 */
export function addKnownWorkspace(workspacePath: string, name?: string): void {
  const known = readKnownWorkspaces();
  const normalizedPath = path.resolve(workspacePath);

  // Check if already exists
  const existingIndex = known.workspaces.findIndex((w) => w.path === normalizedPath);

  if (existingIndex >= 0) {
    // Update existing
    known.workspaces[existingIndex].lastAccessed = new Date().toISOString();
    if (name) {
      known.workspaces[existingIndex].name = name;
    }
  } else {
    // Add new
    known.workspaces.push({
      path: normalizedPath,
      name,
      lastAccessed: new Date().toISOString(),
    });
  }

  writeKnownWorkspaces(known);
}

/**
 * Remove a workspace from known workspaces
 */
export function removeKnownWorkspace(workspacePath: string): void {
  const known = readKnownWorkspaces();
  const normalizedPath = path.resolve(workspacePath);

  known.workspaces = known.workspaces.filter((w) => w.path !== normalizedPath);
  writeKnownWorkspaces(known);
}

/**
 * Get workspace info for a given path
 */
export function getWorkspaceInfo(workspacePath: string): WorkspaceInfo | null {
  const vibenDir = path.join(workspacePath, '.viben');
  const configPath = path.join(vibenDir, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.parse(content) as Record<string, unknown>;
    const stat = fs.statSync(configPath);

    return {
      path: workspacePath,
      name: path.basename(workspacePath),
      configPath,
      mcp: config.mcp as WorkspaceInfo['mcp'],
      skills: config.skills as WorkspaceInfo['skills'],
      agents: config.agents as string[],
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * List all known workspaces with their info
 */
export function listWorkspaces(): WorkspaceInfo[] {
  const known = readKnownWorkspaces();
  const workspaces: WorkspaceInfo[] = [];

  for (const entry of known.workspaces) {
    const info = getWorkspaceInfo(entry.path);
    if (info) {
      // Override name if specified in known workspaces
      if (entry.name) {
        info.name = entry.name;
      }
      workspaces.push(info);
    }
  }

  return workspaces;
}

/**
 * Get current workspace info (if in a workspace)
 */
export function getCurrentWorkspace(): WorkspaceInfo | null {
  const workspaceRoot = findWorkspaceRoot(process.cwd());

  if (!workspaceRoot) {
    return null;
  }

  return getWorkspaceInfo(workspaceRoot);
}

/**
 * Check if currently in a workspace
 */
export function isInWorkspace(): boolean {
  return findWorkspaceRoot(process.cwd()) !== null;
}

/**
 * Get current workspace path (if in a workspace)
 */
export function getCurrentWorkspacePath(): string | null {
  return findWorkspaceRoot(process.cwd());
}
