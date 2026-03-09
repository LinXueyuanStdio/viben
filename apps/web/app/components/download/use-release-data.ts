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

/**
 * Fetch release JSON from GitHub releases
 */
async function fetchReleaseJson<T>(tagPrefix: string, filename: string): Promise<T | null> {
  try {
    // First, get the latest release with the given tag prefix
    const releasesUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
    const response = await fetch(releasesUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) return null;

    const releases = await response.json();

    // Find the latest release matching the tag prefix
    const release = releases.find((r: { tag_name: string }) => r.tag_name.startsWith(tagPrefix));
    if (!release) return null;

    // Find the JSON asset
    const jsonAsset = release.assets?.find((a: { name: string }) => a.name === filename);
    if (!jsonAsset) {
      // Fallback: construct the download URL manually from release info
      return constructFallbackData(release, tagPrefix) as T;
    }

    // Fetch the JSON content
    const jsonResponse = await fetch(jsonAsset.browser_download_url);
    if (!jsonResponse.ok) return null;

    return jsonResponse.json();
  } catch {
    return null;
  }
}

/**
 * Construct fallback data from release info when JSON file is not available
 */
function constructFallbackData(release: { tag_name: string; assets?: { name: string; browser_download_url: string }[]; published_at: string }, tagPrefix: string): DesktopRelease | CLIRelease | null {
  const version = release.tag_name.replace(tagPrefix, '');
  const assets = release.assets || [];

  if (tagPrefix === 'desktop-v') {
    // Desktop release fallback
    const dmg = assets.find(a => a.name.endsWith('.dmg'));
    const msi = assets.find(a => a.name.endsWith('.msi'));
    const exe = assets.find(a => a.name.endsWith('-setup.exe'));
    const appimage = assets.find(a => a.name.endsWith('.AppImage'));
    const deb = assets.find(a => a.name.endsWith('.deb'));

    return {
      version,
      tag: release.tag_name,
      date: release.published_at,
      repository: GITHUB_REPO,
      assets: {
        macos: {
          dmg: { url: dmg?.browser_download_url || '', name: dmg?.name || '' },
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
    } as DesktopRelease;
  }

  if (tagPrefix === 'cli-v') {
    // CLI release fallback
    const installSh = assets.find(a => a.name === 'install.sh');

    return {
      version,
      tag: release.tag_name,
      date: release.published_at,
      repository: GITHUB_REPO,
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
      links: {
        npm: 'https://www.npmjs.com/package/viben',
        documentation: `https://github.com/${GITHUB_REPO}`,
      },
    } as CLIRelease;
  }

  return null;
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
      const [desktopData, cliData] = await Promise.all([
        fetchReleaseJson<DesktopRelease>('desktop-v', 'desktop-releases.json'),
        fetchReleaseJson<CLIRelease>('cli-v', 'cli-releases.json'),
      ]);

      setDesktop(desktopData);
      setCli(cliData);
      setCachedData(desktopData, cliData);
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
