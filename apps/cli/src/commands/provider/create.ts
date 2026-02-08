/**
 * viben provider create - Create a new provider
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import type { ProviderType } from '../../types/provider';
import { output, successResponse } from '../../lib/output';
import {
  createProvider,
  validateProviderName,
  validateProviderType,
  generateProviderName,
  getProvidersConfigPath,
} from '../../lib/providers';

interface CreateOptions {
  name?: string;
  type: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Create a new provider
 */
export function createProviderCommand(ctx: OutputContext, options: CreateOptions): void {
  // Validate type
  const providerType: ProviderType = validateProviderType(options.type);

  // Generate or validate name
  let name: string;
  if (options.name) {
    validateProviderName(options.name);
    name = options.name;
  } else {
    name = generateProviderName(providerType);
  }

  // Create the provider
  const provider = createProvider(name, providerType, {
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
  });

  const configPath = getProvidersConfigPath();

  output(
    ctx,
    successResponse({
      provider: {
        name: provider.name,
        type: provider.type,
        isDefault: provider.isDefault,
      },
      path: configPath,
    }),
    () => {
      console.log(chalk.green('OK') + ` Created provider "${chalk.cyan(provider.name)}"`);
      console.log();
      console.log('Type:', chalk.yellow(provider.type));
      if (provider.isDefault) {
        console.log('Default:', chalk.green('yes'));
      }
      console.log('Config file:', chalk.gray(configPath));
      console.log();

      // Provide helpful hints based on provider type
      if (!options.apiKey) {
        const envHints: Record<string, string> = {
          anthropic: 'ANTHROPIC_API_KEY',
          openai: 'OPENAI_API_KEY',
          google: 'GOOGLE_API_KEY',
          azure: 'AZURE_OPENAI_API_KEY',
          openrouter: 'OPENROUTER_API_KEY',
        };

        const envVar = envHints[providerType];
        if (envVar) {
          console.log(chalk.yellow('Note:') + ' No API key provided. Set it via:');
          console.log(chalk.cyan(`  export ${envVar}="your-api-key"`));
          console.log();
        }
      }

      console.log('Next steps:');
      console.log(chalk.cyan('  viben provider status') + ' - Check provider connectivity');
      console.log(chalk.cyan('  viben provider list') + ' - List all providers');
    }
  );
}
