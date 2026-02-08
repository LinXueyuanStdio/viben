/**
 * Integration tests for viben channel command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben channel', () => {
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

  /**
   * Create a channel configuration directly in the state directory
   */
  function createChannel(
    id: string,
    options: {
      type: string;
      token?: string;
      appId?: string;
      appSecret?: string;
      enabled?: boolean;
    }
  ): void {
    const stateDir = process.env.VIBEN_STATE_DIR!;
    fs.mkdirSync(stateDir, { recursive: true });

    const channelsPath = path.join(stateDir, 'channels.yaml');
    let config: { version: number; channels: Record<string, unknown>; default?: string } = {
      version: 1,
      channels: {},
    };

    // Read existing config if exists
    if (fs.existsSync(channelsPath)) {
      const yaml = require('yaml');
      config = yaml.parse(fs.readFileSync(channelsPath, 'utf-8'));
    }

    // Add channel
    config.channels[id] = {
      id,
      type: options.type,
      enabled: options.enabled ?? true,
      token: options.token,
      appId: options.appId,
      appSecret: options.appSecret,
      allowFrom: [],
    };

    // Write config
    const yaml = require('yaml');
    fs.writeFileSync(channelsPath, yaml.stringify(config));
  }

  /**
   * Set the default channel
   */
  function setDefaultChannel(id: string): void {
    const stateDir = process.env.VIBEN_STATE_DIR!;
    const channelsPath = path.join(stateDir, 'channels.yaml');
    const yaml = require('yaml');
    const config = yaml.parse(fs.readFileSync(channelsPath, 'utf-8'));
    config.default = id;
    fs.writeFileSync(channelsPath, yaml.stringify(config));
  }

  describe('channel list', () => {
    it('should show no channels when none exist', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'channel', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No channels configured');
    });

    it('should list existing channels', async () => {
      createChannel('my-telegram', { type: 'telegram', token: 'test-token' });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'channel', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('my-telegram');
      expect(output).toContain('telegram');
    });

    it('should list multiple channels', async () => {
      createChannel('telegram-bot', { type: 'telegram', token: 'token1' });
      createChannel('discord-bot', { type: 'discord', token: 'token2' });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'channel', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('telegram-bot');
      expect(output).toContain('discord-bot');
      expect(output).toContain('telegram');
      expect(output).toContain('discord');
    });

    it('should show enabled/disabled status', async () => {
      createChannel('enabled-ch', { type: 'telegram', token: 'token1', enabled: true });
      createChannel('disabled-ch', { type: 'telegram', token: 'token2', enabled: false });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'channel', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('enabled-ch');
      expect(output).toContain('disabled-ch');
      expect(output).toContain('enabled');
      expect(output).toContain('disabled');
    });

    it('should output JSON in json mode', async () => {
      createChannel('json-channel', { type: 'telegram', token: 'test' });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'channel', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.channels).toBeDefined();
      expect(parsed.data.channels).toHaveLength(1);
      expect(parsed.data.channels[0].id).toBe('json-channel');
    });
  });

  describe('channel create', () => {
    it('should create a telegram channel', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'create',
        '-n', 'my-telegram',
        '--type', 'telegram',
        '--token', 'test-bot-token'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created channel');
      expect(output).toContain('my-telegram');

      // Verify channel was created
      const channelsPath = path.join(process.env.VIBEN_STATE_DIR!, 'channels.yaml');
      expect(fs.existsSync(channelsPath)).toBe(true);
    });

    it('should create a discord channel', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'create',
        '-n', 'my-discord',
        '--type', 'discord',
        '--token', 'discord-bot-token'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created channel');
      expect(output).toContain('my-discord');
    });

    it('should create a feishu channel with required options', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'create',
        '-n', 'my-feishu',
        '--type', 'feishu',
        '--app-id', 'cli_test123',
        '--app-secret', 'secret123'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created channel');
      expect(output).toContain('my-feishu');
    });

    it('should create a whatsapp channel', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'create',
        '-n', 'my-whatsapp',
        '--type', 'whatsapp'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created channel');
      expect(output).toContain('my-whatsapp');
    });

    it('should fail without channel type', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', 'no-type'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail with invalid channel type', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', 'invalid',
          '--type', 'invalid-type'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail for telegram without token', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', 'no-token-telegram',
          '--type', 'telegram'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail for feishu without credentials', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', 'no-creds-feishu',
          '--type', 'feishu'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail if channel already exists', async () => {
      createChannel('existing', { type: 'telegram', token: 'test' });

      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', 'existing',
          '--type', 'telegram',
          '--token', 'new-token'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail with invalid channel ID (starts with number)', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'create',
          '-n', '123-invalid',
          '--type', 'telegram',
          '--token', 'test'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should create channel as disabled with --disabled flag', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'create',
        '-n', 'disabled-channel',
        '--type', 'telegram',
        '--token', 'test-token',
        '--disabled'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created channel');
    });

    it('should set as default with --set-default flag', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'create',
        '-n', 'default-channel',
        '--type', 'telegram',
        '--token', 'test-token',
        '--set-default'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Created channel');
      expect(output).toContain('Default: yes');
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'create',
        '-n', 'json-channel',
        '--type', 'telegram',
        '--token', 'test'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.id).toBe('json-channel');
      expect(parsed.data.type).toBe('telegram');
    });
  });

  describe('channel remove', () => {
    it('should remove an existing channel', async () => {
      createChannel('to-remove', { type: 'telegram', token: 'test' });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'remove',
        '-n', 'to-remove'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Removed channel');
      expect(output).toContain('to-remove');
    });

    it('should remove channel with --force flag', async () => {
      createChannel('force-remove', { type: 'discord', token: 'test' });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'remove',
        '-n', 'force-remove',
        '--force'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Removed channel');
    });

    it('should fail for non-existent channel', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'remove',
          '-n', 'nonexistent'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createChannel('json-remove', { type: 'telegram', token: 'test' });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'remove',
        '-n', 'json-remove',
        '--force'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.removed).toBe(true);
    });
  });

  describe('channel enable', () => {
    it('should enable a disabled channel', async () => {
      createChannel('disabled-ch', { type: 'telegram', token: 'test', enabled: false });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'enable',
        '-n', 'disabled-ch'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Enabled channel');
      expect(output).toContain('disabled-ch');
    });

    it('should fail for non-existent channel', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'enable',
          '-n', 'nonexistent'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createChannel('json-enable', { type: 'telegram', token: 'test', enabled: false });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'enable',
        '-n', 'json-enable'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.enabled).toBe(true);
    });
  });

  describe('channel disable', () => {
    it('should disable an enabled channel', async () => {
      createChannel('enabled-ch', { type: 'telegram', token: 'test', enabled: true });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'disable',
        '-n', 'enabled-ch'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Disabled channel');
      expect(output).toContain('enabled-ch');
    });

    it('should fail for non-existent channel', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'disable',
          '-n', 'nonexistent'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createChannel('json-disable', { type: 'telegram', token: 'test', enabled: true });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'disable',
        '-n', 'json-disable'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.enabled).toBe(false);
    });
  });

  describe('channel set-default', () => {
    it('should set a channel as default', async () => {
      createChannel('new-default', { type: 'telegram', token: 'test' });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'set-default',
        '-n', 'new-default'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('new-default');
      expect(output).toContain('default');
    });

    it('should fail for non-existent channel', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'set-default',
          '-n', 'nonexistent'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createChannel('json-default', { type: 'telegram', token: 'test' });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'set-default',
        '-n', 'json-default'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.isDefault).toBe(true);
    });
  });

  describe('channel status', () => {
    it('should show status for all channels when no name specified', async () => {
      createChannel('status-ch1', { type: 'telegram', token: 'test1' });
      createChannel('status-ch2', { type: 'discord', token: 'test2' });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'status'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('status-ch1');
      expect(output).toContain('status-ch2');
      expect(output).toContain('Status');
    });

    it('should show no channels message when none exist', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'status'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No channels configured');
    });

    it('should show status for specific channel', async () => {
      createChannel('specific-ch', { type: 'telegram', token: 'test', enabled: false });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'channel', 'status',
        '-n', 'specific-ch'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('specific-ch');
      expect(output).toContain('telegram');
    });

    it('should fail for non-existent specific channel', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'channel', 'status',
          '-n', 'nonexistent'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode for all channels', async () => {
      createChannel('json-status', { type: 'telegram', token: 'test' });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'status'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.channels).toBeDefined();
    });

    it('should output JSON in json mode for specific channel', async () => {
      createChannel('json-specific', { type: 'discord', token: 'test', enabled: false });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'channel', 'status',
        '-n', 'json-specific'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.id).toBe('json-specific');
      expect(parsed.data.type).toBe('discord');
    });
  });
});
