/**
 * viben executor list - List all discovered executors
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import type { ExecutorListData } from '../../types/executor';
import { output, successResponse, outputTable } from '../../lib/output';
import { detectAllExecutors } from '../../lib/executors';

/**
 * List all executors
 */
export function listExecutors(ctx: OutputContext): void {
  const executors = detectAllExecutors();

  const installed = executors.filter((e) => e.installed);
  const notInstalled = executors.filter((e) => !e.installed);

  const responseData: ExecutorListData = {
    executors,
    installed,
    notInstalled,
  };

  output(ctx, successResponse(responseData), () => {
    console.log(chalk.bold('Executors:'));
    console.log();

    if (installed.length > 0) {
      console.log(chalk.green('  Installed:'));

      outputTable(
        { ...ctx, json: false },
        ['ID', 'Name', 'Version', 'Description'],
        installed.map((e) => [
          chalk.cyan(e.id),
          e.name,
          e.version || chalk.gray('-'),
          chalk.gray(e.description),
        ])
      );

      console.log();
    }

    if (notInstalled.length > 0) {
      console.log(chalk.gray('  Not Installed:'));

      outputTable(
        { ...ctx, json: false },
        ['ID', 'Name', 'Version', 'Description'],
        notInstalled.map((e) => [
          chalk.gray(e.id),
          chalk.gray(e.name),
          chalk.gray('-'),
          chalk.gray(e.description),
        ])
      );

      console.log();
    }

    console.log(
      chalk.gray("Tip: Use 'viben executor show -n <id>' to see details.")
    );
  });
}
