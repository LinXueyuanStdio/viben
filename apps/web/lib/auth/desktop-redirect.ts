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
