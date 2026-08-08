import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  fetchInstallationDetail,
  isGitHubAppConfigured,
} from "@/lib/github/app";
import { upsertInstallation } from "@/lib/db/installations";
import { isManagedTemplateTrialUser } from "@/lib/managed-template-trial";
import { sanitizeInternalRedirect } from "@/lib/redirect-safety";
import { getServerSession } from "@/lib/session/get-server-session";

function parseInstallationId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const installationId = Number.parseInt(value, 10);
  if (!Number.isFinite(installationId)) {
    return null;
  }

  return installationId;
}

function redirectAndClearCookies(url: string | URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.cookies.delete("github_app_install_redirect_to");
  response.cookies.delete("github_app_install_state");
  response.cookies.delete("github_reconnect");
  return response;
}

/**
 * GitHub App Setup URL callback — handles installation via App JWT.
 */
export async function GET(req: Request): Promise<Response> {
  const cookieStore = await cookies();
  const redirectTo = sanitizeInternalRedirect(
    cookieStore.get("github_app_install_redirect_to")?.value,
    "/assistant",
    req.url,
  );

  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const redirectUrl = new URL(redirectTo, req.url);

  if (isManagedTemplateTrialUser(session, req.url)) {
    redirectUrl.searchParams.set("github", "trial_blocked");
    return redirectAndClearCookies(redirectUrl);
  }

  if (!isGitHubAppConfigured()) {
    redirectUrl.searchParams.set("github", "app_not_configured");
    return redirectAndClearCookies(redirectUrl);
  }

  const requestUrl = new URL(req.url);
  const installationId = parseInstallationId(
    requestUrl.searchParams.get("installation_id"),
  );
  const setupAction = requestUrl.searchParams.get("setup_action");

  if (installationId) {
    try {
      const detail = await fetchInstallationDetail(installationId);
      await upsertInstallation({
        userId: session.user.id,
        installationId: detail.id,
        accountLogin: detail.accountLogin,
        accountType: detail.accountType,
        repositorySelection: detail.repositorySelection,
        installationUrl: detail.htmlUrl,
      });
    } catch (error) {
      console.error("Failed to fetch installation detail:", error);
    }
  }

  let githubStatus: string;
  if (setupAction === "request") {
    githubStatus = "request_sent";
  } else if (installationId) {
    githubStatus = "app_installed";
  } else {
    githubStatus = "no_action";
    redirectUrl.searchParams.set("missing_installation_id", "1");
  }

  redirectUrl.searchParams.set("github", githubStatus);
  return redirectAndClearCookies(redirectUrl);
}
