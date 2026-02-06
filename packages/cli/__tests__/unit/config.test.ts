/**
 * Unit tests for lib/config.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { VibenConfig } from '../../src/types';
import {
  DEFAULT_CONFIG,
  readConfigFile,
  writeConfigFile,
  readScopedConfig,
  writeScopedConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
  flattenConfig,
  getConfigWithOrigin,
  getEditor,
} from '../../src/lib/config';

describe('config.ts', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-test-')));
    originalEnv = { ...process.env };
    originalCwd = process.cwd();

    // Set custom state dir to avoid polluting real config
    process.env.VIBEN_STATE_DIR = path.join(tempDir, 'state');
  });

  afterEach(() => {
    process.env = originalEnv;
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have version 1', () => {
      expect(DEFAULT_CONFIG.version).toBe(1);
    });

    it('should have default settings', () => {
      expect(DEFAULT_CONFIG.settings).toBeDefined();
      expect(DEFAULT_CONFIG.settings?.editor).toBe('code');
      expect(DEFAULT_CONFIG.settings?.pager).toBe('less');
      expect(DEFAULT_CONFIG.settings?.color).toBe('auto');
    });
  });

  describe('readConfigFile', () => {
    it('should return null for non-existent file', () => {
      const result = readConfigFile(path.join(tempDir, 'nonexistent.yaml'));
      expect(result).toBeNull();
    });

    it('should read a valid YAML config file', () => {
      const configPath = path.join(tempDir, 'config.yaml');
      fs.writeFileSync(configPath, 'version: 1\nsettings:\n  editor: vim\n');

      const result = readConfigFile(configPath);
      expect(result).not.toBeNull();
      expect(result?.version).toBe(1);
      expect(result?.settings?.editor).toBe('vim');
    });

    it('should throw CliError for invalid YAML', () => {
      const configPath = path.join(tempDir, 'invalid.yaml');
      fs.writeFileSync(configPath, 'version: [invalid yaml');

      expect(() => readConfigFile(configPath)).toThrow();
    });
  });

  describe('writeConfigFile', () => {
    it('should write a valid YAML config file', () => {
      const configPath = path.join(tempDir, 'write-test.yaml');
      const config: VibenConfig = {
        version: 1,
        settings: { editor: 'nvim' },
      };

      writeConfigFile(configPath, config);

      expect(fs.existsSync(configPath)).toBe(true);
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('version: 1');
      expect(content).toContain('editor: nvim');
    });

    it('should create parent directories if needed', () => {
      const configPath = path.join(tempDir, 'nested', 'dir', 'config.yaml');
      const config: VibenConfig = { version: 1 };

      writeConfigFile(configPath, config);

      expect(fs.existsSync(configPath)).toBe(true);
    });
  });

  describe('getConfigValue', () => {
    const testConfig: VibenConfig = {
      version: 1,
      settings: {
        editor: 'vim',
        pager: 'less',
        color: 'auto',
      },
      agents: ['agent1', 'agent2'],
      mcp: {
        enabled: ['filesystem', 'git'],
      },
    };

    it('should get top-level values', () => {
      expect(getConfigValue(testConfig, 'version')).toBe(1);
    });

    it('should get nested values with dot notation', () => {
      expect(getConfigValue(testConfig, 'settings.editor')).toBe('vim');
    });

    it('should get array values', () => {
      expect(getConfigValue(testConfig, 'agents')).toEqual(['agent1', 'agent2']);
    });

    it('should get array items with bracket notation', () => {
      expect(getConfigValue(testConfig, 'agents[0]')).toBe('agent1');
      expect(getConfigValue(testConfig, 'agents[1]')).toBe('agent2');
    });

    it('should get nested array items', () => {
      expect(getConfigValue(testConfig, 'mcp.enabled[0]')).toBe('filesystem');
    });

    it('should return undefined for non-existent keys', () => {
      expect(getConfigValue(testConfig, 'nonexistent')).toBeUndefined();
      expect(getConfigValue(testConfig, 'settings.nonexistent')).toBeUndefined();
    });

    it('should return undefined for out-of-bounds array index', () => {
      expect(getConfigValue(testConfig, 'agents[10]')).toBeUndefined();
    });
  });

  describe('setConfigValue', () => {
    it('should set top-level values', () => {
      const config: VibenConfig = { version: 1 };
      const result = setConfigValue(config, 'version', 2);
      expect(result.version).toBe(2);
    });

    it('should set nested values', () => {
      const config: VibenConfig = { version: 1, settings: {} };
      const result = setConfigValue(config, 'settings.editor', 'nvim');
      expect(result.settings?.editor).toBe('nvim');
    });

    it('should create nested objects if needed', () => {
      const config: VibenConfig = { version: 1 };
      const result = setConfigValue(config, 'settings.editor', 'code');
      expect(result.settings?.editor).toBe('code');
    });

    it('should set array values', () => {
      const config: VibenConfig = { version: 1, agents: ['agent1'] };
      const result = setConfigValue(config, 'agents[0]', 'new-agent');
      expect(result.agents?.[0]).toBe('new-agent');
    });

    it('should be immutable (not modify original)', () => {
      const config: VibenConfig = { version: 1, settings: { editor: 'vim' } };
      const result = setConfigValue(config, 'settings.editor', 'nvim');
      expect(config.settings?.editor).toBe('vim');
      expect(result.settings?.editor).toBe('nvim');
    });

    it('should return unchanged config for empty key', () => {
      const config: VibenConfig = { version: 1 };
      const result = setConfigValue(config, '', 'value');
      expect(result).toEqual(config);
    });
  });

  describe('deleteConfigValue', () => {
    it('should delete top-level values', () => {
      const config: VibenConfig = {
        version: 1,
        settings: { editor: 'vim' },
        agents: ['agent1'],
      };
      const result = deleteConfigValue(config, 'agents');
      expect(result.agents).toBeUndefined();
    });

    it('should delete nested values', () => {
      const config: VibenConfig = {
        version: 1,
        settings: { editor: 'vim', pager: 'less' },
      };
      const result = deleteConfigValue(config, 'settings.editor');
      expect(result.settings?.editor).toBeUndefined();
      expect(result.settings?.pager).toBe('less');
    });

    it('should delete array items', () => {
      const config: VibenConfig = {
        version: 1,
        agents: ['agent1', 'agent2', 'agent3'],
      };
      const result = deleteConfigValue(config, 'agents[1]');
      expect(result.agents).toEqual(['agent1', 'agent3']);
    });

    it('should be immutable (not modify original)', () => {
      const config: VibenConfig = { version: 1, agents: ['agent1'] };
      const result = deleteConfigValue(config, 'agents[0]');
      expect(config.agents).toEqual(['agent1']);
      expect(result.agents).toEqual([]);
    });

    it('should return unchanged config if key does not exist', () => {
      const config: VibenConfig = { version: 1 };
      const result = deleteConfigValue(config, 'nonexistent');
      expect(result).toEqual(config);
    });
  });

  describe('flattenConfig', () => {
    it('should flatten simple config', () => {
      const config: VibenConfig = { version: 1 };
      const result = flattenConfig(config);
      expect(result).toContainEqual({ key: 'version', value: '1' });
    });

    it('should flatten nested config', () => {
      const config: VibenConfig = {
        version: 1,
        settings: { editor: 'vim', pager: 'less' },
      };
      const result = flattenConfig(config);
      expect(result).toContainEqual({ key: 'settings.editor', value: 'vim' });
      expect(result).toContainEqual({ key: 'settings.pager', value: 'less' });
    });

    it('should flatten arrays', () => {
      const config: VibenConfig = {
        version: 1,
        agents: ['agent1', 'agent2'],
      };
      const result = flattenConfig(config);
      expect(result).toContainEqual({ key: 'agents[0]', value: 'agent1' });
      expect(result).toContainEqual({ key: 'agents[1]', value: 'agent2' });
    });
  });

  describe('readScopedConfig and writeScopedConfig', () => {
    it('should read and write global config', () => {
      const config: VibenConfig = {
        version: 1,
        settings: { editor: 'global-editor' },
      };

      writeScopedConfig('global', config);
      const result = readScopedConfig('global');

      expect(result).not.toBeNull();
      expect(result?.settings?.editor).toBe('global-editor');
    });

    it('should read and write workspace config', () => {
      // Create workspace
      const vibenDir = path.join(tempDir, '.viben');
      fs.mkdirSync(vibenDir, { recursive: true });
      fs.writeFileSync(path.join(vibenDir, 'config.yaml'), 'version: 1');
      process.chdir(tempDir);

      const config: VibenConfig = {
        version: 1,
        settings: { editor: 'workspace-editor' },
      };

      writeScopedConfig('workspace', config);
      const result = readScopedConfig('workspace');

      expect(result).not.toBeNull();
      expect(result?.settings?.editor).toBe('workspace-editor');
    });
  });

  describe('getEditor', () => {
    it('should return VISUAL env var if set', () => {
      process.env.VISUAL = 'sublime';
      expect(getEditor()).toBe('sublime');
    });

    it('should return EDITOR env var if VISUAL is not set', () => {
      delete process.env.VISUAL;
      process.env.EDITOR = 'nano';
      expect(getEditor()).toBe('nano');
    });

    it('should return config editor if env vars are not set', () => {
      delete process.env.VISUAL;
      delete process.env.EDITOR;

      // Write global config with editor
      const config: VibenConfig = {
        version: 1,
        settings: { editor: 'nvim' },
      };
      writeScopedConfig('global', config);

      expect(getEditor()).toBe('nvim');
    });

    it('should return default editor if nothing else is set', () => {
      delete process.env.VISUAL;
      delete process.env.EDITOR;
      // Ensure no config exists

      const editor = getEditor();
      expect(['code', 'vi']).toContain(editor);
    });
  });
});
