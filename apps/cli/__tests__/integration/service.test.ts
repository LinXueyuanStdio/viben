/**
 * Integration tests for viben service command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben service', () => {
  let tempDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleOutput: string[];
  let errorOutput: string[];
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
    process.env = originalEnv;
    consoleSpy.mockRestore();
    errorSpy.mockRestore();

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  /**
   * Create services state file with running services
   */
  function createServicesState(services: Array<{
    name: string;
    type: 'mcp' | 'viben';
    pid: number;
    command: string;
    args?: string[];
    startedAt: string;
  }>): void {
    const stateDir = process.env.VIBEN_STATE_DIR!;
    fs.mkdirSync(stateDir, { recursive: true });

    const content = require('yaml').stringify({ version: 1, services });
    fs.writeFileSync(path.join(stateDir, 'services.yaml'), content);
  }

  /**
   * Create log file for a service
   */
  function createServiceLog(serviceName: string, lines: string[]): void {
    const stateDir = process.env.VIBEN_STATE_DIR!;
    const logsDir = path.join(stateDir, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });

    const sanitized = serviceName.replace(/[^a-zA-Z0-9-_]/g, '-');
    const logPath = path.join(logsDir, `${sanitized}.log`);
    fs.writeFileSync(logPath, lines.join('\n') + '\n');
  }

  describe('service status', () => {
    it('should show all services with default stopped status', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'status']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Services');
      // Known viben services should be listed
      expect(output).toContain('viben:sync');
      expect(output).toContain('viben:index');
      expect(output).toContain('stopped');
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

    it('should show services from state file', async () => {
      // Create services state with a tracked service
      createServicesState([
        {
          name: 'test-tracked',
          type: 'viben',
          pid: 99999, // Non-existent PID
          command: 'test',
          startedAt: new Date().toISOString(),
        }
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'status']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Services');
    });
  });

  describe('service status <name>', () => {
    it('should show single service status', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'status', 'viben:sync']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('viben:sync');
      expect(output).toContain('Status');
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
      expect(parsed.data.status).toBe('stopped');
    });

    it('should parse MCP service type correctly', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'status', 'mcp:filesystem']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.data.name).toBe('mcp:filesystem');
      expect(parsed.data.type).toBe('mcp');
    });

    it('should show service type in status output', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'status', 'mcp:filesystem']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('mcp');
    });
  });

  describe('service start <name>', () => {
    it('should show error when no command specified for unknown service', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'start', 'unknown-service']);

      // Error message might be in console.log or console.error
      const allOutput = [...consoleOutput, ...errorOutput].join('\n');
      expect(allOutput.toLowerCase()).toMatch(/(no command|specify a command)/i);
    });

    it('should output JSON error when no command with --json flag', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'start', 'unknown-service']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe('MISSING_COMMAND');
    });

    it('should use default command for MCP services', async () => {
      // MCP services should have default npx command
      const program = createProgram();
      // This will try to start the service, but we just want to verify
      // it doesn't error about missing command
      await program.parseAsync(['node', 'viben', '--json', 'service', 'start', 'mcp:filesystem']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      // Should not fail with MISSING_COMMAND since mcp has default
      expect(parsed.error?.code).not.toBe('MISSING_COMMAND');
    });

    it('should use default command for viben:sync service', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'start', 'viben:sync']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      // Should not fail with MISSING_COMMAND since viben:sync has default
      expect(parsed.error?.code).not.toBe('MISSING_COMMAND');
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

    it('should clean up stale service from state', async () => {
      // Create services state with a non-existent PID
      createServicesState([
        {
          name: 'stale-service',
          type: 'viben',
          pid: 99999999, // Very unlikely to be a real PID
          command: 'test',
          startedAt: new Date().toISOString(),
        }
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'stop', 'stale-service']);

      const output = consoleOutput.join('\n');
      // Should recognize it's not actually running
      expect(output).toContain('not running');
    });
  });

  describe('service logs <name>', () => {
    it('should show no logs message when log file does not exist', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'logs', 'no-logs-service']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No logs available');
    });

    it('should output JSON with empty lines when no logs', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'logs', 'no-logs-service']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.lines).toEqual([]);
      expect(parsed.data.count).toBe(0);
    });

    it('should show log content when logs exist', async () => {
      createServiceLog('test-log-service', [
        '[2024-01-01 12:00:00] Starting service...',
        '[2024-01-01 12:00:01] Service ready',
        '[2024-01-01 12:00:02] Processing request',
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'logs', 'test-log-service']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Starting service');
      expect(output).toContain('Service ready');
    });

    it('should output JSON with log lines', async () => {
      createServiceLog('json-log-service', [
        'Line 1',
        'Line 2',
        'Line 3',
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'logs', 'json-log-service']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.lines).toContain('Line 1');
      expect(parsed.data.lines).toContain('Line 2');
      expect(parsed.data.count).toBe(3);
    });

    it('should respect --lines option', async () => {
      // Create log with many lines
      const lines: string[] = [];
      for (let i = 1; i <= 200; i++) {
        lines.push(`Log line ${i}`);
      }
      createServiceLog('many-logs-service', lines);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'service', 'logs', 'many-logs-service',
        '--lines', '10'
      ]);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.data.count).toBe(10);
      // Should get last 10 lines (191-200)
      expect(parsed.data.lines[0]).toContain('191');
      expect(parsed.data.lines[9]).toContain('200');
    });

    it('should show log file path in output', async () => {
      createServiceLog('path-test-service', ['test log']);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'logs', 'path-test-service']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Path:');
      expect(output).toContain('.log');
    });

    it('should handle MCP service name with colon in log path', async () => {
      // MCP service names contain colons which are sanitized for file paths
      createServiceLog('mcp:filesystem', [
        'MCP filesystem log entry',
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'logs', 'mcp:filesystem']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.lines).toContain('MCP filesystem log entry');
    });

    it('should include logPath in JSON output', async () => {
      createServiceLog('path-json-service', ['test']);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'logs', 'path-json-service']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.data.logPath).toBeDefined();
      expect(parsed.data.logPath).toContain('path-json-service.log');
    });
  });

  describe('service restart <name>', () => {
    it('should handle restart of non-running service without command', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'service', 'restart', 'restart-test']);

      const allOutput = [...consoleOutput, ...errorOutput].join('\n').toLowerCase();
      // Should show error about no command or status
      expect(allOutput).toMatch(/(no command|error|no previous command)/);
    });

    it('should output JSON for restart without command', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'service', 'restart', 'restart-json-test']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      // Should either succeed with error status or fail
      if (parsed.success) {
        expect(parsed.data.status).toBe('error');
      } else {
        expect(parsed.error).toBeDefined();
      }
    });
  });
});
