/**
 * Integration tests for viben provider command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben provider', () => {
  let tempDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-provider-test-')));
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

  function getProvidersConfigPath(): string {
    return path.join(process.env.VIBEN_STATE_DIR!, 'providers.yaml');
  }

  function createProvidersConfig(content: string): void {
    const configPath = getProvidersConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, content, 'utf-8');
  }

  function createProvider(name: string, type: string, isDefault = false): void {
    const configPath = getProvidersConfigPath();
    const stateDir = path.dirname(configPath);

    fs.mkdirSync(stateDir, { recursive: true });

    let existingConfig: {
      version: number;
      default?: string;
      providers: Record<string, { type: string }>;
    };

    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      // Simple YAML parse for test purposes
      existingConfig = parseSimpleYaml(content);
    } else {
      existingConfig = { version: 1, providers: {} };
    }

    existingConfig.providers[name] = { type };
    if (isDefault || !existingConfig.default) {
      existingConfig.default = name;
    }

    // Write back as YAML
    const yamlContent = stringifySimpleYaml(existingConfig);
    fs.writeFileSync(configPath, yamlContent, 'utf-8');
  }

  function parseSimpleYaml(content: string): {
    version: number;
    default?: string;
    providers: Record<string, { type: string; api_key?: string; base_url?: string }>;
  } {
    const result: {
      version: number;
      default?: string;
      providers: Record<string, { type: string; api_key?: string; base_url?: string }>;
    } = { version: 1, providers: {} };

    const lines = content.split('\n');
    let currentProvider: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('version:')) {
        result.version = parseInt(trimmed.split(':')[1].trim(), 10);
      } else if (trimmed.startsWith('default:')) {
        result.default = trimmed.split(':')[1].trim();
      } else if (line.startsWith('  ') && !line.startsWith('    ') && trimmed.endsWith(':')) {
        // Provider name
        currentProvider = trimmed.slice(0, -1);
        result.providers[currentProvider] = { type: '' };
      } else if (line.startsWith('    ') && currentProvider) {
        // Provider property
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        if (key === 'type') {
          result.providers[currentProvider].type = value;
        } else if (key === 'api_key') {
          result.providers[currentProvider].api_key = value;
        } else if (key === 'base_url') {
          result.providers[currentProvider].base_url = value;
        }
      }
    }

    return result;
  }

  function stringifySimpleYaml(config: {
    version: number;
    default?: string;
    providers: Record<string, { type: string; api_key?: string; base_url?: string }>;
  }): string {
    let content = `version: ${config.version}\n`;
    if (config.default) {
      content += `default: ${config.default}\n`;
    }
    content += 'providers:\n';
    for (const [name, provider] of Object.entries(config.providers)) {
      content += `  ${name}:\n`;
      content += `    type: ${provider.type}\n`;
      if (provider.api_key) {
        content += `    api_key: ${provider.api_key}\n`;
      }
      if (provider.base_url) {
        content += `    base_url: ${provider.base_url}\n`;
      }
    }
    return content;
  }

  describe('provider list', () => {
    it('should show hint when no providers exist', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No providers configured');
      expect(output).toContain('viben provider create');
    });

    it('should list providers when they exist', async () => {
      createProvider('anthropic-main', 'anthropic', true);
      createProvider('openai-main', 'openai');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('anthropic-main');
      expect(output).toContain('openai-main');
      expect(output).toContain('anthropic');
      expect(output).toContain('openai');
    });

    it('should show default indicator', async () => {
      createProvider('anthropic-main', 'anthropic', true);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('anthropic-main');
      expect(output).toMatch(/default|yes|\*/i);
    });

    it('should output JSON in json mode', async () => {
      createProvider('test-provider', 'openai', true);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'provider', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.providers).toBeDefined();
      expect(parsed.data.providers).toHaveLength(1);
      expect(parsed.data.providers[0].name).toBe('test-provider');
      expect(parsed.data.providers[0].type).toBe('openai');
      expect(parsed.data.providers[0].isDefault).toBe(true);
    });

    it('should output empty JSON when no providers', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'provider', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.providers).toEqual([]);
      expect(parsed.data.count).toBe(0);
    });
  });

  describe('provider create', () => {
    it('should create openai provider', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-t', 'openai']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
      expect(output).toContain('openai');

      // Verify file was created
      const configPath = getProvidersConfigPath();
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('should create anthropic provider', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-t', 'anthropic']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
      expect(output).toContain('anthropic');
    });

    it('should create ollama provider', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-t', 'ollama']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
      expect(output).toContain('ollama');
    });

    it('should create custom provider', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'provider', 'create',
        '-t', 'custom',
        '--base-url', 'https://api.example.com/v1'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
      expect(output).toContain('custom');
    });

    it('should auto-generate name when not provided', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-t', 'openai']);

      const configPath = getProvidersConfigPath();
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('openai');
    });

    it('should use custom name with -n option', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'provider', 'create',
        '-n', 'my-custom-provider',
        '-t', 'openai'
      ]);

      const configPath = getProvidersConfigPath();
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('my-custom-provider');
    });

    it('should store api key when provided', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'provider', 'create',
        '-n', 'with-key',
        '-t', 'openai',
        '--api-key', 'sk-test-key-123'
      ]);

      const configPath = getProvidersConfigPath();
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('sk-test-key-123');
    });

    it('should store base url when provided', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'provider', 'create',
        '-n', 'with-url',
        '-t', 'custom',
        '--base-url', 'https://custom-api.example.com/v1'
      ]);

      const configPath = getProvidersConfigPath();
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('https://custom-api.example.com/v1');
    });

    it('should fail with invalid provider type', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'provider', 'create',
          '-t', 'invalid-type'
        ]);
      } catch {
        // Expected
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail if provider already exists', async () => {
      createProvider('existing-provider', 'openai');

      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'provider', 'create',
          '-n', 'existing-provider',
          '-t', 'anthropic'
        ]);
      } catch {
        // Expected
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should set first provider as default', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'provider', 'create',
        '-n', 'first-provider',
        '-t', 'openai'
      ]);

      const configPath = getProvidersConfigPath();
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('default: first-provider');
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'provider', 'create',
        '-n', 'json-provider',
        '-t', 'anthropic'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.provider.name).toBe('json-provider');
      expect(parsed.data.provider.type).toBe('anthropic');
    });

    it('should create google provider', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-t', 'google']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
      expect(output).toContain('google');
    });

    it('should create azure provider', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-t', 'azure']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
      expect(output).toContain('azure');
    });

    it('should create openrouter provider', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'create', '-t', 'openrouter']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
      expect(output).toContain('openrouter');
    });
  });

  describe('provider remove', () => {
    it('should remove existing provider', async () => {
      createProvider('to-remove', 'openai');
      createProvider('to-keep', 'anthropic', true);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'remove', '-n', 'to-remove']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
      expect(output).toContain('to-remove');

      // Verify removal
      const configPath = getProvidersConfigPath();
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).not.toContain('to-remove');
      expect(content).toContain('to-keep');
    });

    it('should fail when provider does not exist', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'provider', 'remove', '-n', 'nonexistent']);
      } catch {
        // Expected
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should update default when removing default provider', async () => {
      createProvider('first', 'openai', true);
      createProvider('second', 'anthropic');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'remove', '-n', 'first']);

      const configPath = getProvidersConfigPath();
      const content = fs.readFileSync(configPath, 'utf-8');
      // Default should be updated to remaining provider
      expect(content).toContain('default: second');
    });

    it('should clear default when removing the only provider', async () => {
      createProvider('only-provider', 'openai', true);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'remove', '-n', 'only-provider']);

      const configPath = getProvidersConfigPath();
      const content = fs.readFileSync(configPath, 'utf-8');
      // Should not contain default or should be empty
      const config = parseSimpleYaml(content);
      expect(config.default).toBeUndefined();
    });

    it('should output JSON in json mode', async () => {
      createProvider('json-remove', 'openai', true);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'provider', 'remove',
        '-n', 'json-remove'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.removed).toBe('json-remove');
      expect(parsed.data.wasDefault).toBe(true);
    });

    it('should indicate if removed provider was default', async () => {
      createProvider('default-provider', 'openai', true);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'remove', '-n', 'default-provider']);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/default/i);
    });
  });

  describe('provider set-default', () => {
    it('should set default provider', async () => {
      createProvider('first', 'openai', true);
      createProvider('second', 'anthropic');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'set-default', '-n', 'second']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
      expect(output).toContain('second');

      // Verify
      const configPath = getProvidersConfigPath();
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('default: second');
    });

    it('should fail when provider does not exist', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'provider', 'set-default', '-n', 'nonexistent']);
      } catch {
        // Expected
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle setting already default provider', async () => {
      createProvider('already-default', 'openai', true);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'set-default', '-n', 'already-default']);

      // Should not error, just indicate it's already default
      expect(process.exit).not.toHaveBeenCalledWith(1);
      const output = consoleOutput.join('\n');
      expect(output).toMatch(/already.*default|default/i);
    });

    it('should output JSON in json mode', async () => {
      createProvider('json-default', 'openai');

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'provider', 'set-default',
        '-n', 'json-default'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.name).toBe('json-default');
    });
  });

  describe('provider status', () => {
    it('should show no providers message when empty', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'status']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No providers configured');
    });

    it('should show status for all providers', async () => {
      createProvider('test-anthropic', 'anthropic', true);
      createProvider('test-openai', 'openai');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'provider', 'status']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('test-anthropic');
      expect(output).toContain('test-openai');
      // Should show status (connected, error, or not running)
      expect(output).toMatch(/connected|error|not running|Status/i);
    });

    it('should show status for specific provider', async () => {
      createProvider('specific-provider', 'openai', true);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'provider', 'status',
        '-n', 'specific-provider'
      ]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('specific-provider');
      expect(output).toContain('openai');
    });

    it('should fail for non-existent provider with -n option', async () => {
      createProvider('exists', 'openai', true);

      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'provider', 'status',
          '-n', 'nonexistent'
        ]);
      } catch {
        // Expected
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode for all providers', async () => {
      createProvider('json-status', 'anthropic', true);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'provider', 'status']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.providers).toBeDefined();
      expect(parsed.data.providers[0].name).toBe('json-status');
      expect(parsed.data.providers[0].type).toBe('anthropic');
      expect(parsed.data.providers[0].status).toBeDefined();
    });

    it('should output JSON in json mode for specific provider', async () => {
      createProvider('specific-json', 'openai', true);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'provider', 'status',
        '-n', 'specific-json'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.provider).toBeDefined();
      expect(parsed.data.provider.name).toBe('specific-json');
    });

    it('should show error for provider without API key', async () => {
      createProvider('no-key', 'anthropic', true);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'provider', 'status',
        '-n', 'no-key'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      // Should show error status since no API key
      expect(parsed.data.provider.status).toBe('error');
      expect(parsed.data.provider.error).toContain('API key');
    });

    it('should show not_running status for ollama when not running', async () => {
      createProvider('local-ollama', 'ollama', true);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'provider', 'status',
        '-n', 'local-ollama'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      // Ollama doesn't need API key, but might not be running
      expect(['connected', 'not_running', 'error']).toContain(parsed.data.provider.status);
    });
  });

  describe('provider name validation', () => {
    it('should reject name starting with number', async () => {
      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'provider', 'create',
          '-n', '123invalid',
          '-t', 'openai'
        ]);
      } catch {
        // Expected
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should accept name with hyphens and underscores', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'provider', 'create',
        '-n', 'my-custom_provider',
        '-t', 'openai'
      ]);

      expect(process.exit).not.toHaveBeenCalledWith(1);
      const output = consoleOutput.join('\n');
      expect(output).toContain('OK');
    });
  });

  describe('auto-generated names', () => {
    it('should generate unique names for same type', async () => {
      // Create first provider
      const program1 = createProgram();
      await program1.parseAsync(['node', 'viben', 'provider', 'create', '-t', 'openai']);

      // Create second provider of same type
      consoleOutput = [];
      const program2 = createProgram();
      await program2.parseAsync(['node', 'viben', 'provider', 'create', '-t', 'openai']);

      // Both should succeed
      expect(process.exit).not.toHaveBeenCalledWith(1);

      // Verify both exist
      const configPath = getProvidersConfigPath();
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('openai');
      expect(content).toContain('openai-1');
    });
  });
});
