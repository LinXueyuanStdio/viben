/**
 * Viben CLI
 *
 * Command-line interface for managing AI agent workspaces.
 *
 * @packageDocumentation
 */

export { createProgram, run } from './cli';
export { CliError } from './types';
export type {
  CliResponse,
  ConfigScope,
  VibenConfig,
  Agent,
  GlobalOptions,
  OutputContext,
} from './types';
