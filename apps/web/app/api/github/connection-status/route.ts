import { NextResponse } from "next/server";
import { getInstallationsByUserId } from "@/lib/db/installations";
import type { GitHubConnectionStatusResponse } from "@/lib/github/status";
import {
  isGitHubInstallationsAuthError,
  syncUserInstallations,
} from "@/lib/github/sync";
import { getGitHubRepoOAuthToken } from "@/lib/github/token";
import {
  getGitHubUsernameForToken,
  hasGitHubAccount,
} from "@/lib/github/users";
import { getServerSession } from "@/lib/session/get-server-session";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const installations = await getInstallationsByUserId(session.user.id);

  if (!(await hasGitHubAccount(session.user.id))) {
    return NextResponse.json({
      status: "not_connected",
      reason: null,
      hasInstallations: false,
      syncedInstallationsCount: 0,
    } satisfies GitHubConnectionStatusResponse);
  }

  const token = await getGitHubRepoOAuthToken(session.user.id);
  if (!token) {
    return NextResponse.json({
      status: "reconnect_required",
      reason: "token_unavailable",
      hasInstallations: installations.length > 0,
      syncedInstallationsCount: null,
    } satisfies GitHubConnectionStatusResponse);
  }

  try {
    const username = await getGitHubUsernameForToken(token);
    if (!username) {
      // The token can't resolve the GitHub user — treat it as unusable.
      return NextResponse.json({
        status: "reconnect_required",
        reason: "token_unavailable",
        hasInstallations: installations.length > 0,
        syncedInstallationsCount: null,
      } satisfies GitHubConnectionStatusResponse);
    }

    const count = await syncUserInstallations(session.user.id, token, username);

    // Sync cleared cached installations that previously existed — the
    // installation is gone or no longer accessible, so the user must reconnect.
    if (count === 0 && installations.length > 0) {
      return NextResponse.json({
        status: "reconnect_required",
        reason: "installations_missing",
        hasInstallations: false,
        syncedInstallationsCount: 0,
      } satisfies GitHubConnectionStatusResponse);
    }

    return NextResponse.json({
      status: "connected",
      reason: null,
      hasInstallations: count > 0,
      syncedInstallationsCount: count,
    } satisfies GitHubConnectionStatusResponse);
  } catch (error) {
    if (isGitHubInstallationsAuthError(error)) {
      return NextResponse.json({
        status: "reconnect_required",
        reason: "sync_auth_failed",
        hasInstallations: installations.length > 0,
        syncedInstallationsCount: null,
      } satisfies GitHubConnectionStatusResponse);
    }

    console.error("Failed to validate GitHub connection status:", error);
  }

  // Sync failed for a non-auth reason — fall back to cached installations.
  return NextResponse.json({
    status: installations.length > 0 ? "connected" : "not_connected",
    reason: null,
    hasInstallations: installations.length > 0,
    syncedInstallationsCount: installations.length,
  } satisfies GitHubConnectionStatusResponse);
}
