/**
 * CLI types for Viben
 */

/**
 * CLI-specific error class
 */
export class CliError extends Error {
  constructor(
    message: string,
    public code: string = "CLI_ERROR",
    public exitCode: number = 1
  ) {
    super(message);
    this.name = "CliError";
    Error.captureStackTrace?.(this, this.constructor);
  }

  static invalidArgument(arg: string, reason?: string): CliError {
    const message = reason
      ? `Invalid argument "${arg}": ${reason}`
      : `Invalid argument: ${arg}`;
    return new CliError(message, "INVALID_ARGUMENT", 1);
  }

  static missingArgument(arg: string): CliError {
    return new CliError(
      `Missing required argument: ${arg}`,
      "MISSING_ARGUMENT",
      1
    );
  }

  static notFound(resourceType: string, resourceId: string): CliError {
    return new CliError(
      `${resourceType} "${resourceId}" not found`,
      "NOT_FOUND",
      1
    );
  }

  static alreadyExists(resourceType: string, resourceId: string): CliError {
    return new CliError(
      `${resourceType} "${resourceId}" already exists`,
      "ALREADY_EXISTS",
      1
    );
  }

  static operationFailed(operation: string, reason?: string): CliError {
    const message = reason
      ? `${operation} failed: ${reason}`
      : `${operation} failed`;
    return new CliError(message, "OPERATION_FAILED", 1);
  }
}

/**
 * Standard CLI JSON response format
 */
export interface CliResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Output context for CLI commands
 */
export interface OutputContext {
  /** Output JSON format */
  json: boolean;
  /** Verbose output */
  verbose: boolean;
  /** Quiet mode (minimal output) */
  quiet: boolean;
}

/**
 * Global CLI options
 */
export interface GlobalOptions {
  /** Output JSON format */
  json?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Quiet mode */
  quiet?: boolean;
  /** Use global config instead of workspace */
  global?: boolean;
}

/**
 * Command result that can be outputted in different formats
 */
export interface CommandResult<T = unknown> {
  /** The response data */
  response: CliResponse<T>;
  /** Human-readable renderer function */
  humanRender?: () => void;
}
