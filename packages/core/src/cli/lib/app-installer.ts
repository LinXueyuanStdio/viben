/**
 * App installer - download and install Viben desktop app
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ============================================================================
// Types
// ============================================================================

export interface ReleaseAsset {
  url: string;
  name: string;
  size?: number;
}

export interface PlatformAssets {
  macos: { arm64: ReleaseAsset; x64: ReleaseAsset };
  windows: { exe: ReleaseAsset; msi: ReleaseAsset };
  linux: { deb: ReleaseAsset };
}

export interface ReleaseInfo {
  version: string;
  tag: string;
  date: string;
  desktop: { assets: PlatformAssets };
}

export type SupportedPlatform = "darwin-arm64" | "darwin-x64" | "win32-x64" | "linux-x64";
export type UnsupportedPlatform = "win32-arm64" | "linux-arm64";
export type WindowsFormat = "exe" | "msi";

export interface DownloadOptions {
  outputDir: string;
  force: boolean;
  format: WindowsFormat;
  onProgress?: (downloaded: number, total: number) => void;
}

export interface InstallResult {
  success: boolean;
  installedPath?: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const GITHUB_REPO = "LinXueyuanStdio/viben";
const RELEASES_JSON_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/releases.json`;
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

// App installation paths by platform
const APP_PATHS = {
  darwin: "/Applications/Viben.app",
  win32: "C:\\Program Files\\Viben\\Viben.exe",
  linux: "/usr/bin/viben-desktop",
} as const;

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Detect current platform and architecture
 */
export function detectPlatform(): SupportedPlatform | UnsupportedPlatform {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin") {
    return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  }

  if (platform === "win32") {
    return arch === "arm64" ? "win32-arm64" : "win32-x64";
  }

  if (platform === "linux") {
    return arch === "arm64" ? "linux-arm64" : "linux-x64";
  }

  // Default to linux-x64 for unknown platforms
  return "linux-x64";
}

/**
 * Check if platform is supported
 */
export function isPlatformSupported(platform: string): platform is SupportedPlatform {
  return ["darwin-arm64", "darwin-x64", "win32-x64", "linux-x64"].includes(platform);
}

/**
 * Get human-readable platform name
 */
export function getPlatformDisplayName(platform: SupportedPlatform | UnsupportedPlatform): string {
  const names: Record<string, string> = {
    "darwin-arm64": "macOS (Apple Silicon)",
    "darwin-x64": "macOS (Intel)",
    "win32-x64": "Windows (x64)",
    "win32-arm64": "Windows (ARM64)",
    "linux-x64": "Linux (x64)",
    "linux-arm64": "Linux (ARM64)",
  };
  return names[platform] ?? platform;
}

/**
 * Check if desktop app is installed
 */
export function isAppInstalled(): boolean {
  const platform = process.platform;

  if (platform === "darwin") {
    return existsSync(APP_PATHS.darwin);
  }

  if (platform === "win32") {
    return existsSync(APP_PATHS.win32);
  }

  if (platform === "linux") {
    // Check multiple possible locations
    const linuxPaths = ["/usr/bin/viben-desktop", "/opt/Viben/viben-desktop"];
    return linuxPaths.some((p) => existsSync(p));
  }

  return false;
}

/**
 * Get installed app path
 */
export function getInstalledAppPath(): string | null {
  const platform = process.platform;

  if (platform === "darwin") {
    return existsSync(APP_PATHS.darwin) ? APP_PATHS.darwin : null;
  }

  if (platform === "win32") {
    return existsSync(APP_PATHS.win32) ? APP_PATHS.win32 : null;
  }

  if (platform === "linux") {
    const linuxPaths = ["/usr/bin/viben-desktop", "/opt/Viben/viben-desktop"];
    for (const p of linuxPaths) {
      if (existsSync(p)) return p;
    }
  }

  return null;
}

/**
 * Get default download directory
 */
export function getDefaultDownloadDir(): string {
  return join(homedir(), "Downloads");
}

// ============================================================================
// Release Info Fetching
// ============================================================================

/**
 * Fetch release info from releases.json
 */
async function fetchFromReleasesJson(version?: string): Promise<ReleaseInfo | null> {
  const url = version
    ? `https://github.com/${GITHUB_REPO}/releases/download/v${version.replace(/^v/, "")}/releases.json`
    : RELEASES_JSON_URL;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "viben-cli" },
    });

    if (!response.ok) return null;

    const data = await response.json() as ReleaseInfo;

    // Validate required fields
    if (!data.version || !data.desktop?.assets) return null;

    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch release info from GitHub API (fallback)
 */
async function fetchFromGitHubApi(version?: string): Promise<ReleaseInfo | null> {
  const url = version
    ? `${GITHUB_API_URL}/tags/v${version.replace(/^v/, "")}`
    : `${GITHUB_API_URL}/latest`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "viben-cli",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      // Check for rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
        if (rateLimitRemaining === "0") {
          throw new Error("RATE_LIMITED");
        }
      }
      return null;
    }

    const release = await response.json() as {
      tag_name: string;
      published_at: string;
      assets: Array<{ name: string; browser_download_url: string; size: number }>;
    };

    // Parse assets into our format
    const assets = release.assets;
    const findAsset = (pattern: RegExp) => {
      const asset = assets.find((a) => pattern.test(a.name));
      return asset
        ? { url: asset.browser_download_url, name: asset.name, size: asset.size }
        : { url: "", name: "" };
    };

    return {
      version: release.tag_name.replace(/^v/, ""),
      tag: release.tag_name,
      date: release.published_at,
      desktop: {
        assets: {
          macos: {
            arm64: findAsset(/Viben_.*_aarch64\.dmg$/),
            x64: findAsset(/Viben_.*_(x64|x86_64)\.dmg$/),
          },
          windows: {
            exe: findAsset(/Viben_.*_x64-setup\.exe$/),
            msi: findAsset(/Viben_.*_x64.*\.msi$/),
          },
          linux: {
            deb: findAsset(/Viben_.*_amd64\.deb$/),
          },
        },
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      throw error;
    }
    return null;
  }
}

/**
 * Fetch release info with fallback
 */
export async function fetchReleaseInfo(version?: string): Promise<ReleaseInfo> {
  // Try releases.json first
  const fromJson = await fetchFromReleasesJson(version);
  if (fromJson) return fromJson;

  // Fallback to GitHub API
  const fromApi = await fetchFromGitHubApi(version);
  if (fromApi) return fromApi;

  throw new Error(version ? "VERSION_NOT_FOUND" : "NETWORK_ERROR");
}

/**
 * Get asset URL for current platform
 */
export function getAssetForPlatform(
  release: ReleaseInfo,
  platform: SupportedPlatform,
  format: WindowsFormat = "exe"
): ReleaseAsset {
  const assets = release.desktop.assets;

  switch (platform) {
    case "darwin-arm64":
      return assets.macos.arm64;
    case "darwin-x64":
      return assets.macos.x64;
    case "win32-x64":
      return format === "msi" ? assets.windows.msi : assets.windows.exe;
    case "linux-x64":
      return assets.linux.deb;
    default:
      throw new Error("PLATFORM_NOT_SUPPORTED");
  }
}
