// Types
export type { Session, SessionPayload, OAuthProfile } from './types';

// JWE utilities
export { encryptSession, decryptSession } from './jwe';

// Cookie management
export { setSessionCookie, getSession, clearSession } from './cookies';

// Middleware
export {
  authMiddleware,
  requireAuth,
  getOptionalSession,
  AuthError,
} from './middleware';

// Admin middleware and helpers
export {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getPermissions,
  isAdminRole,
  getRoleLevel,
  requireAdmin,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  getAdminSession,
} from './admin';

// API Key
export { validateApiKey, generateApiKey } from './api-key';

// Password
export { hashPassword, verifyPassword } from './password';

// Token encryption (for GitHub access tokens)
export { encryptToken, decryptToken } from './token-encryption';
