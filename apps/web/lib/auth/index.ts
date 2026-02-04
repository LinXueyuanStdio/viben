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

// API Key
export { validateApiKey, generateApiKey } from './api-key';

// Password
export { hashPassword, verifyPassword } from './password';
