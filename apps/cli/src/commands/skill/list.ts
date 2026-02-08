/**
 * viben skill list - List installed or available skills
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { listSkills, getAvailableSkills, isSkillInstalled } from '../../lib/skills';

/**
 * Format a date string for display
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) {
    return '-';
  }

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 24 hours ago
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours === 0) {
        const minutes = Math.floor(diff / (60 * 1000));
        if (minutes === 0) {
          return 'just now';
        }
        return `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }

    // Less than 7 days ago
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}d ago`;
    }

    // Format as date
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

/**
 * List installed skills
 */
export function listInstalledSkills(ctx: OutputContext): void {
  const skills = listSkills();

  output(
    ctx,
    successResponse({ skills, count: skills.length }),
    () => {
      if (skills.length === 0) {
        console.log(chalk.gray('No skills installed.'));
        console.log();
        console.log('Install a skill with:');
        console.log(chalk.cyan('  viben skill install <name>'));
        console.log();
        console.log('View available skills with:');
        console.log(chalk.cyan('  viben skill list --available'));
        return;
      }

      console.log('Installed Skills:');

      outputTable(
        ctx,
        ['Name', 'Version', 'Installed'],
        skills.map((skill) => [
          skill.id,
          `v${skill.version}`,
          formatDate(skill.installed_at),
        ])
      );
    }
  );
}

/**
 * List available skills from marketplace
 */
export function listAvailableSkills(ctx: OutputContext): void {
  const available = getAvailableSkills();

  // Mark which ones are already installed
  const skillsWithStatus = available.map((skill) => ({
    ...skill,
    installed: isSkillInstalled(skill.id),
  }));

  output(
    ctx,
    successResponse({ skills: skillsWithStatus, count: skillsWithStatus.length }),
    () => {
      if (skillsWithStatus.length === 0) {
        console.log(chalk.gray('No skills available in marketplace.'));
        return;
      }

      console.log('Available Skills:');

      outputTable(
        ctx,
        ['Name', 'Version', 'Description', 'Status'],
        skillsWithStatus.map((skill) => [
          skill.id,
          `v${skill.version}`,
          skill.description,
          skill.installed ? chalk.green('installed') : chalk.gray('-'),
        ])
      );
    }
  );
}
