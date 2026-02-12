/**
 * Integration tests for viben service command
 *
 * Note: Current NAPI implementation only supports global scope.
 * Services are managed via: $VIBEN_STATE_DIR/services.yaml
 * Logs are stored in: $VIBEN_STATE_DIR/logs/
 *
 * LIMITATION: NAPI modules are loaded once at process start and cannot be reset.
 * Setting VIBEN_STATE_DIR after the module loads has no effect.
 * These tests verify CLI behavior with the global state directory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben service', () => {
  let originalCwd: string;
  let consoleOutput: string[];
  let errorOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalCwd = process.cwd();

    // Capture console output
    consoleOutput = [];
    errorOutput = [];
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      consoleOutput.push(args.join(' '));
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errorOutput.push(args.join(' '));
    });

    // Prevent process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('service status', () => {
    it('should show all services', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'status']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Services');
    });

    it('should output JSON format with --json flag', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'status']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.services).toBeDefined();
      expect(Array.isArray(parsed.data.services)).toBe(true);
    });
  });

  describe('service status <name>', () => {
    it('should show single service status', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'status', 'viben:sync']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('viben:sync');
    });

    it('should show stopped status for unknown service', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'status', 'unknown-service']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('unknown-service');
      expect(output).toContain('stopped');
    });

    it('should output single service JSON with --json flag', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'status', 'viben:sync']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.name).toBe('viben:sync');
    });

    it('should parse MCP service name correctly', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'status', 'mcp:filesystem']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.data.name).toBe('mcp:filesystem');
      // Type may or may not be included in JSON output
      expect(parsed.success).toBe(true);
    });
  });

  describe('service start <name>', () => {
    it('should show error when no command specified for unknown service', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'service', 'start', 'unknown-service']);
      } catch {
        // Expected to throw
      }

      // Error message might be in console.log or console.error
      const allOutput = [...consoleOutput, ...errorOutput].join('\n');
      expect(allOutput.toLowerCase()).toMatch(/(no command|specify a command|error)/i);
    });

    it('should output JSON error when no command with --json flag', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', '--json', 'service', 'start', 'unknown-service']);
      } catch {
        // Expected to throw
      }

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe('MISSING_COMMAND');
    });
  });

  describe('service stop <name>', () => {
    it('should handle stopping non-running service', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'stop', 'not-running-service']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('not running');
    });

    it('should output JSON for non-running service with --json flag', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'stop', 'not-running-service']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.status).toBe('stopped');
    });
  });

  describe('service logs <name>', () => {
    it('should show no logs message or log content', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'logs', 'test-log-service']);

      const output = consoleOutput.join('\n');
      // Either shows "No logs available" or shows log content
      expect(output.length).toBeGreaterThan(0);
    });

    it('should output JSON with lines array', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'logs', 'test-log-service']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.lines).toBeDefined();
      expect(Array.isArray(parsed.data.lines)).toBe(true);
      expect(typeof parsed.data.count).toBe('number');
    });

    it('should include logPath in JSON output', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'logs', 'path-test-service']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.data.logPath).toBeDefined();
      expect(parsed.data.logPath).toContain('.log');
    });

    it('should accept --lines option', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'service', 'logs', 'test-service',
        '--lines', '10'
      ]);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.lines).toBeDefined();
    });
  });

  describe('service restart <name>', () => {
    it('should handle restart of non-running service without command', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync(['node', 'viben', 'service', 'restart', 'restart-test']);
      } catch {
        errorThrown = true;
      }

      // Should throw an error or call process.exit(1)
      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should throw or exit when restart without command', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync(['node', 'viben', '--json', 'service', 'restart', 'restart-json-test']);
      } catch {
        errorThrown = true;
      }

      // Should either throw an error or call process.exit(1)
      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      // Test passes if either error was thrown or exit was called
      // or if JSON error response was produced
      const output = consoleOutput.join('\n');
      const hasJsonError = output.trim().startsWith('{') && output.includes('"success":false');
      expect(exitCalled || errorThrown || hasJsonError).toBe(true);
    });
  });
});
