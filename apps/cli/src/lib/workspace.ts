/**
 * Workspace management for Viben CLI
 *
 * Handles workspace detection, listing, and information retrieval.
 * Uses NAPI bindings to viben-core for all operations.
 */

import {
  workspaceList,
  workspaceGetCurrent,
  workspaceGetCurrentPath,
  workspaceIsInWorkspace,
  workspaceGetInfo,
  workspaceAddKnown,
  workspaceRemoveKnown,
  workspaceFindRoot,
  workspaceInit,
  type NativeWorkspaceInfo,
  type InitWorkspaceOptions,
  type InitWorkspaceResult,
} from './native';

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

// Re-export types
export type { InitWorkspaceOptions, InitWorkspaceResult };

/**
 * Convert native workspace info to CLI workspace info
 */
function toWorkspaceInfo(native: NativeWorkspaceInfo): WorkspaceInfo {
  return {
    path: native.path,
    name: native.name,
    configPath: native.configPath,
    mcp: native.mcp ? {
      enabled: native.mcp.enabled,
      disabled: native.mcp.disabled,
    } : undefined,
    skills: native.skills ? {
      enabled: native.skills.enabled,
      disabled: native.skills.disabled,
    } : undefined,
    agents: native.agents,
    createdAt: native.createdAt,
    updatedAt: native.updatedAt,
  };
}

/**
 * List all known workspaces with their info
 */
export function listWorkspaces(): WorkspaceInfo[] {
  return workspaceList().map(toWorkspaceInfo);
}

/**
 * Get current workspace info (if in a workspace)
 */
export function getCurrentWorkspace(): WorkspaceInfo | null {
  const native = workspaceGetCurrent();
  return native ? toWorkspaceInfo(native) : null;
}

/**
 * Get current workspace path (if in a workspace)
 */
export function getCurrentWorkspacePath(): string | null {
  return workspaceGetCurrentPath();
}

/**
 * Check if currently in a workspace
 */
export function isInWorkspace(): boolean {
  return workspaceIsInWorkspace();
}

/**
 * Get workspace info for a given path
 */
export function getWorkspaceInfo(workspacePath: string): WorkspaceInfo | null {
  const native = workspaceGetInfo(workspacePath);
  return native ? toWorkspaceInfo(native) : null;
}

/**
 * Add a workspace to known workspaces
 */
export function addKnownWorkspace(workspacePath: string, name?: string): void {
  workspaceAddKnown(workspacePath, name);
}

/**
 * Remove a workspace from known workspaces
 */
export function removeKnownWorkspace(workspacePath: string): void {
  workspaceRemoveKnown(workspacePath);
}

/**
 * Find workspace root from a given path
 */
export function findWorkspaceRootFromPath(startPath: string): string | null {
  return workspaceFindRoot(startPath);
}

/**
 * Initialize a workspace
 */
export function initWorkspace(options?: InitWorkspaceOptions): InitWorkspaceResult {
  return workspaceInit(options);
}
