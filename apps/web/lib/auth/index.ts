// Types
export type { Session, SessionPayload, OAuthProfile, AccessTokenPayload } from './types';

// JWE utilities
export { encryptSession, decryptSession } from './jwe';

// Token primitives（edge-safe，可被 middleware 导入）
export {
  signAccessToken,
  verifyAccessToken,
} from './token';

// Refresh token primitives（Node-only，依赖 node:crypto）
export {
  generateRefreshToken,
  hashRefreshToken,
} from './refresh-token';

// Session lifecycle
export {
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllUserSessions,
  resolveSessionFromAccessToken,
  RefreshTokenError,
} from './session-service';

// Cookie management
export { setAuthCookies, clearAuthCookies, getSession } from './cookies';

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
