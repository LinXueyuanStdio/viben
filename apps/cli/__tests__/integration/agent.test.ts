/**
 * Integration tests for viben agent command
 *
 * Note: Current NAPI implementation only supports global scope.
 * Agents are stored as directories: $VIBEN_STATE_DIR/agents/{agent-id}/config.yaml
 *
 * LIMITATION: NAPI modules are loaded once at process start and cannot be reset.
 * Setting VIBEN_STATE_DIR after the module loads has no effect.
 * These tests verify CLI behavior with the global state directory.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben agent', () => {
  let originalCwd: string;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let createdAgents: string[] = [];

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

    // Clean up any agents created during tests
    for (const agentName of createdAgents) {
      try {
        const { agentRemove } = await import('../../src/lib/native');
        await agentRemove(agentName);
      } catch {
        // Ignore errors during cleanup
      }
    }
    createdAgents = [];
  });

  /**
   * Helper to create an agent and track it for cleanup
   */
  async function createTestAgent(name: string, options: Record<string, string> = {}): Promise<void> {
    const args = ['node', 'viben', 'agent', 'create', '-n', name];

    if (options.description) {
      args.push('-d', options.description);
    }
    if (options.model) {
      args.push('-m', options.model);
    }
    if (options.provider) {
      args.push('-p', options.provider);
    }

    const program = createProgram();
    await program.parseAsync(args);

    // Track for cleanup
    createdAgents.push(name);

    // Clear console output after setup
    consoleOutput.length = 0;
  }

  describe('agent list', () => {
    it('should show message when no agents exist', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'list']);

      const output = consoleOutput.join('\n');
      // Either shows "No agents found" or lists existing agents
      expect(output.length).toBeGreaterThan(0);
    });

    it('should list created agents', async () => {
      const testName = `test-agent-${Date.now()}`;
      await createTestAgent(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain(testName);
    });

    it('should output valid JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'agent', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.agents).toBeDefined();
      expect(Array.isArray(parsed.data.agents)).toBe(true);
    });
  });

  describe('agent create', () => {
    it('should create a new agent', async () => {
      const testName = `new-agent-${Date.now()}`;
      createdAgents.push(testName); // Track for cleanup

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'create', '-n', testName]);

      expect(consoleOutput.join('\n')).toContain('OK');
      expect(consoleOutput.join('\n')).toContain(testName);
    });

    it('should create agent with description', async () => {
      const testName = `desc-agent-${Date.now()}`;
      createdAgents.push(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'agent', 'create',
        '-n', testName,
        '-d', 'My test description'
      ]);

      expect(consoleOutput.join('\n')).toContain('OK');
    });

    it('should create agent with model and provider', async () => {
      const testName = `model-agent-${Date.now()}`;
      createdAgents.push(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', 'agent', 'create',
        '-n', testName,
        '-m', 'claude-sonnet-4-20250514',
        '-p', 'anthropic'
      ]);

      expect(consoleOutput.join('\n')).toContain('OK');
    });

    it('should fail if agent already exists', async () => {
      const testName = `existing-${Date.now()}`;
      await createTestAgent(testName);

      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync([
          'node', 'viben', 'agent', 'create',
          '-n', testName
        ]);
      } catch {
        errorThrown = true;
      }

      // Either process.exit was called or error was thrown
      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should output JSON in json mode', async () => {
      const testName = `json-agent-${Date.now()}`;
      createdAgents.push(testName);

      const program = createProgram();
      await program.parseAsync([
        'node', 'viben', '--json', 'agent', 'create',
        '-n', testName
      ]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.agent).toBeDefined();
      expect(parsed.data.agent.name).toBe(testName);
    });
  });

  describe('agent show', () => {
    it('should show agent details', async () => {
      const testName = `show-agent-${Date.now()}`;
      await createTestAgent(testName, {
        description: 'Agent for testing show',
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'agent', 'show', '-n', testName]);

      const output = consoleOutput.join('\n');
      expect(output).toContain(testName);
    });

    it('should fail for non-existent agent', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'agent', 'show', '-n', 'nonexistent-agent-xyz']);
      } catch {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode', async () => {
      const testName = `json-show-${Date.now()}`;
      await createTestAgent(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'agent', 'show', '-n', testName]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.agent.name).toBe(testName);
    });
  });
});
