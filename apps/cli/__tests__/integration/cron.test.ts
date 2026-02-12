/**
 * Integration tests for viben cron command
 *
 * Note: Current NAPI implementation only supports global scope.
 * Cron jobs are stored in: $VIBEN_STATE_DIR/cron.yaml
 *
 * LIMITATION: NAPI modules are loaded once at process start and cannot be reset.
 * Setting VIBEN_STATE_DIR after the module loads has no effect.
 * These tests verify CLI behavior with the global state directory.
 *
 * NOTE: Cron expressions use 6-field format (sec min hour day month weekday):
 * - "0 0 9 * * *" = Every day at 9:00 AM
 * - "0 30 8 * * 1-5" = Every weekday at 8:30 AM
 * - "0 0 0 1 * *" = First day of every month at midnight
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben cron', () => {
  let originalCwd: string;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let createdJobs: string[] = [];

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

  afterEach(async () => {
    process.chdir(originalCwd);
    consoleSpy.mockRestore();
    errorSpy.mockRestore();

    // Clean up any cron jobs created during tests
    for (const jobId of createdJobs) {
      try {
        const { cronRemove } = await import('../../src/lib/native');
        await cronRemove(jobId);
      } catch {
        // Ignore errors during cleanup
      }
    }
    createdJobs = [];
  });

  /**
   * Find and parse JSON output from console output
   */
  function findJsonOutput(output: string[]): unknown {
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
    return JSON.parse(output.join('\n'));
  }

  /**
   * Helper to create a cron job and track it for cleanup
   * Supports both --cron (6-field format) and --every (interval) scheduling
   */
  async function createTestCronJob(
    name: string,
    options: {
      message: string;
      cron?: string;  // 6-field format: "sec min hour day month weekday"
      every?: number;
      channel?: string;
      agent?: string;
      disabled?: boolean;
    }
  ): Promise<string> {
    const args = ['node', 'viben', 'cron', 'add', '--name', name, '--message', options.message];

    // Use cron expression if provided, otherwise use interval
    if (options.cron) {
      args.push('--cron', options.cron);
    } else {
      args.push('--every', String(options.every || 3600));
    }

    if (options.channel) {
      args.push('--channel', options.channel);
    }
    if (options.agent) {
      args.push('--agent', options.agent);
    }
    if (options.disabled) {
      args.push('--disabled');
    }

    const program = createProgram();
    await program.parseAsync(args);

    // Job ID is derived from name (lowercase, hyphens)
    const jobId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    createdJobs.push(jobId);

    // Clear console output after setup
    consoleOutput.length = 0;

    return jobId;
  }

  describe('cron list', () => {
    it('should show message when no jobs exist or list existing ones', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'cron', 'list']);

      const output = consoleOutput.join('\n');
      // Either shows "No scheduled jobs" or lists existing jobs
      expect(output.length).toBeGreaterThan(0);
    });

    it('should list created cron jobs', async () => {
      const testName = `test-job-${Date.now()}`;
      await createTestCronJob(testName, { message: 'Good morning!', every: 3600 });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'cron', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain(testName.toLowerCase());
    });

    it('should output valid JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'cron', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.jobs).toBeDefined();
      expect(Array.isArray(parsed.data.jobs)).toBe(true);
    });
  });

  describe('cron add', () => {
    it('should add a job with 6-field cron expression (daily at 9 AM)', async () => {
      const testName = `add-cron-daily-${Date.now()}`;
      createdJobs.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', testName,
        '--message', 'Good morning!',
        '--cron', '0 0 9 * * *'  // 6-field: sec min hour day month weekday
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Created|OK|✓/);
    });

    it('should add a job with 6-field cron expression (weekdays at 8:30 AM)', async () => {
      const testName = `add-cron-weekday-${Date.now()}`;
      createdJobs.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', testName,
        '--message', 'Weekday reminder',
        '--cron', '0 30 8 * * 1-5'  // Monday to Friday at 8:30 AM
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Created|OK|✓/);
    });

    it('should add a job with 6-field cron expression (every minute)', async () => {
      const testName = `add-cron-minute-${Date.now()}`;
      createdJobs.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', testName,
        '--message', 'Every minute check',
        '--cron', '0 * * * * *'  // Every minute at second 0
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Created|OK|✓/);
    });

    it('should add a job with interval (--every)', async () => {
      const testName = `add-every-${Date.now()}`;
      createdJobs.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', testName,
        '--message', 'Checking in',
        '--every', '3600'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Created|OK|✓/);
    });

    it('should add job with cron and channel option', async () => {
      const testName = `add-cron-ch-${Date.now()}`;
      createdJobs.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', testName,
        '--message', 'Hello channel',
        '--cron', '0 0 12 * * *',  // Daily at noon
        '--channel', 'my-telegram'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Created|OK|✓/);
    });

    it('should add job with cron and agent option', async () => {
      const testName = `add-cron-agent-${Date.now()}`;
      createdJobs.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', testName,
        '--message', 'Hello agent',
        '--cron', '0 0 15 * * *',  // Daily at 3 PM
        '--agent', 'custom-agent'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Created|OK|✓/);
    });

    it('should create disabled job with cron and --disabled flag', async () => {
      const testName = `add-cron-dis-${Date.now()}`;
      createdJobs.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'add',
        '--name', testName,
        '--message', 'Not active',
        '--cron', '0 0 0 * * *',  // Daily at midnight
        '--disabled'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Created|OK|✓/);
    });

    it('should fail without schedule (neither cron nor every)', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'add',
          '--name', 'No Schedule',
          '--message', 'test'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should fail with invalid cron expression (random text)', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'add',
          '--name', 'Invalid Cron',
          '--message', 'test',
          '--cron', 'invalid cron expression'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should fail with standard 5-field cron expression (missing seconds)', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'add',
          '--name', 'Wrong Format',
          '--message', 'test',
          '--cron', '0 9 * * *'  // 5-field format (missing seconds) - should fail
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should fail if job ID already exists', async () => {
      const testName = `dup-job-${Date.now()}`;
      await createTestCronJob(testName, { message: 'test', every: 3600 });

      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'add',
          '--name', testName,
          '--message', 'duplicate',
          '--every', '3600'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should output JSON in json mode', async () => {
      const testName = `json-add-${Date.now()}`;
      createdJobs.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'cron', 'add',
        '--name', testName,
        '--message', 'test',
        '--every', '3600'
      ]);

      const parsed = findJsonOutput(consoleOutput) as { success: boolean; data: { job: { name: string } } };
      expect(parsed.success).toBe(true);
      expect(parsed.data.job).toBeDefined();
    });
  });

  describe('cron remove', () => {
    it('should remove an existing job', async () => {
      const testName = `rm-job-${Date.now()}`;
      const jobId = await createTestCronJob(testName, { message: 'goodbye', every: 3600 });

      // Remove from cleanup list since we're testing removal
      createdJobs = createdJobs.filter(id => id !== jobId);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'remove', jobId
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Removed|OK|✓/);
    });

    it('should fail for non-existent job', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'remove', 'nonexistent-job-xyz'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should output JSON in json mode', async () => {
      const testName = `json-rm-${Date.now()}`;
      const jobId = await createTestCronJob(testName, { message: 'test', every: 3600 });

      // Remove from cleanup list
      createdJobs = createdJobs.filter(id => id !== jobId);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'cron', 'remove', jobId
      ]);

      const parsed = findJsonOutput(consoleOutput) as { success: boolean };
      expect(parsed.success).toBe(true);
    });
  });

  describe('cron enable', () => {
    it('should enable a disabled job', async () => {
      const testName = `dis-job-${Date.now()}`;
      const jobId = await createTestCronJob(testName, { message: 'test', every: 3600, disabled: true });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'enable', jobId
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Enabled|OK|✓/);
    });

    it('should fail for non-existent job', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'enable', 'nonexistent-enable-xyz'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should output JSON in json mode', async () => {
      const testName = `json-en-${Date.now()}`;
      const jobId = await createTestCronJob(testName, { message: 'test', every: 3600, disabled: true });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'cron', 'enable', jobId
      ]);

      const parsed = findJsonOutput(consoleOutput) as { success: boolean; data: { job: { enabled: boolean } } };
      expect(parsed.success).toBe(true);
      expect(parsed.data.job).toBeDefined();
      expect(parsed.data.job.enabled).toBe(true);
    });
  });

  describe('cron disable', () => {
    it('should disable an enabled job', async () => {
      const testName = `en-job-${Date.now()}`;
      const jobId = await createTestCronJob(testName, { message: 'test', every: 3600 });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'disable', jobId
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Disabled|OK|✓/);
    });

    it('should fail for non-existent job', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'disable', 'nonexistent-disable-xyz'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should output JSON in json mode', async () => {
      const testName = `json-dis-${Date.now()}`;
      const jobId = await createTestCronJob(testName, { message: 'test', every: 3600 });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'cron', 'disable', jobId
      ]);

      const parsed = findJsonOutput(consoleOutput) as { success: boolean; data: { job: { enabled: boolean } } };
      expect(parsed.success).toBe(true);
      expect(parsed.data.job).toBeDefined();
      expect(parsed.data.job.enabled).toBe(false);
    });
  });

  describe('cron show', () => {
    it('should show job details', async () => {
      const testName = `show-job-${Date.now()}`;
      const jobId = await createTestCronJob(testName, {
        message: 'Hello world',
        every: 3600,
        channel: 'my-channel',
        agent: 'my-agent',
      });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'cron', 'show', jobId
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain(jobId);
    });

    it('should fail for non-existent job', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'cron', 'show', 'nonexistent-show-xyz'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should output JSON in json mode', async () => {
      const testName = `json-show-${Date.now()}`;
      const jobId = await createTestCronJob(testName, { message: 'test message', every: 7200 });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'cron', 'show', jobId
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.job).toBeDefined();
    });
  });
});
