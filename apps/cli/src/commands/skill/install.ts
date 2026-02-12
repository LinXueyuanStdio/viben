/**
 * viben skill install - Install a skill
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import { installSkill, parseSkillName, validateSkillId } from '../../lib/skills';

/**
 * Install a skill
 *
 * @param ctx - Output context
 * @param nameWithVersion - Skill name, optionally with version (e.g., "code-review" or "code-review@1.0.0")
 */
export async function installSkillCommand(
  ctx: OutputContext,
  nameWithVersion: string
): Promise<void> {
  // Parse name and version
  const { name, version } = parseSkillName(nameWithVersion);

  // Validate skill name
  validateSkillId(name);

  // Install the skill
  const skill = installSkill(name, version);

  output(
    ctx,
    successResponse({ skill }),
    () => {
      console.log(chalk.green('Installed skill:'), skill.id);
      console.log();
      console.log(`  Name:      ${skill.id}`);
      console.log(`  Version:   v${skill.version}`);
      console.log(`  Installed: ${skill.installedAt}`);
      console.log();
      console.log('The skill is now available for use.');
    }
  );
}
