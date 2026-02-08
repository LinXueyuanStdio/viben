/**
 * Integration tests for viben config command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben config', () => {
  let tempDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-test-')));
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    // Set custom state dir
    process.env.VIBEN_STATE_DIR = path.join(tempDir, 'state');

    // Capture console output
    consoleOutput = [];
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      consoleOutput.push(args.join(' '));
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Prevent process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    consoleSpy.mockRestore();
    errorSpy.mockRestore();

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  function createWorkspace(): void {
    const vibenDir = path.join(tempDir, '.viben');
    fs.mkdirSync(vibenDir, { recursive: true });
    fs.writeFileSync(
      path.join(vibenDir, 'config.yaml'),
      'version: 1\nsettings:\n  editor: code\n'
    );
    process.chdir(tempDir);
  }

  function createGlobalConfig(): void {
    const stateDir = process.env.VIBEN_STATE_DIR!;
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'config.yaml'),
      'version: 1\nsettings:\n  editor: vim\n  pager: less\n'
    );
  }

  describe('config get', () => {
    it('should get a config value', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'config', 'get', 'settings.editor']);

      expect(consoleOutput.join('\n')).toContain('code');
    });

    it('should output nothing for non-existent key', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'config', 'get', 'nonexistent']);

      // Should be empty or just have the empty successResponse
      expect(consoleOutput.length).toBeLessThanOrEqual(1);
    });

    it('should output JSON in json mode', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'config', 'get', 'settings.editor']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.value).toBe('code');
    });

    it('should use global config with --global flag', async () => {
      createWorkspace();
      createGlobalConfig();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'config', 'get', '--global', 'settings.editor']);

      expect(consoleOutput.join('\n')).toContain('vim');
    });
  });

  describe('config set', () => {
    it('should set a config value', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'config', 'set', 'settings.editor', 'nvim']);

      expect(consoleOutput.join('\n')).toContain('OK');

      // Verify the value was set
      consoleOutput = [];
      await program.parseAsync(['node', 'viben', 'config', 'get', 'settings.editor']);
      expect(consoleOutput.join('\n')).toContain('nvim');
    });

    it('should set JSON values', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'config', 'set', 'mcp.enabled', '["filesystem", "git"]'
      ]);

      expect(consoleOutput.join('\n')).toContain('OK');

      // Verify
      consoleOutput = [];
      await program.parseAsync(['node', 'viben', '--json', 'config', 'get', 'mcp.enabled']);
      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.data.value).toEqual(['filesystem', 'git']);
    });

    it('should set boolean values', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'config', 'set', 'settings.enabled', 'true']);

      consoleOutput = [];
      await program.parseAsync(['node', 'viben', '--json', 'config', 'get', 'settings.enabled']);
      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.data.value).toBe(true);
    });

    it('should set numeric values', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'config', 'set', 'settings.timeout', '5000']);

      consoleOutput = [];
      await program.parseAsync(['node', 'viben', '--json', 'config', 'get', 'settings.timeout']);
      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.data.value).toBe(5000);
    });
  });

  describe('config unset', () => {
    it('should unset a config value', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'config', 'unset', 'settings.editor']);

      expect(consoleOutput.join('\n')).toContain('OK');

      // Verify the value was unset
      consoleOutput = [];
      await program.parseAsync(['node', 'viben', '--json', 'config', 'get', 'settings.editor']);
      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.data.value).toBeNull();
    });
  });

  describe('config list', () => {
    it('should list all config values', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'config', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('version');
      expect(output).toContain('settings.editor');
    });

    it('should output JSON in json mode', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'config', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.items).toBeDefined();
      expect(Array.isArray(parsed.data.items)).toBe(true);
    });

    it('should show origin with --show-origin flag', async () => {
      createWorkspace();
      createGlobalConfig();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'config', 'list', '--show-origin']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('workspace');
    });
  });
});
