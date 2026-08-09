import { NextResponse } from "next/server";
import { getInstallationsByUserId } from "@/lib/db/installations";
import type { GitHubConnectionStatusResponse } from "@/lib/github/status";
import {
  isGitHubInstallationsAuthError,
  syncUserInstallations,
} from "@/lib/github/sync";
import { getGithubOAuthToken } from "@/lib/github/token";
import { getGitHubUsername } from "@/lib/github/users";
import { getServerSession } from "@/lib/session/get-server-session";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const installations = await getInstallationsByUserId(session.user.id);
  const token = await getGithubOAuthToken(session.user.id);

  // Try sync via OAuth token (only works with repo-scoped tokens)
  if (token) {
    try {
      const username = await getGitHubUsername(session.user.id);
      if (username) {
        const count = await syncUserInstallations(session.user.id, token, username);
        return NextResponse.json({
          status: "connected",
          reason: null,
          hasInstallations: count > 0,
          syncedInstallationsCount: count,
        } satisfies GitHubConnectionStatusResponse);
      }
    } catch (error) {
      if (!isGitHubInstallationsAuthError(error)) {
        console.error("Failed to validate GitHub connection status:", error);
      }
      // fall through — login token lacks App scope, rely on DB
    }
  }

  // Rely on DB installations (populated by GitHub App callback)
  return NextResponse.json({
    status: installations.length > 0 ? "connected" : "not_connected",
    reason: null,
    hasInstallations: installations.length > 0,
    syncedInstallationsCount: installations.length,
  } satisfies GitHubConnectionStatusResponse);
}
