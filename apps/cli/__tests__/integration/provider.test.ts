/**
 * Integration tests for viben provider command
 *
 * Note: Current NAPI implementation only supports global scope.
 * Providers are stored in: $VIBEN_STATE_DIR/providers.yaml
 *
 * LIMITATION: NAPI modules are loaded once at process start and cannot be reset.
 * Setting VIBEN_STATE_DIR after the module loads has no effect.
 * These tests verify CLI behavior with the global state directory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben provider', () => {
  let originalCwd: string;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let createdProviders: string[] = [];

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

    // Clean up any providers created during tests
    for (const providerId of createdProviders) {
      try {
        const { providerRemove } = await import('../../src/lib/native');
        await providerRemove(providerId);
      } catch {
        // Ignore errors during cleanup
      }
    }
    createdProviders = [];
  });

  /**
   * Helper to create a provider and track it for cleanup
   */
  async function createTestProvider(
    name: string,
    options: {
      type: string;
      apiKey?: string;
      baseUrl?: string;
    }
  ): Promise<string> {
    const args = ['node', 'viben', 'provider', 'create', '-n', name, '-t', options.type];

    if (options.apiKey) {
      args.push('--api-key', options.apiKey);
    }
    if (options.baseUrl) {
      args.push('--base-url', options.baseUrl);
    }

    const program = createProgram();
    await program.parseAsync(args);

    // Track for cleanup
    createdProviders.push(name);

    // Clear console output after setup
    consoleOutput.length = 0;

    return name;
  }

  describe('provider list', () => {
    it('should show message when no providers exist or list existing ones', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'list']);

      const output = consoleOutput.join('\n');
      // Either shows "No providers configured" or lists existing providers
      expect(output.length).toBeGreaterThan(0);
    });

    it('should list created providers', async () => {
      const testName = `test-prov-${Date.now()}`;
      await createTestProvider(testName, { type: 'openai' });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain(testName);
    });

    it('should output valid JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'provider', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.providers).toBeDefined();
      expect(Array.isArray(parsed.data.providers)).toBe(true);
    });
  });

  describe('provider create', () => {
    it('should create openai provider', async () => {
      const testName = `openai-${Date.now()}`;
      createdProviders.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-n', testName, '-t', 'openai']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });

    it('should create anthropic provider', async () => {
      const testName = `anthropic-${Date.now()}`;
      createdProviders.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-n', testName, '-t', 'anthropic']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });

    it('should create ollama provider', async () => {
      const testName = `ollama-${Date.now()}`;
      createdProviders.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-n', testName, '-t', 'ollama']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });

    it('should create custom provider with base url', async () => {
      const testName = `custom-${Date.now()}`;
      createdProviders.push(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'provider', 'create',
        '-n', testName,
        '-t', 'custom',
        '--base-url', 'https://api.example.com/v1'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });

    it('should fail with invalid provider type', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'provider', 'create',
          '-n', 'invalid-type-test',
          '-t', 'invalid-type'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should fail if provider already exists', async () => {
      const testName = `dup-prov-${Date.now()}`;
      await createTestProvider(testName, { type: 'openai' });

      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'provider', 'create',
          '-n', testName,
          '-t', 'anthropic'
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
      const testName = `json-prov-${Date.now()}`;
      createdProviders.push(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'provider', 'create',
        '-n', testName,
        '-t', 'anthropic'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.provider).toBeDefined();
      expect(parsed.data.provider.name).toBe(testName);
    });

    it('should create google provider', async () => {
      const testName = `google-${Date.now()}`;
      createdProviders.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-n', testName, '-t', 'google']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });

    it('should create azure provider', async () => {
      const testName = `azure-${Date.now()}`;
      createdProviders.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-n', testName, '-t', 'azure']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });

    it('should create openrouter provider', async () => {
      const testName = `openrouter-${Date.now()}`;
      createdProviders.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-n', testName, '-t', 'openrouter']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });
  });

  describe('provider remove', () => {
    it('should remove existing provider', async () => {
      const testName = `rm-prov-${Date.now()}`;
      await createTestProvider(testName, { type: 'openai' });

      // Remove from cleanup list since we're testing removal
      createdProviders = createdProviders.filter(id => id !== testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'remove', '-n', testName]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });

    it('should fail when provider does not exist', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync(['node', 'viben', 'provider', 'remove', '-n', 'nonexistent-prov-xyz']);
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
      await createTestProvider(testName, { type: 'openai' });

      // Remove from cleanup list
      createdProviders = createdProviders.filter(id => id !== testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'provider', 'remove',
        '-n', testName
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
    });
  });

  describe('provider set-default', () => {
    it('should set default provider', async () => {
      const testName = `def-prov-${Date.now()}`;
      await createTestProvider(testName, { type: 'openai' });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'set-default', '-n', testName]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });

    it('should fail when provider does not exist', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync(['node', 'viben', 'provider', 'set-default', '-n', 'nonexistent-def-xyz']);
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
      await createTestProvider(testName, { type: 'openai' });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'provider', 'set-default',
        '-n', testName
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
    });
  });

  describe('provider status', () => {
    it('should show status for providers', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'status']);

      const output = consoleOutput.join('\n');
      // Either shows "No providers" or lists status
      expect(output.length).toBeGreaterThan(0);
    });

    it('should show status for specific provider', async () => {
      const testName = `stat-prov-${Date.now()}`;
      await createTestProvider(testName, { type: 'openai' });

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'provider', 'status',
        '-n', testName
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain(testName);
    });

    it('should fail for non-existent provider with -n option', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'provider', 'status',
          '-n', 'nonexistent-stat-xyz'
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
      await program.parseAsync(['node', 'viben', '--json', 'provider', 'status']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
    });
  });

  describe('provider name validation', () => {
    it('should reject name starting with number', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'provider', 'create',
          '-n', '123invalid',
          '-t', 'openai'
        ]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should accept name with hyphens and underscores', async () => {
      const testName = `my-custom_provider-${Date.now()}`;
      createdProviders.push(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'provider', 'create',
        '-n', testName,
        '-t', 'openai'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });
  });
});
