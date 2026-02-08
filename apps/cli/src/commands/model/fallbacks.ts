/**
 * viben model fallbacks - Manage model fallback chain
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import {
  getFallbacks,
  addFallback,
  removeFallback,
  clearFallbacks,
  getModelConfig,
} from '../../lib/models';

/**
 * List the fallback chain
 */
export function listFallbacks(ctx: OutputContext): void {
  const fallbacks = getFallbacks();

  output(
    ctx,
    successResponse({
      fallbacks,
      count: fallbacks.length,
    }),
    () => {
      if (fallbacks.length === 0) {
        console.log(chalk.gray('No fallback chain configured.'));
        console.log();
        console.log('Add to fallback chain with:');
        console.log(chalk.cyan('  viben model fallbacks create -n <model-id>'));
        return;
      }

      console.log('Fallback Chain:');

      outputTable(
        ctx,
        ['Order', 'Model', 'Provider'],
        fallbacks.map((modelId, index) => {
          const config = getModelConfig(modelId);
          return [
            `${index + 1}.`,
            modelId,
            config?.provider ? `(${config.provider})` : chalk.gray('(unknown)'),
          ];
        })
      );
    }
  );
}

/**
 * Add a model to the fallback chain
 */
export function addToFallbacks(ctx: OutputContext, modelId: string): void {
  if (!modelId || modelId.trim() === '') {
    throw new CliError('Model ID is required', 'MISSING_MODEL_ID');
  }

  const existingFallbacks = getFallbacks();
  const alreadyExists = existingFallbacks.includes(modelId);

  addFallback(modelId);

  const newPosition = existingFallbacks.length + (alreadyExists ? 0 : 1);

  output(
    ctx,
    successResponse({
      success: true,
      model: modelId,
      position: newPosition,
      alreadyExisted: alreadyExists,
    }),
    () => {
      if (alreadyExists) {
        console.log(chalk.yellow('!'), `Model ${chalk.cyan(modelId)} is already in fallback chain`);
      } else {
        console.log(chalk.green('\u2713'), `Added ${chalk.cyan(modelId)} to fallback chain (position ${newPosition})`);
      }
    }
  );
}

/**
 * Remove a model from the fallback chain
 */
export function removeFromFallbacks(ctx: OutputContext, modelId: string): void {
  if (!modelId || modelId.trim() === '') {
    throw new CliError('Model ID is required', 'MISSING_MODEL_ID');
  }

  const removed = removeFallback(modelId);

  if (!removed) {
    throw new CliError(
      `Model not in fallback chain: ${modelId}`,
      'MODEL_NOT_IN_FALLBACKS'
    );
  }

  output(
    ctx,
    successResponse({
      success: true,
      model: modelId,
      removed: true,
    }),
    () => {
      console.log(chalk.green('\u2713'), `Removed ${chalk.cyan(modelId)} from fallback chain`);
    }
  );
}

/**
 * Clear the entire fallback chain
 */
export function clearFallbackChain(ctx: OutputContext): void {
  const previousCount = getFallbacks().length;
  clearFallbacks();

  output(
    ctx,
    successResponse({
      success: true,
      cleared: true,
      previousCount,
    }),
    () => {
      if (previousCount === 0) {
        console.log(chalk.gray('Fallback chain was already empty.'));
      } else {
        console.log(chalk.green('\u2713'), `Cleared fallback chain (${previousCount} model${previousCount !== 1 ? 's' : ''} removed)`);
      }
    }
  );
}
