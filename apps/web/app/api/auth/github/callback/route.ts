export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db, users, oauthConnections } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth/cookies';
import { encryptSession } from '@/lib/auth/jwe';
import { describeDesktopRedirectUri, isAllowedDesktopRedirectUri } from '@/lib/auth/desktop-redirect';
import { generateId } from '@/lib/utils';
import { normalizeUserSlug } from '@/lib/utils/user-slug';
import { eq, and } from 'drizzle-orm';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Generate an HTML page that delivers the OAuth result back to the desktop app.
 *
 * Uses three delivery mechanisms to maximize reliability across platforms:
 *
 * 1. **Meta refresh → HTTP callback** (primary, most reliable)
 *    A top-level navigation to http://127.0.0.1:{port}/oauth?… avoids both
 *    Chrome Private Network Access restrictions (which block fetch() to
 *    localhost from public origins) and browser protocol-handler gating
 *    (which may suppress window.location = viben:// without a user gesture).
 *
 * 2. **Deep-link button** (secondary, user-gesture driven)
 *    A visible "Open Viben" button with href="viben://oauth?session=…" so
 *    the click is a real user gesture — works even when meta-refresh fails.
 *
 * 3. **JavaScript window.location fallback** (last resort)
 *    Runs on page load; some browsers allow it for registered URL schemes.
 *
 * This replaces server-side 307 redirects because HTTPS→HTTP redirects to
 * localhost are unreliable on Windows: browser HTTPS-First mode may upgrade
 * the connection to TLS (which the TCP server doesn't support), security
 * software may block the redirect, and long session tokens in the URL can
 * trigger security heuristics.
 */
function renderDesktopOAuthCallbackPage(options: {
  type: 'session' | 'error';
  httpCallbackUrl: string;
  deepLinkUrl: string;
}): NextResponse {
  const { type, httpCallbackUrl, deepLinkUrl } = options;
  const isError = type === 'error';
  const title = isError ? 'Login Failed' : 'Login Complete!';
  const message = isError
    ? 'An error occurred during GitHub authentication. Returning to Viben...'
    : 'You have signed in with GitHub. Returning to Viben...';

  // Escape URLs for safe use in HTML attribute contexts.
  // base64url values (A-Za-z0-9-_) are inherently safe; only structural
  // characters (& < > " ') need escaping.
  const escapeAttr = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // The meta-refresh URL must contain raw & (not &amp;) because browsers
  // parse the content attribute value literally before following the URL.
  // httpCallbackUrl is a plain string with raw &, so we combine it directly.
  const metaRefreshUrl = httpCallbackUrl.replace(/"/g, '&quot;');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!--
  Meta refresh performs a top-level navigation to the local TCP callback
  server. Top-level navigations are NOT subject to Chrome's Private Network
  Access preflight checks (unlike fetch()), making this the most reliable
  way to deliver the session from a public HTTPS origin to localhost.
-->
<meta http-equiv="refresh" content="0;url=${metaRefreshUrl}">
<title>Viben — ${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: #0a0a0a; color: #e0e0e0;
  }
  .card {
    text-align: center; max-width: 400px; padding: 40px 32px;
    background: #1a1a1a; border-radius: 12px; border: 1px solid #2a2a2a;
  }
  .icon { font-size: 48px; margin-bottom: 16px; }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
  p { font-size: 14px; color: #999; margin-bottom: 24px; line-height: 1.5; }
  .btn {
    display: inline-block; padding: 10px 24px;
    background: #6b9fff; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; text-decoration: none; cursor: pointer;
  }
  .btn:hover { background: #5a8de0; }
  .hint { font-size: 12px; color: #666; margin-top: 16px; }
  .hint a { color: #6b9fff; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">${isError ? '&#10060;' : '&#10003;'}</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <a class="btn" href="${escapeAttr(deepLinkUrl)}">Open Viben</a>
  <p class="hint">You can close this tab after the app opens.</p>
</div>
<script>
(function(){
  var deepLink = ${JSON.stringify(deepLinkUrl)};
  var httpCallback = ${JSON.stringify(httpCallbackUrl)};

  // If the meta refresh hasn't fired yet, try the deep link via JS.
  // Some browsers allow programmatic navigation to registered URL schemes
  // without a user gesture; others require the explicit button click above.
  window.location.href = deepLink;

  // Last resort: poke the TCP server via fetch.
  // This may be blocked by Chrome Private Network Access, but the meta
  // refresh and deep-link button already cover the primary paths.
  setTimeout(function(){
    try { fetch(httpCallback, { mode: "no-cors" }); } catch(e) {}
  }, 1200);
})();
</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Verify state and get desktop redirect URI if present
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  const desktopRedirectUri = cookieStore.get('oauth_redirect_uri')?.value;
  const webRedirect = cookieStore.get('oauth_web_redirect')?.value;
  cookieStore.delete('oauth_state');
  cookieStore.delete('oauth_redirect_uri');
  cookieStore.delete('oauth_web_redirect');

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('No access token received:', tokenData);
      return NextResponse.redirect(`${appUrl}/login?error=no_token`);
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser: GitHubUser = await userResponse.json();

    // Get email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const emails: GitHubEmail[] = await emailResponse.json();
    const primaryEmail =
      emails.find((e) => e.primary)?.email || githubUser.email;

    if (!primaryEmail) {
      return NextResponse.redirect(`${appUrl}/login?error=no_email`);
    }

    // Find existing OAuth connection
    const existingConnection = await db.query.oauthConnections.findFirst({
      where: and(
        eq(oauthConnections.provider, 'github'),
        eq(oauthConnections.providerId, String(githubUser.id))
      ),
      with: { user: true },
    });

    let user;

    if (existingConnection) {
      // Update access token
      await db
        .update(oauthConnections)
        .set({ accessToken })
        .where(eq(oauthConnections.id, existingConnection.id));

      user = existingConnection.user;
    } else {
      // Check if user with this email exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, primaryEmail),
      });

      if (existingUser) {
        // Link OAuth to existing user
        await db.insert(oauthConnections).values({
          id: generateId(),
          userId: existingUser.id,
          provider: 'github',
          providerId: String(githubUser.id),
          accessToken,
        });
        user = existingUser;
      } else {
        // Create new user
        const userId = generateId();
        await db.insert(users).values({
          id: userId,
          email: primaryEmail,
          username: githubUser.login,
          userSlug: normalizeUserSlug(githubUser.login, userId),
          displayName: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          githubUsername: githubUser.login,
          role: 'developer',
          emailVerified: true,
        });

        await db.insert(oauthConnections).values({
          id: generateId(),
          userId,
          provider: 'github',
          providerId: String(githubUser.id),
          accessToken,
        });

        user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
      }
    }

    if (!user) {
      throw new Error('Failed to create or find user');
    }

    // Check if this is a desktop client callback
    if (isAllowedDesktopRedirectUri(desktopRedirectUri)) {
      console.info('[OAuth][GitHub] redirecting desktop session', describeDesktopRedirectUri(desktopRedirectUri));
      // For desktop client, generate JWT and redirect with session data
      // This avoids the issue of OAuth code being single-use
      const desktopAccessToken = await encryptSession({
        userId: user.id,
        username: user.username,
        userSlug: user.userSlug,
        email: user.email,
        role: user.role as 'user' | 'developer' | 'admin',
        avatarUrl: user.avatarUrl ?? undefined,
      });

      // Calculate expiration (7 days from now)
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

      // Build session data for desktop
      const sessionData = {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          userSlug: user.userSlug,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        accessToken: desktopAccessToken,
        refreshToken: null,
        expiresAt,
      };

      // Encode session data as base64 URL-safe string
      const sessionBase64 = Buffer.from(JSON.stringify(sessionData)).toString('base64url');

      // Build the HTTP callback URL (for TCP server fallback)
      const httpCallbackUrl = new URL(desktopRedirectUri);
      httpCallbackUrl.searchParams.set('session', sessionBase64);

      // Build the deep link URL (primary path — avoids HTTPS→HTTP redirect issues)
      const deepLinkUrl = `viben://oauth?session=${encodeURIComponent(sessionBase64)}`;

      // Return HTML page that tries deep link first, falls back to HTTP callback.
      // This replaces the server-side 307 redirect which is unreliable on Windows:
      // HTTPS→HTTP redirects to localhost can be blocked by browser HTTPS-First mode,
      // Windows security software, or triggered by long session tokens in the URL.
      return renderDesktopOAuthCallbackPage({
        type: 'session',
        httpCallbackUrl: httpCallbackUrl.toString(),
        deepLinkUrl,
      });
    }

    // Set session for web client
    await setSessionCookie({
      userId: user.id,
      username: user.username,
      userSlug: user.userSlug,
      email: user.email,
      role: user.role as 'user' | 'developer' | 'admin',
      avatarUrl: user.avatarUrl ?? undefined,
    });

    // Redirect to the original page (if login was initiated from a protected page)
    // or to the home page as default. Only accepts same-origin paths for safety.
    if (webRedirect && webRedirect.startsWith('/') && !webRedirect.startsWith('//')) {
      return NextResponse.redirect(`${appUrl}${webRedirect}`);
    }
    return NextResponse.redirect(appUrl);
  } catch (error) {
    console.error('OAuth error:', error);

    // If desktop client, return HTML error page (instead of 307 redirect)
    if (isAllowedDesktopRedirectUri(desktopRedirectUri)) {
      console.info('[OAuth][GitHub] redirecting desktop oauth error', describeDesktopRedirectUri(desktopRedirectUri));
      const httpCallbackUrl = new URL(desktopRedirectUri);
      httpCallbackUrl.searchParams.set('error', 'oauth_failed');
      const deepLinkUrl = 'viben://oauth?error=oauth_failed';
      return renderDesktopOAuthCallbackPage({
        type: 'error',
        httpCallbackUrl: httpCallbackUrl.toString(),
        deepLinkUrl,
      });
    }

    return NextResponse.redirect(`${appUrl}/login?error=oauth_failed`);
  }
}
