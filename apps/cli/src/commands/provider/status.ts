/**
 * viben provider status - Check provider connectivity
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import {
  providerList,
  providerGet,
  providerTestConnection,
  type Provider,
  type ProviderStatus,
} from '../../lib/native';

interface StatusOptions {
  name?: string;
}

/**
 * Format status for display
 */
function formatStatus(status: ProviderStatus): string {
  if (status.connected) {
    return chalk.green('\u2713 connected');
  }
  if (status.error) {
    return chalk.red('\u2717 error');
  }
  return chalk.yellow('\u25CB not tested');
}

/**
 * Format latency for display
 */
function formatLatency(latency?: number): string {
  if (latency === undefined || latency === null) {
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
  const providers = await providerList();
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
    const provider = await providerGet(options.name);
    if (!provider) {
      throw new CliError(`Provider "${options.name}" not found`, 'PROVIDER_NOT_FOUND');
    }

    const status = await providerTestConnection(options.name);

    output(
      ctx,
      successResponse({
        provider: {
          id: provider.id,
          name: provider.name,
          type: provider.providerType,
          status: status.connected ? 'connected' : 'error',
          latency: status.latencyMs,
          error: status.error,
          isDefault: provider.isDefault,
        },
      }),
      () => {
        console.log(chalk.bold(`Provider: ${provider.name}`));
        console.log();
        console.log('ID:', chalk.yellow(provider.id));
        console.log('Type:', chalk.yellow(provider.providerType));
        console.log('Status:', formatStatus(status));
        if (status.latencyMs !== undefined) {
          console.log('Latency:', formatLatency(status.latencyMs));
        }
        if (status.error) {
          console.log('Error:', chalk.red(status.error));
        }
        if (provider.isDefault) {
          console.log('Default:', chalk.green('yes'));
        }
      }
    );
  } else {
    // Check all providers
    const statuses: Array<{ provider: Provider; status: ProviderStatus }> = [];
    for (const provider of providers) {
      const status = await providerTestConnection(provider.id);
      statuses.push({ provider, status });
    }

    output(
      ctx,
      successResponse({
        providers: statuses.map(({ provider, status }) => ({
          id: provider.id,
          name: provider.name,
          type: provider.providerType,
          status: status.connected ? 'connected' : 'error',
          latency: status.latencyMs,
          error: status.error,
          isDefault: provider.isDefault,
        })),
      }),
      () => {
        console.log(chalk.bold('Provider Status:'));
        console.log();

        outputTable(
          ctx,
          ['ID', 'Name', 'Type', 'Status', 'Latency', 'Error'],
          statuses.map(({ provider, status }) => [
            provider.isDefault ? chalk.cyan(provider.id + '*') : provider.id,
            provider.name,
            provider.providerType,
            formatStatus(status),
            formatLatency(status.latencyMs),
            status.error ? chalk.red(status.error) : chalk.gray('-'),
          ])
        );

        console.log();
        console.log(chalk.gray('* = default provider'));
      }
    );
  }
}
