import "server-only";

export interface UserVercelAuthInfo {
  token: string;
  expiresAt: number;
  externalId: string;
}

// Stub: Vercel OAuth token management (requires Better Auth accounts table)
// TODO: Implement with viben OAuth system
export async function getUserVercelAuthInfo(
  _userId: string,
): Promise<UserVercelAuthInfo | null> {
  return null;
}

export async function getUserVercelToken(
  _userId: string,
): Promise<string | null> {
  return null;
}
