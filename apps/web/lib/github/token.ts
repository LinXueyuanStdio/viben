import "server-only";
import { db, githubConnections, oauthConnections } from "@/lib/db";
import { eq } from "drizzle-orm";

/** �?oauthConnections 获取登录 OAuth token（用户身份，scope: read:user�?*/
export async function getGithubOAuthToken(
  userId: string,
): Promise<string | null> {
  const oauthConn = await db.query.oauthConnections.findFirst({
    where: eq(oauthConnections.userId, userId),
    columns: { accessToken: true },
  });
  return oauthConn?.accessToken ?? null;
}

/** �?githubConnections 获取加密的仓�?OAuth token（scope: repo�?*/
export async function getGithubAppToken(
  userId: string,
): Promise<string | null> {
  const ghConn = await db.query.githubConnections.findFirst({
    where: eq(githubConnections.userId, userId),
    columns: { accessTokenEncrypted: true },
  });
  if (!ghConn?.accessTokenEncrypted) return null;

  try {
    const { decryptToken } = await import("@/lib/auth/token-encryption");
    return await decryptToken(ghConn.accessTokenEncrypted);
  } catch {
    return null;
  }
}
