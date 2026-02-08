/**
 * Integration tests for viben cron command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Note: createProgram must be imported dynamically after setting VIBEN_STATE_DIR
// to ensure modules read the correct environment variable.

describe('viben cron', () => {
  let tempDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-test-')));
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    // Set custom state dir BEFORE resetting modules
    process.env.VIBEN_STATE_DIR = path.join(tempDir, 'state');

    // Reset module cache to ensure modules read the new VIBEN_STATE_DIR
    vi.resetModules();

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

  /**
   * Dynamically import createProgram to ensure it uses current VIBEN_STATE_DIR
   */
  async function getCreateProgram() {
    const { createProgram } = await import('../../src/cli');
    return createProgram;
  }

  /**
   * Find and parse JSON output from console output
   * CronService logs additional messages, so we need to extract the JSON
   */
  function findJsonOutput(output: string[]): unknown {
    // Find lines that look like JSON (start with { and end with })
    for (const line of output) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          return JSON.parse(trimmed);
        } catch {
          // Not valid JSON, continue
        }
      }
    }
    // Try parsing the whole output
    return JSON.parse(output.join('\n'));
  }

  /**
   * Create a cron job directly in the state directory
   */
  function createCronJob(
    id: string,
    options: {
      name: string;
      message: string;
      cron?: string;
      every?: number;
      channel?: string;
      agent?: string;
      enabled?: boolean;
      lastRun?: number;
      lastStatus?: 'success' | 'failure';
      lastError?: string;
    }
  ): void {
    const stateDir = process.env.VIBEN_STATE_DIR!;
    fs.mkdirSync(stateDir, { recursive: true });

    const cronPath = path.join(stateDir, 'cron.yaml');
    let config: { version: number; jobs: Record<string, unknown> } = {
      version: 1,
      jobs: {},
    };

    // Read existing config if exists
    if (fs.existsSync(cronPath)) {
      const yaml = require('yaml');
      config = yaml.parse(fs.readFileSync(cronPath, 'utf-8'));
    }

    // Add job
    config.jobs[id] = {
      name: options.name,
      message: options.message,
      cron: options.cron,
      every: options.every,
      channel: options.channel,
      agent: options.agent ?? 'main',
      enabled: options.enabled ?? true,
      lastRun: options.lastRun,
      lastStatus: options.lastStatus,
      lastError: options.lastError,
    };

    // Write config
    const yaml = require('yaml');
    fs.writeFileSync(cronPath, yaml.stringify(config));
  }

  describe('cron list', () => {
    it('should show no jobs when none exist', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'cron', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No scheduled jobs found');
    });

    it('should list existing cron jobs', async () => {
      createCronJob('daily-reminder', {
        name: 'Daily Reminder',
        message: 'Good morning!',
        cron: '0 9 * * *',
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'cron', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('daily-reminder');
      expect(output).toContain('enabled');
    });

    it('should list multiple jobs', async () => {
      createCronJob('job1', {
        name: 'Job 1',
        message: 'Hello 1',
        cron: '0 9 * * *',
      });
      createCronJob('job2', {
        name: 'Job 2',
        message: 'Hello 2',
        every: 3600,
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'cron', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('job1');
      expect(output).toContain('job2');
    });

    it('should show enabled/disabled status', async () => {
      createCronJob('enabled-job', {
        name: 'Enabled',
        message: 'test',
        cron: '* * * * *',
        enabled: true,
      });
      createCronJob('disabled-job', {
        name: 'Disabled',
        message: 'test',
        cron: '* * * * *',
        enabled: false,
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'cron', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('enabled-job');
      expect(output).toContain('disabled-job');
      expect(output).toContain('enabled');
      expect(output).toContain('disabled');
    });

    it('should output JSON in json mode', async () => {
      createCronJob('json-job', {
        name: 'JSON Job',
        message: 'test',
        cron: '0 0 * * *',
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'cron', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.jobs).toBeDefined();
      expect(parsed.data.count).toBe(1);
    });
  });

  describe('cron add', () => {
    it('should add a job with cron expression', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', 'Daily Greeting',
        '--message', 'Good morning!',
        '--cron', '0 9 * * *'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created cron job');
      expect(output).toContain('Daily Greeting');
      expect(output).toContain('Good morning!');
      expect(output).toContain('0 9 * * *');

      // Verify job was created
      const cronPath = path.join(process.env.VIBEN_STATE_DIR!, 'cron.yaml');
      expect(fs.existsSync(cronPath)).toBe(true);
    });

    it('should add a job with interval (--every)', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', 'Hourly Check',
        '--message', 'Checking in',
        '--every', '3600'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created cron job');
      expect(output).toContain('Hourly Check');
      expect(output).toContain('every 3600s');
    });

    it('should add job with channel option', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', 'Channel Job',
        '--message', 'Hello channel',
        '--cron', '0 12 * * *',
        '--channel', 'my-telegram'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created cron job');
      expect(output).toContain('Channel:');
      expect(output).toContain('my-telegram');
    });

    it('should add job with agent option', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', 'Agent Job',
        '--message', 'Hello agent',
        '--cron', '0 15 * * *',
        '--agent', 'custom-agent'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created cron job');
      expect(output).toContain('Agent:');
      expect(output).toContain('custom-agent');
    });

    it('should create disabled job with --disabled flag', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', 'Disabled Job',
        '--message', 'Not active',
        '--cron', '0 0 * * *',
        '--disabled'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created cron job');
      expect(output).toContain('disabled');
    });

    it('should fail without schedule (neither cron nor every)', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'add',
          '--name', 'No Schedule',
          '--message', 'test'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail with invalid cron expression', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'add',
          '--name', 'Invalid Cron',
          '--message', 'test',
          '--cron', 'invalid cron expression'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail if job ID already exists', async () => {
      createCronJob('existing-job', {
        name: 'Existing',
        message: 'test',
        cron: '* * * * *',
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'add',
          '--name', 'existing-job',
          '--message', 'duplicate',
          '--cron', '0 0 * * *'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'cron', 'add',
        '--name', 'JSON Add',
        '--message', 'test',
        '--cron', '0 0 * * *'
      ]);

      const parsed = findJsonOutput(consoleOutput) as { success: boolean; data: { job: { name: string } } };
      expect(parsed.success).toBe(true);
      expect(parsed.data.job).toBeDefined();
      expect(parsed.data.job.name).toBe('JSON Add');
    });
  });

  describe('cron remove', () => {
    it('should remove an existing job', async () => {
      createCronJob('to-remove', {
        name: 'To Remove',
        message: 'goodbye',
        cron: '0 0 * * *',
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'remove', 'to-remove'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Removed cron job');
      expect(output).toContain('to-remove');
    });

    it('should fail for non-existent job', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'remove', 'nonexistent'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createCronJob('json-remove', {
        name: 'JSON Remove',
        message: 'test',
        cron: '0 0 * * *',
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'cron', 'remove', 'json-remove'
      ]);

      const parsed = findJsonOutput(consoleOutput) as { success: boolean; data: { removed: boolean } };
      expect(parsed.success).toBe(true);
      expect(parsed.data.removed).toBe(true);
    });
  });

  describe('cron enable', () => {
    it('should enable a disabled job', async () => {
      createCronJob('disabled-job', {
        name: 'Disabled Job',
        message: 'test',
        cron: '0 0 * * *',
        enabled: false,
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'enable', 'disabled-job'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Enabled cron job');
      expect(output).toContain('disabled-job');
    });

    it('should fail for non-existent job', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'enable', 'nonexistent'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createCronJob('json-enable', {
        name: 'JSON Enable',
        message: 'test',
        cron: '0 0 * * *',
        enabled: false,
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'cron', 'enable', 'json-enable'
      ]);

      const parsed = findJsonOutput(consoleOutput) as { success: boolean; data: { job: { enabled: boolean } } };
      expect(parsed.success).toBe(true);
      expect(parsed.data.job).toBeDefined();
      expect(parsed.data.job.enabled).toBe(true);
    });
  });

  describe('cron disable', () => {
    it('should disable an enabled job', async () => {
      createCronJob('enabled-job', {
        name: 'Enabled Job',
        message: 'test',
        cron: '0 0 * * *',
        enabled: true,
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'disable', 'enabled-job'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Disabled cron job');
      expect(output).toContain('enabled-job');
    });

    it('should fail for non-existent job', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'disable', 'nonexistent'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createCronJob('json-disable', {
        name: 'JSON Disable',
        message: 'test',
        cron: '0 0 * * *',
        enabled: true,
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'cron', 'disable', 'json-disable'
      ]);

      const parsed = findJsonOutput(consoleOutput) as { success: boolean; data: { job: { enabled: boolean } } };
      expect(parsed.success).toBe(true);
      expect(parsed.data.job).toBeDefined();
      expect(parsed.data.job.enabled).toBe(false);
    });
  });

  describe('cron show', () => {
    it('should show job details', async () => {
      createCronJob('show-job', {
        name: 'Show Job',
        message: 'Hello world',
        cron: '0 9 * * *',
        channel: 'my-channel',
        agent: 'my-agent',
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'show', 'show-job'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('show-job');
      expect(output).toContain('Show Job');
      expect(output).toContain('Hello world');
      expect(output).toContain('0 9 * * *');
      expect(output).toContain('my-channel');
      expect(output).toContain('my-agent');
    });

    it('should show job with interval schedule', async () => {
      createCronJob('interval-job', {
        name: 'Interval Job',
        message: 'Interval test',
        every: 3600,
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'show', 'interval-job'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('interval-job');
      expect(output).toContain('Interval Job');
      expect(output).toContain('every');
    });

    it('should show last run status', async () => {
      createCronJob('run-job', {
        name: 'Run Job',
        message: 'test',
        cron: '0 0 * * *',
        lastRun: Date.now() - 3600000,
        lastStatus: 'success',
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'show', 'run-job'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('run-job');
      expect(output).toContain('Last run');
      expect(output).toContain('success');
    });

    it('should show last error if job failed', async () => {
      createCronJob('failed-job', {
        name: 'Failed Job',
        message: 'test',
        cron: '0 0 * * *',
        lastRun: Date.now() - 3600000,
        lastStatus: 'failure',
        lastError: 'Connection timeout',
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'show', 'failed-job'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('failed-job');
      expect(output).toContain('failure');
      expect(output).toContain('Connection timeout');
    });

    it('should fail for non-existent job', async () => {
      const createProgram = await getCreateProgram();
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'show', 'nonexistent'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createCronJob('json-show', {
        name: 'JSON Show',
        message: 'test message',
        cron: '0 12 * * *',
      });

      const createProgram = await getCreateProgram();
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'cron', 'show', 'json-show'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.job).toBeDefined();
      expect(parsed.data.job.id).toBe('json-show');
      expect(parsed.data.job.name).toBe('JSON Show');
      expect(parsed.data.job.message).toBe('test message');
    });
  });
});
