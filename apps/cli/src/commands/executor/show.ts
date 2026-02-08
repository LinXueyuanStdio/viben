/**
 * viben executor show - Show executor details
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import type { ExecutorShowData } from '../../types/executor';
import { output, successResponse } from '../../lib/output';
import { getExecutorById, formatCapability, getAllExecutorIds } from '../../lib/executors';

/**
 * Show executor details
 */
export function showExecutor(ctx: OutputContext, id: string): void {
  const executor = getExecutorById(id);

  if (!executor) {
    const validIds = getAllExecutorIds();
    throw new CliError(
      `Executor "${id}" not found. Valid IDs: ${validIds.join(', ')}`,
      'EXECUTOR_NOT_FOUND',
      { validIds }
    );
  }

  // TODO: Get agents using this executor from agents config
  const agents: ExecutorShowData['agents'] = [];

  const responseData: ExecutorShowData = {
    executor,
    agents,
  };

  output(ctx, successResponse(responseData), () => {
    console.log(chalk.bold.underline(`Executor: ${executor.id}`));
    console.log(`Name: ${executor.name}`);
    console.log(`Description: ${executor.description}`);
    console.log();

    // Status
    if (executor.installed) {
      console.log(`Status: ${chalk.green('✓ Installed')}`);
      if (executor.version) {
        console.log(`Version: ${executor.version}`);
      }
      if (executor.path) {
        console.log(`Path: ${executor.path}`);
      }
    } else {
      console.log(`Status: ${chalk.gray('○ Not Installed')}`);
    }

    console.log();

    // Configuration
    if (executor.installed && (executor.configDir || executor.mcpConfigPath || executor.settingsPath)) {
      console.log(chalk.bold('Configuration:'));
      if (executor.configDir) {
        console.log(`  Config Dir:    ${executor.configDir}`);
      }
      if (executor.mcpConfigPath) {
        console.log(`  MCP Config:    ${executor.mcpConfigPath}`);
      }
      if (executor.settingsPath) {
        console.log(`  Settings:      ${executor.settingsPath}`);
      }
      console.log();
    }

    // Agents using this executor
    if (agents && agents.length > 0) {
      console.log(chalk.bold('Agents using this executor:'));
      for (const agent of agents) {
        const defaultMark = agent.isDefault ? chalk.yellow(' (default)') : '';
        console.log(
          `  ${agent.id}          ${agent.sessionCount} session${agent.sessionCount !== 1 ? 's' : ''}${defaultMark}`
        );
      }
      console.log();
    }

    // Capabilities
    if (executor.capabilities.length > 0) {
      console.log(chalk.bold('Capabilities:'));
      for (const cap of executor.capabilities) {
        console.log(`  - ${formatCapability(cap)}`);
      }
    }
  });
}
