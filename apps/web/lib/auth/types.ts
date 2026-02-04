export interface Session {
  userId: string;
  username: string;
  email: string;
  role: 'user' | 'developer' | 'admin';
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
