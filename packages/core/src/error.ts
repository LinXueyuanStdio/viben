/**
 * Viben Core Error Classes
 */

/**
 * Base error class for all Viben errors
 */
export class VibenError extends Error {
  constructor(
    message: string,
    public code: string = "VIBEN_ERROR"
  ) {
    super(message);
    this.name = "VibenError";
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends VibenError {
  constructor(
    public resourceType: string,
    public resourceId: string
  ) {
    super(`${resourceType} "${resourceId}" not found`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

/**
 * Error thrown when a resource already exists
 */
export class AlreadyExistsError extends VibenError {
  constructor(
    public resourceType: string,
    public resourceId: string
  ) {
    super(`${resourceType} "${resourceId}" already exists`, "ALREADY_EXISTS");
    this.name = "AlreadyExistsError";
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends VibenError {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

/**
 * Error thrown by executor operations
 */
export class ExecutorError extends VibenError {
  constructor(
    message: string,
    public executorType?: string,
    code: string = "EXECUTOR_ERROR"
  ) {
    super(message, code);
    this.name = "ExecutorError";
  }

  static followUpNotSupported(executor: string): ExecutorError {
    return new ExecutorError(
      `Follow-up is not supported for ${executor}`,
      executor,
      "FOLLOW_UP_NOT_SUPPORTED"
    );
  }

  static spawnError(executor: string, cause: string): ExecutorError {
    return new ExecutorError(
      `Failed to spawn ${executor}: ${cause}`,
      executor,
      "SPAWN_ERROR"
    );
  }

  static executableNotFound(program: string): ExecutorError {
    return new ExecutorError(
      `Executable "${program}" not found in PATH`,
      undefined,
      "EXECUTABLE_NOT_FOUND"
    );
  }

  static authRequired(executor: string): ExecutorError {
    return new ExecutorError(
      `Authentication required for ${executor}`,
      executor,
      "AUTH_REQUIRED"
    );
  }

  static unknownType(executorType: string): ExecutorError {
    return new ExecutorError(
      `Unknown executor type: ${executorType}`,
      executorType,
      "UNKNOWN_TYPE"
    );
  }

  static chatNotSupported(executor: string): ExecutorError {
    return new ExecutorError(
      `Chat mode is not supported for ${executor}`,
      executor,
      "CHAT_NOT_SUPPORTED"
    );
  }

  static noPromptProvided(): ExecutorError {
    return new ExecutorError(
      "No prompt provided and stdin is empty",
      undefined,
      "NO_PROMPT_PROVIDED"
    );
  }
}

/**
 * Error thrown by database operations
 */
export class DatabaseError extends VibenError {
  constructor(
    message: string,
    public operation?: string
  ) {
    super(message, "DATABASE_ERROR");
    this.name = "DatabaseError";
  }
}

/**
 * Error thrown by cron service operations
 */
export class CronError extends VibenError {
  constructor(
    message: string,
    code: string = "CRON_ERROR"
  ) {
    super(message, code);
    this.name = "CronError";
  }

  static notFound(jobId: string): CronError {
    return new CronError(`Job not found: ${jobId}`, "JOB_NOT_FOUND");
  }

  static alreadyExists(jobId: string): CronError {
    return new CronError(`Job already exists: ${jobId}`, "JOB_ALREADY_EXISTS");
  }

  static invalidSchedule(): CronError {
    return new CronError(
      "Invalid schedule: must specify either cron expression or interval",
      "INVALID_SCHEDULE"
    );
  }

  static invalidCron(expression: string, cause: string): CronError {
    return new CronError(
      `Invalid cron expression "${expression}": ${cause}`,
      "INVALID_CRON"
    );
  }
}

/**
 * Error thrown by event service operations
 */
export class EventError extends VibenError {
  constructor(
    message: string,
    code: string = "EVENT_ERROR"
  ) {
    super(message, code);
    this.name = "EventError";
  }
}

/**
 * Error thrown by session store operations
 */
export class SessionStoreError extends VibenError {
  constructor(
    message: string,
    code: string = "SESSION_STORE_ERROR"
  ) {
    super(message, code);
    this.name = "SessionStoreError";
  }
}

/**
 * Error thrown by history service operations
 */
export class HistoryError extends VibenError {
  constructor(
    message: string,
    code: string = "HISTORY_ERROR"
  ) {
    super(message, code);
    this.name = "HistoryError";
  }
}

/**
 * Error thrown by gateway operations
 */
export class GatewayError extends VibenError {
  constructor(
    message: string,
    public statusCode: number = 500,
    code: string = "GATEWAY_ERROR"
  ) {
    super(message, code);
    this.name = "GatewayError";
  }
}

/**
 * Error thrown by service manager operations
 */
export class ServiceError extends VibenError {
  constructor(
    message: string,
    public serviceName?: string,
    code: string = "SERVICE_ERROR"
  ) {
    super(message, code);
    this.name = "ServiceError";
  }

  static notFound(serviceName: string): ServiceError {
    return new ServiceError(
      `Service not found: ${serviceName}`,
      serviceName,
      "SERVICE_NOT_FOUND"
    );
  }

  static alreadyRunning(serviceName: string): ServiceError {
    return new ServiceError(
      `Service already running: ${serviceName}`,
      serviceName,
      "SERVICE_ALREADY_RUNNING"
    );
  }

  static startFailed(serviceName: string, cause: string): ServiceError {
    return new ServiceError(
      `Failed to start service ${serviceName}: ${cause}`,
      serviceName,
      "SERVICE_START_FAILED"
    );
  }

  static stopFailed(serviceName: string, cause: string): ServiceError {
    return new ServiceError(
      `Failed to stop service ${serviceName}: ${cause}`,
      serviceName,
      "SERVICE_STOP_FAILED"
    );
  }

  static noCommand(serviceName: string): ServiceError {
    return new ServiceError(
      `No command specified for service ${serviceName} and no default is configured`,
      serviceName,
      "SERVICE_NO_COMMAND"
    );
  }
}
