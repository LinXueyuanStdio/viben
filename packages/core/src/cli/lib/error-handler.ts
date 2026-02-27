/**
 * CLI error handling utilities
 */
import { CliError, type OutputContext } from "../types";
import { outputError } from "./output";
import {
  VibenError,
  NotFoundError,
  AlreadyExistsError,
  ValidationError,
  ExecutorError,
  ServiceError,
  CronError,
} from "../../error";

/**
 * Convert a VibenError to a CliError
 */
export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof NotFoundError) {
    return CliError.notFound(error.resourceType, error.resourceId);
  }

  if (error instanceof AlreadyExistsError) {
    return CliError.alreadyExists(error.resourceType, error.resourceId);
  }

  if (error instanceof ValidationError) {
    return CliError.invalidArgument(error.field || "input", error.message);
  }

  if (error instanceof ExecutorError) {
    return new CliError(error.message, error.code, 1);
  }

  if (error instanceof ServiceError) {
    return new CliError(error.message, error.code, 1);
  }

  if (error instanceof CronError) {
    return new CliError(error.message, error.code, 1);
  }

  if (error instanceof VibenError) {
    return new CliError(error.message, error.code, 1);
  }

  if (error instanceof Error) {
    return new CliError(error.message, "UNKNOWN_ERROR", 1);
  }

  return new CliError(String(error), "UNKNOWN_ERROR", 1);
}

/**
 * Handle a command error and output appropriately
 */
export function handleCommandError(ctx: OutputContext, error: unknown): never {
  const cliError = toCliError(error);
  outputError(ctx, cliError.code, cliError.message);
  process.exit(cliError.exitCode);
}

/**
 * Wrap an async command handler with error handling
 */
export function withErrorHandler<T extends unknown[]>(
  ctx: OutputContext,
  handler: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await handler(...args);
    } catch (error) {
      handleCommandError(ctx, error);
    }
  };
}
