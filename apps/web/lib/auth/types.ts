export interface Session {
  userId: string;
  username: string;
  userSlug: string;
  displayName?: string;
  email: string;
  // Expanded roles: 'admin' is legacy, treated as 'super_admin'
  role: 'user' | 'developer' | 'admin' | 'super_admin' | 'moderator' | 'support';
  avatarUrl?: string;
  expiresAt: number;
}

export interface SessionPayload {
  session: Session;
  iat: number;
  exp: number;
}

export interface OAuthProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface AccessTokenPayload {
  userId: string;
  role: string;
  sessionId: string;
  iat: number;
  exp: number;
}
