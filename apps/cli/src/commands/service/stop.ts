/**
 * viben service stop - Stop a service
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, errorResponse } from '../../lib/output';
import { stopService, getServiceStatusAsync } from '../../lib/services';

/**
 * Options for stop command
 */
export interface StopOptions {
  name: string;
}

/**
 * Stop a service
 */
export async function stopServiceCommand(
  ctx: OutputContext,
  options: StopOptions
): Promise<void> {
  const { name } = options;

  // Check if running
  const current = await getServiceStatusAsync(name);
  if (current.status !== 'running') {
    output(
      ctx,
      successResponse({
        name,
        status: 'stopped',
        message: 'Service is not running',
      }),
      () => {
        console.log(chalk.yellow(`Service ${name} is not running`));
      }
    );
    return;
  }

  try {
    await stopService(name);

    output(
      ctx,
      successResponse({
        name,
        status: 'stopped',
        previousPid: current.pid,
      }),
      () => {
        console.log(chalk.green(`Stopped service ${name}`));
        console.log(`  Previous PID: ${current.pid}`);
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output(
      ctx,
      errorResponse('STOP_ERROR', `Error stopping service: ${message}`),
      () => {
        console.error(chalk.red('Error stopping service:'), message);
      }
    );
  }
}
