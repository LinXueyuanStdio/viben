/**
 * viben model aliases - Manage model aliases
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import {
  getAliases,
  createAlias,
  removeAlias,
  aliasExists,
} from '../../lib/models';

/**
 * List all model aliases
 */
export function listAliases(ctx: OutputContext): void {
  const aliases = getAliases();
  const aliasEntries = Object.entries(aliases);

  output(
    ctx,
    successResponse({
      aliases,
      count: aliasEntries.length,
    }),
    () => {
      if (aliasEntries.length === 0) {
        console.log(chalk.gray('No model aliases configured.'));
        console.log();
        console.log('Create an alias with:');
        console.log(chalk.cyan('  viben model aliases create -n <alias> -f <model-id>'));
        return;
      }

      console.log('Model Aliases:');

      outputTable(
        ctx,
        ['Alias', 'Target'],
        aliasEntries.map(([alias, target]) => [
          chalk.cyan(alias),
          `\u2192 ${target}`,
        ])
      );
    }
  );
}

/**
 * Create a model alias
 */
export function createModelAlias(
  ctx: OutputContext,
  alias: string,
  modelId: string
): void {
  if (!alias || alias.trim() === '') {
    throw new CliError('Alias name is required', 'MISSING_ALIAS_NAME');
  }

  if (!modelId || modelId.trim() === '') {
    throw new CliError('Model ID is required', 'MISSING_MODEL_ID');
  }

  const existed = aliasExists(alias);
  createAlias(alias, modelId);

  output(
    ctx,
    successResponse({
      success: true,
      alias,
      model: modelId,
      updated: existed,
    }),
    () => {
      if (existed) {
        console.log(chalk.green('\u2713'), `Updated alias: ${chalk.cyan(alias)} \u2192 ${modelId}`);
      } else {
        console.log(chalk.green('\u2713'), `Created alias: ${chalk.cyan(alias)} \u2192 ${modelId}`);
      }
    }
  );
}

/**
 * Remove a model alias
 */
export function removeModelAlias(ctx: OutputContext, alias: string): void {
  if (!alias || alias.trim() === '') {
    throw new CliError('Alias name is required', 'MISSING_ALIAS_NAME');
  }

  const removed = removeAlias(alias);

  if (!removed) {
    throw new CliError(`Alias not found: ${alias}`, 'ALIAS_NOT_FOUND');
  }

  output(
    ctx,
    successResponse({
      success: true,
      alias,
      removed: true,
    }),
    () => {
      console.log(chalk.green('\u2713'), `Removed alias: ${chalk.cyan(alias)}`);
    }
  );
}
