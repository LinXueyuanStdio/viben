export const dynamic = 'force-dynamic';

// Module-level log to confirm the module is loaded by Vercel's runtime.
console.error('[OAuth][Google] MODULE LOADED');

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateId } from '@/lib/utils';
import { cookies } from 'next/headers';
import { describeDesktopRedirectUri, isAllowedDesktopRedirectUri } from '@/lib/auth/desktop-redirect';

/** @ignore */
export async function GET(request: NextRequest) {
  console.error('[OAuth][Google] HANDLER INVOKED');

  try {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!clientId) {
      console.error('[OAuth][Google] missing clientId');
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    // Check if this is from desktop client
    const searchParams = request.nextUrl.searchParams;
    const redirectUri = searchParams.get('redirect_uri');
    const client = searchParams.get('client');
    const webRedirect = searchParams.get('redirect');

    const state = generateId();

    console.error('[OAuth][Google] initial request', {
      client: client ?? 'web',
      hasRedirectUri: Boolean(redirectUri),
      hasWebRedirect: Boolean(webRedirect),
      webRedirect,
    });

    // Store state in cookie for CSRF protection
    const cookieStore = await cookies();
    const existingDesktopCookie = cookieStore.get('oauth_redirect_uri')?.value;
    if (existingDesktopCookie) {
      try {
        console.warn('[OAuth][Google] found stale oauth_redirect_uri cookie, will clear if non-desktop', {
          existingDesktopCookie: describeDesktopRedirectUri(existingDesktopCookie),
        });
      } catch {
        console.warn('[OAuth][Google] stale oauth_redirect_uri cookie is malformed, clearing', {
          cookieLen: existingDesktopCookie.length,
        });
      }
    }

    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    });
    console.error('[OAuth][Google] oauth_state cookie set', { statePrefix: state.slice(0, 8) });

    if (client === 'desktop' && isAllowedDesktopRedirectUri(redirectUri)) {
      console.error('[OAuth][Google] desktop redirect registered', describeDesktopRedirectUri(redirectUri));
      cookieStore.set('oauth_redirect_uri', redirectUri, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
      });
    } else {
      if (existingDesktopCookie) {
        console.error('[OAuth][Google] clearing stale oauth_redirect_uri cookie');
      }
      cookieStore.delete('oauth_redirect_uri');

      if (client === 'desktop') {
        console.warn('[OAuth][Google] desktop redirect rejected', {
          hasRedirectUri: Boolean(redirectUri),
        });
      }
    }

    if (client !== 'desktop' && webRedirect && webRedirect.startsWith('/') && !webRedirect.startsWith('//')) {
      console.error('[OAuth][Google] web redirect stored', { webRedirect });
      cookieStore.set('oauth_web_redirect', webRedirect, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    console.error('[OAuth][Google] redirecting to Google', { statePrefix: state.slice(0, 8) });
    return NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    );
  } catch (err) {
    console.error('[OAuth][Google] UNHANDLED ERROR', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
