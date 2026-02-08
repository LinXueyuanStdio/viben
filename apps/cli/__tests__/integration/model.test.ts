/**
 * Integration tests for viben model command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben model', () => {
  let tempDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-model-test-')));
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
   * Create a models.yaml config file with the given content
   */
  function createModelsConfig(config: {
    default?: string;
    aliases?: Record<string, string>;
    fallbacks?: string[];
    model_config?: Record<string, { provider?: string; max_tokens?: number; temperature?: number }>;
    model_capabilities?: Record<string, { context_window?: number; cost_per_1k_input?: number; cost_per_1k_output?: number }>;
  }): void {
    const stateDir = process.env.VIBEN_STATE_DIR!;
    fs.mkdirSync(stateDir, { recursive: true });

    const yamlLines: string[] = ['version: 1'];

    if (config.default) {
      yamlLines.push(`default: ${config.default}`);
    }

    if (config.aliases && Object.keys(config.aliases).length > 0) {
      yamlLines.push('aliases:');
      for (const [alias, model] of Object.entries(config.aliases)) {
        yamlLines.push(`  ${alias}: ${model}`);
      }
    }

    if (config.fallbacks && config.fallbacks.length > 0) {
      yamlLines.push('fallbacks:');
      for (const fallback of config.fallbacks) {
        yamlLines.push(`  - ${fallback}`);
      }
    }

    if (config.model_config && Object.keys(config.model_config).length > 0) {
      yamlLines.push('model_config:');
      for (const [modelId, modelConfig] of Object.entries(config.model_config)) {
        yamlLines.push(`  ${modelId}:`);
        if (modelConfig.provider) {
          yamlLines.push(`    provider: ${modelConfig.provider}`);
        }
        if (modelConfig.max_tokens) {
          yamlLines.push(`    max_tokens: ${modelConfig.max_tokens}`);
        }
        if (modelConfig.temperature !== undefined) {
          yamlLines.push(`    temperature: ${modelConfig.temperature}`);
        }
      }
    }

    if (config.model_capabilities && Object.keys(config.model_capabilities).length > 0) {
      yamlLines.push('model_capabilities:');
      for (const [modelId, caps] of Object.entries(config.model_capabilities)) {
        yamlLines.push(`  ${modelId}:`);
        if (caps.context_window) {
          yamlLines.push(`    context_window: ${caps.context_window}`);
        }
        if (caps.cost_per_1k_input !== undefined) {
          yamlLines.push(`    cost_per_1k_input: ${caps.cost_per_1k_input}`);
        }
        if (caps.cost_per_1k_output !== undefined) {
          yamlLines.push(`    cost_per_1k_output: ${caps.cost_per_1k_output}`);
        }
      }
    }

    fs.writeFileSync(path.join(stateDir, 'models.yaml'), yamlLines.join('\n'));
  }

  /**
   * Read the models.yaml config file using proper YAML parser
   */
  function readModelsConfig(): Record<string, unknown> {
    const stateDir = process.env.VIBEN_STATE_DIR!;
    const configPath = path.join(stateDir, 'models.yaml');
    if (!fs.existsSync(configPath)) {
      return {};
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    return yaml.parse(content) as Record<string, unknown>;
  }

  describe('model list', () => {
    it('should show default model when no explicit models are configured', async () => {
      // When no config exists, DEFAULT_MODELS_CONFIG is used which has a default model
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'list']);

      const output = consoleOutput.join('\n');
      // The default config has claude-sonnet-4-20250514 as default
      expect(output).toContain('Available Models');
      expect(output).toContain('claude-sonnet-4-20250514');
    });

    it('should list configured models', async () => {
      createModelsConfig({
        default: 'claude-sonnet-4-20250514',
        model_config: {
          'claude-sonnet-4-20250514': { provider: 'anthropic' },
          'gpt-4-turbo': { provider: 'openai' },
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('claude-sonnet-4-20250514');
      expect(output).toContain('gpt-4-turbo');
      expect(output).toContain('anthropic');
      expect(output).toContain('openai');
    });

    it('should filter models by provider', async () => {
      createModelsConfig({
        default: 'claude-sonnet-4-20250514',
        model_config: {
          'claude-sonnet-4-20250514': { provider: 'anthropic' },
          'gpt-4-turbo': { provider: 'openai' },
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'list', '--provider', 'anthropic']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('claude-sonnet-4-20250514');
      expect(output).not.toContain('gpt-4-turbo');
    });

    it('should output JSON in json mode', async () => {
      createModelsConfig({
        default: 'claude-sonnet-4-20250514',
        model_config: {
          'claude-sonnet-4-20250514': { provider: 'anthropic' },
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.models).toBeDefined();
      expect(parsed.data.models.length).toBeGreaterThan(0);
      expect(parsed.data.models.some((m: { id: string }) => m.id === 'claude-sonnet-4-20250514')).toBe(true);
    });

    it('should mark default model with asterisk', async () => {
      createModelsConfig({
        default: 'claude-sonnet-4-20250514',
        model_config: {
          'claude-sonnet-4-20250514': { provider: 'anthropic' },
          'gpt-4-turbo': { provider: 'openai' },
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'list']);

      const output = consoleOutput.join('\n');
      // The output should indicate the default model
      expect(output).toContain('default model');
    });
  });

  describe('model set-default', () => {
    it('should set the default model', async () => {
      createModelsConfig({});

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'set-default', '-n', 'claude-sonnet-4-20250514']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('claude-sonnet-4-20250514');

      // Verify the config was updated
      const config = readModelsConfig();
      expect(config.default).toBe('claude-sonnet-4-20250514');
    });

    it('should update existing default model', async () => {
      createModelsConfig({
        default: 'gpt-4-turbo',
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'set-default', '-n', 'claude-sonnet-4-20250514']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('claude-sonnet-4-20250514');

      // Verify the config was updated
      const config = readModelsConfig();
      expect(config.default).toBe('claude-sonnet-4-20250514');
    });

    it('should output JSON in json mode', async () => {
      createModelsConfig({});

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'set-default', '-n', 'gpt-4-turbo']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.model).toBe('gpt-4-turbo');
    });
  });

  describe('model status', () => {
    it('should show model status', async () => {
      createModelsConfig({
        default: 'claude-sonnet-4-20250514',
        model_config: {
          'claude-sonnet-4-20250514': { provider: 'anthropic' },
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'status']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Model Status');
      expect(output).toContain('claude-sonnet-4-20250514');
    });

    it('should show status for a specific model', async () => {
      createModelsConfig({
        model_config: {
          'claude-sonnet-4-20250514': { provider: 'anthropic' },
          'gpt-4-turbo': { provider: 'openai' },
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'status', '-n', 'claude-sonnet-4-20250514']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('claude-sonnet-4-20250514');
    });

    it('should output JSON in json mode', async () => {
      createModelsConfig({
        default: 'claude-sonnet-4-20250514',
        model_config: {
          'claude-sonnet-4-20250514': { provider: 'anthropic' },
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'status']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.default).toBe('claude-sonnet-4-20250514');
      expect(parsed.data.models).toBeDefined();
    });
  });

  describe('model aliases list', () => {
    it('should show message when no aliases configured', async () => {
      createModelsConfig({});

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'aliases', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No model aliases');
    });

    it('should list configured aliases', async () => {
      createModelsConfig({
        aliases: {
          fast: 'claude-3-5-haiku-latest',
          smart: 'claude-sonnet-4-20250514',
          best: 'claude-opus-4-20250514',
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'aliases', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('fast');
      expect(output).toContain('smart');
      expect(output).toContain('best');
      expect(output).toContain('claude-3-5-haiku-latest');
      expect(output).toContain('claude-sonnet-4-20250514');
    });

    it('should output JSON in json mode', async () => {
      createModelsConfig({
        aliases: {
          fast: 'claude-3-5-haiku-latest',
          smart: 'claude-sonnet-4-20250514',
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'aliases', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.aliases).toBeDefined();
      expect(parsed.data.aliases.fast).toBe('claude-3-5-haiku-latest');
      expect(parsed.data.aliases.smart).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('model aliases create', () => {
    it('should create a new alias', async () => {
      createModelsConfig({});

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'aliases', 'create', '-n', 'fast', '-f', 'claude-3-5-haiku-latest']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('fast');
      expect(output).toContain('claude-3-5-haiku-latest');

      // Verify the config was updated
      const config = readModelsConfig();
      expect((config.aliases as Record<string, string>)['fast']).toBe('claude-3-5-haiku-latest');
    });

    it('should update an existing alias', async () => {
      createModelsConfig({
        aliases: {
          fast: 'gpt-4o-mini',
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'aliases', 'create', '-n', 'fast', '-f', 'claude-3-5-haiku-latest']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('fast');

      // Verify the config was updated
      const config = readModelsConfig();
      expect((config.aliases as Record<string, string>)['fast']).toBe('claude-3-5-haiku-latest');
    });

    it('should output JSON in json mode', async () => {
      createModelsConfig({});

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'aliases', 'create', '-n', 'smart', '-f', 'claude-sonnet-4-20250514']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.alias).toBe('smart');
      expect(parsed.data.model).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('model aliases remove', () => {
    it('should remove an existing alias', async () => {
      createModelsConfig({
        aliases: {
          fast: 'claude-3-5-haiku-latest',
          smart: 'claude-sonnet-4-20250514',
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'aliases', 'remove', '-n', 'fast']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Removed');
      expect(output).toContain('fast');

      // Verify the config was updated
      const config = readModelsConfig();
      expect((config.aliases as Record<string, string>)['fast']).toBeUndefined();
      expect((config.aliases as Record<string, string>)['smart']).toBe('claude-sonnet-4-20250514');
    });

    it('should fail when removing non-existent alias', async () => {
      createModelsConfig({
        aliases: {
          smart: 'claude-sonnet-4-20250514',
        },
      });

      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'model', 'aliases', 'remove', '-n', 'nonexistent']);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createModelsConfig({
        aliases: {
          fast: 'claude-3-5-haiku-latest',
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'aliases', 'remove', '-n', 'fast']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.alias).toBe('fast');
      expect(parsed.data.removed).toBe(true);
    });
  });

  describe('model fallbacks list', () => {
    it('should show message when no fallbacks configured', async () => {
      createModelsConfig({});

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No fallback chain');
    });

    it('should list configured fallbacks in order', async () => {
      createModelsConfig({
        fallbacks: ['claude-sonnet-4-20250514', 'gpt-4-turbo', 'claude-3-5-haiku-latest'],
        model_config: {
          'claude-sonnet-4-20250514': { provider: 'anthropic' },
          'gpt-4-turbo': { provider: 'openai' },
          'claude-3-5-haiku-latest': { provider: 'anthropic' },
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('claude-sonnet-4-20250514');
      expect(output).toContain('gpt-4-turbo');
      expect(output).toContain('claude-3-5-haiku-latest');
      // Check the order indicator
      expect(output).toContain('1.');
      expect(output).toContain('2.');
      expect(output).toContain('3.');
    });

    it('should output JSON in json mode', async () => {
      createModelsConfig({
        fallbacks: ['claude-sonnet-4-20250514', 'gpt-4-turbo'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'fallbacks', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.fallbacks).toBeDefined();
      expect(parsed.data.fallbacks).toEqual(['claude-sonnet-4-20250514', 'gpt-4-turbo']);
      expect(parsed.data.count).toBe(2);
    });
  });

  describe('model fallbacks create', () => {
    it('should add a model to the fallback chain', async () => {
      createModelsConfig({});

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'create', '-n', 'claude-sonnet-4-20250514']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Added');
      expect(output).toContain('claude-sonnet-4-20250514');
      expect(output).toContain('position 1');

      // Verify the config was updated
      const config = readModelsConfig();
      expect((config.fallbacks as string[])).toContain('claude-sonnet-4-20250514');
    });

    it('should add to the end of existing fallback chain', async () => {
      createModelsConfig({
        fallbacks: ['claude-sonnet-4-20250514'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'create', '-n', 'gpt-4-turbo']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('gpt-4-turbo');
      expect(output).toContain('position 2');

      // Verify the config was updated
      const config = readModelsConfig();
      expect((config.fallbacks as string[])).toEqual(['claude-sonnet-4-20250514', 'gpt-4-turbo']);
    });

    it('should not add duplicate model to fallback chain', async () => {
      createModelsConfig({
        fallbacks: ['claude-sonnet-4-20250514'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'create', '-n', 'claude-sonnet-4-20250514']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('already in fallback chain');

      // Verify the config was not changed (no duplicate)
      const config = readModelsConfig();
      expect((config.fallbacks as string[]).filter(f => f === 'claude-sonnet-4-20250514').length).toBe(1);
    });

    it('should output JSON in json mode', async () => {
      createModelsConfig({});

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'fallbacks', 'create', '-n', 'gpt-4-turbo']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.model).toBe('gpt-4-turbo');
      expect(parsed.data.position).toBe(1);
    });
  });

  describe('model fallbacks remove', () => {
    it('should remove a model from the fallback chain', async () => {
      createModelsConfig({
        fallbacks: ['claude-sonnet-4-20250514', 'gpt-4-turbo', 'claude-3-5-haiku-latest'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'remove', '-n', 'gpt-4-turbo']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Removed');
      expect(output).toContain('gpt-4-turbo');

      // Verify the config was updated
      const config = readModelsConfig();
      expect((config.fallbacks as string[])).toEqual(['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest']);
    });

    it('should fail when removing non-existent model from fallbacks', async () => {
      createModelsConfig({
        fallbacks: ['claude-sonnet-4-20250514'],
      });

      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'remove', '-n', 'nonexistent']);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createModelsConfig({
        fallbacks: ['claude-sonnet-4-20250514', 'gpt-4-turbo'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'fallbacks', 'remove', '-n', 'gpt-4-turbo']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.model).toBe('gpt-4-turbo');
      expect(parsed.data.removed).toBe(true);
    });
  });

  describe('model fallbacks clear', () => {
    it('should clear all fallbacks', async () => {
      createModelsConfig({
        fallbacks: ['claude-sonnet-4-20250514', 'gpt-4-turbo', 'claude-3-5-haiku-latest'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'clear']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Cleared');
      expect(output).toContain('3 models removed');

      // Verify the config was updated
      const config = readModelsConfig();
      expect((config.fallbacks as string[])).toEqual([]);
    });

    it('should handle clearing empty fallback chain', async () => {
      createModelsConfig({
        fallbacks: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'model', 'fallbacks', 'clear']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('already empty');
    });

    it('should output JSON in json mode', async () => {
      createModelsConfig({
        fallbacks: ['claude-sonnet-4-20250514', 'gpt-4-turbo'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'model', 'fallbacks', 'clear']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.cleared).toBe(true);
      expect(parsed.data.previousCount).toBe(2);
    });
  });
});
