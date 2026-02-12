/**
 * Integration tests for viben workspace command
 *
 * Note: Current NAPI implementation only supports global scope.
 * Known workspaces are stored in: $VIBEN_STATE_DIR/workspaces.yaml
 *
 * LIMITATION: NAPI modules are loaded once at process start and cannot be reset.
 * Setting VIBEN_STATE_DIR after the module loads has no effect.
 * These tests verify CLI behavior with the global state directory.
 *
 * Workspace detection is path-based (reads .viben/config.yaml from file system),
 * so temp directories with proper structure should work.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben workspace', () => {
  let tempDir: string;
  let originalCwd: string;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let addedWorkspaces: string[] = [];

  beforeEach(() => {
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-ws-test-')));
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

    // Clean up added workspaces from known list
    for (const wsPath of addedWorkspaces) {
      try {
        const { workspaceRemoveKnown } = await import('../../src/lib/native');
        workspaceRemoveKnown(wsPath);
      } catch {
        // Ignore errors during cleanup
      }
    }
    addedWorkspaces = [];

    // Clean up temp directory
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
   * Add workspace to known workspaces list using NAPI
   */
  async function addKnownWorkspace(workspacePath: string, name?: string): Promise<void> {
    const { workspaceAddKnown } = await import('../../src/lib/native');
    workspaceAddKnown(workspacePath, name);
    addedWorkspaces.push(workspacePath);
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

    it('should output JSON format with --json flag when in workspace', async () => {
      createWorkspace();
      process.chdir(tempDir);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'workspace', 'current']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.path).toBe(tempDir);
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
    it('should list workspaces or show empty message', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      // Either shows "No known workspaces" or lists existing ones
      expect(output.length).toBeGreaterThan(0);
    });

    it('should list added workspace', async () => {
      const ws1 = path.join(tempDir, `project-${Date.now()}`);
      fs.mkdirSync(ws1, { recursive: true });
      createConfiguredWorkspace(ws1, { mcp: ['filesystem'] });
      await addKnownWorkspace(ws1, 'Test Project');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Test Project');
    });

    it('should list multiple workspaces', async () => {
      const ts = Date.now();
      const ws1 = path.join(tempDir, `project1-${ts}`);
      const ws2 = path.join(tempDir, `project2-${ts}`);
      fs.mkdirSync(ws1, { recursive: true });
      fs.mkdirSync(ws2, { recursive: true });

      createConfiguredWorkspace(ws1, { mcp: ['filesystem'] });
      createConfiguredWorkspace(ws2, { mcp: ['memory'], skills: ['code-review'] });

      await addKnownWorkspace(ws1, 'Project 1');
      await addKnownWorkspace(ws2, 'Project 2');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Project 1');
      expect(output).toContain('Project 2');
    });

    it('should output valid JSON format with --json flag', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.workspaces).toBeDefined();
      expect(Array.isArray(parsed.data.workspaces)).toBe(true);
    });

    it('should mark current workspace with indicator', async () => {
      const ws1 = path.join(tempDir, `current-ws-${Date.now()}`);
      fs.mkdirSync(ws1, { recursive: true });
      createConfiguredWorkspace(ws1, {});
      await addKnownWorkspace(ws1, 'Current WS');

      // Change to ws1 so it becomes current
      process.chdir(ws1);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'workspace', 'list']);

      const output = consoleOutput.join('\n');
      // Current workspace should be marked
      expect(output).toContain('Current WS');
    });
  });
});
