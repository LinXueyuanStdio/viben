/**
 * Origin Validation Middleware
 *
 * Provides protection against DNS rebinding attacks by validating
 * the Origin header of incoming requests against an allowlist.
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import { logger as globalLogger } from "../../telemetry";

const log = globalLogger.child({ module: "origin-validation" });

/**
 * Default allowed origins for the Gateway
 * These are the origins that are trusted by default
 */
const DEFAULT_ALLOWED_ORIGINS = [
  // Desktop app (Vite dev server)
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  // Gateway itself
  "http://localhost:18790",
  "http://127.0.0.1:18790",
  // Tauri custom protocol
  "tauri://localhost",
  // Web app (Next.js dev server)
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/**
 * Get allowed origins from environment and defaults
 *
 * @returns Array of allowed origin strings
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.VIBEN_ALLOWED_ORIGINS;
  const additionalOrigins = envOrigins
    ? envOrigins.split(",").map((o) => o.trim()).filter(Boolean)
    : [];

  return [...DEFAULT_ALLOWED_ORIGINS, ...additionalOrigins];
}

/**
 * Check if the origin is allowed
 *
 * @param origin - The origin to check
 * @returns true if origin is allowed or absent, false otherwise
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  // Allow requests without Origin header (e.g., same-origin requests, curl)
  if (!origin) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

/**
 * Validate origin and return 403 if not allowed
 *
 * This middleware protects against DNS rebinding attacks by ensuring
 * that requests only come from trusted origins.
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns true if origin is valid and request can proceed, false if blocked
 */
export function validateOrigin(request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = request.headers.origin;

  if (!isOriginAllowed(origin)) {
    log.warn({ origin }, "Blocked request from untrusted origin");

    reply.code(403).send({
      error: "Forbidden",
      message: "Request origin not allowed. This may be a DNS rebinding attack.",
      origin: origin,
    });
    return false;
  }

  return true;
}

/**
 * Set security headers on the response
 *
 * These headers provide additional protection against various attacks.
 *
 * @param reply - Fastify reply object
 */
export function setSecurityHeaders(reply: FastifyReply): void {
  reply.raw.setHeader("X-Content-Type-Options", "nosniff");
  reply.raw.setHeader("X-Frame-Options", "SAMEORIGIN");
  reply.raw.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' localhost:* 127.0.0.1:*"
  );
}

/**
 * Combined middleware: validate origin and set security headers
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns true if request can proceed, false if blocked
 */
export function validateOriginAndSetSecurityHeaders(
  request: FastifyRequest,
  reply: FastifyReply
): boolean {
  setSecurityHeaders(reply);
  return validateOrigin(request, reply);
}
