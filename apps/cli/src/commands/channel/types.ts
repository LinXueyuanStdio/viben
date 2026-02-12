/**
 * viben channel types - List supported channel types
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { channelListTypes, type ChannelTypeInfo } from '../../lib/native';

/**
 * List all supported channel types
 */
export async function listChannelTypes(ctx: OutputContext): Promise<void> {
  const types = channelListTypes();

  const response = successResponse({
    types: types.map((type: ChannelTypeInfo) => ({
      id: type.id,
      name: type.name,
      description: type.description,
      setupDifficulty: type.setupDifficulty,
    })),
  });

  output(ctx, response, () => {
    console.log('Supported channel types:');
    console.log();

    const headers = ['TYPE', 'DESCRIPTION'];
    const rows = types.map((type: ChannelTypeInfo) => [type.id, type.name]);

    outputTable({ ...ctx, json: false }, headers, rows);
  });
}
