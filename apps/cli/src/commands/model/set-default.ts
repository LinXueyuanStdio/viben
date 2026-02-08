/**
 * viben model set-default - Set the default model
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { setDefaultModel, getDefaultModel } from '../../lib/models';

/**
 * Set the default model
 */
export function setDefault(ctx: OutputContext, modelId: string): void {
  if (!modelId || modelId.trim() === '') {
    throw new CliError('Model ID is required', 'MISSING_MODEL_ID');
  }

  const previousDefault = getDefaultModel();
  setDefaultModel(modelId);

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
