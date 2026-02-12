/**
 * viben channel login - WhatsApp QR code login
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, errorResponse } from '../../lib/output';

export interface LoginOptions {
  name: string;
}

/**
 * Login to WhatsApp channel (QR code scan)
 */
export async function loginChannel(ctx: OutputContext, options: LoginOptions): Promise<void> {
  // TODO: Implement WhatsApp login when NAPI bindings support it
  const response = errorResponse('WhatsApp login not yet implemented in NAPI bindings', 'NOT_IMPLEMENTED');

  output(ctx, response, () => {
    console.log(chalk.yellow('Warning:'), 'WhatsApp login is not yet implemented.');
    console.log('This feature requires NAPI bindings for WhatsApp bridge integration.');
    console.log();
    console.log('For now, configure WhatsApp channels with bridge URL:');
    console.log(chalk.cyan('  viben channel create -n my-whatsapp --type whatsapp --bridge-url ws://localhost:3001'));
  });

  // Don't exit with error code for now, just show warning
}