/**
 * viben agent remove - Remove an agent
 */

import * as fs from 'fs';
import chalk from 'chalk';
import type { OutputContext, ConfigScope } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { findAgent, deleteAgent, getAgentsDir } from '../../lib/agents';

interface RemoveOptions {
  name: string;
  force?: boolean;
}

/**
 * Remove an agent
 */
export function removeAgent(ctx: OutputContext, options: RemoveOptions): void {
  const id = options.name;

  // Find the agent first
  const result = findAgent(id);

  if (!result) {
    throw new CliError(
      `Agent "${id}" not found`,
      'AGENT_NOT_FOUND'
    );
  }

  const { config, path: agentPath, source } = result;

  // In non-force mode, we would prompt for confirmation
  // For CLI, we just proceed (use --force to skip any future confirmation logic)
  if (!options.force && !ctx.json) {
    // For now, we'll proceed without confirmation since stdin handling is complex
    // In a real implementation, you might want to use readline or prompts
  }

  // Delete the agent file
  try {
    fs.unlinkSync(agentPath);
  } catch (error) {
    throw new CliError(
      `Failed to delete agent: ${agentPath}`,
      'AGENT_DELETE_ERROR',
      error
    );
  }

  output(
    ctx,
    successResponse({
      removed: true,
      id: config.id || id,
      path: agentPath,
      source,
    }),
    () => {
      console.log(chalk.green('OK') + ` Removed agent "${chalk.cyan(id)}"`);
      console.log();
      console.log(chalk.gray('Deleted:'), agentPath);
    }
  );
}
