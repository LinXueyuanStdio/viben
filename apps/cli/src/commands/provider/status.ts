/**
 * viben provider status - Check provider connectivity
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import type { ProviderStatus } from '../../types/provider';
import { output, successResponse, outputTable } from '../../lib/output';
import {
  checkProviderStatus,
  checkAllProvidersStatus,
  getProvider,
  listProviders,
} from '../../lib/providers';
import { CliError } from '../../types';

interface StatusOptions {
  name?: string;
}

/**
 * Format status for display
 */
function formatStatus(status: ProviderStatus): string {
  switch (status.status) {
    case 'connected':
      return chalk.green('\u2713 connected');
    case 'not_running':
      return chalk.yellow('\u25CB not running');
    case 'error':
      return chalk.red('\u2717 error');
    default:
      return chalk.gray('unknown');
  }
}

/**
 * Format latency for display
 */
function formatLatency(latency?: number): string {
  if (latency === undefined) {
    return chalk.gray('-');
  }
  return `${latency}ms`;
}

/**
 * Check provider status
 */
export async function statusProviderCommand(
  ctx: OutputContext,
  options: StatusOptions
): Promise<void> {
  // Check if no providers configured
  const providers = listProviders();
  if (providers.length === 0) {
    output(
      ctx,
      successResponse({
        providers: [],
        message: 'No providers configured',
      }),
      () => {
        console.log(chalk.gray('No providers configured.'));
        console.log();
        console.log('Create a provider with:');
        console.log(chalk.cyan('  viben provider create -t <type>'));
      }
    );
    return;
  }

  if (options.name) {
    // Check single provider
    const provider = getProvider(options.name);
    if (!provider) {
      throw new CliError(
        `Provider "${options.name}" not found`,
        'PROVIDER_NOT_FOUND'
      );
    }

    const status = await checkProviderStatus(provider);

    output(
      ctx,
      successResponse({
        provider: {
          name: status.name,
          type: status.type,
          status: status.status,
          latency: status.latency,
          error: status.error,
          isDefault: status.isDefault,
        },
      }),
      () => {
        console.log(chalk.bold(`Provider: ${status.name}`));
        console.log();
        console.log('Type:', chalk.yellow(status.type));
        console.log('Status:', formatStatus(status));
        if (status.latency !== undefined) {
          console.log('Latency:', formatLatency(status.latency));
        }
        if (status.error) {
          console.log('Error:', chalk.red(status.error));
        }
        if (status.isDefault) {
          console.log('Default:', chalk.green('yes'));
        }
      }
    );
  } else {
    // Check all providers
    const statuses = await checkAllProvidersStatus();

    output(
      ctx,
      successResponse({
        providers: statuses.map((s) => ({
          name: s.name,
          type: s.type,
          status: s.status,
          latency: s.latency,
          error: s.error,
          isDefault: s.isDefault,
        })),
      }),
      () => {
        console.log(chalk.bold('Provider Status:'));
        console.log();

        outputTable(
          ctx,
          ['Name', 'Type', 'Status', 'Latency', 'Error'],
          statuses.map((s) => [
            s.isDefault ? chalk.cyan(s.name + '*') : s.name,
            s.type,
            formatStatus(s),
            formatLatency(s.latency),
            s.error ? chalk.red(s.error) : chalk.gray('-'),
          ])
        );

        console.log();
        console.log(chalk.gray('* = default provider'));
      }
    );
  }
}
