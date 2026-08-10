import "server-only";
import { db, oauthConnections } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getGitHubRepoOAuthToken } from "./repo-connection";

/** Get the login OAuth token used for GitHub identity requests. */
export async function getGithubOAuthToken(
  userId: string,
): Promise<string | null> {
  const oauthConn = await db.query.oauthConnections.findFirst({
    where: eq(oauthConnections.userId, userId),
    columns: { accessToken: true },
  });
  return oauthConn?.accessToken ?? null;
}

export { getGitHubRepoOAuthToken };
