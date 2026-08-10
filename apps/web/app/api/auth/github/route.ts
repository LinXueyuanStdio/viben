export const dynamic = 'force-dynamic';

// Module-level log to confirm the module is loaded by Vercel's runtime.
// If this never appears, the deployment or routing is broken.
console.error('[OAuth][GitHub] MODULE LOADED');

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateId } from '@/lib/utils';
import { cookies } from 'next/headers';
import { describeDesktopRedirectUri, isAllowedDesktopRedirectUri } from '@/lib/auth/desktop-redirect';

/** @ignore */
export async function GET(request: NextRequest) {
  // First line of the handler — confirms the function was invoked.
  console.error('[OAuth][GitHub] HANDLER INVOKED');

  try {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!clientId) {
      console.error('[OAuth][GitHub] missing clientId');
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    // Check if this is from desktop client
    const searchParams = request.nextUrl.searchParams;
    const redirectUri = searchParams.get('redirect_uri');
    const client = searchParams.get('client');
    const webRedirect = searchParams.get('redirect');

    const state = generateId();

    console.error('[OAuth][GitHub] initial request', {
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
        console.warn('[OAuth][GitHub] found stale oauth_redirect_uri cookie, will clear if non-desktop', {
          existingDesktopCookie: describeDesktopRedirectUri(existingDesktopCookie),
        });
      } catch {
        console.warn('[OAuth][GitHub] stale oauth_redirect_uri cookie is malformed, clearing', {
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
    console.error('[OAuth][GitHub] oauth_state cookie set', { statePrefix: state.slice(0, 8) });

    if (client === 'desktop' && isAllowedDesktopRedirectUri(redirectUri)) {
      console.error('[OAuth][GitHub] desktop redirect registered', describeDesktopRedirectUri(redirectUri));
      cookieStore.set('oauth_redirect_uri', redirectUri, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
      });
    } else {
      if (existingDesktopCookie) {
        console.error('[OAuth][GitHub] clearing stale oauth_redirect_uri cookie');
      }
      cookieStore.delete('oauth_redirect_uri');

      if (client === 'desktop') {
        console.warn('[OAuth][GitHub] desktop redirect rejected', {
          hasRedirectUri: Boolean(redirectUri),
        });
      }
    }

    if (client !== 'desktop' && webRedirect && webRedirect.startsWith('/') && !webRedirect.startsWith('//')) {
      console.error('[OAuth][GitHub] web redirect stored', { webRedirect });
      cookieStore.set('oauth_web_redirect', webRedirect, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${appUrl}/api/auth/github/callback`,
      scope: 'read:user user:email repo',
      state,
    });

    console.error('[OAuth][GitHub] redirecting to GitHub', { statePrefix: state.slice(0, 8) });
    return NextResponse.redirect(
      `https://github.com/login/oauth/authorize?${params}`
    );
  } catch (err) {
    console.error('[OAuth][GitHub] UNHANDLED ERROR', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
