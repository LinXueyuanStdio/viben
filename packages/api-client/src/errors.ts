/**
 * Structured error hierarchy for Viben API client
 */
import { ApiError } from "./client";

// Re-export the base error
export { ApiError } from "./client";

/**
 * Network or timeout error (status 0 or 408)
 */
export class NetworkError extends ApiError {
  constructor(message: string, status = 0) {
    super(message, status);
    this.name = "NetworkError";
  }
}

/**
 * Authentication error (401)
 */
export class AuthError extends ApiError {
  constructor(message = "Invalid or expired token") {
    super(message, 401);
    this.name = "AuthError";
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends ApiError {
  constructor(message = "Too many requests") {
    super(message, 429);
    this.name = "RateLimitError";
  }
}

/**
 * Server error (5xx)
 */
export class ServerError extends ApiError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "ServerError";
  }
}

/**
 * Type guard: check if an unknown error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Get a stable error code string from an unknown error
 */
export function getApiErrorCode(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "UNAUTHORIZED";
    if (error.status === 429) return "RATE_LIMITED";
    if (error.status >= 500) return "SERVER_ERROR";
    if (error.status === 408 || error.status === 0) return "NETWORK_ERROR";
    return `HTTP_${error.status}`;
  }
  return "UNKNOWN";
}
