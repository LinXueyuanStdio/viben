/**
 * viben model set-default - Set the default model
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { modelSetDefault as nativeSetDefault, modelGetDefault } from '../../lib/native';

/**
 * Set the default model
 */
export async function setDefault(ctx: OutputContext, modelId: string): Promise<void> {
  if (!modelId || modelId.trim() === '') {
    throw new CliError('Model ID is required', 'MISSING_MODEL_ID');
  }

  const previousDefault = await modelGetDefault();
  await nativeSetDefault(modelId);

  output(
    ctx,
    successResponse({
      success: true,
      model: modelId,
      previousDefault: previousDefault,
    }),
    () => {
      console.log(chalk.green('\u2713'), `Default model set to: ${chalk.cyan(modelId)}`);
      if (previousDefault && previousDefault !== modelId) {
        console.log(chalk.gray(`  (was: ${previousDefault})`));
      }
    }
  );
}
