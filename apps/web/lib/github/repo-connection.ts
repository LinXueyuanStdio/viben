import "server-only";
import { eq } from "drizzle-orm";
import { decryptToken, encryptToken } from "@/lib/auth/token-encryption";
import { db, githubConnections } from "@/lib/db";

export interface UpsertGitHubRepoConnectionInput {
  userId: string;
  accessToken: string;
  scope: string;
  githubUserId: string;
  githubUsername: string;
}

export async function upsertGitHubRepoConnection(
  input: UpsertGitHubRepoConnectionInput,
): Promise<void> {
  const accessTokenEncrypted = await encryptToken(input.accessToken);
  const existingConnection = await db.query.githubConnections.findFirst({
    where: eq(githubConnections.userId, input.userId),
    columns: { id: true },
  });
  const values = {
    accessTokenEncrypted,
    scope: input.scope,
    githubUserId: input.githubUserId,
    githubUsername: input.githubUsername,
    connectedAt: new Date(),
  };

  if (existingConnection) {
    await db
      .update(githubConnections)
      .set(values)
      .where(eq(githubConnections.id, existingConnection.id));
    return;
  }

  await db.insert(githubConnections).values({
    userId: input.userId,
    ...values,
  });
}

export async function hasGitHubRepoConnection(
  userId: string,
): Promise<boolean> {
  const connection = await db.query.githubConnections.findFirst({
    where: eq(githubConnections.userId, userId),
    columns: { accessTokenEncrypted: true },
  });

  return Boolean(connection?.accessTokenEncrypted);
}

export async function getGitHubRepoOAuthToken(
  userId: string,
): Promise<string | null> {
  const connection = await db.query.githubConnections.findFirst({
    where: eq(githubConnections.userId, userId),
    columns: { accessTokenEncrypted: true },
  });
  if (!connection?.accessTokenEncrypted) {
    return null;
  }

  return decryptToken(connection.accessTokenEncrypted);
}
