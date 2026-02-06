/**
 * Unit tests for lib/scope.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WORKSPACE_DIR,
  CONFIG_FILE,
  getGlobalConfigDir,
  getStateDir,
  findWorkspaceRoot,
  getWorkspaceDir,
  resolveScope,
  getConfigPathForScope,
  ensureDir,
} from '../../src/lib/scope';

describe('scope.ts', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    // Create temp directory for tests
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-test-')));
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    process.chdir(originalCwd);

    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('constants', () => {
    it('should export WORKSPACE_DIR as .viben', () => {
      expect(WORKSPACE_DIR).toBe('.viben');
    });

    it('should export CONFIG_FILE as config.yaml', () => {
      expect(CONFIG_FILE).toBe('config.yaml');
    });
  });

  describe('getGlobalConfigDir', () => {
    it('should return ~/.viben by default', () => {
      delete process.env.VIBEN_STATE_DIR;
      const result = getGlobalConfigDir();
      expect(result).toBe(path.join(os.homedir(), '.viben'));
    });

    it('should respect VIBEN_STATE_DIR environment variable', () => {
      const customDir = path.join(tempDir, 'custom-state');
      process.env.VIBEN_STATE_DIR = customDir;
      const result = getGlobalConfigDir();
      expect(result).toBe(customDir);
    });
  });

  describe('getStateDir', () => {
    it('should return the same as getGlobalConfigDir', () => {
      delete process.env.VIBEN_STATE_DIR;
      expect(getStateDir()).toBe(getGlobalConfigDir());
    });
  });

  describe('findWorkspaceRoot', () => {
    it('should return null when no workspace exists', () => {
      const result = findWorkspaceRoot(tempDir);
      expect(result).toBeNull();
    });

    it('should find workspace in current directory', () => {
      // Create workspace
      const vibenDir = path.join(tempDir, WORKSPACE_DIR);
      fs.mkdirSync(vibenDir, { recursive: true });
      fs.writeFileSync(path.join(vibenDir, CONFIG_FILE), 'version: 1');

      const result = findWorkspaceRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it('should find workspace in parent directory', () => {
      // Create workspace in temp dir
      const vibenDir = path.join(tempDir, WORKSPACE_DIR);
      fs.mkdirSync(vibenDir, { recursive: true });
      fs.writeFileSync(path.join(vibenDir, CONFIG_FILE), 'version: 1');

      // Create nested directory
      const nestedDir = path.join(tempDir, 'sub', 'nested');
      fs.mkdirSync(nestedDir, { recursive: true });

      const result = findWorkspaceRoot(nestedDir);
      expect(result).toBe(tempDir);
    });

    it('should not find workspace without config file', () => {
      // Create .viben directory but no config file
      const vibenDir = path.join(tempDir, WORKSPACE_DIR);
      fs.mkdirSync(vibenDir, { recursive: true });

      const result = findWorkspaceRoot(tempDir);
      expect(result).toBeNull();
    });
  });

  describe('getWorkspaceDir', () => {
    it('should return null when not in a workspace', () => {
      process.chdir(tempDir);
      const result = getWorkspaceDir();
      expect(result).toBeNull();
    });

    it('should return .viben directory path when in a workspace', () => {
      // Create workspace
      const vibenDir = path.join(tempDir, WORKSPACE_DIR);
      fs.mkdirSync(vibenDir, { recursive: true });
      fs.writeFileSync(path.join(vibenDir, CONFIG_FILE), 'version: 1');

      process.chdir(tempDir);
      const result = getWorkspaceDir();
      expect(result).toBe(vibenDir);
    });
  });

  describe('resolveScope', () => {
    it('should return global when --global flag is set', () => {
      const result = resolveScope({ global: true });
      expect(result).toBe('global');
    });

    it('should return workspace when --workspace flag is set', () => {
      const result = resolveScope({ workspace: true });
      expect(result).toBe('workspace');
    });

    it('should prefer global over workspace when both are set', () => {
      const result = resolveScope({ global: true, workspace: true });
      expect(result).toBe('global');
    });

    it('should respect VIBEN_SCOPE environment variable', () => {
      process.env.VIBEN_SCOPE = 'workspace';
      const result = resolveScope({});
      expect(result).toBe('workspace');
    });

    it('should auto-detect workspace when in one', () => {
      // Create workspace
      const vibenDir = path.join(tempDir, WORKSPACE_DIR);
      fs.mkdirSync(vibenDir, { recursive: true });
      fs.writeFileSync(path.join(vibenDir, CONFIG_FILE), 'version: 1');

      process.chdir(tempDir);
      delete process.env.VIBEN_SCOPE;
      const result = resolveScope({});
      expect(result).toBe('workspace');
    });

    it('should default to global when not in a workspace', () => {
      process.chdir(tempDir);
      delete process.env.VIBEN_SCOPE;
      const result = resolveScope({});
      expect(result).toBe('global');
    });
  });

  describe('getConfigPathForScope', () => {
    it('should return global config path for global scope', () => {
      const customDir = path.join(tempDir, 'state');
      process.env.VIBEN_STATE_DIR = customDir;

      const result = getConfigPathForScope('global');
      expect(result).toBe(path.join(customDir, CONFIG_FILE));
    });

    it('should return workspace config path for workspace scope', () => {
      // Create workspace
      const vibenDir = path.join(tempDir, WORKSPACE_DIR);
      fs.mkdirSync(vibenDir, { recursive: true });
      fs.writeFileSync(path.join(vibenDir, CONFIG_FILE), 'version: 1');

      process.chdir(tempDir);
      const result = getConfigPathForScope('workspace');
      expect(result).toBe(path.join(vibenDir, CONFIG_FILE));
    });

    it('should throw when requesting workspace scope without a workspace', () => {
      process.chdir(tempDir);
      expect(() => getConfigPathForScope('workspace')).toThrow();
    });
  });

  describe('ensureDir', () => {
    it('should create a directory if it does not exist', () => {
      const newDir = path.join(tempDir, 'new', 'nested', 'dir');
      expect(fs.existsSync(newDir)).toBe(false);

      ensureDir(newDir);
      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      fs.mkdirSync(path.join(tempDir, 'existing'));
      expect(() => ensureDir(path.join(tempDir, 'existing'))).not.toThrow();
    });
  });
});
