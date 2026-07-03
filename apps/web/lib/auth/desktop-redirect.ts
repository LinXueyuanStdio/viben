import { NextResponse } from 'next/server';

export function isAllowedDesktopRedirectUri(redirectUri: string | null | undefined): redirectUri is string {
  if (!redirectUri) {
    return false;
  }

  try {
    const url = new URL(redirectUri);

    if (url.protocol === 'viben:') {
      return url.hostname === 'oauth' || url.pathname === '/oauth';
    }

    if (url.protocol !== 'http:') {
      return false;
    }

    if (url.username || url.password) {
      return false;
    }

    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      return false;
    }

    if (url.pathname !== '/oauth') {
      return false;
    }

    if (!url.searchParams.has('desktop_state')) {
      return false;
    }

    const port = Number(url.port);
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  } catch {
    return false;
  }
}

export function describeDesktopRedirectUri(redirectUri: string): {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
} {
  const url = new URL(redirectUri);
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
  };
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
export function renderDesktopOAuthCallbackPage(options: {
  type: 'session' | 'error';
  httpCallbackUrl: string;
  deepLinkUrl: string;
}): NextResponse {
  const { type, httpCallbackUrl, deepLinkUrl } = options;
  const isError = type === 'error';
  const title = isError ? 'Login Failed' : 'Login Complete!';
  const message = isError
    ? 'An error occurred during authentication. Returning to Viben...'
    : 'You have signed in. Returning to Viben...';

  // Escape URLs for safe use in HTML attribute contexts.
  const escapeAttr = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const metaRefreshUrl = httpCallbackUrl.replace(/"/g, '&quot;');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
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

  window.location.href = deepLink;

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
