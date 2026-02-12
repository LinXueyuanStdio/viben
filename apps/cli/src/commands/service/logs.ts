/**
 * viben service logs - View service logs
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse } from '../../lib/output';
import {
  readServiceLogsAsync,
  watchServiceLogs,
  getServiceLogPath,
  clearServiceLogs,
} from '../../lib/services';

/**
 * Options for logs command
 */
export interface LogsOptions {
  name: string;
  follow?: boolean;
  lines?: number;
  clear?: boolean;
}

/**
 * View service logs
 */
export async function showServiceLogs(
  ctx: OutputContext,
  options: LogsOptions
): Promise<void> {
  const { name, follow, lines = 100, clear } = options;

  // Clear logs if requested
  if (clear) {
    await clearServiceLogs(name);

    output(
      ctx,
      successResponse({ name, cleared: true }),
      () => {
        console.log(chalk.green(`Cleared logs for service ${name}`));
      }
    );
    return;
  }

  // Get log file path
  const logPath = getServiceLogPath(name);

  if (follow) {
    // Follow mode - watch for changes
    if (ctx.json) {
      // In JSON mode, we can't stream, so just output current logs
      const logs = await readServiceLogsAsync(name, lines);
      console.log(
        JSON.stringify(
          {
            success: true,
            data: {
              name,
              logPath,
              lines: logs,
              count: logs.length,
              note: 'Follow mode not supported in JSON output',
            },
          },
          null,
          2
        )
      );
      return;
    }

    // Human mode - stream logs
    console.log(chalk.bold(`Logs for ${name}:`));
    console.log(chalk.gray(`Path: ${logPath}`));
    console.log(chalk.gray('Press Ctrl+C to stop following'));
    console.log();

    // Output existing logs first
    const existingLogs = await readServiceLogsAsync(name, lines);
    for (const line of existingLogs) {
      console.log(line);
    }

    // Watch for new logs
    const stop = watchServiceLogs(name, (line) => {
      console.log(line);
    });

    // Handle SIGINT
    process.on('SIGINT', () => {
      stop();
      console.log();
      console.log(chalk.gray('Stopped following logs'));
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {
      // Never resolves - keep waiting until SIGINT
    });
    return;
  }

  // Regular mode - show last N lines
  const logs = await readServiceLogsAsync(name, lines);

  output(
    ctx,
    successResponse({
      name,
      logPath,
      lines: logs,
      count: logs.length,
    }),
    () => {
      console.log(chalk.bold(`Logs for ${name}:`));
      console.log(chalk.gray(`Path: ${logPath}`));
      console.log();

      if (logs.length === 0) {
        console.log(chalk.gray('No logs available.'));
        return;
      }

      for (const line of logs) {
        console.log(line);
      }
    }
  );
}
