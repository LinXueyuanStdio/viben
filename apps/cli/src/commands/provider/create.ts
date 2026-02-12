/**
 * viben provider create - Create a new provider
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { providerCreate, ProviderTypes, type CreateProviderOptions, type ProviderType } from '../../lib/native';

interface CreateOptions {
  name?: string;
  type: string;
  apiKey?: string;
  baseUrl?: string;
  setAsDefault?: boolean;
}

/**
 * Map string type to ProviderType
 */
function parseProviderType(type: string): ProviderType {
  const typeMap: Record<string, ProviderType> = {
    openai: ProviderTypes.OpenAI,
    anthropic: ProviderTypes.Anthropic,
    azure: ProviderTypes.Azure,
    ollama: ProviderTypes.Ollama,
    openrouter: ProviderTypes.OpenRouter,
    google: ProviderTypes.Google,
    custom: ProviderTypes.Custom,
  };

  const normalized = type.toLowerCase();
  const providerType = typeMap[normalized];

  if (!providerType) {
    throw new CliError(
      `Invalid provider type: ${type}. Valid types: openai, anthropic, google, azure, openrouter, ollama, custom`,
      'INVALID_PROVIDER_TYPE'
    );
  }

  return providerType;
}

/**
 * Create a new provider
 */
export async function createProviderCommand(ctx: OutputContext, options: CreateOptions): Promise<void> {
  // Validate and parse type
  const providerType = parseProviderType(options.type);

  // Generate name if not provided
  const name = options.name || `${options.type.toLowerCase()}-provider`;

  const createOptions: CreateProviderOptions = {
    providerType,
    name,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    setAsDefault: options.setAsDefault,
  };

  const provider = await providerCreate(createOptions);

  output(
    ctx,
    successResponse({
      provider: {
        id: provider.id,
        name: provider.name,
        type: provider.providerType,
        enabled: provider.enabled,
        isDefault: provider.isDefault,
      },
    }),
    () => {
      console.log(chalk.green('OK') + ` Created provider "${chalk.cyan(provider.name)}"`);
      console.log();
      console.log('ID:', chalk.yellow(provider.id));
      console.log('Type:', chalk.yellow(provider.providerType));
      if (provider.isDefault) {
        console.log('Default:', chalk.green('yes'));
      }
      console.log();

      // Provide helpful hints based on provider type
      if (!options.apiKey) {
        const envHints: Record<string, string> = {
          [ProviderTypes.Anthropic]: 'ANTHROPIC_API_KEY',
          [ProviderTypes.OpenAI]: 'OPENAI_API_KEY',
          [ProviderTypes.Google]: 'GOOGLE_API_KEY',
          [ProviderTypes.Azure]: 'AZURE_OPENAI_API_KEY',
          [ProviderTypes.OpenRouter]: 'OPENROUTER_API_KEY',
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
