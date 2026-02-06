/**
 * Integration tests for viben agent command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben agent', () => {
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

  function createWorkspace(): void {
    const vibenDir = path.join(tempDir, '.viben');
    fs.mkdirSync(vibenDir, { recursive: true });
    fs.writeFileSync(
      path.join(vibenDir, 'config.yaml'),
      'version: 1\n'
    );
    process.chdir(tempDir);
  }

  function createAgent(scope: 'global' | 'workspace', id: string, config: Record<string, string> = {}): void {
    let agentsDir: string;
    if (scope === 'global') {
      agentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
    } else {
      agentsDir = path.join(tempDir, '.viben', 'agents');
    }

    fs.mkdirSync(agentsDir, { recursive: true });
    const content = Object.entries({ id, ...config })
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    fs.writeFileSync(path.join(agentsDir, `${id}.yaml`), content);
  }

  describe('agent list', () => {
    it('should list no agents when none exist', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No agents found');
    });

    it('should list global agents', async () => {
      createAgent('global', 'test-agent', { name: 'Test Agent' });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('test-agent');
      expect(output).toContain('global');
    });

    it('should list workspace agents', async () => {
      createWorkspace();
      createAgent('workspace', 'ws-agent', { name: 'Workspace Agent' });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('ws-agent');
      expect(output).toContain('workspace');
    });

    it('should list agents from both scopes', async () => {
      createWorkspace();
      createAgent('global', 'global-agent');
      createAgent('workspace', 'ws-agent');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('global-agent');
      expect(output).toContain('ws-agent');
    });

    it('should output JSON in json mode', async () => {
      createAgent('global', 'test-agent');

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'agent', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.agents).toBeDefined();
      expect(parsed.data.agents).toHaveLength(1);
      expect(parsed.data.agents[0].id).toBe('test-agent');
    });
  });

  describe('agent create', () => {
    it('should create a new agent', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'create', '-n', 'new-agent']);

      expect(consoleOutput.join('\n')).toContain('OK');

      // Verify the agent was created
      const agentPath = path.join(tempDir, '.viben', 'agents', 'new-agent.yaml');
      expect(fs.existsSync(agentPath)).toBe(true);
    });

    it('should create agent with description', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'agent', 'create',
        '-n', 'desc-agent',
        '-d', 'My agent description'
      ]);

      const agentPath = path.join(tempDir, '.viben', 'agents', 'desc-agent.yaml');
      const content = fs.readFileSync(agentPath, 'utf-8');
      expect(content).toContain('My agent description');
    });

    it('should create agent with model and provider', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'agent', 'create',
        '-n', 'model-agent',
        '-m', 'claude-sonnet-4-20250514',
        '-p', 'anthropic'
      ]);

      const agentPath = path.join(tempDir, '.viben', 'agents', 'model-agent.yaml');
      const content = fs.readFileSync(agentPath, 'utf-8');
      expect(content).toContain('claude-sonnet-4-20250514');
      expect(content).toContain('anthropic');
    });

    it('should create global agent with --global flag', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'agent', 'create',
        '-n', 'global-agent',
        '--global'
      ]);

      const agentPath = path.join(process.env.VIBEN_STATE_DIR!, 'agents', 'global-agent.yaml');
      expect(fs.existsSync(agentPath)).toBe(true);
    });

    it('should fail with invalid agent ID', async () => {
      createWorkspace();

      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'agent', 'create',
          '-n', '123-invalid'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should fail if agent already exists', async () => {
      createWorkspace();
      createAgent('workspace', 'existing-agent');

      const program = createProgram();
      try {
        await program.parseAsync([
          'node', 'viben', 'agent', 'create',
          '-n', 'existing-agent'
        ]);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createWorkspace();

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'agent', 'create',
        '-n', 'json-agent'
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.agent.id).toBe('json-agent');
    });
  });

  describe('agent show', () => {
    it('should show agent details', async () => {
      createAgent('global', 'show-agent', {
        name: 'Show Agent',
        description: 'Agent for testing show',
        model: 'gpt-4'
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'show', '-n', 'show-agent']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('show-agent');
      expect(output).toContain('Show Agent');
      expect(output).toContain('gpt-4');
    });

    it('should fail for non-existent agent', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'agent', 'show', '-n', 'nonexistent']);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      createAgent('global', 'json-show', { name: 'JSON Show Agent' });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'agent', 'show', '-n', 'json-show']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.agent.id).toBe('json-show');
      expect(parsed.data.source).toBe('global');
    });

    it('should show workspace agent before global', async () => {
      createWorkspace();
      createAgent('global', 'shared', { name: 'Global Version' });
      createAgent('workspace', 'shared', { name: 'Workspace Version' });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'show', '-n', 'shared']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Workspace Version');
      expect(output).toContain('workspace');
    });
  });
});
