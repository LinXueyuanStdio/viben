/**
 * viben channel status - Show channel status
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import {
  listChannelConfigs,
  getDefaultChannelId,
  getChannelConfig,
  ChannelManager,
} from '../../lib/channels';

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
  const config = getChannelConfig(name);
  if (!config) {
    throw new CliError(`Channel "${name}" not found`, 'CHANNEL_NOT_FOUND');
  }

  const defaultId = getDefaultChannelId();
  const isDefault = name === defaultId;

  // Try to get live status if channel is enabled
  let liveStatus = null;
  if (config.enabled) {
    try {
      const manager = new ChannelManager();
      await manager.initialize();
      const channel = manager.getChannel(name);
      if (channel) {
        await channel.connect();
        liveStatus = channel.getStatus();
        await channel.disconnect();
      }
    } catch (error) {
      // Connection failed, will show as disconnected
      liveStatus = {
        connected: false,
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const response = successResponse({
    id: name,
    type: config.type,
    enabled: config.enabled,
    isDefault,
    status: liveStatus || { connected: false },
  });

  output(ctx, response, () => {
    console.log(chalk.bold(`Channel: ${name}`));
    console.log();
    console.log(`  Type:     ${config.type}`);
    console.log(`  Enabled:  ${config.enabled ? chalk.green('yes') : chalk.gray('no')}`);
    console.log(`  Default:  ${isDefault ? chalk.yellow('yes') : 'no'}`);

    if (liveStatus) {
      const statusText = liveStatus.connected
        ? chalk.green('\u2713 connected')
        : chalk.red('\u2717 disconnected');
      console.log(`  Status:   ${statusText}`);

      if (liveStatus.identifier) {
        console.log(`  Identity: ${liveStatus.identifier}`);
      }
      if (liveStatus.lastError) {
        console.log(`  Error:    ${chalk.red(liveStatus.lastError)}`);
      }
    } else if (!config.enabled) {
      console.log(`  Status:   ${chalk.gray('\u25CB disabled')}`);
    }
  });
}

/**
 * Show status for all channels
 */
async function showAllChannelStatus(ctx: OutputContext): Promise<void> {
  const channels = listChannelConfigs();
  const defaultId = getDefaultChannelId();

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
    type: ch.type,
    enabled: ch.enabled,
    isDefault: ch.id === defaultId,
  }));

  const response = successResponse({
    default: defaultId,
    channels: statuses,
  });

  output(ctx, response, () => {
    console.log(chalk.bold('Channel Status:'));
    console.log();

    const headers = ['ID', 'Type', 'Status', 'Identity'];
    const rows = channels.map((ch) => {
      const id = ch.id === defaultId ? `${ch.id}${chalk.yellow('*')}` : ch.id;
      const status = ch.enabled
        ? chalk.green('\u2713 enabled')
        : chalk.gray('\u25CB disabled');
      const identity = ch.enabled ? chalk.gray('(run gateway to connect)') : '-';
      return [id, ch.type, status, identity];
    });

    outputTable({ ...ctx, json: false }, headers, rows);

    console.log();
    console.log(chalk.gray('To see live connection status, run: viben channel status -n <id>'));
  });
}
