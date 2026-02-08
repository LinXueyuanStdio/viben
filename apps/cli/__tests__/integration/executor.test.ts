/**
 * Integration tests for viben executor command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben executor', { timeout: 60000 }, () => {
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

  describe('executor list', () => {
    it('should list all known executors', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Executors:');
      // Should contain at least one executor ID
      expect(output).toMatch(/CLAUDE_CODE|CURSOR|GEMINI_CLI|CODEX/);
    });

    it('should show installed and not installed sections', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'list']);

      const output = consoleOutput.join('\n');
      // Should have either Installed or Not Installed section (or both)
      expect(output.includes('Installed:') || output.includes('Not Installed:')).toBe(true);
    });

    it('should show tip message', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain("viben executor show -n <id>");
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.executors).toBeDefined();
      expect(Array.isArray(parsed.data.executors)).toBe(true);
      expect(parsed.data.installed).toBeDefined();
      expect(parsed.data.notInstalled).toBeDefined();
    });

    it('should include executor properties in JSON output', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      const firstExecutor = parsed.data.executors[0];

      expect(firstExecutor).toHaveProperty('id');
      expect(firstExecutor).toHaveProperty('name');
      expect(firstExecutor).toHaveProperty('description');
      expect(firstExecutor).toHaveProperty('installed');
      expect(firstExecutor).toHaveProperty('capabilities');
    });

    it('should separate installed and not installed in JSON', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));

      // All installed should have installed: true
      for (const executor of parsed.data.installed) {
        expect(executor.installed).toBe(true);
      }

      // All notInstalled should have installed: false
      for (const executor of parsed.data.notInstalled) {
        expect(executor.installed).toBe(false);
      }

      // Total should match
      expect(parsed.data.executors.length).toBe(
        parsed.data.installed.length + parsed.data.notInstalled.length
      );
    });
  });

  describe('executor show', () => {
    it('should show executor details for valid ID', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'CLAUDE_CODE']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Executor: CLAUDE_CODE');
      expect(output).toContain('Claude Code');
      expect(output).toContain("Anthropic's official CLI for Claude");
    });

    it('should show capabilities', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'CLAUDE_CODE']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Capabilities:');
      expect(output).toContain('Tool use');
      expect(output).toContain('MCP server support');
    });

    it('should be case insensitive for ID', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'claude_code']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Executor: CLAUDE_CODE');
    });

    it('should fail for invalid executor ID', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'INVALID']);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should show valid IDs in error message', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'INVALID']);
      } catch {
        // Expected to throw
      }

      const errorOutput = errorSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(errorOutput).toContain('CLAUDE_CODE');
      expect(errorOutput).toContain('CURSOR');
    });

    it('should require -n option', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'executor', 'show']);
      } catch {
        // Commander will throw for missing required option
      }

      // Commander exits with 1 for missing required option
      expect(process.exit).toHaveBeenCalled();
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'show', '-n', 'CLAUDE_CODE']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.executor).toBeDefined();
      expect(parsed.data.executor.id).toBe('CLAUDE_CODE');
      expect(parsed.data.executor.name).toBe('Claude Code');
    });

    it('should include all executor properties in JSON', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'show', '-n', 'CLAUDE_CODE']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      const executor = parsed.data.executor;

      expect(executor).toHaveProperty('id');
      expect(executor).toHaveProperty('name');
      expect(executor).toHaveProperty('description');
      expect(executor).toHaveProperty('installed');
      expect(executor).toHaveProperty('capabilities');
      expect(Array.isArray(executor.capabilities)).toBe(true);
    });

    it('should include agents array in JSON output', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'show', '-n', 'CLAUDE_CODE']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.data.agents).toBeDefined();
      expect(Array.isArray(parsed.data.agents)).toBe(true);
    });

    it('should output error as JSON in json mode', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', '--json', 'executor', 'show', '-n', 'INVALID']);
      } catch {
        // Expected to throw
      }

      // In JSON mode, error should be in JSON format
      const output = consoleOutput.join('\n');
      if (output) {
        const parsed = JSON.parse(output);
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBeDefined();
        expect(parsed.error.code).toBe('EXECUTOR_NOT_FOUND');
      }
    });
  });

  describe('executor help', () => {
    it('should show help for executor command', async () => {
      const program = createProgram();
      // Commander outputs help to stdout
      const helpSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        await program.parseAsync(['node', 'viben', 'executor', '--help']);
      } catch {
        // Commander may exit after help
      }

      helpSpy.mockRestore();
    });

    it('should list subcommands', async () => {
      const program = createProgram();
      const helpSpy = vi.spyOn(process.stdout, 'write').mockImplementation((data) => {
        if (typeof data === 'string') {
          consoleOutput.push(data);
        }
        return true;
      });

      try {
        await program.parseAsync(['node', 'viben', 'executor', '--help']);
      } catch {
        // Commander may exit after help
      }

      const output = consoleOutput.join('');
      expect(output).toContain('list');
      expect(output).toContain('show');

      helpSpy.mockRestore();
    });
  });

  describe('executor detection accuracy', () => {
    it('should detect Claude Code if installed', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'show', '-n', 'CLAUDE_CODE']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      const executor = parsed.data.executor;

      // If installed, should have version and path
      if (executor.installed) {
        expect(executor.path).toBeDefined();
        // Version might not always be available even if installed
      }
    });

    it('should return correct capabilities for each executor', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));

      // Check Claude Code capabilities
      const claudeCode = parsed.data.executors.find(
        (e: { id: string }) => e.id === 'CLAUDE_CODE'
      );
      expect(claudeCode.capabilities).toContain('tool_use');
      expect(claudeCode.capabilities).toContain('mcp_support');
      expect(claudeCode.capabilities).toContain('extended_thinking');

      // Check Cursor capabilities
      const cursor = parsed.data.executors.find((e: { id: string }) => e.id === 'CURSOR');
      expect(cursor.capabilities).toContain('tool_use');
      expect(cursor.capabilities).toContain('mcp_support');
      expect(cursor.capabilities).toContain('vision');
    });
  });
});
