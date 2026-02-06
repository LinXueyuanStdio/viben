/**
 * Unit tests for lib/agents.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAgentsDir,
  listAgentsFromScope,
  getAgentPath,
  findAgent,
  readAgentConfig,
  writeAgentConfig,
  createAgentDir,
  agentExists,
  deleteAgent,
  validateAgentId,
  getAllAgents,
} from '../../src/lib/agents';

describe('agents.ts', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-test-')));
    originalEnv = { ...process.env };
    originalCwd = process.cwd();

    // Set custom state dir
    process.env.VIBEN_STATE_DIR = path.join(tempDir, 'state');
  });

  afterEach(() => {
    process.env = originalEnv;
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  function createWorkspace(): string {
    const vibenDir = path.join(tempDir, '.viben');
    fs.mkdirSync(vibenDir, { recursive: true });
    fs.writeFileSync(path.join(vibenDir, 'config.yaml'), 'version: 1');
    process.chdir(tempDir);
    return vibenDir;
  }

  function createAgent(agentsDir: string, id: string, config: Record<string, unknown> = {}): void {
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
    }
    const agentConfig = { id, ...config };
    const yamlContent = Object.entries(agentConfig)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n');
    fs.writeFileSync(path.join(agentsDir, `${id}.yaml`), yamlContent);
  }

  describe('validateAgentId', () => {
    it('should accept valid IDs', () => {
      expect(() => validateAgentId('agent1')).not.toThrow();
      expect(() => validateAgentId('my-agent')).not.toThrow();
      expect(() => validateAgentId('my_agent')).not.toThrow();
      expect(() => validateAgentId('Agent123')).not.toThrow();
    });

    it('should reject empty IDs', () => {
      expect(() => validateAgentId('')).toThrow();
      expect(() => validateAgentId('   ')).toThrow();
    });

    it('should reject IDs starting with numbers', () => {
      expect(() => validateAgentId('123agent')).toThrow();
    });

    it('should reject IDs with invalid characters', () => {
      expect(() => validateAgentId('agent.name')).toThrow();
      expect(() => validateAgentId('agent/name')).toThrow();
      expect(() => validateAgentId('agent name')).toThrow();
    });

    it('should reject IDs longer than 64 characters', () => {
      const longId = 'a'.repeat(65);
      expect(() => validateAgentId(longId)).toThrow();
    });
  });

  describe('getAgentsDir', () => {
    it('should return global agents dir for global scope', () => {
      const stateDir = process.env.VIBEN_STATE_DIR!;
      const result = getAgentsDir('global');
      expect(result).toBe(path.join(stateDir, 'agents'));
    });

    it('should return workspace agents dir for workspace scope', () => {
      const vibenDir = createWorkspace();
      const result = getAgentsDir('workspace');
      expect(result).toBe(path.join(vibenDir, 'agents'));
    });

    it('should throw when workspace scope without workspace', () => {
      process.chdir(tempDir);
      expect(() => getAgentsDir('workspace')).toThrow();
    });
  });

  describe('getAgentPath', () => {
    it('should return correct path for global agent', () => {
      const stateDir = process.env.VIBEN_STATE_DIR!;
      const result = getAgentPath('global', 'my-agent');
      expect(result).toBe(path.join(stateDir, 'agents', 'my-agent.yaml'));
    });

    it('should return correct path for workspace agent', () => {
      const vibenDir = createWorkspace();
      const result = getAgentPath('workspace', 'my-agent');
      expect(result).toBe(path.join(vibenDir, 'agents', 'my-agent.yaml'));
    });
  });

  describe('listAgentsFromScope', () => {
    it('should return empty array when no agents exist', () => {
      const result = listAgentsFromScope('global');
      expect(result).toEqual([]);
    });

    it('should list global agents', () => {
      const agentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      createAgent(agentsDir, 'agent1', { name: 'Agent One' });
      createAgent(agentsDir, 'agent2', { name: 'Agent Two' });

      const result = listAgentsFromScope('global');
      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toContain('agent1');
      expect(result.map(a => a.id)).toContain('agent2');
    });

    it('should list workspace agents', () => {
      const vibenDir = createWorkspace();
      const agentsDir = path.join(vibenDir, 'agents');
      createAgent(agentsDir, 'ws-agent', { name: 'Workspace Agent' });

      const result = listAgentsFromScope('workspace');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ws-agent');
    });

    it('should skip invalid YAML files', () => {
      const agentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });
      createAgent(agentsDir, 'valid-agent');
      fs.writeFileSync(path.join(agentsDir, 'invalid.yaml'), '[invalid yaml');

      const result = listAgentsFromScope('global');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid-agent');
    });

    it('should skip non-YAML files', () => {
      const agentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });
      createAgent(agentsDir, 'valid-agent');
      fs.writeFileSync(path.join(agentsDir, 'readme.txt'), 'not an agent');

      const result = listAgentsFromScope('global');
      expect(result).toHaveLength(1);
    });
  });

  describe('readAgentConfig', () => {
    it('should return null for non-existent agent', () => {
      const result = readAgentConfig('global', 'nonexistent');
      expect(result).toBeNull();
    });

    it('should read agent configuration', () => {
      const agentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      createAgent(agentsDir, 'test-agent', {
        name: 'Test Agent',
        model: 'claude-sonnet-4-20250514',
      });

      const result = readAgentConfig('global', 'test-agent');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-agent');
      expect(result?.name).toBe('Test Agent');
    });
  });

  describe('writeAgentConfig', () => {
    it('should write agent configuration', () => {
      const config = {
        id: 'new-agent',
        name: 'New Agent',
        description: 'A new agent',
      };

      writeAgentConfig('global', 'new-agent', config);

      const result = readAgentConfig('global', 'new-agent');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('New Agent');
    });

    it('should create agents directory if needed', () => {
      const agentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      expect(fs.existsSync(agentsDir)).toBe(false);

      writeAgentConfig('global', 'test', { id: 'test' });

      expect(fs.existsSync(agentsDir)).toBe(true);
    });
  });

  describe('agentExists', () => {
    it('should return false for non-existent agent', () => {
      expect(agentExists('global', 'nonexistent')).toBe(false);
    });

    it('should return true for existing agent', () => {
      const agentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      createAgent(agentsDir, 'existing');

      expect(agentExists('global', 'existing')).toBe(true);
    });
  });

  describe('deleteAgent', () => {
    it('should throw for non-existent agent', () => {
      expect(() => deleteAgent('global', 'nonexistent')).toThrow();
    });

    it('should delete existing agent', () => {
      const agentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      createAgent(agentsDir, 'to-delete');

      expect(agentExists('global', 'to-delete')).toBe(true);
      deleteAgent('global', 'to-delete');
      expect(agentExists('global', 'to-delete')).toBe(false);
    });
  });

  describe('findAgent', () => {
    it('should return null for non-existent agent', () => {
      const result = findAgent('nonexistent');
      expect(result).toBeNull();
    });

    it('should find global agent', () => {
      const agentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      createAgent(agentsDir, 'global-agent', { name: 'Global' });

      const result = findAgent('global-agent');
      expect(result).not.toBeNull();
      expect(result?.source).toBe('global');
      expect(result?.config.name).toBe('Global');
    });

    it('should prefer workspace agent over global', () => {
      // Create global agent
      const globalAgentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      createAgent(globalAgentsDir, 'shared-agent', { name: 'Global Version' });

      // Create workspace agent with same ID
      const vibenDir = createWorkspace();
      const wsAgentsDir = path.join(vibenDir, 'agents');
      createAgent(wsAgentsDir, 'shared-agent', { name: 'Workspace Version' });

      const result = findAgent('shared-agent');
      expect(result).not.toBeNull();
      expect(result?.source).toBe('workspace');
      expect(result?.config.name).toBe('Workspace Version');
    });
  });

  describe('getAllAgents', () => {
    it('should return empty array when no agents exist', () => {
      const result = getAllAgents();
      expect(result).toEqual([]);
    });

    it('should return all agents from both scopes', () => {
      // Create global agents
      const globalAgentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      createAgent(globalAgentsDir, 'global-agent', { name: 'Global' });

      // Create workspace agent
      const vibenDir = createWorkspace();
      const wsAgentsDir = path.join(vibenDir, 'agents');
      createAgent(wsAgentsDir, 'ws-agent', { name: 'Workspace' });

      const result = getAllAgents();
      expect(result).toHaveLength(2);
      expect(result.find(a => a.id === 'global-agent')?.source).toBe('global');
      expect(result.find(a => a.id === 'ws-agent')?.source).toBe('workspace');
    });

    it('should not duplicate agents that exist in both scopes', () => {
      // Create global agent
      const globalAgentsDir = path.join(process.env.VIBEN_STATE_DIR!, 'agents');
      createAgent(globalAgentsDir, 'shared', { name: 'Global Version' });

      // Create workspace agent with same ID
      const vibenDir = createWorkspace();
      const wsAgentsDir = path.join(vibenDir, 'agents');
      createAgent(wsAgentsDir, 'shared', { name: 'Workspace Version' });

      const result = getAllAgents();
      // Should only have one 'shared' agent (workspace version)
      const sharedAgents = result.filter(a => a.id === 'shared');
      expect(sharedAgents).toHaveLength(1);
      expect(sharedAgents[0].source).toBe('workspace');
    });
  });

  describe('createAgentDir', () => {
    it('should create agents directory', () => {
      const stateDir = process.env.VIBEN_STATE_DIR!;
      const agentsDir = path.join(stateDir, 'agents');
      expect(fs.existsSync(agentsDir)).toBe(false);

      createAgentDir('global', 'test-agent');

      expect(fs.existsSync(agentsDir)).toBe(true);
    });
  });
});
