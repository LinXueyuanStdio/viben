/**
 * viben model status - Show model status
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { modelList, modelGet, modelGetDefault, type Model } from '../../lib/native';

/**
 * Show model status
 */
export async function showModelStatus(ctx: OutputContext, modelId?: string): Promise<void> {
  const defaultModel = await modelGetDefault();

  let models: Model[];
  if (modelId) {
    const model = await modelGet(modelId);
    models = model ? [model] : [];
  } else {
    models = await modelList();
  }

  const responseData = {
    default: defaultModel,
    models: models.map((m: Model) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      enabled: m.enabled,
      isDefault: m.isDefault,
    })),
  };

  output(
    ctx,
    successResponse(responseData),
    () => {
      console.log('Model Status:');

      if (defaultModel) {
        console.log(`  Default: ${chalk.cyan(defaultModel)}`);
      } else {
        console.log(`  Default: ${chalk.gray('(not set)')}`);
      }

      console.log();

      if (models.length === 0) {
        console.log(chalk.gray('  No models configured.'));
        return;
      }

      outputTable(
        ctx,
        ['Model', 'Name', 'Provider', 'Enabled', 'Default'],
        models.map((model: Model) => [
          model.id,
          model.name || chalk.gray('(unnamed)'),
          model.provider || chalk.gray('(unknown)'),
          model.enabled ? chalk.green('yes') : chalk.gray('no'),
          model.isDefault ? chalk.green('yes') : chalk.gray('no'),
        ])
      );
    }
  );
}
