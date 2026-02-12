/**
 * viben executor list - List all discovered executors
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { executorList, type Executor } from '../../lib/native';

/**
 * List all executors
 */
export function listExecutors(ctx: OutputContext): void {
  const executors = executorList();

  const available = executors.filter((e) => e.availability.status !== 'NotFound');
  const notAvailable = executors.filter((e) => e.availability.status === 'NotFound');

  const responseData = {
    executors,
    available,
    notAvailable,
  };

  output(ctx, successResponse(responseData), () => {
    console.log(chalk.bold('Executors:'));
    console.log();

    if (available.length > 0) {
      console.log(chalk.green('  Available:'));

      outputTable(
        { ...ctx, json: false },
        ['ID', 'Name', 'Status', 'Description'],
        available.map((e) => [
          chalk.cyan(e.id),
          e.name,
          formatStatus(e.availability.status),
          chalk.gray(e.description),
        ])
      );

      console.log();
    }

    if (notAvailable.length > 0) {
      console.log(chalk.gray('  Not Available:'));

      outputTable(
        { ...ctx, json: false },
        ['ID', 'Name', 'Status', 'Description'],
        notAvailable.map((e) => [
          chalk.gray(e.id),
          chalk.gray(e.name),
          chalk.gray('Not Found'),
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

function formatStatus(status: string): string {
  switch (status) {
    case 'LoginDetected':
      return chalk.green('Logged In');
    case 'InstallationFound':
      return chalk.yellow('Installed');
    case 'NotFound':
      return chalk.gray('Not Found');
    default:
      return chalk.gray(status);
  }
}
