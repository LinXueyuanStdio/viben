/**
 * Integration tests for viben skill command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProgram } from '../../src/cli';

describe('viben skill', () => {
  let tempDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-skill-test-')));
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    // Set custom state dir - unique per test
    process.env.VIBEN_STATE_DIR = path.join(tempDir, 'state');

    // Capture console output
    consoleOutput = [];
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      consoleOutput.push(args.join(' '));
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Prevent process.exit and track calls
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  /**
   * Helper to create skills config directory and file
   */
  function setupSkillsConfig(skills: Record<string, { version: string; installed_at: string }>): void {
    const skillsDir = path.join(process.env.VIBEN_STATE_DIR!, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillsDir, 'installed.yaml'),
      yaml.stringify({
        version: 1,
        skills,
      }),
      'utf-8'
    );
  }

  describe('skill list', () => {
    it('should show message when no skills installed', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No skills installed');
    });

    it('should list installed skills', async () => {
      setupSkillsConfig({
        'code-review': {
          version: '1.0.0',
          installed_at: new Date().toISOString(),
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Installed Skills');
      expect(output).toContain('code-review');
      expect(output).toContain('v1.0.0');
    });

    it('should list multiple installed skills', async () => {
      setupSkillsConfig({
        'code-review': {
          version: '1.0.0',
          installed_at: new Date().toISOString(),
        },
        'commit': {
          version: '1.2.0',
          installed_at: new Date().toISOString(),
        },
        'test-runner': {
          version: '0.9.0',
          installed_at: new Date().toISOString(),
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('code-review');
      expect(output).toContain('commit');
      expect(output).toContain('test-runner');
    });

    it('should list available skills with --available flag', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'list', '--available']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Available Skills');
      // Check for mock available skills
      expect(output).toContain('code-review');
      expect(output).toContain('commit');
      expect(output).toContain('test-runner');
    });

    it('should show installed status for available skills', async () => {
      setupSkillsConfig({
        'code-review': {
          version: '1.0.0',
          installed_at: new Date().toISOString(),
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'list', '--available']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('installed');
    });

    it('should output JSON in json mode for empty list', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.skills).toBeDefined();
      expect(parsed.data.skills).toHaveLength(0);
      expect(parsed.data.count).toBe(0);
    });

    it('should output JSON in json mode with installed skills', async () => {
      setupSkillsConfig({
        'code-review': {
          version: '1.0.0',
          installed_at: '2024-01-15T10:00:00Z',
        },
        'commit': {
          version: '1.2.0',
          installed_at: '2024-01-16T12:00:00Z',
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'list']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.skills).toHaveLength(2);
      expect(parsed.data.count).toBe(2);
      expect(parsed.data.skills.map((s: { id: string }) => s.id)).toContain('code-review');
      expect(parsed.data.skills.map((s: { id: string }) => s.id)).toContain('commit');
    });

    it('should output JSON in json mode for available skills', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'list', '--available']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.skills).toBeDefined();
      expect(parsed.data.skills.length).toBeGreaterThan(0);
      // Each skill should have id, name, version, description
      const firstSkill = parsed.data.skills[0];
      expect(firstSkill.id).toBeDefined();
      expect(firstSkill.version).toBeDefined();
      expect(firstSkill.description).toBeDefined();
    });
  });

  describe('skill install', () => {
    it('should install a skill', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', 'my-skill']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Installed skill');
      expect(output).toContain('my-skill');

      // Verify skill was installed
      const skillsDir = path.join(process.env.VIBEN_STATE_DIR!, 'skills');
      const configPath = path.join(skillsDir, 'installed.yaml');
      expect(fs.existsSync(configPath)).toBe(true);

      const config = yaml.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.skills['my-skill']).toBeDefined();
      expect(config.skills['my-skill'].version).toBe('1.0.0');
    });

    it('should install skill with specific version', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', 'versioned@2.0.0']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('versioned');
      expect(output).toContain('v2.0.0');

      // Verify installed version
      const skillsDir = path.join(process.env.VIBEN_STATE_DIR!, 'skills');
      const configPath = path.join(skillsDir, 'installed.yaml');

      const config = yaml.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.skills['versioned'].version).toBe('2.0.0');
    });

    it('should create skill directory', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', 'dir-test']);

      // Verify skill directory was created
      const skillDir = path.join(process.env.VIBEN_STATE_DIR!, 'skills', 'dir-test');
      expect(fs.existsSync(skillDir)).toBe(true);
      expect(fs.existsSync(path.join(skillDir, 'config.yaml'))).toBe(true);
    });

    it('should fail when installing already installed skill', async () => {
      // First install
      const program1 = createProgram();
      await program1.parseAsync(['node', 'viben', 'skill', 'install', 'dup-skill']);

      // Clear output and reset exit spy
      consoleOutput = [];
      exitSpy.mockClear();

      // Try to install again
      const program2 = createProgram();
      try {
        await program2.parseAsync(['node', 'viben', 'skill', 'install', 'dup-skill']);
      } catch {
        // Expected to throw
      }

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail with invalid skill name', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'skill', 'install', 'Invalid-Skill!']);
      } catch {
        // Expected to throw
      }

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail with empty skill name', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'skill', 'install', '']);
      } catch {
        // Expected to throw
      }

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode on success', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', '--json', 'skill', 'install', 'json-skill']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.skill).toBeDefined();
      expect(parsed.data.skill.id).toBe('json-skill');
      expect(parsed.data.skill.version).toBe('1.0.0');
      expect(parsed.data.skill.installed_at).toBeDefined();
    });

    it('should output JSON in json mode on error', async () => {
      // First install
      const program1 = createProgram();
      await program1.parseAsync(['node', 'viben', 'skill', 'install', 'json-dup-skill']);

      // Clear output
      consoleOutput = [];

      // Try to install again with JSON output
      const program2 = createProgram();
      try {
        await program2.parseAsync(['node', 'viben', '--json', 'skill', 'install', 'json-dup-skill']);
      } catch {
        // Expected to throw
      }

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe('SKILL_ALREADY_INSTALLED');
    });
  });

  describe('skill uninstall', () => {
    it('should uninstall an installed skill', async () => {
      // First install
      const program1 = createProgram();
      await program1.parseAsync(['node', 'viben', 'skill', 'install', 'uninstall-test']);

      // Clear output
      consoleOutput = [];

      // Then uninstall
      const program2 = createProgram();
      await program2.parseAsync(['node', 'viben', 'skill', 'uninstall', 'uninstall-test']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Uninstalled skill');
      expect(output).toContain('uninstall-test');

      // Verify skill was removed from config
      const skillsDir = path.join(process.env.VIBEN_STATE_DIR!, 'skills');
      const configPath = path.join(skillsDir, 'installed.yaml');

      const config = yaml.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.skills['uninstall-test']).toBeUndefined();
    });

    it('should remove skill directory on uninstall', async () => {
      // First install
      const program1 = createProgram();
      await program1.parseAsync(['node', 'viben', 'skill', 'install', 'dir-remove-test']);

      const skillDir = path.join(process.env.VIBEN_STATE_DIR!, 'skills', 'dir-remove-test');
      expect(fs.existsSync(skillDir)).toBe(true);

      // Then uninstall
      const program2 = createProgram();
      await program2.parseAsync(['node', 'viben', 'skill', 'uninstall', 'dir-remove-test']);

      // Skill directory should be removed
      expect(fs.existsSync(skillDir)).toBe(false);
    });

    it('should fail when uninstalling non-existent skill', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'skill', 'uninstall', 'non-existent-skill']);
      } catch {
        // Expected to throw
      }

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail with invalid skill name', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'skill', 'uninstall', 'Invalid!Name']);
      } catch {
        // Expected to throw
      }

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should output JSON in json mode on success', async () => {
      // First install
      const program1 = createProgram();
      await program1.parseAsync(['node', 'viben', 'skill', 'install', 'json-uninstall-test']);

      // Clear output
      consoleOutput = [];

      // Then uninstall with JSON
      const program2 = createProgram();
      await program2.parseAsync(['node', 'viben', '--json', 'skill', 'uninstall', 'json-uninstall-test']);

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(true);
      expect(parsed.data.name).toBe('json-uninstall-test');
      expect(parsed.data.removed).toBe(true);
    });

    it('should output JSON in json mode on error', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', '--json', 'skill', 'uninstall', 'non-existent']);
      } catch {
        // Expected to throw
      }

      const parsed = JSON.parse(consoleOutput.join('\n'));
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe('SKILL_NOT_FOUND');
    });
  });

  describe('skill name validation', () => {
    it('should accept valid skill names', async () => {
      const validNames = [
        'valid-name-1',
        'test123',
        'my_skill',
        'a',
        '123test',
        'skill-with-many-dashes',
        'skill_with_underscores',
      ];

      for (const name of validNames) {
        // Reset state dir for each iteration
        const skillsDir = path.join(process.env.VIBEN_STATE_DIR!, 'skills');
        if (fs.existsSync(skillsDir)) {
          fs.rmSync(skillsDir, { recursive: true });
        }

        consoleOutput = [];
        const program = createProgram();
        await program.parseAsync(['node', 'viben', 'skill', 'install', name]);

        const output = consoleOutput.join('\n');
        expect(output).toContain('Installed skill');
      }
    });

    it('should reject skill names starting with hyphen or underscore', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'skill', 'install', '-invalid']);
      } catch {
        // Expected to throw
      }

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject skill names with uppercase letters', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'skill', 'install', 'InvalidName']);
      } catch {
        // Expected to throw
      }

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should reject skill names with special characters', async () => {
      const program = createProgram();
      try {
        await program.parseAsync(['node', 'viben', 'skill', 'install', 'skill@name']);
      } catch {
        // Expected to throw
      }

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('version parsing', () => {
    it('should parse skill name without version', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', 'simple-skill']);

      const skillsDir = path.join(process.env.VIBEN_STATE_DIR!, 'skills');
      const configPath = path.join(skillsDir, 'installed.yaml');

      const config = yaml.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.skills['simple-skill'].version).toBe('1.0.0'); // Default version
    });

    it('should parse skill name with semantic version', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', 'sem-versioned-skill@2.1.3']);

      const skillsDir = path.join(process.env.VIBEN_STATE_DIR!, 'skills');
      const configPath = path.join(skillsDir, 'installed.yaml');

      const config = yaml.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.skills['sem-versioned-skill'].version).toBe('2.1.3');
    });

    it('should parse skill name with prerelease version', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'viben', 'skill', 'install', 'beta-skill@1.0.0-beta.1']);

      const skillsDir = path.join(process.env.VIBEN_STATE_DIR!, 'skills');
      const configPath = path.join(skillsDir, 'installed.yaml');

      const config = yaml.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.skills['beta-skill'].version).toBe('1.0.0-beta.1');
    });
  });
});
