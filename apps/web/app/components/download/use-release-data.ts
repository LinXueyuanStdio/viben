'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DesktopRelease, CLIRelease, Platform } from './types';

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
        appimage?: { url: string; name: string };  // Optional: AppImage bundling is disabled in CI
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
 * Fetch releases data from our API endpoint (avoids CORS issues with GitHub)
 */
async function fetchUnifiedRelease(): Promise<UnifiedRelease | null> {
  try {
    const response = await fetch('/api/releases');
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
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
