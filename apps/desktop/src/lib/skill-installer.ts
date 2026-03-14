/**
 * Skill Installation Handler
 *
 * Desktop app utilities for downloading and installing skill packages.
 * Integrates with Viben API client for downloads and core skills manager for extraction.
 */

import { getClient } from './viben';
import type { SkillPackage } from '@viben/api-client';
import { skillsManager } from '@viben/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { mkdir, writeFile, exists, remove } from '@tauri-apps/plugin-fs';
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
export interface InstallSkillOptions {
  /** Skill package to install */
  package: SkillPackage;
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

// ============================================
// Installation
// ============================================

/**
 * Download and install a skill package
 *
 * This function:
 * 1. Downloads the skill package from the platform
 * 2. Saves it to a temporary file
 * 3. Extracts it using the core skills manager
 * 4. Tracks progress through callbacks
 * 5. Cleans up temporary files
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

  // Declare tempZipPath outside try block to ensure cleanup in finally
  let tempZipPath: string | undefined;

  try {
    // Report download start
    onProgress?.({
      stage: 'downloading',
      progress: 0,
      message: i18n.t('installation.downloading', { name: pkg.name }),
    });

    // Download package
    const api = getClient();
    const blob = await api.skills.download(pkg.id);

    // Report download complete
    onProgress?.({
      stage: 'downloading',
      progress: 100,
      message: i18n.t('installation.downloadComplete'),
    });

    // Get app data directory
    const dataDir = await appDataDir();
    const tempDir = await join(dataDir, 'temp');
    const skillsDir = await join(dataDir, 'skills');

    // Ensure directories exist
    if (!(await exists(tempDir))) {
      await mkdir(tempDir, { recursive: true });
    }
    if (!(await exists(skillsDir))) {
      await mkdir(skillsDir, { recursive: true });
    }

    // Save to temporary file
    tempZipPath = await join(tempDir, `${pkg.slug}-${pkg.version}.zip`);
    const arrayBuffer = await blob.arrayBuffer();
    await writeFile(tempZipPath, new Uint8Array(arrayBuffer));

    // Report extraction start
    onProgress?.({
      stage: 'extracting',
      progress: 0,
      message: i18n.t('installation.extractingPackage'),
    });

    // Extract using core skills manager
    const result = await skillsManager.installSkill({
      name: pkg.slug,
      target: 'global',
      zipPath: tempZipPath,
      force,
      onProgress: (extractProgress: number) => {
        onProgress?.({
          stage: 'extracting',
          progress: extractProgress,
          message: i18n.t('installation.extractingFiles'),
        });
      },
    });

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

    // Determine structured error code from the error
    let errorCode: InstallErrorCode = 'UNKNOWN_ERROR';
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code: string }).code;
      if (code === 'ALREADY_EXISTS') {
        errorCode = 'ALREADY_EXISTS';
      } else if (code === 'FILE_CONFLICT') {
        errorCode = 'FILE_CONFLICT';
      } else if (code === 'VALIDATION_ERROR') {
        errorCode = 'VALIDATION_ERROR';
      }
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('download')) {
      errorCode = 'NETWORK_ERROR';
    } else if (errorMessage.includes('permission') || errorMessage.includes('access') || errorMessage.includes('EACCES')) {
      errorCode = 'PERMISSION_ERROR';
    }

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
  } finally {
    // Clean up temporary file regardless of success or failure
    if (tempZipPath) {
      try {
        await remove(tempZipPath);
      } catch {
        // Ignore cleanup errors
      }
    }
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
    const dataDir = await appDataDir();
    const skillsDir = await join(dataDir, 'skills');
    const skillDir = await join(skillsDir, skillSlug);

    return await exists(skillDir);
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
