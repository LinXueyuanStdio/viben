/**
 * Integration tests for viben channel command
 *
 * Note: Current NAPI implementation only supports global scope.
 * Channels are stored in: $VIBEN_STATE_DIR/channels.yaml
 *
 * LIMITATION: NAPI modules are loaded once at process start and cannot be reset.
 * Setting VIBEN_STATE_DIR after the module loads has no effect.
 * These tests verify CLI behavior with the global state directory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben channel', () => {
  let originalCwd: string;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let createdChannels: string[] = [];

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

    // Clean up any channels created during tests
    for (const channelId of createdChannels) {
      try {
        const { channelRemove } = await import('../../src/lib/native');
        await channelRemove(channelId);
      } catch {
        // Ignore errors during cleanup
      }
    }
    createdChannels = [];
  });

  /**
   * Helper to create a telegram channel and track it for cleanup
   * Telegram requires: --token and --chat-id
   */
  async function createTestChannel(
    name: string,
    options: {
      type?: string;
      token?: string;
      chatId?: string;
      appId?: string;
      appSecret?: string;
      disabled?: boolean;
      setDefault?: boolean;
    } = {}
  ): Promise<string> {
    const channelType = options.type || 'telegram';
    const args = ['node', 'viben', 'channel', 'create', '-n', name, '--type', channelType];

    // Telegram requires token and chat_id
    if (channelType === 'telegram') {
      args.push('--token', options.token || 'test-token-123');
      args.push('--chat-id', options.chatId || '123456789');
    } else if (channelType === 'discord') {
      args.push('--token', options.token || 'test-token-123');
    } else if (channelType === 'feishu') {
      args.push('--app-id', options.appId || 'cli_test123');
      args.push('--app-secret', options.appSecret || 'secret123');
    }

    if (options.disabled) {
      args.push('--disabled');
    }
    if (options.setDefault) {
      args.push('--set-default');
    }

    const program = createProgram();
    await program.parseAsync(args);

    // Track for cleanup - channel ID is derived from name (lowercase, hyphens)
    const channelId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    createdChannels.push(channelId);

    // Clear console output after setup
    consoleOutput.length = 0;

    return channelId;
  }

  describe('channel list', () => {
    it('should show message when no channels exist or list existing ones', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'channel', 'list']);

      const output = consoleOutput.join('\n');
      // Either shows "No channels configured" or lists existing channels
      expect(output.length).toBeGreaterThan(0);
    });

    it('should list created channels', async () => {
      const testName = `test-ch-${Date.now()}`;
      await createTestChannel(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'channel', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain(testName.toLowerCase());
    });

    it('should output valid JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'channel', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.channels).toBeDefined();
      expect(Array.isArray(parsed.data.channels)).toBe(true);
    });
  });

  describe('channel create', () => {
    it('should create a telegram channel', async () => {
      const testName = `tg-ch-${Date.now()}`;
      createdChannels.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'create',
        '-n', testName,
        '--type', 'telegram',
        '--token', 'test-bot-token',
        '--chat-id', '123456789'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/OK|Created|✓/);
    });

    it('should create a discord channel', async () => {
      const testName = `dc-ch-${Date.now()}`;
      createdChannels.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'create',
        '-n', testName,
        '--type', 'discord',
        '--token', 'discord-bot-token'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/OK|Created|✓/);
    });

    it('should create a feishu channel with required options', async () => {
      const testName = `fs-ch-${Date.now()}`;
      createdChannels.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'create',
        '-n', testName,
        '--type', 'feishu',
        '--app-id', 'cli_test123',
        '--app-secret', 'secret123'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/OK|Created|✓/);
    });

    it('should create a whatsapp channel', async () => {
      const testName = `wa-ch-${Date.now()}`;
      createdChannels.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'create',
        '-n', testName,
        '--type', 'whatsapp'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/OK|Created|✓/);
    });

    it('should fail without channel type', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', 'no-type'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should fail with invalid channel type', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', 'invalid',
          '--type', 'invalid-type'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should fail for telegram without token', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', 'no-token-telegram',
          '--type', 'telegram'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should fail for feishu without credentials', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', 'no-creds-feishu',
          '--type', 'feishu'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should fail if channel already exists', async () => {
      const testName = `dup-ch-${Date.now()}`;
      await createTestChannel(testName);

      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', testName,
          '--type', 'telegram',
          '--token', 'new-token',
          '--chat-id', '987654321'
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
      const testName = `json-ch-${Date.now()}`;
      createdChannels.push(testName.toLowerCase());

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'create',
        '-n', testName,
        '--type', 'telegram',
        '--token', 'test',
        '--chat-id', '123456789'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      // The JSON output has the channel data directly in data (not data.channel)
      expect(parsed.data).toBeDefined();
      expect(parsed.data.id || parsed.data.channel).toBeDefined();
    });
  });

  describe('channel remove', () => {
    it('should remove an existing channel', async () => {
      const testName = `rm-ch-${Date.now()}`;
      const channelId = await createTestChannel(testName);

      // Remove from cleanup list since we're testing removal
      createdChannels = createdChannels.filter(id => id !== channelId);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'remove',
        '-n', channelId
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/OK|Removed|✓/);
    });

    it('should remove channel with --force flag', async () => {
      const testName = `force-rm-${Date.now()}`;
      const channelId = await createTestChannel(testName, { type: 'discord', token: 'test' });

      // Remove from cleanup list
      createdChannels = createdChannels.filter(id => id !== channelId);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'remove',
        '-n', channelId,
        '--force'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/OK|Removed|✓/);
    });

    it('should fail for non-existent channel', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'remove',
          '-n', 'nonexistent-channel-xyz'
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
      const channelId = await createTestChannel(testName);

      // Remove from cleanup list
      createdChannels = createdChannels.filter(id => id !== channelId);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'remove',
        '-n', channelId,
        '--force'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
    });
  });

  describe('channel enable', () => {
    it('should enable a disabled channel', async () => {
      const testName = `dis-ch-${Date.now()}`;
      const channelId = await createTestChannel(testName, { disabled: true });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'enable',
        '-n', channelId
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/OK|Enabled|✓/);
    });

    it('should fail for non-existent channel', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'enable',
          '-n', 'nonexistent-enable-xyz'
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
      const channelId = await createTestChannel(testName, { disabled: true });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'enable',
        '-n', channelId
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
    });
  });

  describe('channel disable', () => {
    it('should disable an enabled channel', async () => {
      const testName = `en-ch-${Date.now()}`;
      const channelId = await createTestChannel(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'disable',
        '-n', channelId
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/OK|Disabled|✓/);
    });

    it('should fail for non-existent channel', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'disable',
          '-n', 'nonexistent-disable-xyz'
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
      const channelId = await createTestChannel(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'disable',
        '-n', channelId
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
    });
  });

  describe('channel set-default', () => {
    it('should set a channel as default', async () => {
      const testName = `def-ch-${Date.now()}`;
      const channelId = await createTestChannel(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'set-default',
        '-n', channelId
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/OK|default|✓/);
    });

    it('should fail for non-existent channel', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'set-default',
          '-n', 'nonexistent-default-xyz'
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
      const testName = `json-def-${Date.now()}`;
      const channelId = await createTestChannel(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'set-default',
        '-n', channelId
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
    });
  });

  describe('channel status', () => {
    it('should show status for channels', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'status'
      ]);

      const output = consoleOutput.join('\n');
      // Either shows "No channels" or lists status
      expect(output.length).toBeGreaterThan(0);
    });

    it('should show status for specific channel', async () => {
      const testName = `stat-ch-${Date.now()}`;
      const channelId = await createTestChannel(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'status',
        '-n', channelId
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain(channelId);
    });

    it('should fail for non-existent specific channel', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'status',
          '-n', 'nonexistent-status-xyz'
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
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'status'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
    });
  });
});
