import "server-only";

// Stub: GitHub OAuth token management (requires Better Auth accounts table)
// TODO: Implement with viben OAuth system
export async function getUserGitHubToken(
  _userId: string,
): Promise<string | null> {
  return null;
}

export async function getGitHubAppUserToken(
  _userId: string,
): Promise<string | null> {
  return null;
}
