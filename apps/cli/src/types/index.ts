/**
 * Viben CLI Type Definitions
 */

/**
 * Standard CLI response for JSON output mode
 */
export interface CliResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * CLI Error with structured error information
 */
export class CliError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CliError';
  }

  toResponse(): CliResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

/**
 * Scope for configuration operations
 */
export type ConfigScope = 'global' | 'workspace';

/**
 * Viben configuration file structure
 */
export interface VibenConfig {
  version: number;
  settings?: {
    editor?: string;
    pager?: string;
    color?: 'auto' | 'always' | 'never';
  };
  agents?: string[];
  mcp?: {
    enabled?: string[];
  };
  skills?: {
    enabled?: string[];
  };
}

/**
 * Agent definition
 */
export interface Agent {
  id: string;
  name?: string;
  description?: string;
  model?: string;
  provider?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Global CLI options passed through context
 */
export interface GlobalOptions {
  json?: boolean;
  global?: boolean;
  workspace?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  name?: string;
}

/**
 * Output context for commands
 */
export interface OutputContext {
  json: boolean;
  verbose: boolean;
  quiet: boolean;
}

// Re-export model types
export * from './model';

// Re-export provider types
export * from './provider';

// Re-export skill types
export * from './skill';
