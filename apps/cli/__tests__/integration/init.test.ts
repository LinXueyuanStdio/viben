/**
 * Integration tests for viben init command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben init', () => {
  let tempDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-test-')));
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    // Set custom state dir to avoid polluting real config
    process.env.VIBEN_STATE_DIR = path.join(tempDir, 'state');

    // Capture console output
    consoleOutput = [];
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      consoleOutput.push(args.join(' '));
    });

    // Prevent process.exit from terminating tests
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    consoleSpy.mockRestore();

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should initialize a workspace in the current directory', async () => {
    process.chdir(tempDir);

    const program = createProgram();
    await program.parseAsync(['node', 'viben', 'init']);

    // Check that .viben directory was created
    const vibenDir = path.join(tempDir, '.viben');
    expect(fs.existsSync(vibenDir)).toBe(true);

    // Check that config.yaml was created
    const configPath = path.join(vibenDir, 'config.yaml');
    expect(fs.existsSync(configPath)).toBe(true);

    // Check that agents directory was created
    const agentsDir = path.join(vibenDir, 'agents');
    expect(fs.existsSync(agentsDir)).toBe(true);

    // Check that main agent was created
    const mainAgentPath = path.join(agentsDir, 'main.yaml');
    expect(fs.existsSync(mainAgentPath)).toBe(true);
  });

  it('should output success message', async () => {
    process.chdir(tempDir);

    const program = createProgram();
    await program.parseAsync(['node', 'viben', 'init']);

    const output = consoleOutput.join('\n');
    expect(output).toContain('initialized');
  });

  it('should output JSON in json mode', async () => {
    process.chdir(tempDir);

    const program = createProgram();
    await program.parseAsync(['node', 'viben', '--json', 'init']);

    const output = consoleOutput.join('\n');
    const parsed = JSON.parse(output);

    expect(parsed.success).toBe(true);
    expect(parsed.data.path).toContain('.viben');
    expect(parsed.data.files).toContain('config.yaml');
  });

  it('should fail if workspace already exists', async () => {
    // Create existing workspace
    const vibenDir = path.join(tempDir, '.viben');
    fs.mkdirSync(vibenDir, { recursive: true });
    fs.writeFileSync(path.join(vibenDir, 'config.yaml'), 'version: 1');

    process.chdir(tempDir);

    // Mock console.error
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = createProgram();
    try {
      await program.parseAsync(['node', 'viben', 'init']);
    } catch {
      // Expected to throw
    }

    expect(process.exit).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
  });

  it('should fail if inside an existing workspace subdirectory', async () => {
    // Create workspace
    const vibenDir = path.join(tempDir, '.viben');
    fs.mkdirSync(vibenDir, { recursive: true });
    fs.writeFileSync(path.join(vibenDir, 'config.yaml'), 'version: 1');

    // Create subdirectory
    const subDir = path.join(tempDir, 'subdir');
    fs.mkdirSync(subDir, { recursive: true });

    process.chdir(subDir);

    // Mock console.error
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = createProgram();
    try {
      await program.parseAsync(['node', 'viben', 'init']);
    } catch {
      // Expected to throw
    }

    expect(process.exit).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
  });

  it('should create valid YAML config file', async () => {
    process.chdir(tempDir);

    const program = createProgram();
    await program.parseAsync(['node', 'viben', 'init']);

    const configPath = path.join(tempDir, '.viben', 'config.yaml');
    const content = fs.readFileSync(configPath, 'utf-8');

    // Should be valid YAML
    expect(content).toContain('version');
    expect(content).not.toContain('undefined');
    expect(content).not.toContain('null');
  });
});
