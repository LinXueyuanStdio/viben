import { generateState } from "arctic";
import { NextResponse, type NextRequest } from "next/server";
import { getInstallationsByUserId } from "@/lib/db/installations";
import { syncUserInstallations } from "@/lib/github/sync";
import { getGitHubRepoOAuthToken } from "@/lib/github/token";
import {
  getGitHubAccountId,
  getGitHubUsernameForToken,
  hasGitHubAccount,
} from "@/lib/github/users";
import { isManagedTemplateTrialUser } from "@/lib/managed-template-trial";
import { sanitizeInternalRedirect } from "@/lib/redirect-safety";
import { getServerSession } from "@/lib/session/get-server-session";

const COOKIE_OPTIONS = {
  path: "/",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  maxAge: 60 * 15,
  sameSite: "lax" as const,
};

function redirectWithInstallCookies(
  url: string | URL,
  redirectTo: string,
  state: string,
): NextResponse {
  const response = NextResponse.redirect(url);
  response.cookies.set(
    "github_app_install_redirect_to",
    redirectTo,
    COOKIE_OPTIONS,
  );
  response.cookies.set("github_app_install_state", state, COOKIE_OPTIONS);
  return response;
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getServerSession();
  const redirectTo = sanitizeInternalRedirect(
    req.nextUrl.searchParams.get("next"),
    "/assistant",
    req.url,
  );

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isManagedTemplateTrialUser(session, req.url)) {
    const fallbackUrl = new URL(redirectTo, req.url);
    fallbackUrl.searchParams.set("github", "trial_blocked");
    return NextResponse.redirect(fallbackUrl);
  }

  const appSlug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
  if (!appSlug) {
    const fallbackUrl = new URL(redirectTo, req.url);
    fallbackUrl.searchParams.set("github", "app_not_configured");
    return NextResponse.redirect(fallbackUrl);
  }

  const state = generateState();

  // if a specific target_id is provided, go directly to install for that account
  const targetId = req.nextUrl.searchParams.get("target_id");
  if (targetId && /^\d+$/.test(targetId)) {
    const installUrl = new URL(
      `https://github.com/apps/${appSlug}/installations/new`,
    );
    installUrl.searchParams.set("state", state);
    installUrl.searchParams.set("target_id", targetId);
    return redirectWithInstallCookies(installUrl, redirectTo, state);
  }

  // reconnect mode —skip account picker, target the user's personal account
  const reconnect = req.nextUrl.searchParams.get("reconnect");
  if (reconnect === "1") {
    const accountId = await getGitHubAccountId(session.user.id);
    if (accountId) {
      const installUrl = new URL(
        `https://github.com/apps/${appSlug}/installations/new`,
      );
      installUrl.searchParams.set("state", state);
      installUrl.searchParams.set("target_id", accountId);
      return redirectWithInstallCookies(installUrl, redirectTo, state);
    }
  }

  // check existing installations first —if user has any, skip to account picker
  let installations = await getInstallationsByUserId(session.user.id);

  if (installations.length === 0) {
    // try to sync via OAuth token if user has linked GitHub account
    const linked = await hasGitHubAccount(session.user.id);
    if (linked) {
      try {
        const token = await getGitHubRepoOAuthToken(session.user.id);
        const username = token
          ? await getGitHubUsernameForToken(token)
          : null;
        if (token && username) {
          await syncUserInstallations(session.user.id, token, username);
          installations = await getInstallationsByUserId(session.user.id);
        }
      } catch (error) {
        console.error("Failed to sync GitHub installations in install flow:", {
          userId: session.user.id,
          error,
        });
      }
    }
  }

  if (installations.length === 0) {
    // no installations —route to GitHub App install page directly
    // (the callback will use App JWT to register the installation, no OAuth needed)
    const installUrl = new URL(
      `https://github.com/apps/${appSlug}/installations/new`,
    );
    installUrl.searchParams.set("state", state);
    return redirectWithInstallCookies(installUrl, redirectTo, state);
  }

  // already has installations —show account/org picker for additional installs
  const installUrl = new URL(
    `https://github.com/apps/${appSlug}/installations/select_target`,
  );
  installUrl.searchParams.set("state", state);
  return redirectWithInstallCookies(installUrl, redirectTo, state);
}
