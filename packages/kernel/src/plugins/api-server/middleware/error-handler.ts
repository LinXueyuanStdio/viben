import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ConfigValidationError } from '../../../core/config/config-registry.js';

/** Standard error envelope returned by all API error responses. */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

/** Thrown by route handlers when a requested resource does not exist (→ 404). */
export class NotFoundError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Thrown when the client sends a malformed or semantically invalid request (→ 400). */
export class BadRequestError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BadRequestError';
  }
}

/** Thrown when a required backing service (e.g. file-service) is not loaded (→ 503). */
export class ServiceUnavailableError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

/** Thrown by auth middleware and routes for authentication/authorization failures (→ 401 or 403). */
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Fastify global error handler that normalizes all thrown errors into the `ApiErrorResponse`
 * envelope. Maps known error classes to their corresponding HTTP status codes and falls back
 * to 500 for anything unrecognized.
 */
export function globalErrorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof ZodError) {
    const issues = error.issues;
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: issues.map((e) => e.message).join(', '),
        statusCode: 400,
        details: issues,
      },
    });
    return;
  }

  if (error instanceof ConfigValidationError) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        statusCode: 400,
      },
    });
    return;
  }

  if (error instanceof BadRequestError) {
    reply.status(400).send({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 400,
      },
    });
    return;
  }

  if (error instanceof NotFoundError) {
    reply.status(404).send({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 404,
      },
    });
    return;
  }

  if (error instanceof ServiceUnavailableError) {
    reply.status(503).send({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 503,
      },
    });
    return;
  }

  if (error instanceof AuthError) {
    reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      },
    });
    return;
  }

  reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      statusCode: 500,
    },
  });
}
