/**
 * viben model status - Show model status
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { getDefaultModel, getModelStatus } from '../../lib/models';

/**
 * Show model status
 */
export function showModelStatus(ctx: OutputContext, modelId?: string): void {
  const defaultModel = getDefaultModel();
  const statuses = getModelStatus(modelId);

  const responseData = {
    default: defaultModel,
    models: statuses.map((s) => ({
      id: s.id,
      provider: s.provider,
      available: s.available,
      error: s.error,
    })),
  };

  output(
    ctx,
    successResponse(responseData),
    () => {
      console.log('Model Status:');

      if (defaultModel) {
        console.log(`  Default: ${chalk.cyan(defaultModel)}`);
      } else {
        console.log(`  Default: ${chalk.gray('(not set)')}`);
      }

      console.log();

      if (statuses.length === 0) {
        console.log(chalk.gray('  No models configured.'));
        return;
      }

      outputTable(
        ctx,
        ['Model', 'Provider', 'Status'],
        statuses.map((status) => [
          status.id,
          status.provider || chalk.gray('(unknown)'),
          status.available
            ? chalk.green('\u2713 available')
            : chalk.red(`\u2717 ${status.error || 'unavailable'}`),
        ])
      );
    }
  );
}
