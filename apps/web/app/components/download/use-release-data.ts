'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DesktopRelease, CLIRelease, Platform } from './types';

const GITHUB_REPO = 'LinXueyuanStdio/viben';
const CACHE_KEY = 'viben-releases-cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  desktop: DesktopRelease | null;
  cli: CLIRelease | null;
  timestamp: number;
}

/**
 * Detect user's platform from User Agent
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown';

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';

  return 'unknown';
}

/**
 * Get cached release data
 */
function getCachedData(): CacheData | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: CacheData = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Set cached release data
 */
function setCachedData(desktop: DesktopRelease | null, cli: CLIRelease | null): void {
  if (typeof window === 'undefined') return;

  try {
    const data: CacheData = {
      desktop,
      cli,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

interface UnifiedRelease {
  version: string;
  tag: string;
  date: string;
  repository: string;
  components: {
    cli: boolean;
    desktop: boolean;
  };
  cli: {
    install_methods: {
      shell: { command: string; platforms: string[] };
      npx: { command: string; platforms: string[] };
      npm: { command: string; platforms: string[] };
      homebrew: { command: string; platforms: string[] };
    };
    assets: {
      install_sh: { url: string; name: string };
    };
  };
  desktop: {
    assets: {
      macos: {
        arm64: { url: string; name: string };
        x64: { url: string; name: string };
      };
      windows: {
        msi: { url: string; name: string };
        exe: { url: string; name: string };
      };
      linux: {
        appimage: { url: string; name: string };
        deb: { url: string; name: string };
      };
    };
  };
  links: {
    npm: string;
    documentation: string;
    changelog: string;
  };
}

/**
 * Fetch releases.json from latest GitHub release
 */
async function fetchUnifiedRelease(): Promise<UnifiedRelease | null> {
  try {
    const releasesUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
    const response = await fetch(releasesUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) return null;

    const releases = await response.json();

    // Find the latest release with 'v' prefix (unified release format)
    const release = releases.find((r: { tag_name: string; prerelease: boolean }) =>
      r.tag_name.startsWith('v') && !r.prerelease
    );
    if (!release) return null;

    // Try to fetch releases.json from the release assets
    const jsonAsset = release.assets?.find((a: { name: string }) => a.name === 'releases.json');
    if (jsonAsset) {
      const jsonResponse = await fetch(jsonAsset.browser_download_url);
      if (jsonResponse.ok) {
        return jsonResponse.json();
      }
    }

    // Fallback: construct data from release assets
    return constructUnifiedFallbackData(release);
  } catch {
    return null;
  }
}

/**
 * Construct fallback unified release data from release assets
 */
function constructUnifiedFallbackData(release: {
  tag_name: string;
  assets?: { name: string; browser_download_url: string }[];
  published_at: string;
}): UnifiedRelease {
  const version = release.tag_name.replace(/^v/, '');
  const assets = release.assets || [];

  // macOS has separate builds for ARM64 (Apple Silicon) and x64 (Intel)
  const dmgArm64 = assets.find(a => a.name.endsWith('.dmg') && a.name.includes('aarch64'));
  const dmgX64 = assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('x86_64') || a.name.includes('x64')));
  const msi = assets.find(a => a.name.endsWith('.msi'));
  const exe = assets.find(a => a.name.endsWith('-setup.exe'));
  const appimage = assets.find(a => a.name.endsWith('.AppImage'));
  const deb = assets.find(a => a.name.endsWith('.deb'));
  const installSh = assets.find(a => a.name === 'install.sh');

  return {
    version,
    tag: release.tag_name,
    date: release.published_at,
    repository: GITHUB_REPO,
    components: {
      cli: !!installSh,
      desktop: !!(dmgArm64 || dmgX64 || msi || exe || appimage || deb),
    },
    cli: {
      install_methods: {
        shell: {
          command: `curl -fsSL https://github.com/${GITHUB_REPO}/releases/latest/download/install.sh | bash`,
          platforms: ['macos', 'linux'],
        },
        npx: {
          command: 'npx viben',
          platforms: ['macos', 'linux', 'windows'],
        },
        npm: {
          command: 'npm install -g viben',
          platforms: ['macos', 'linux', 'windows'],
        },
        homebrew: {
          command: `brew tap ${GITHUB_REPO.split('/')[0]}/viben && brew install viben`,
          platforms: ['macos', 'linux'],
        },
      },
      assets: {
        install_sh: {
          url: installSh?.browser_download_url || `https://github.com/${GITHUB_REPO}/releases/download/${release.tag_name}/install.sh`,
          name: 'install.sh',
        },
      },
    },
    desktop: {
      assets: {
        macos: {
          arm64: { url: dmgArm64?.browser_download_url || '', name: dmgArm64?.name || '' },
          x64: { url: dmgX64?.browser_download_url || '', name: dmgX64?.name || '' },
        },
        windows: {
          msi: { url: msi?.browser_download_url || '', name: msi?.name || '' },
          exe: { url: exe?.browser_download_url || '', name: exe?.name || '' },
        },
        linux: {
          appimage: { url: appimage?.browser_download_url || '', name: appimage?.name || '' },
          deb: { url: deb?.browser_download_url || '', name: deb?.name || '' },
        },
      },
    },
    links: {
      npm: 'https://www.npmjs.com/package/viben',
      documentation: `https://github.com/${GITHUB_REPO}`,
      changelog: `https://github.com/${GITHUB_REPO}/blob/main/CHANGELOG.md`,
    },
  };
}

/**
 * Convert unified release to desktop release format
 */
function toDesktopRelease(unified: UnifiedRelease): DesktopRelease | null {
  if (!unified.components.desktop) return null;
  return {
    version: unified.version,
    tag: unified.tag,
    date: unified.date,
    repository: unified.repository,
    assets: unified.desktop.assets,
  };
}

/**
 * Convert unified release to CLI release format
 */
function toCLIRelease(unified: UnifiedRelease): CLIRelease | null {
  if (!unified.components.cli) return null;
  return {
    version: unified.version,
    tag: unified.tag,
    date: unified.date,
    repository: unified.repository,
    install_methods: unified.cli.install_methods as CLIRelease['install_methods'],
    assets: unified.cli.assets,
    links: {
      npm: unified.links.npm,
      documentation: unified.links.documentation,
    },
  };
}


export interface UseReleaseDataResult {
  desktop: DesktopRelease | null;
  cli: CLIRelease | null;
  platform: Platform;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and cache release data
 */
export function useReleaseData(): UseReleaseDataResult {
  const [desktop, setDesktop] = useState<DesktopRelease | null>(null);
  const [cli, setCli] = useState<CLIRelease | null>(null);
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (useCache = true) => {
    setLoading(true);
    setError(null);

    // Check cache first
    if (useCache) {
      const cached = getCachedData();
      if (cached) {
        setDesktop(cached.desktop);
        setCli(cached.cli);
        setLoading(false);
        return;
      }
    }

    try {
      const unified = await fetchUnifiedRelease();

      if (unified) {
        const desktopData = toDesktopRelease(unified);
        const cliData = toCLIRelease(unified);
        setDesktop(desktopData);
        setCli(cliData);
        setCachedData(desktopData, cliData);
      } else {
        setDesktop(null);
        setCli(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch release data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPlatform(detectPlatform());
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(false);
  }, [fetchData]);

  return { desktop, cli, platform, loading, error, refresh };
}
