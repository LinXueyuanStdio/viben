/**
 * App installer - download and install Viben desktop app
 */
import { execSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
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

// ============================================================================
// Download
// ============================================================================

/**
 * Download a file with progress callback
 */
export async function downloadAsset(
  asset: ReleaseAsset,
  options: DownloadOptions
): Promise<string> {
  const { outputDir, force, onProgress } = options;

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    throw new Error("OUTPUT_DIR_ERROR");
  }

  const outputPath = join(outputDir, asset.name);

  // Check if file already exists
  if (existsSync(outputPath) && !force) {
    throw new Error("FILE_EXISTS");
  }

  // Download the file
  const response = await fetch(asset.url, {
    headers: { "User-Agent": "viben-cli" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error("DOWNLOAD_FAILED");
  }

  const totalSize = parseInt(response.headers.get("content-length") ?? "0", 10) || asset.size || 0;
  let downloadedSize = 0;

  // Create write stream
  const fileStream = createWriteStream(outputPath);

  // Process the response body with progress tracking
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("DOWNLOAD_FAILED");
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fileStream.write(value);
      downloadedSize += value.length;

      if (onProgress && totalSize > 0) {
        onProgress(downloadedSize, totalSize);
      }
    }
  } finally {
    fileStream.end();
    reader.releaseLock();
  }

  // Wait for file to be fully written
  await new Promise<void>((resolve, reject) => {
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
  });

  return outputPath;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ============================================================================
// Installation
// ============================================================================

/**
 * Install on macOS (DMG)
 */
async function installMacOS(dmgPath: string): Promise<InstallResult> {
  try {
    // Mount DMG and get mount point
    const mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`, {
      encoding: "utf-8",
    });

    // Parse mount point from output
    const mountMatch = mountOutput.match(/\/Volumes\/[^\s]+/);
    if (!mountMatch) {
      return { success: false, error: "Failed to mount DMG" };
    }
    const mountPoint = mountMatch[0];

    try {
      // Copy app to Applications
      execSync(`cp -R "${mountPoint}/Viben.app" /Applications/`, { encoding: "utf-8" });

      // Clear quarantine attribute (ignore errors)
      try {
        execSync("xattr -cr /Applications/Viben.app", { encoding: "utf-8" });
      } catch {
        // Ignore xattr errors
      }

      return { success: true, installedPath: "/Applications/Viben.app" };
    } finally {
      // Always unmount
      try {
        execSync(`hdiutil detach "${mountPoint}" -quiet`, { encoding: "utf-8" });
      } catch {
        // Ignore unmount errors
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Installation failed",
    };
  }
}

/**
 * Install on Windows (EXE or MSI)
 */
async function installWindows(installerPath: string): Promise<InstallResult> {
  try {
    const isExe = installerPath.endsWith(".exe");

    if (isExe) {
      // NSIS silent install
      execSync(`"${installerPath}" /S`, { encoding: "utf-8" });
    } else {
      // MSI silent install
      execSync(`msiexec /i "${installerPath}" /quiet /norestart`, { encoding: "utf-8" });
    }

    return { success: true, installedPath: APP_PATHS.win32 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Installation failed",
    };
  }
}

/**
 * Install on Linux (DEB)
 */
async function installLinux(debPath: string): Promise<InstallResult> {
  try {
    // Try apt install first (handles dependencies)
    try {
      execSync(`sudo apt install -y "${debPath}"`, { encoding: "utf-8", stdio: "inherit" });
      return { success: true, installedPath: "/usr/bin/viben-desktop" };
    } catch {
      // Fallback to dpkg + apt-get -f
      execSync(`sudo dpkg -i "${debPath}"`, { encoding: "utf-8", stdio: "inherit" });
      execSync("sudo apt-get install -f -y", { encoding: "utf-8", stdio: "inherit" });
      return { success: true, installedPath: "/usr/bin/viben-desktop" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Installation failed. Try: sudo dpkg -i " + debPath,
    };
  }
}

/**
 * Install the downloaded package
 */
export async function installPackage(packagePath: string): Promise<InstallResult> {
  const platform = process.platform;

  if (platform === "darwin") {
    return installMacOS(packagePath);
  }

  if (platform === "win32") {
    return installWindows(packagePath);
  }

  if (platform === "linux") {
    return installLinux(packagePath);
  }

  return { success: false, error: "PLATFORM_NOT_SUPPORTED" };
}

/**
 * Get manual install command for user
 */
export function getManualInstallCommand(packagePath: string): string {
  const platform = process.platform;

  if (platform === "darwin") {
    return `open "${packagePath}"`;
  }

  if (platform === "win32") {
    return `"${packagePath}"`;
  }

  if (platform === "linux") {
    return `sudo apt install "${packagePath}"`;
  }

  return packagePath;
}
