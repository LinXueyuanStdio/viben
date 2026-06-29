export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateId } from '@/lib/utils';
import { cookies } from 'next/headers';
import { describeDesktopRedirectUri, isAllowedDesktopRedirectUri } from '@/lib/auth/desktop-redirect';

export async function GET(request: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId) {
    return NextResponse.json(
      { error: 'GitHub OAuth not configured' },
      { status: 500 }
    );
  }

  // Check if this is from desktop client
  const searchParams = request.nextUrl.searchParams;
  const redirectUri = searchParams.get('redirect_uri');
  const client = searchParams.get('client');
  const webRedirect = searchParams.get('redirect'); // post-login redirect for web flow

  const state = generateId();

  console.info('[OAuth][GitHub] initial request', {
    client: client ?? 'web',
    hasRedirectUri: Boolean(redirectUri),
    hasWebRedirect: Boolean(webRedirect),
    webRedirect,
  });

  // Store state in cookie for CSRF protection
  const cookieStore = await cookies();
  const existingDesktopCookie = cookieStore.get('oauth_redirect_uri')?.value;
  if (existingDesktopCookie) {
    console.warn('[OAuth][GitHub] found stale oauth_redirect_uri cookie, will clear if non-desktop', {
      existingDesktopCookie: describeDesktopRedirectUri(existingDesktopCookie),
    });
  }

  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });
  console.info('[OAuth][GitHub] oauth_state cookie set', { statePrefix: state.slice(0, 8) });

  // Store desktop redirect_uri if present (deep link or local loopback callback)
  if (client === 'desktop' && isAllowedDesktopRedirectUri(redirectUri)) {
    console.info('[OAuth][GitHub] desktop redirect registered', describeDesktopRedirectUri(redirectUri));
    cookieStore.set('oauth_redirect_uri', redirectUri, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });
  } else {
    // Clear any stale desktop redirect cookie from a previous desktop login
    // attempt. Without this, a web login would incorrectly take the desktop
    // code path (returning an HTML page) if the cookie from a prior desktop
    // OAuth attempt is still present in the browser.
    if (existingDesktopCookie) {
      console.info('[OAuth][GitHub] clearing stale oauth_redirect_uri cookie');
    }
    cookieStore.delete('oauth_redirect_uri');

    if (client === 'desktop') {
      console.warn('[OAuth][GitHub] desktop redirect rejected', {
        hasRedirectUri: Boolean(redirectUri),
      });
    }
  }

  // Store web post-login redirect path (for web client "login → back" flow)
  // Only store if this is NOT a desktop client and the redirect path is safe
  if (client !== 'desktop' && webRedirect && webRedirect.startsWith('/') && !webRedirect.startsWith('//')) {
    console.info('[OAuth][GitHub] web redirect stored', { webRedirect });
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
    scope: 'read:user user:email',
    state,
  });

  console.info('[OAuth][GitHub] redirecting to GitHub', { statePrefix: state.slice(0, 8) });
  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  );
}
