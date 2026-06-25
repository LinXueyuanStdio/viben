/**
 * Skill Installation Handler
 *
 * Desktop app utilities for downloading and installing skill packages.
 * Uses Viben Gateway API for skill installation (not direct @viben/core import).
 */

import type { SkillPackage } from '@viben/api-client';
import { getGatewayClient } from './gateway';
import { appDataDir, join } from '@tauri-apps/api/path';
import i18n from '@/i18n';

// ============================================
// Types
// ============================================

/**
 * Installation progress stages
 */
export type InstallStage = 'downloading' | 'extracting' | 'complete' | 'error';

/**
 * Installation progress callback
 */
export interface InstallProgress {
  /** Current installation stage */
  stage: InstallStage;
  /** Progress percentage (0-100) */
  progress: number;
  /** Optional status message */
  message?: string;
  /** Error message if stage is 'error' */
  error?: string;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: InstallProgress) => void;

/**
 * Options for skill installation
 */
export type InstallableSkillPackage = Pick<SkillPackage, "id" | "name" | "slug" | "version">;

export interface InstallSkillOptions {
  /** Skill package to install */
  package: InstallableSkillPackage;
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Force reinstall if already exists */
  force?: boolean;
}

/**
 * Options for ClaWHub skill installation
 */
export interface InstallClawhubSkillOptions {
  /** ClaWHub package slug */
  slug: string;
  /** Display name */
  name: string;
  /** Version to install */
  version: string;
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Force reinstall if already exists */
  force?: boolean;
}

/**
 * Error codes for skill installation failures
 */
export type InstallErrorCode =
  | 'ALREADY_EXISTS'
  | 'FILE_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'PERMISSION_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Result of skill installation
 */
export interface InstallSkillResult {
  /** Whether installation was successful */
  success: boolean;
  /** Installed skill name */
  name: string;
  /** Installed skill version */
  version: string;
  /** Path to the installed skill */
  path: string;
  /** Result message */
  message: string;
  /** Error message if installation failed */
  error?: string;
  /** Structured error code for programmatic handling */
  errorCode?: InstallErrorCode;
}

/**
 * Gateway skill install response
 */
interface GatewayInstallResponse {
  success: boolean;
  name: string;
  version: string;
  path: string;
  message: string;
  error?: string;
}

function isUnknownClawhubVersion(version: string): boolean {
  const normalized = version.trim();
  return normalized === "" || normalized === "0.0.0";
}

// ============================================
// Installation
// ============================================

function getInstallErrorCode(errorMessage: string): InstallErrorCode {
  const normalized = errorMessage.toLowerCase();

  if (errorMessage.includes('ALREADY_EXISTS') || normalized.includes('already exists')) {
    return 'ALREADY_EXISTS';
  }
  if (errorMessage.includes('FILE_CONFLICT')) {
    return 'FILE_CONFLICT';
  }
  if (
    errorMessage.includes('VALIDATION_ERROR') ||
    normalized.includes('invalid') ||
    normalized.includes('corrupt') ||
    normalized.includes('zip')
  ) {
    return 'VALIDATION_ERROR';
  }
  if (
    errorMessage.includes('NETWORK_ERROR') ||
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('download')
  ) {
    return 'NETWORK_ERROR';
  }
  if (
    errorMessage.includes('PERMISSION_ERROR') ||
    normalized.includes('permission') ||
    normalized.includes('access') ||
    errorMessage.includes('EACCES')
  ) {
    return 'PERMISSION_ERROR';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Download and install a skill package
 *
 * This function:
 * 1. Requests Gateway to download the skill package from the platform
 * 2. Gateway installs the skill through the shared core implementation
 * 3. Tracks progress through callbacks
 *
 * @param options - Installation options
 * @returns Installation result
 *
 * @example
 * ```ts
 * const result = await downloadAndInstallSkill({
 *   package: skillPackage,
 *   onProgress: (progress) => {
 *     console.log(`${progress.stage}: ${progress.progress}%`);
 *   },
 *   force: false,
 * });
 *
 * if (result.success) {
 *   console.log('Installed to:', result.path);
 * } else {
 *   console.error('Installation failed:', result.error);
 * }
 * ```
 */
export async function downloadAndInstallSkill(
  options: InstallSkillOptions
): Promise<InstallSkillResult> {
  const { package: pkg, onProgress, force = false } = options;

  try {
    // Report download start
    onProgress?.({
      stage: 'downloading',
      progress: 0,
      message: i18n.t('installation.downloading', { name: pkg.name }),
    });

    // Report extraction start
    onProgress?.({
      stage: 'extracting',
      progress: 0,
      message: i18n.t('installation.extractingPackage'),
    });

    // Call Gateway API to install the skill
    const result = await getGatewayClient().post<GatewayInstallResponse>(
      '/api/skill/install',
      {
        name: pkg.slug,
        force,
        version: pkg.version,
        registry: "viben",
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Installation failed');
    }

    // Report completion
    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: i18n.t('installation.complete'),
    });

    return {
      success: true,
      name: result.name,
      version: result.version,
      path: result.path,
      message: result.message,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : i18n.t('common.unknownError');

    const errorCode = getInstallErrorCode(errorMessage);

    // Report error
    onProgress?.({
      stage: 'error',
      progress: 0,
      message: i18n.t('installation.failed'),
      error: errorMessage,
    });

    return {
      success: false,
      name: pkg.name,
      version: pkg.version,
      path: '',
      message: i18n.t('installation.failed'),
      error: errorMessage,
      errorCode,
    };
  }
}

/**
 * Download and install a ClaWHub skill package
 */
export async function downloadAndInstallClawhubSkill(
  options: InstallClawhubSkillOptions
): Promise<InstallSkillResult> {
  const { slug, name, version, onProgress, force = false } = options;

  try {
    onProgress?.({
      stage: 'downloading',
      progress: 0,
      message: i18n.t('installation.downloading', { name }),
    });

    onProgress?.({
      stage: 'extracting',
      progress: 0,
      message: i18n.t('installation.extractingPackage'),
    });

    const result = await getGatewayClient().post<GatewayInstallResponse>(
      '/api/skill/install',
      {
        name: slug,
        force,
        version: isUnknownClawhubVersion(version) ? undefined : version,
        registry: "clawhub",
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Installation failed');
    }

    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: i18n.t('installation.complete'),
    });

    return {
      success: true,
      name: result.name,
      version: result.version,
      path: result.path,
      message: result.message,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : i18n.t('common.unknownError');
    const errorCode = getInstallErrorCode(errorMessage);

    onProgress?.({
      stage: 'error',
      progress: 0,
      message: i18n.t('installation.failed'),
      error: errorMessage,
    });

    return {
      success: false,
      name,
      version,
      path: '',
      message: i18n.t('installation.failed'),
      error: errorMessage,
      errorCode,
    };
  }
}

/**
 * Check if a skill is already installed
 *
 * @param skillSlug - Skill slug to check
 * @returns Whether the skill is installed
 */
export async function isSkillInstalled(skillSlug: string): Promise<boolean> {
  try {
    const data = await getGatewayClient().get<{ packages: Array<{ id: string }> }>('/api/packages/skills');
    return data.packages.some(pkg => pkg.id === skillSlug);
  } catch {
    return false;
  }
}

/**
 * Get installed skills directory path
 *
 * @returns Path to the skills directory
 */
export async function getSkillsDirectory(): Promise<string> {
  const dataDir = await appDataDir();
  return join(dataDir, 'skills');
}
