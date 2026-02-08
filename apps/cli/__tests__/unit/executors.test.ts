/**
 * Unit tests for lib/executors.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EXECUTOR_REGISTRY,
  detectExecutor,
  detectAllExecutors,
  getExecutorById,
  getAllExecutorIds,
  formatCapability,
} from '../../src/lib/executors';
import type { ExecutorDetector, ExecutorCapability } from '../../src/types/executor';

// Mock child_process.execSync
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

// Mock fs module for file existence checks
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    realpathSync: (actual as typeof fs).realpathSync,
    mkdtempSync: (actual as typeof fs).mkdtempSync,
    mkdirSync: (actual as typeof fs).mkdirSync,
    writeFileSync: (actual as typeof fs).writeFileSync,
    readFileSync: (actual as typeof fs).readFileSync,
    rmSync: (actual as typeof fs).rmSync,
    constants: (actual as typeof fs).constants,
  };
});

describe('executors.ts', () => {
  const mockedExecSync = vi.mocked(execSync);
  const mockedExistsSync = vi.mocked(fs.existsSync);
  const mockedStatSync = vi.mocked(fs.statSync);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no files exist
    mockedExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('EXECUTOR_REGISTRY', () => {
    it('should contain known executors', () => {
      expect(EXECUTOR_REGISTRY.length).toBeGreaterThan(0);

      const ids = EXECUTOR_REGISTRY.map((e) => e.id);
      expect(ids).toContain('CLAUDE_CODE');
      expect(ids).toContain('CURSOR');
      expect(ids).toContain('GEMINI_CLI');
      expect(ids).toContain('CODEX');
      expect(ids).toContain('AIDER');
    });

    it('should have required fields for each executor', () => {
      for (const executor of EXECUTOR_REGISTRY) {
        expect(executor.id).toBeDefined();
        expect(executor.name).toBeDefined();
        expect(executor.description).toBeDefined();
        expect(executor.detectCommand).toBeDefined();
        expect(executor.executableNames).toBeDefined();
        expect(executor.executableNames.length).toBeGreaterThan(0);
        expect(executor.configPaths).toBeDefined();
        expect(executor.capabilities).toBeDefined();
        expect(executor.capabilities.length).toBeGreaterThan(0);
      }
    });

    it('should have unique IDs', () => {
      const ids = EXECUTOR_REGISTRY.map((e) => e.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('detectExecutor', () => {
    const mockDetector: ExecutorDetector = {
      id: 'TEST_EXECUTOR',
      name: 'Test Executor',
      description: 'A test executor',
      detectCommand: 'test-exe --version',
      executableNames: ['test-exe'],
      configPaths: ['.test-exe'],
      mcpConfigPath: '.test-exe/mcp.json',
      settingsPath: '.test-exe/settings.json',
      capabilities: ['tool_use', 'multi_turn'],
    };

    it('should detect installed executor', () => {
      // Mock executable found in PATH
      mockedExistsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr.includes('test-exe')) return true;
        return false;
      });

      mockedStatSync.mockImplementation(() => ({
        isFile: () => true,
        isDirectory: () => false,
        mode: fs.constants.X_OK,
      }) as fs.Stats);

      // Mock version command
      mockedExecSync.mockReturnValue('test-exe version 1.2.3\n');

      const result = detectExecutor(mockDetector);

      expect(result.id).toBe('TEST_EXECUTOR');
      expect(result.name).toBe('Test Executor');
      expect(result.installed).toBe(true);
      expect(result.version).toBe('1.2.3');
      expect(result.capabilities).toEqual(['tool_use', 'multi_turn']);
    });

    it('should detect not installed executor', () => {
      mockedExistsSync.mockReturnValue(false);

      const result = detectExecutor(mockDetector);

      expect(result.id).toBe('TEST_EXECUTOR');
      expect(result.installed).toBe(false);
      expect(result.version).toBeUndefined();
      expect(result.path).toBeUndefined();
    });

    it('should handle version command failure', () => {
      mockedExistsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr.includes('test-exe')) return true;
        return false;
      });

      mockedStatSync.mockImplementation(() => ({
        isFile: () => true,
        isDirectory: () => false,
        mode: fs.constants.X_OK,
      }) as fs.Stats);

      // Version command throws
      mockedExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const result = detectExecutor(mockDetector);

      expect(result.installed).toBe(true);
      expect(result.version).toBeUndefined();
    });

    it('should detect config directory', () => {
      const homeDir = os.homedir();
      const configDir = path.join(homeDir, '.test-exe');

      mockedExistsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr === configDir) return true;
        return false;
      });

      mockedStatSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr === configDir) {
          return {
            isFile: () => false,
            isDirectory: () => true,
            mode: 0,
          } as fs.Stats;
        }
        return {
          isFile: () => false,
          isDirectory: () => false,
          mode: 0,
        } as fs.Stats;
      });

      const result = detectExecutor(mockDetector);

      expect(result.configDir).toBe(configDir);
    });

    it('should detect MCP config and settings files', () => {
      const homeDir = os.homedir();
      const mcpPath = path.join(homeDir, '.test-exe/mcp.json');
      const settingsPath = path.join(homeDir, '.test-exe/settings.json');

      mockedExistsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr === mcpPath || pathStr === settingsPath) return true;
        return false;
      });

      mockedStatSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr === mcpPath || pathStr === settingsPath) {
          return {
            isFile: () => true,
            isDirectory: () => false,
            mode: 0,
          } as fs.Stats;
        }
        return {
          isFile: () => false,
          isDirectory: () => false,
          mode: 0,
        } as fs.Stats;
      });

      const result = detectExecutor(mockDetector);

      expect(result.mcpConfigPath).toBe(mcpPath);
      expect(result.settingsPath).toBe(settingsPath);
    });

    it('should parse different version formats', () => {
      mockedExistsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr.includes('test-exe')) return true;
        return false;
      });

      mockedStatSync.mockImplementation(() => ({
        isFile: () => true,
        isDirectory: () => false,
        mode: fs.constants.X_OK,
      }) as fs.Stats);

      // Test "v1.0.0" format
      mockedExecSync.mockReturnValue('v1.0.0\n');
      let result = detectExecutor(mockDetector);
      expect(result.version).toBe('1.0.0');

      // Test "version 2.3.4" format
      mockedExecSync.mockReturnValue('Test Executor version 2.3.4\n');
      result = detectExecutor(mockDetector);
      expect(result.version).toBe('2.3.4');

      // Test pre-release version
      mockedExecSync.mockReturnValue('3.0.0-beta.1\n');
      result = detectExecutor(mockDetector);
      expect(result.version).toBe('3.0.0-beta.1');
    });
  });

  describe('detectAllExecutors', () => {
    it('should return all executors from registry', () => {
      mockedExistsSync.mockReturnValue(false);

      const result = detectAllExecutors();

      expect(result.length).toBe(EXECUTOR_REGISTRY.length);
      expect(result.every((e) => e.installed === false)).toBe(true);
    });

    it('should include executor details', () => {
      mockedExistsSync.mockReturnValue(false);

      const result = detectAllExecutors();

      const claudeCode = result.find((e) => e.id === 'CLAUDE_CODE');
      expect(claudeCode).toBeDefined();
      expect(claudeCode?.name).toBe('Claude Code');
      expect(claudeCode?.capabilities).toContain('tool_use');
      expect(claudeCode?.capabilities).toContain('mcp_support');
    });
  });

  describe('getExecutorById', () => {
    it('should return executor by ID (case insensitive)', () => {
      mockedExistsSync.mockReturnValue(false);

      const result1 = getExecutorById('CLAUDE_CODE');
      expect(result1).toBeDefined();
      expect(result1?.id).toBe('CLAUDE_CODE');

      const result2 = getExecutorById('claude_code');
      expect(result2).toBeDefined();
      expect(result2?.id).toBe('CLAUDE_CODE');

      const result3 = getExecutorById('Claude_Code');
      expect(result3).toBeDefined();
      expect(result3?.id).toBe('CLAUDE_CODE');
    });

    it('should return undefined for unknown ID', () => {
      const result = getExecutorById('UNKNOWN_EXECUTOR');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllExecutorIds', () => {
    it('should return all executor IDs', () => {
      const ids = getAllExecutorIds();

      expect(ids.length).toBe(EXECUTOR_REGISTRY.length);
      expect(ids).toContain('CLAUDE_CODE');
      expect(ids).toContain('CURSOR');
      expect(ids).toContain('GEMINI_CLI');
    });
  });

  describe('formatCapability', () => {
    it('should format known capabilities', () => {
      expect(formatCapability('tool_use')).toBe('Tool use');
      expect(formatCapability('mcp_support')).toBe('MCP server support');
      expect(formatCapability('multi_turn')).toBe('Multi-turn conversations');
      expect(formatCapability('extended_thinking')).toBe('Extended thinking');
      expect(formatCapability('vision')).toBe('Image understanding');
      expect(formatCapability('code_execution')).toBe('Code execution');
      expect(formatCapability('web_browsing')).toBe('Web browsing');
      expect(formatCapability('file_editing')).toBe('File editing');
    });

    it('should return raw capability for unknown', () => {
      // Cast to bypass type checking for unknown capability
      const unknown = 'unknown_capability' as ExecutorCapability;
      expect(formatCapability(unknown)).toBe('unknown_capability');
    });
  });
});
