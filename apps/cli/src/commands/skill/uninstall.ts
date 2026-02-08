/**
 * viben skill uninstall - Uninstall a skill
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { uninstallSkill, validateSkillId } from '../../lib/skills';

/**
 * Uninstall a skill
 *
 * @param ctx - Output context
 * @param name - Skill name to uninstall
 */
export async function uninstallSkillCommand(
  ctx: OutputContext,
  name: string
): Promise<void> {
  // Validate skill name
  validateSkillId(name);

  // Uninstall the skill
  const removed = uninstallSkill(name);

  if (!removed) {
    throw new CliError(
      `Skill '${name}' is not installed.`,
      'SKILL_NOT_FOUND'
    );
  }

  output(
    ctx,
    successResponse({ name, removed: true }),
    () => {
      console.log(chalk.green('Uninstalled skill:'), name);
      console.log();
      console.log('The skill has been removed.');
    }
  );
}
