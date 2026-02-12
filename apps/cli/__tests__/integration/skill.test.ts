/**
 * Integration tests for viben skill command
 *
 * Note: Current NAPI implementation only supports global scope.
 * Skills are stored in: $VIBEN_STATE_DIR/skills/
 *
 * LIMITATION: NAPI modules are loaded once at process start and cannot be reset.
 * Setting VIBEN_STATE_DIR after the module loads has no effect.
 * These tests verify CLI behavior with the global state directory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben skill', () => {
  let originalCwd: string;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let installedSkills: string[] = [];

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

    // Clean up any skills installed during tests
    for (const skillId of installedSkills) {
      try {
        const { skillUninstall } = await import('../../src/lib/native');
        skillUninstall(skillId);
      } catch {
        // Ignore errors during cleanup
      }
    }
    installedSkills = [];
  });

  /**
   * Helper to install a skill and track it for cleanup
   */
  async function installTestSkill(
    nameWithVersion: string
  ): Promise<string> {
    const program = createProgram();
    await program.parseAsync(['node', 'viben', 'skill', 'install', nameWithVersion]);

    // Extract skill ID from nameWithVersion
    const skillId = nameWithVersion.split('@')[0];
    installedSkills.push(skillId);

    // Clear console output after setup
    consoleOutput.length = 0;

    return skillId;
  }

  describe('skill list', () => {
    it('should show message or list when no skills installed', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'list']);

      const output = consoleOutput.join('\n');
      // Either shows "No skills installed" or lists existing skills
      expect(output.length).toBeGreaterThan(0);
    });

    it('should list installed skills', async () => {
      const testName = `skill-list-${Date.now()}`;
      await installTestSkill(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain(testName);
    });

    it('should list available skills with --available flag', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'list', '--available']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Available Skills');
    });

    it('should output JSON in json mode', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.skills).toBeDefined();
      expect(Array.isArray(parsed.data.skills)).toBe(true);
    });

    it('should output JSON in json mode for available skills', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'list', '--available']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.skills).toBeDefined();
    });
  });

  describe('skill install', () => {
    it('should install a skill', async () => {
      const testName = `skill-install-${Date.now()}`;
      installedSkills.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', testName]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Installed|OK|✓/);
      expect(output).toContain(testName);
    });

    it('should install skill with specific version', async () => {
      const testName = `skill-ver-${Date.now()}`;
      installedSkills.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', `${testName}@2.0.0`]);

      const output = consoleOutput.join('\n');
      expect(output).toContain(testName);
      expect(output).toContain('2.0.0');
    });

    it('should fail when installing already installed skill', async () => {
      const testName = `skill-dup-${Date.now()}`;
      await installTestSkill(testName);

      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync(['node', 'viben', 'skill', 'install', testName]);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should output JSON in json mode', async () => {
      const testName = `skill-json-${Date.now()}`;
      installedSkills.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'install', testName]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.skill).toBeDefined();
      expect(parsed.data.skill.id).toBe(testName);
    });
  });

  describe('skill uninstall', () => {
    it('should uninstall an installed skill', async () => {
      const testName = `skill-uninstall-${Date.now()}`;
      const skillId = await installTestSkill(testName);

      // Remove from cleanup list since we're testing uninstall
      installedSkills = installedSkills.filter(id => id !== skillId);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'uninstall', skillId]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Uninstalled|Removed|OK|✓/);
    });

    it('should fail when uninstalling non-existent skill', async () => {
      const program = createProgram();
      let errorThrown = false;
      try {
        await program.parseAsync(['node', 'viben', 'skill', 'uninstall', 'nonexistent-skill-xyz']);
      } catch {
        errorThrown = true;
      }

      const exitCalled = (process.exit as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => call[0] === 1
      );
      expect(exitCalled || errorThrown).toBe(true);
    });

    it('should output JSON in json mode on success', async () => {
      const testName = `skill-json-un-${Date.now()}`;
      const skillId = await installTestSkill(testName);

      // Remove from cleanup list
      installedSkills = installedSkills.filter(id => id !== skillId);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'uninstall', skillId]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
    });

    it('should output JSON error for non-existent skill', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', '--json', 'skill', 'uninstall', 'non-existent-xyz']);
      } catch {
        // Expected to throw
      }

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('skill name validation', () => {
    it('should accept valid skill names with lowercase letters', async () => {
      const testName = `valid-skill-${Date.now()}`;
      installedSkills.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', testName]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Installed|OK|✓/);
    });

    it('should accept skill names with numbers', async () => {
      const testName = `skill123-${Date.now()}`;
      installedSkills.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', testName]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Installed|OK|✓/);
    });

    it('should accept skill names with hyphens', async () => {
      const testName = `my-test-skill-${Date.now()}`;
      installedSkills.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', testName]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Installed|OK|✓/);
    });

    it('should accept skill names with underscores', async () => {
      const testName = `my_test_skill_${Date.now()}`;
      installedSkills.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', testName]);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Installed|OK|✓/);
    });
  });

  describe('version parsing', () => {
    it('should parse skill name without version and use default', async () => {
      const testName = `simple-skill-${Date.now()}`;
      installedSkills.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'install', testName]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.skill.version).toBe('1.0.0');
    });

    it('should parse skill name with semantic version', async () => {
      const testName = `versioned-skill-${Date.now()}`;
      installedSkills.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'install', `${testName}@2.1.3`]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.skill.version).toBe('2.1.3');
    });

    it('should parse skill name with prerelease version', async () => {
      const testName = `beta-skill-${Date.now()}`;
      installedSkills.push(testName);

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'install', `${testName}@1.0.0-beta.1`]);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.skill.version).toBe('1.0.0-beta.1');
    });
  });
});
