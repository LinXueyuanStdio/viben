export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db, users, oauthConnections } from '@/lib/db';
import { uploadImageFromUrl } from '@/lib/media';
import { getSession, setSessionCookie } from '@/lib/auth/cookies';
import { encryptSession } from '@/lib/auth/jwe';
import { describeDesktopRedirectUri, isAllowedDesktopRedirectUri, renderDesktopOAuthCallbackPage } from '@/lib/auth/desktop-redirect';
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

/** @ignore */
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

  console.info('[OAuth][GitHub] callback received', {
    hasCode: Boolean(code),
    stateMatch: state === storedState,
    isDesktop: isAllowedDesktopRedirectUri(desktopRedirectUri),
    hasWebRedirect: Boolean(webRedirect),
    webRedirect,
  });

  cookieStore.delete('oauth_state');
  cookieStore.delete('oauth_redirect_uri');
  cookieStore.delete('oauth_web_redirect');

  if (!code || !state || state !== storedState) {
    console.warn('[OAuth][GitHub] state validation failed', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasStoredState: Boolean(storedState),
      stateMatch: state === storedState,
    });
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
      // If there is already an active session for a different user, reject the
      // connection — this GitHub account is already linked to another viben account.
      const currentSession = await getSession();
      if (currentSession?.userId && currentSession.userId !== existingConnection.userId) {
        return NextResponse.redirect(
          `${appUrl}/settings/account?error=already_linked&provider=github`,
        );
      }

      // Update access token
      await db
        .update(oauthConnections)
        .set({ accessToken })
        .where(eq(oauthConnections.id, existingConnection.id));

      // Ensure githubUsername is set on the user record
      if (!existingConnection.user.githubUsername) {
        await db
          .update(users)
          .set({ githubUsername: githubUser.login })
          .where(eq(users.id, existingConnection.user.id));
      }

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

        // Update githubUsername if not already set
        if (!existingUser.githubUsername) {
          await db
            .update(users)
            .set({ githubUsername: githubUser.login })
            .where(eq(users.id, existingUser.id));
        }
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
          avatarUrl: await uploadImageFromUrl({
            imageUrl: githubUser.avatar_url,
            kind: 'avatar',
            userSlug: normalizeUserSlug(githubUser.login, userId),
            userId,
            uid: userId,
          }) || githubUser.avatar_url,
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

    console.info('[OAuth][GitHub] user resolved', {
      userId: user.id,
      username: user.username,
      isDesktop: isAllowedDesktopRedirectUri(desktopRedirectUri),
    });

    // Check if this is a desktop client callback
    if (isAllowedDesktopRedirectUri(desktopRedirectUri)) {
      console.info('[OAuth][GitHub] taking desktop path', describeDesktopRedirectUri(desktopRedirectUri));
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

      console.info('[OAuth][GitHub] desktop session prepared', {
        sessionBase64Len: sessionBase64.length,
        httpCallbackUrl: httpCallbackUrl.toString().replace(/session=[^&]+/, 'session=***'),
        deepLinkUrl: deepLinkUrl.replace(/session=[^&]+/, 'session=***'),
      });

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
    console.info('[OAuth][GitHub] taking web path', {
      userId: user.id,
      username: user.username,
      hasWebRedirect: Boolean(webRedirect),
      webRedirect,
    });
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
      console.info('[OAuth][GitHub] redirecting to stored webRedirect', { webRedirect });
      return NextResponse.redirect(`${appUrl}${webRedirect}`);
    }
    console.info('[OAuth][GitHub] redirecting to home', { appUrl });
    return NextResponse.redirect(appUrl);
  } catch (error) {
    console.error('[OAuth][GitHub] callback error', {
      message: error instanceof Error ? error.message : String(error),
      isDesktop: isAllowedDesktopRedirectUri(desktopRedirectUri),
    });

    // If desktop client, return HTML error page (instead of 307 redirect)
    if (isAllowedDesktopRedirectUri(desktopRedirectUri)) {
      console.info('[OAuth][GitHub] sending desktop error page', describeDesktopRedirectUri(desktopRedirectUri));
      const httpCallbackUrl = new URL(desktopRedirectUri);
      httpCallbackUrl.searchParams.set('error', 'oauth_failed');
      const deepLinkUrl = 'viben://oauth?error=oauth_failed';
      return renderDesktopOAuthCallbackPage({
        type: 'error',
        httpCallbackUrl: httpCallbackUrl.toString(),
        deepLinkUrl,
      });
    }

    console.info('[OAuth][GitHub] redirecting to web login error page');
    return NextResponse.redirect(`${appUrl}/login?error=oauth_failed`);
  }
}
