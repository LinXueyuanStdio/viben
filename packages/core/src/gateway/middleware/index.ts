/**
 * Gateway Middleware
 *
 * Re-exports all middleware functions for easy import
 */
export {
  validateOrigin,
  validateOriginAndSetSecurityHeaders,
  setSecurityHeaders,
  getAllowedOrigins,
  isOriginAllowed,
} from "./origin-validation";
