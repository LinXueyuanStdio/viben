/**
 * viben channel status - Show channel status
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import {
  channelList,
  channelGet,
  channelGetDefault,
  channelTestConnection,
} from '../../lib/native';

export interface StatusOptions {
  name?: string;
}

/**
 * Show channel status
 */
export async function showChannelStatus(
  ctx: OutputContext,
  options: StatusOptions
): Promise<void> {
  if (options.name) {
    // Show status for a specific channel
    await showSingleChannelStatus(ctx, options.name);
  } else {
    // Show status for all channels
    await showAllChannelStatus(ctx);
  }
}

/**
 * Show status for a single channel
 */
async function showSingleChannelStatus(ctx: OutputContext, name: string): Promise<void> {
  const channel = await channelGet(name);
  if (!channel) {
    throw new CliError(`Channel "${name}" not found`, 'CHANNEL_NOT_FOUND');
  }

  // Try to test connection if channel is enabled
  let testResult = null;
  if (channel.enabled) {
    try {
      testResult = await channelTestConnection(name);
    } catch (error) {
      testResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const response = successResponse({
    id: channel.id,
    name: channel.name,
    type: channel.channelType,
    enabled: channel.enabled,
    isDefault: channel.isDefault,
    status: testResult || { success: false },
  });

  output(ctx, response, () => {
    console.log(chalk.bold(`Channel: ${channel.name}`));
    console.log();
    console.log(`  ID:       ${channel.id}`);
    console.log(`  Type:     ${channel.channelType}`);
    console.log(`  Enabled:  ${channel.enabled ? chalk.green('yes') : chalk.gray('no')}`);
    console.log(`  Default:  ${channel.isDefault ? chalk.yellow('yes') : 'no'}`);

    if (testResult) {
      const statusText = testResult.success
        ? chalk.green('\u2713 connected')
        : chalk.red('\u2717 disconnected');
      console.log(`  Status:   ${statusText}`);

      if (testResult.details) {
        console.log(`  Details:  ${testResult.details}`);
      }
      if (testResult.error) {
        console.log(`  Error:    ${chalk.red(testResult.error)}`);
      }
    } else if (!channel.enabled) {
      console.log(`  Status:   ${chalk.gray('\u25CB disabled')}`);
    }
  });
}

/**
 * Show status for all channels
 */
async function showAllChannelStatus(ctx: OutputContext): Promise<void> {
  const channels = await channelList();
  const defaultId = await channelGetDefault();

  if (channels.length === 0) {
    const response = successResponse({ channels: [] });
    output(ctx, response, () => {
      console.log(chalk.gray('No channels configured.'));
    });
    return;
  }

  // Get statuses (without connecting, for speed)
  const statuses = channels.map((ch) => ({
    id: ch.id,
    name: ch.name,
    type: ch.channelType,
    enabled: ch.enabled,
    isDefault: ch.isDefault,
  }));

  const response = successResponse({
    default: defaultId,
    channels: statuses,
  });

  output(ctx, response, () => {
    console.log(chalk.bold('Channel Status:'));
    console.log();

    const headers = ['ID', 'Name', 'Type', 'Status'];
    const rows = channels.map((ch) => {
      const id = ch.isDefault ? `${ch.id}${chalk.yellow('*')}` : ch.id;
      const status = ch.enabled
        ? chalk.green('\u2713 enabled')
        : chalk.gray('\u25CB disabled');
      return [id, ch.name, ch.channelType, status];
    });

    outputTable({ ...ctx, json: false }, headers, rows);

    console.log();
    console.log(chalk.gray('To test connection, run: viben channel status -n <id>'));
  });
}
