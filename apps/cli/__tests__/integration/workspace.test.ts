/**
 * Integration tests for viben workspace command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben workspace', () => {
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
   * Create a workspace with .viben/config.yaml
   */
  function createWorkspace(workspacePath?: string): string {
    const wsPath = workspacePath || tempDir;
    const vibenDir = path.join(wsPath, '.viben');
    fs.mkdirSync(vibenDir, { recursive: true });
    fs.writeFileSync(
      path.join(vibenDir, 'config.yaml'),
      'version: 1\nmcp:\n  enabled: []\nskills:\n  enabled: []\nagents: []\n'
    );
    return wsPath;
  }

  /**
   * Create a workspace with MCP and skills configured
   */
  function createConfiguredWorkspace(
    workspacePath: string,
    config: { mcp?: string[]; skills?: string[]; agents?: string[] }
  ): void {
    const vibenDir = path.join(workspacePath, '.viben');
    fs.mkdirSync(vibenDir, { recursive: true });

    const mcpEnabled = config.mcp || [];
    const skillsEnabled = config.skills || [];
    const agents = config.agents || [];

    const content = [
      'version: 1',
      'mcp:',
      `  enabled: [${mcpEnabled.map((s) => `"${s}"`).join(', ')}]`,
      'skills:',
      `  enabled: [${skillsEnabled.map((s) => `"${s}"`).join(', ')}]`,
      `agents: [${agents.map((s) => `"${s}"`).join(', ')}]`,
    ].join('\n');

    fs.writeFileSync(path.join(vibenDir, 'config.yaml'), content);
  }

  /**
   * Add workspace to known workspaces list
   */
  function addKnownWorkspace(workspacePath: string, name?: string): void {
    const stateDir = process.env.VIBEN_STATE_DIR!;
    fs.mkdirSync(stateDir, { recursive: true });

    const workspacesFile = path.join(stateDir, 'workspaces.yaml');
    let workspaces: Array<{ path: string; name?: string; lastAccessed?: string }> = [];

    if (fs.existsSync(workspacesFile)) {
      const content = fs.readFileSync(workspacesFile, 'utf-8');
      const data = require('yaml').parse(content);
      workspaces = data?.workspaces || [];
    }

    workspaces.push({
      path: workspacePath,
      name,
      lastAccessed: new Date().toISOString(),
    });

    const content = require('yaml').stringify({ version: 1, workspaces });
    fs.writeFileSync(workspacesFile, content);
  }

  describe('workspace current', () => {
    it('should show "not in workspace" when outside workspace', async () => {
      // Don't create a workspace, just run from temp dir
      process.chdir(tempDir);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'current']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Not in a workspace');
    });

    it('should show workspace info when inside workspace', async () => {
      createWorkspace();
      process.chdir(tempDir);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'current']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Current Workspace');
      expect(output).toContain('Path:');
    });

    it('should show workspace with MCP and skills', async () => {
      createConfiguredWorkspace(tempDir, {
        mcp: ['filesystem', 'memory'],
        skills: ['code-review'],
        agents: ['dev-agent'],
      });
      process.chdir(tempDir);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'current']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('filesystem');
      expect(output).toContain('memory');
      expect(output).toContain('code-review');
      expect(output).toContain('dev-agent');
    });

    it('should output JSON format with --json flag', async () => {
      createWorkspace();
      process.chdir(tempDir);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'workspace', 'current']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.path).toBe(tempDir);
      expect(parsed.data.mcp).toBeDefined();
      expect(parsed.data.skills).toBeDefined();
    });

    it('should output JSON error when not in workspace with --json flag', async () => {
      process.chdir(tempDir);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'workspace', 'current']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe('NOT_IN_WORKSPACE');
    });

    it('should detect workspace from subdirectory', async () => {
      createWorkspace();
      const subDir = path.join(tempDir, 'src', 'components');
      fs.mkdirSync(subDir, { recursive: true });
      process.chdir(subDir);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'current']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Current Workspace');
      expect(output).toContain(tempDir);
    });
  });

  describe('workspace list', () => {
    it('should show empty list when no workspaces exist', async () => {
      process.chdir(tempDir);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No known workspaces');
    });

    it('should list single workspace', async () => {
      const ws1 = path.join(tempDir, 'project1');
      fs.mkdirSync(ws1, { recursive: true });
      createConfiguredWorkspace(ws1, { mcp: ['filesystem'] });
      addKnownWorkspace(ws1, 'Project 1');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Known Workspaces');
      expect(output).toContain('Project 1');
    });

    it('should list multiple workspaces', async () => {
      const ws1 = path.join(tempDir, 'project1');
      const ws2 = path.join(tempDir, 'project2');
      fs.mkdirSync(ws1, { recursive: true });
      fs.mkdirSync(ws2, { recursive: true });

      createConfiguredWorkspace(ws1, { mcp: ['filesystem'] });
      createConfiguredWorkspace(ws2, { mcp: ['memory'], skills: ['code-review'] });

      addKnownWorkspace(ws1, 'Project 1');
      addKnownWorkspace(ws2, 'Project 2');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Project 1');
      expect(output).toContain('Project 2');
    });

    it('should mark current workspace with indicator', async () => {
      const ws1 = path.join(tempDir, 'project1');
      const ws2 = path.join(tempDir, 'project2');
      fs.mkdirSync(ws1, { recursive: true });
      fs.mkdirSync(ws2, { recursive: true });

      createConfiguredWorkspace(ws1, {});
      createConfiguredWorkspace(ws2, {});

      addKnownWorkspace(ws1, 'Project 1');
      addKnownWorkspace(ws2, 'Project 2');

      // Change to ws1 so it becomes current
      process.chdir(ws1);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      // Current workspace should be marked with *
      expect(output).toContain('*');
      expect(output).toContain('current workspace');
    });

    it('should output JSON format with --json flag', async () => {
      const ws1 = path.join(tempDir, 'project1');
      fs.mkdirSync(ws1, { recursive: true });
      createConfiguredWorkspace(ws1, { mcp: ['filesystem'] });
      addKnownWorkspace(ws1, 'Project 1');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.workspaces).toBeDefined();
      expect(parsed.data.workspaces).toHaveLength(1);
      expect(parsed.data.count).toBe(1);
    });

    it('should output empty workspaces array in JSON when none exist', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.workspaces).toEqual([]);
      expect(parsed.data.count).toBe(0);
    });

    it('should filter out non-existent workspaces', async () => {
      const ws1 = path.join(tempDir, 'project1');
      const ws2 = path.join(tempDir, 'project2-deleted');
      fs.mkdirSync(ws1, { recursive: true });

      createConfiguredWorkspace(ws1, {});
      // ws2 is added to known list but directory doesn't exist
      addKnownWorkspace(ws1, 'Project 1');
      addKnownWorkspace(ws2, 'Project 2 Deleted');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      // Only ws1 should be listed since ws2 doesn't have config.yaml
      expect(parsed.data.workspaces).toHaveLength(1);
      expect(parsed.data.workspaces[0].name).toBe('Project 1');
    });
  });
});
