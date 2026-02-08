/**
 * Scope management for Viben CLI
 *
 * Handles workspace detection, scope resolution, and path management.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ConfigScope } from '../types';
import { CliError } from '../types';

/**
 * Workspace directory name (.viben)
 */
export const WORKSPACE_DIR = '.viben';

/**
 * Config file name
 */
export const CONFIG_FILE = 'config.yaml';

/**
 * Get the global config directory path (~/.viben)
 * Supports VIBEN_STATE_DIR environment variable override
 */
export function getGlobalConfigDir(): string {
  return process.env.VIBEN_STATE_DIR || path.join(os.homedir(), WORKSPACE_DIR);
}

/**
 * Alias for getGlobalConfigDir for backward compatibility
 */
export const GLOBAL_CONFIG_DIR = getGlobalConfigDir();

/**
 * Get the state directory (same as global config dir)
 */
export function getStateDir(): string {
  return getGlobalConfigDir();
}

/**
 * Find the workspace root directory by traversing up from the given directory
 * Returns null if no workspace is found
 */
export function findWorkspaceRoot(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const vibenDir = path.join(currentDir, WORKSPACE_DIR);
    const configPath = path.join(vibenDir, CONFIG_FILE);

    if (fs.existsSync(configPath)) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Get the workspace directory (.viben) for the current directory
 * Returns null if not in a workspace
 */
export function getWorkspaceDir(): string | null {
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  if (workspaceRoot) {
    return path.join(workspaceRoot, WORKSPACE_DIR);
  }
  return null;
}

/**
 * Options for resolving scope
 */
export interface ResolveScopeOptions {
  global?: boolean;
  workspace?: boolean;
}

/**
 * Resolve the configuration scope based on options and environment
 *
 * Priority:
 * 1. Command line flags (--global or --workspace)
 * 2. Environment variable VIBEN_SCOPE
 * 3. Auto-detect based on current directory
 */
export function resolveScope(options: ResolveScopeOptions = {}): ConfigScope {
  // 1. Explicit flags
  if (options.global) {
    return 'global';
  }
  if (options.workspace) {
    return 'workspace';
  }

  // 2. Environment variable
  const envScope = process.env.VIBEN_SCOPE;
  if (envScope === 'global' || envScope === 'workspace') {
    return envScope;
  }

  // 3. Auto-detect: check if we're in a workspace
  const workspaceDir = getWorkspaceDir();
  if (workspaceDir) {
    return 'workspace';
  }

  // Default to global
  return 'global';
}

/**
 * Get the config file path for a given scope
 */
export function getConfigPathForScope(scope: ConfigScope): string {
  if (scope === 'workspace') {
    const workspaceDir = getWorkspaceDir();
    if (!workspaceDir) {
      throw new CliError(
        'Not in a workspace. Use --global or run "viben init" first.',
        'NO_WORKSPACE'
      );
    }
    return path.join(workspaceDir, CONFIG_FILE);
  }

  // Global scope
  const globalDir = getGlobalConfigDir();
  return path.join(globalDir, CONFIG_FILE);
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
