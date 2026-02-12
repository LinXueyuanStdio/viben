/**
 * Integration tests for viben model command
 *
 * Note: Current NAPI implementation only supports global scope.
 * Models are configured in: $VIBEN_STATE_DIR/models.yaml
 *
 * LIMITATION: NAPI modules are loaded once at process start and cannot be reset.
 * Setting VIBEN_STATE_DIR after the module loads has no effect.
 * These tests verify CLI behavior with the global state directory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben model', () => {
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

  describe('model list', () => {
    it('should list models', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Available Models');
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.models).toBeDefined();
      expect(Array.isArray(parsed.data.models)).toBe(true);
    });

    it('should accept --provider filter', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'list', '--provider', 'anthropic']);

      const output = consoleOutput.join('\n');
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe('model set-default', () => {
    it('should set default model', async () => {
      const testModel = 'gpt-4-turbo';

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'set-default', '-n', testModel]);

      const output = consoleOutput.join('\n');
      expect(output).toContain(testModel);
    });

    it('should output JSON in json mode', async () => {
      // Use a model that exists in default config
      const testModel = 'gpt-4-turbo';

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'set-default', '-n', testModel]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.model).toBe(testModel);
    });
  });

  describe('model status', () => {
    it('should show model status', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'status']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Model Status');
    });

    it('should show status for a specific model', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'status', '-n', 'gpt-4-turbo']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('gpt-4-turbo');
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'status']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.default).toBeDefined();
    });
  });

  describe('model aliases list', () => {
    it('should show aliases or empty message', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'aliases', 'list']);

      const output = consoleOutput.join('\n');
      // Either shows "No model aliases" or lists existing aliases
      expect(output.length).toBeGreaterThan(0);
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'aliases', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.aliases).toBeDefined();
    });
  });

  describe('model aliases create', () => {
    it('should create an alias', async () => {
      const testAlias = `test-alias-${Date.now()}`;
      const testModel = 'gpt-4-turbo';

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'aliases', 'create', '-n', testAlias, '-f', testModel]);

      const output = consoleOutput.join('\n');
      expect(output).toContain(testAlias);
      expect(output).toContain(testModel);

      // Clean up: remove the alias
      consoleOutput.length = 0;
      const program2 = createProgram();
      await program2.parseAsync(['node', 'viben', 'model', 'aliases', 'remove', '-n', testAlias]);
    });

    it('should output JSON in json mode', async () => {
      const testAlias = `json-alias-${Date.now()}`;
      const testModel = 'claude-sonnet-4-20250514';

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'aliases', 'create', '-n', testAlias, '-f', testModel]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.alias).toBe(testAlias);
      expect(parsed.data.model).toBe(testModel);

      // Clean up: remove the alias
      consoleOutput.length = 0;
      const program2 = createProgram();
      await program2.parseAsync(['node', 'viben', 'model', 'aliases', 'remove', '-n', testAlias]);
    });
  });

  describe('model aliases remove', () => {
    it('should fail when removing non-existent alias', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync(['node', 'viben', 'model', 'aliases', 'remove', '-n', 'nonexistent-alias-xyz']);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });
  });

  describe('model fallbacks list', () => {
    it('should show fallbacks or empty message', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'list']);

      const output = consoleOutput.join('\n');
      // Either shows "No fallback chain" or lists existing fallbacks
      expect(output.length).toBeGreaterThan(0);
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'fallbacks', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.fallbacks).toBeDefined();
    });
  });

  describe('model fallbacks create', () => {
    it('should add model to fallback chain', async () => {
      const testModel = 'gpt-4-turbo';

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'create', '-n', testModel]);

      const output = consoleOutput.join('\n');
      // Should either add it or say it's already in the chain
      expect(output.length).toBeGreaterThan(0);
    });

    it('should output JSON in json mode', async () => {
      const testModel = 'claude-sonnet-4-20250514';

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'fallbacks', 'create', '-n', testModel]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.model).toBe(testModel);
    });
  });

  describe('model fallbacks remove', () => {
    it('should fail when removing non-existent model from fallbacks', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'remove', '-n', 'nonexistent-model-xyz']);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });
  });

  describe('model fallbacks clear', () => {
    it('should clear fallbacks or show empty message', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'clear']);

      const output = consoleOutput.join('\n');
      // Either shows "Cleared" or "already empty"
      expect(output.length).toBeGreaterThan(0);
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'fallbacks', 'clear']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.cleared).toBeDefined();
    });
  });
});
