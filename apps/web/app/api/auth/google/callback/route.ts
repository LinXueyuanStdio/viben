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

interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  id_token: string;
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

  console.info('[OAuth][Google] callback received', {
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
    console.warn('[OAuth][Google] state validation failed', {
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
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${appUrl}/api/auth/google/callback`,
        }),
      }
    );

    const tokenData: GoogleTokenResponse = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('[OAuth][Google] no access token received:', tokenData);
      return NextResponse.redirect(`${appUrl}/login?error=no_token`);
    }

    // Get user info
    const userResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const googleUser: GoogleUser = await userResponse.json();

    if (!googleUser.email) {
      return NextResponse.redirect(`${appUrl}/login?error=no_email`);
    }

    // Find existing OAuth connection
    const existingConnection = await db.query.oauthConnections.findFirst({
      where: and(
        eq(oauthConnections.provider, 'google'),
        eq(oauthConnections.providerId, String(googleUser.id))
      ),
      with: { user: true },
    });

    let user;

    if (existingConnection) {
      // If there is already an active session for a different user, reject the
      // connection — this Google account is already linked to another viben account.
      const currentSession = await getSession();
      if (currentSession?.userId && currentSession.userId !== existingConnection.userId) {
        return NextResponse.redirect(
          `${appUrl}/settings/connections?error=already_linked&provider=google`,
        );
      }

      // Update access token
      await db
        .update(oauthConnections)
        .set({ accessToken: tokenData.access_token })
        .where(eq(oauthConnections.id, existingConnection.id));

      user = existingConnection.user;
    } else {
      // Check if user with this email exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, googleUser.email),
      });

      if (existingUser) {
        // Link OAuth to existing user
        await db.insert(oauthConnections).values({
          id: generateId(),
          userId: existingUser.id,
          provider: 'google',
          providerId: String(googleUser.id),
          accessToken: tokenData.access_token,
        });
        user = existingUser;
      } else {
        // Create new user
        const userId = generateId();
        // Use email prefix as base username, given_name as fallback
        const baseUsername = googleUser.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');

        await db.insert(users).values({
          id: userId,
          email: googleUser.email,
          username: baseUsername,
          userSlug: normalizeUserSlug(baseUsername, userId),
          displayName: googleUser.name || googleUser.email,
          avatarUrl: await uploadImageFromUrl({
            imageUrl: googleUser.picture,
            kind: 'avatar',
            userSlug: normalizeUserSlug(baseUsername, userId),
            userId,
            uid: userId,
          }) || googleUser.picture,
          role: 'developer',
          emailVerified: true,
        });

        await db.insert(oauthConnections).values({
          id: generateId(),
          userId,
          provider: 'google',
          providerId: String(googleUser.id),
          accessToken: tokenData.access_token,
        });

        user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
      }
    }

    if (!user) {
      throw new Error('Failed to create or find user');
    }

    console.info('[OAuth][Google] user resolved', {
      userId: user.id,
      username: user.username,
      isDesktop: isAllowedDesktopRedirectUri(desktopRedirectUri),
    });

    // Check if this is a desktop client callback
    if (isAllowedDesktopRedirectUri(desktopRedirectUri)) {
      console.info('[OAuth][Google] taking desktop path', describeDesktopRedirectUri(desktopRedirectUri));
      const desktopAccessToken = await encryptSession({
        userId: user.id,
        username: user.username,
        userSlug: user.userSlug,
        email: user.email,
        role: user.role as 'user' | 'developer' | 'admin',
        avatarUrl: user.avatarUrl ?? undefined,
      });

      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

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

      const sessionBase64 = Buffer.from(JSON.stringify(sessionData)).toString('base64url');

      const httpCallbackUrl = new URL(desktopRedirectUri);
      httpCallbackUrl.searchParams.set('session', sessionBase64);

      const deepLinkUrl = `viben://oauth?session=${encodeURIComponent(sessionBase64)}`;

      console.info('[OAuth][Google] desktop session prepared', {
        sessionBase64Len: sessionBase64.length,
        httpCallbackUrl: httpCallbackUrl.toString().replace(/session=[^&]+/, 'session=***'),
        deepLinkUrl: deepLinkUrl.replace(/session=[^&]+/, 'session=***'),
      });

      return renderDesktopOAuthCallbackPage({
        type: 'session',
        httpCallbackUrl: httpCallbackUrl.toString(),
        deepLinkUrl,
      });
    }

    // Set session for web client
    console.info('[OAuth][Google] taking web path', {
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

    if (webRedirect && webRedirect.startsWith('/') && !webRedirect.startsWith('//')) {
      console.info('[OAuth][Google] redirecting to stored webRedirect', { webRedirect });
      return NextResponse.redirect(`${appUrl}${webRedirect}`);
    }
    console.info('[OAuth][Google] redirecting to home', { appUrl });
    return NextResponse.redirect(appUrl);
  } catch (error) {
    console.error('[OAuth][Google] callback error', {
      message: error instanceof Error ? error.message : String(error),
      isDesktop: isAllowedDesktopRedirectUri(desktopRedirectUri),
    });

    if (isAllowedDesktopRedirectUri(desktopRedirectUri)) {
      console.info('[OAuth][Google] sending desktop error page', describeDesktopRedirectUri(desktopRedirectUri));
      const httpCallbackUrl = new URL(desktopRedirectUri);
      httpCallbackUrl.searchParams.set('error', 'oauth_failed');
      const deepLinkUrl = 'viben://oauth?error=oauth_failed';
      return renderDesktopOAuthCallbackPage({
        type: 'error',
        httpCallbackUrl: httpCallbackUrl.toString(),
        deepLinkUrl,
      });
    }

    console.info('[OAuth][Google] redirecting to web login error page');
    return NextResponse.redirect(`${appUrl}/login?error=oauth_failed`);
  }
}
