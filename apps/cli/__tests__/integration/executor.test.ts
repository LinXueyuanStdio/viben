/**
 * Integration tests for viben executor command
 *
 * Note: Current NAPI implementation only supports global scope.
 *
 * LIMITATION: NAPI modules are loaded once at process start and cannot be reset.
 * Setting VIBEN_STATE_DIR after the module loads has no effect.
 * These tests verify CLI behavior with the global state directory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben executor', { timeout: 60000 }, () => {
  let originalCwd: string;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalCwd = process.cwd();

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
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
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

    it('should show executors in output', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'list']);

      const output = consoleOutput.join('\n');
      // Should show executors in some format
      expect(output.length).toBeGreaterThan(0);
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
    });

    it('should include executor properties in JSON output', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      const firstExecutor = parsed.data.executors[0];

      expect(firstExecutor).toHaveProperty('id');
      expect(firstExecutor).toHaveProperty('name');
      expect(firstExecutor).toHaveProperty('description');
    });
  });

  describe('executor show', () => {
    it('should show Claude Code executor details', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'CLAUDE_CODE']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('CLAUDE_CODE');
      expect(output).toContain('claude'); // lowercase in name field
    });

    it('should show Cursor Agent executor details', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'CURSOR_AGENT']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('CURSOR_AGENT');
    });

    it('should show Gemini executor details', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'GEMINI']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('GEMINI');
    });

    it('should show Codex executor details', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'CODEX']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('CODEX');
    });

    it('should fail for non-existent executor', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'NONEXISTENT']);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'show', '-n', 'CLAUDE_CODE']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.executor).toBeDefined();
      expect(parsed.data.executor.id).toBe('CLAUDE_CODE');
    });

    it('should show capabilities in human output', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'CLAUDE_CODE']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Capabilities:');
    });

    it('should show description in output', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'executor', 'show', '-n', 'CURSOR_AGENT']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Description:');
    });
  });

  // Note: executor status command does not exist, use executor show instead;

  describe('executor capabilities', () => {
    it('should have executors with capabilities', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));

      // Check that executors have capabilities
      const executorsWithCapabilities = parsed.data.executors.filter(
        (e: { capabilities?: string[] }) => e.capabilities && e.capabilities.length > 0
      );
      expect(executorsWithCapabilities.length).toBeGreaterThan(0);
    });

    it('should have claude code executor', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'executor', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      const claudeCode = parsed.data.executors.find(
        (e: { id: string }) => e.id === 'CLAUDE_CODE'
      );

      expect(claudeCode).toBeDefined();
      expect(claudeCode.id).toBe('CLAUDE_CODE');
    });
  });
});
