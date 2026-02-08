/**
 * Skills Management for Viben CLI
 *
 * Handles reading/writing skills configuration and managing skill installations.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { CliError } from '../types';
import { getStateDir, ensureDir } from './scope';
import {
  type SkillsConfig,
  type Skill,
  type InstalledSkill,
  type AvailableSkill,
  DEFAULT_SKILLS_CONFIG,
  SKILLS_CONFIG_FILE,
  SKILLS_DIR,
} from '../types/skill';

/**
 * Get the skills directory path
 */
export function getSkillsDir(): string {
  const stateDir = getStateDir();
  return path.join(stateDir, SKILLS_DIR);
}

/**
 * Get the path to the skills configuration file
 */
export function getSkillsConfigPath(): string {
  const skillsDir = getSkillsDir();
  return path.join(skillsDir, SKILLS_CONFIG_FILE);
}

/**
 * Read skills configuration from file
 * Returns default config if file doesn't exist
 */
export function readSkillsConfig(): SkillsConfig {
  const configPath = getSkillsConfigPath();

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_SKILLS_CONFIG };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = yaml.parse(content) as SkillsConfig;

    // Ensure structure is valid
    return {
      version: parsed.version ?? 1,
      skills: parsed.skills ?? {},
    };
  } catch (error) {
    throw new CliError(
      `Failed to read skills config: ${configPath}`,
      'SKILLS_CONFIG_READ_ERROR',
      error
    );
  }
}

/**
 * Write skills configuration to file
 */
export function writeSkillsConfig(config: SkillsConfig): void {
  const configPath = getSkillsConfigPath();
  const skillsDir = getSkillsDir();

  try {
    ensureDir(skillsDir);

    const content = yaml.stringify(config, {
      indent: 2,
      lineWidth: 0,
    });

    fs.writeFileSync(configPath, content, 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write skills config: ${configPath}`,
      'SKILLS_CONFIG_WRITE_ERROR',
      error
    );
  }
}

/**
 * Get a skill by ID
 * Returns the full Skill with id populated, or null if not found
 */
export function getSkill(id: string): Skill | null {
  const config = readSkillsConfig();
  const skillConfig = config.skills[id];

  if (!skillConfig) {
    return null;
  }

  return { id, ...skillConfig };
}

/**
 * List all installed skills
 * Returns array of Skill objects with id populated
 */
export function listSkills(): Skill[] {
  const config = readSkillsConfig();

  return Object.entries(config.skills).map(([id, skillConfig]) => ({
    id,
    ...skillConfig,
  }));
}

/**
 * Check if a skill is installed
 */
export function isSkillInstalled(id: string): boolean {
  const config = readSkillsConfig();
  return id in config.skills;
}

/**
 * Parse skill name with optional version
 * Supports formats: "skill-name" or "skill-name@version"
 */
export function parseSkillName(nameWithVersion: string): { name: string; version?: string } {
  const atIndex = nameWithVersion.lastIndexOf('@');

  // No @ or @ at the start (scoped package like @scope/pkg) is not valid for version
  if (atIndex <= 0) {
    return { name: nameWithVersion };
  }

  const name = nameWithVersion.substring(0, atIndex);
  const version = nameWithVersion.substring(atIndex + 1);

  // Validate version format (basic check)
  if (version && /^[\d.]+(?:-[\w.]+)?$/.test(version)) {
    return { name, version };
  }

  // If version doesn't look valid, treat entire string as name
  return { name: nameWithVersion };
}

/**
 * Install a skill
 *
 * Creates the skill directory structure and adds to installed.yaml.
 * Note: Actual download/installation logic can be implemented later.
 */
export function installSkill(name: string, version?: string): Skill {
  const config = readSkillsConfig();

  // Default version if not specified
  const skillVersion = version ?? '1.0.0';

  // Check if already installed
  if (config.skills[name]) {
    throw new CliError(
      `Skill '${name}' is already installed. Use 'viben skill uninstall ${name}' first to reinstall.`,
      'SKILL_ALREADY_INSTALLED'
    );
  }

  // Create skill directory
  const skillDir = path.join(getSkillsDir(), name);
  ensureDir(skillDir);

  // Create a placeholder config in the skill directory
  const skillConfigPath = path.join(skillDir, 'config.yaml');
  const skillConfigContent = yaml.stringify({
    version: 1,
    name: name,
    description: `Skill ${name}`,
    installed_version: skillVersion,
  }, {
    indent: 2,
    lineWidth: 0,
  });
  fs.writeFileSync(skillConfigPath, skillConfigContent, 'utf-8');

  // Add to installed.yaml
  const installedSkill: InstalledSkill = {
    version: skillVersion,
    installed_at: new Date().toISOString(),
  };

  config.skills[name] = installedSkill;
  writeSkillsConfig(config);

  return {
    id: name,
    ...installedSkill,
  };
}

/**
 * Uninstall a skill
 *
 * Removes the skill directory and entry from installed.yaml.
 * Returns true if the skill was uninstalled, false if it wasn't installed.
 */
export function uninstallSkill(name: string): boolean {
  const config = readSkillsConfig();

  if (!config.skills[name]) {
    return false;
  }

  // Remove skill directory
  const skillDir = path.join(getSkillsDir(), name);
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }

  // Remove from installed.yaml
  delete config.skills[name];
  writeSkillsConfig(config);

  return true;
}

/**
 * Get available skills from marketplace
 *
 * Note: This is a placeholder returning mock data.
 * Real implementation would fetch from a marketplace API.
 */
export function getAvailableSkills(): AvailableSkill[] {
  // Mock available skills for now
  return [
    {
      id: 'code-review',
      name: 'Code Review',
      version: '1.0.0',
      description: 'Code review assistance',
    },
    {
      id: 'commit',
      name: 'Smart Commit',
      version: '1.2.0',
      description: 'Smart commit messages',
    },
    {
      id: 'test-runner',
      name: 'Test Runner',
      version: '0.9.0',
      description: 'Test execution helper',
    },
    {
      id: 'doc-gen',
      name: 'Documentation Generator',
      version: '1.1.0',
      description: 'Generate documentation from code',
    },
    {
      id: 'refactor',
      name: 'Code Refactor',
      version: '0.8.0',
      description: 'Refactoring suggestions and assistance',
    },
  ];
}

/**
 * Validate skill ID format
 */
export function validateSkillId(id: string): void {
  if (!id || id.trim() === '') {
    throw new CliError('Skill name cannot be empty', 'INVALID_SKILL_NAME');
  }

  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
    throw new CliError(
      'Skill name must start with a letter or number and contain only lowercase letters, numbers, underscores, and hyphens',
      'INVALID_SKILL_NAME'
    );
  }

  if (id.length > 64) {
    throw new CliError('Skill name must be 64 characters or less', 'INVALID_SKILL_NAME');
  }
}
