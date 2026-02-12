/**
 * viben executor show - Show executor details
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { executorGet, executorGetAllIds, type Executor } from '../../lib/native';

/**
 * Show executor details
 */
export function showExecutor(ctx: OutputContext, id: string): void {
  const executor = executorGet(id.toUpperCase());

  if (!executor) {
    const validIds = executorGetAllIds();
    throw new CliError(
      `Executor "${id}" not found. Valid IDs: ${validIds.join(', ')}`,
      'EXECUTOR_NOT_FOUND',
      { validIds }
    );
  }

  const responseData = {
    executor,
  };

  output(ctx, successResponse(responseData), () => {
    console.log(chalk.bold.underline(`Executor: ${executor.id}`));
    console.log(`Name: ${executor.name}`);
    console.log(`Description: ${executor.description}`);
    console.log();

    // Status
    const status = executor.availability.status;
    if (status === 'LoginDetected') {
      console.log(`Status: ${chalk.green('✓ Logged In')}`);
      if (executor.availability.lastAuthTimestamp) {
        const date = new Date(executor.availability.lastAuthTimestamp * 1000);
        console.log(`Last Auth: ${date.toLocaleString()}`);
      }
    } else if (status === 'InstallationFound') {
      console.log(`Status: ${chalk.yellow('○ Installed')}`);
    } else {
      console.log(`Status: ${chalk.gray('○ Not Found')}`);
    }

    console.log();

    // MCP Configuration
    if (executor.supportsMcp) {
      console.log(chalk.bold('MCP Support:'));
      console.log(`  Supports MCP: ${chalk.green('Yes')}`);
      if (executor.mcpConfigPath) {
        console.log(`  Config Path:  ${executor.mcpConfigPath}`);
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

function formatCapability(capability: string): string {
  const labels: Record<string, string> = {
    'SessionFork': 'Session forking',
    'SetupHelper': 'Setup helper required',
    'ContextUsage': 'Context/token usage reporting',
  };

  return labels[capability] || capability;
}
