# viben app Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `viben app` command to launch or install the Viben desktop application, with platform detection, download progress, and automatic installation.

**Architecture:** Two-file structure: `app.ts` handles command registration and CLI flow, `app-installer.ts` contains platform detection, release fetching, downloading, and installation logic. Uses `cli-progress` for download progress bars.

**Tech Stack:** TypeScript, Commander.js, cli-progress, Node.js child_process for platform commands

---

## File Structure

```
packages/core/src/cli/commands/app.ts       # Command registration, subcommands, user prompts
packages/core/src/cli/lib/app-installer.ts  # Core logic: detect, fetch, download, install, launch
packages/core/src/cli/lib/app-installer.test.ts  # Unit tests
```

---

## Task 1: Add cli-progress dependency

**Files:**
- Modify: `packages/core/package.json`

- [ ] **Step 1: Add cli-progress to dependencies**

```bash
cd /root/viben && pnpm add cli-progress -F @viben/core
```

- [ ] **Step 2: Add type definitions**

```bash
cd /root/viben && pnpm add -D @types/cli-progress -F @viben/core
```

- [ ] **Step 3: Verify installation**

Run: `cat packages/core/package.json | grep cli-progress`
Expected: Shows `"cli-progress": "^3.x.x"` in dependencies

- [ ] **Step 4: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "chore(core): add cli-progress dependency for download progress"
```

---

## Task 2: Create app-installer types and platform detection

**Files:**
- Create: `packages/core/src/cli/lib/app-installer.ts`

- [ ] **Step 1: Create app-installer.ts with types and platform detection**

```typescript
/**
 * App installer - download and install Viben desktop app
 */
import { execSync, spawn } from "node:child_process";
import { createWriteStream, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

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
  const platform = process.platform as "darwin" | "win32" | "linux";
  const appPath = APP_PATHS[platform];

  if (!appPath) return false;

  if (platform === "linux") {
    // Check multiple possible locations
    const linuxPaths = ["/usr/bin/viben-desktop", "/opt/Viben/viben-desktop"];
    return linuxPaths.some((p) => existsSync(p));
  }

  return existsSync(appPath);
}

/**
 * Get installed app path
 */
export function getInstalledAppPath(): string | null {
  const platform = process.platform as "darwin" | "win32" | "linux";

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
```

- [ ] **Step 2: Verify file created**

Run: `head -50 packages/core/src/cli/lib/app-installer.ts`
Expected: Shows the types and platform detection code

- [ ] **Step 3: Run typecheck**

Run: `cd /root/viben && pnpm turbo build --filter=@viben/core`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/cli/lib/app-installer.ts
git commit -m "feat(cli): add app-installer types and platform detection"
```

---

## Task 3: Add release info fetching

**Files:**
- Modify: `packages/core/src/cli/lib/app-installer.ts`

- [ ] **Step 1: Add fetchReleaseInfo function**

Append to `packages/core/src/cli/lib/app-installer.ts`:

```typescript
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
```

- [ ] **Step 2: Run typecheck**

Run: `cd /root/viben && pnpm turbo build --filter=@viben/core`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/cli/lib/app-installer.ts
git commit -m "feat(cli): add release info fetching with GitHub API fallback"
```

---

## Task 4: Add download functionality with progress

**Files:**
- Modify: `packages/core/src/cli/lib/app-installer.ts`

- [ ] **Step 1: Add download function**

Append to `packages/core/src/cli/lib/app-installer.ts`:

```typescript
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

  // Check disk space (rough estimate: need 2x file size for safety)
  const requiredSpace = (asset.size ?? 100 * 1024 * 1024) * 2;
  try {
    const stats = statSync(outputDir);
    // Note: This is a simplified check; real disk space check would need platform-specific code
  } catch {
    // Ignore disk space check errors
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
```

- [ ] **Step 2: Run typecheck**

Run: `cd /root/viben && pnpm turbo build --filter=@viben/core`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/cli/lib/app-installer.ts
git commit -m "feat(cli): add download functionality with progress tracking"
```

---

## Task 5: Add installation logic

**Files:**
- Modify: `packages/core/src/cli/lib/app-installer.ts`

- [ ] **Step 1: Add install functions**

Append to `packages/core/src/cli/lib/app-installer.ts`:

```typescript
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
```

- [ ] **Step 2: Run typecheck**

Run: `cd /root/viben && pnpm turbo build --filter=@viben/core`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/cli/lib/app-installer.ts
git commit -m "feat(cli): add platform-specific installation logic"
```

---

## Task 6: Add app launching

**Files:**
- Modify: `packages/core/src/cli/lib/app-installer.ts`

- [ ] **Step 1: Add launch function**

Append to `packages/core/src/cli/lib/app-installer.ts`:

```typescript
// ============================================================================
// Launch
// ============================================================================

/**
 * Launch the desktop app
 */
export function launchApp(): boolean {
  const appPath = getInstalledAppPath();
  if (!appPath) return false;

  const platform = process.platform;

  try {
    if (platform === "darwin") {
      spawn("open", [appPath], { detached: true, stdio: "ignore" }).unref();
    } else if (platform === "win32") {
      spawn("cmd", ["/c", "start", "", appPath], { detached: true, stdio: "ignore" }).unref();
    } else if (platform === "linux") {
      spawn(appPath, [], { detached: true, stdio: "ignore" }).unref();
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd /root/viben && pnpm turbo build --filter=@viben/core`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/cli/lib/app-installer.ts
git commit -m "feat(cli): add app launch functionality"
```

---

## Task 7: Export from lib/index.ts

**Files:**
- Modify: `packages/core/src/cli/lib/index.ts`

- [ ] **Step 1: Add export**

Add to `packages/core/src/cli/lib/index.ts`:

```typescript
export * from "./app-installer";
```

- [ ] **Step 2: Verify export**

Run: `grep app-installer packages/core/src/cli/lib/index.ts`
Expected: Shows the export line

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/cli/lib/index.ts
git commit -m "feat(cli): export app-installer from lib"
```

---

## Task 8: Create app command

**Files:**
- Create: `packages/core/src/cli/commands/app.ts`

- [ ] **Step 1: Create app.ts command file**

```typescript
/**
 * viben app - Launch or install Viben desktop app
 */
import chalk from "chalk";
import cliProgress from "cli-progress";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  handleCommandError,
} from "../lib";
import {
  detectPlatform,
  isPlatformSupported,
  getPlatformDisplayName,
  isAppInstalled,
  getDefaultDownloadDir,
  fetchReleaseInfo,
  getAssetForPlatform,
  downloadAsset,
  installPackage,
  launchApp,
  formatBytes,
  getManualInstallCommand,
  type SupportedPlatform,
  type WindowsFormat,
} from "../lib/app-installer";
import { createInterface } from "node:readline";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [Y/n] `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "" || normalized === "y" || normalized === "yes");
    });
  });
}

/**
 * Create progress bar for download
 */
function createProgressBar(): cliProgress.SingleBar {
  return new cliProgress.SingleBar({
    format: "  [{bar}] {percentage}% | {downloaded}/{total}",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });
}

// ============================================================================
// Command Handlers
// ============================================================================

interface AppOptions {
  yes?: boolean;
}

interface InstallOptions {
  check?: boolean;
  install?: boolean;
  output?: string;
  force?: boolean;
  format?: WindowsFormat;
}

/**
 * Handle default `viben app` command
 */
async function handleAppDefault(ctx: OutputContext, options: AppOptions): Promise<void> {
  // Check if app is installed
  if (isAppInstalled()) {
    if (!ctx.quiet) {
      console.log(chalk.cyan("Launching Viben desktop app..."));
    }

    const launched = launchApp();
    if (launched) {
      output(ctx, successResponse({ launched: true }), () => {
        console.log(chalk.green("✓ Viben desktop app launched"));
      });
    } else {
      output(ctx, errorResponse("LAUNCH_FAILED", "Failed to launch app"), () => {
        console.log(chalk.red("Error: Failed to launch Viben desktop app"));
      });
      process.exit(1);
    }
    return;
  }

  // App not installed - prompt for download
  const platform = detectPlatform();

  if (!isPlatformSupported(platform)) {
    output(
      ctx,
      errorResponse("PLATFORM_NOT_SUPPORTED", `Platform ${platform} is not supported`),
      () => {
        console.log(chalk.red(`Error: ${getPlatformDisplayName(platform)} is not supported.`));
        console.log(chalk.gray("Supported platforms: macOS, Windows (x64), Linux (x64)"));
      }
    );
    process.exit(1);
  }

  if (!ctx.quiet) {
    console.log(chalk.yellow("Viben desktop app is not installed."));
    console.log();
  }

  // Fetch release info
  let release;
  try {
    if (!ctx.quiet) {
      console.log(chalk.gray("Checking latest version..."));
    }
    release = await fetchReleaseInfo();
  } catch (error) {
    const code = error instanceof Error ? error.message : "NETWORK_ERROR";
    output(ctx, errorResponse(code, "Failed to fetch release info"), () => {
      console.log(chalk.red("Error: Failed to check for latest version."));
      console.log(chalk.gray("Please check your internet connection."));
    });
    process.exit(1);
  }

  const asset = getAssetForPlatform(release, platform as SupportedPlatform);

  if (!ctx.quiet) {
    console.log(`  Latest version: ${chalk.bold("v" + release.version)}`);
    if (asset.size) {
      console.log(`  Download size: ${chalk.bold(formatBytes(asset.size))}`);
    }
    console.log();
  }

  // Confirm with user (unless -y flag)
  if (!options.yes) {
    const confirmed = await confirm("Download and install?");
    if (!confirmed) {
      console.log();
      console.log(chalk.gray("To install manually, download from:"));
      console.log(chalk.cyan(`  ${asset.url}`));
      return;
    }
    console.log();
  }

  // Download
  const outputDir = getDefaultDownloadDir();
  const progressBar = createProgressBar();

  if (!ctx.quiet) {
    console.log(`Downloading ${chalk.cyan(asset.name)}...`);
    progressBar.start(asset.size ?? 100, 0, {
      downloaded: "0 B",
      total: formatBytes(asset.size ?? 0),
    });
  }

  let downloadedPath: string;
  try {
    downloadedPath = await downloadAsset(asset, {
      outputDir,
      force: true,
      format: "exe",
      onProgress: (downloaded, total) => {
        if (!ctx.quiet) {
          progressBar.update(downloaded, {
            downloaded: formatBytes(downloaded),
            total: formatBytes(total),
          });
        }
      },
    });
  } catch (error) {
    if (!ctx.quiet) {
      progressBar.stop();
    }
    const code = error instanceof Error ? error.message : "DOWNLOAD_FAILED";
    output(ctx, errorResponse(code, "Download failed"), () => {
      console.log(chalk.red("\nError: Download failed."));
    });
    process.exit(1);
  }

  if (!ctx.quiet) {
    progressBar.stop();
    console.log(chalk.green(`\n✓ Downloaded to ${downloadedPath}`));
    console.log();
  }

  // Install
  if (!ctx.quiet) {
    console.log(chalk.cyan("Installing..."));
  }

  const installResult = await installPackage(downloadedPath);

  if (!installResult.success) {
    output(ctx, errorResponse("INSTALL_FAILED", installResult.error ?? "Installation failed"), () => {
      console.log(chalk.red(`Error: ${installResult.error}`));
      console.log();
      console.log(chalk.gray("To install manually, run:"));
      console.log(chalk.cyan(`  ${getManualInstallCommand(downloadedPath)}`));
    });
    process.exit(1);
  }

  if (!ctx.quiet) {
    console.log(chalk.green("✓ Installed successfully"));
    console.log();
  }

  // Launch
  if (!ctx.quiet) {
    console.log(chalk.cyan("Launching Viben desktop app..."));
  }

  const launched = launchApp();

  output(
    ctx,
    successResponse({
      version: release.version,
      installed: true,
      launched,
      path: installResult.installedPath,
    }),
    () => {
      if (launched) {
        console.log(chalk.green("✓ Viben desktop app launched"));
      } else {
        console.log(chalk.yellow("App installed but failed to launch automatically."));
      }
    }
  );
}

/**
 * Handle `viben app install` command
 */
async function handleInstall(
  ctx: OutputContext,
  version: string | undefined,
  options: InstallOptions
): Promise<void> {
  const platform = detectPlatform();

  if (!isPlatformSupported(platform)) {
    output(
      ctx,
      errorResponse("PLATFORM_NOT_SUPPORTED", `Platform ${platform} is not supported`),
      () => {
        console.log(chalk.red(`Error: ${getPlatformDisplayName(platform)} is not supported.`));
        console.log(chalk.gray("Supported platforms: macOS, Windows (x64), Linux (x64)"));
      }
    );
    process.exit(1);
  }

  // Normalize version
  const normalizedVersion = version?.replace(/^v/, "");

  // Fetch release info
  if (!ctx.quiet) {
    console.log(chalk.cyan("Checking version..."));
  }

  let release;
  try {
    release = await fetchReleaseInfo(normalizedVersion);
  } catch (error) {
    const code = error instanceof Error ? error.message : "NETWORK_ERROR";
    const message =
      code === "VERSION_NOT_FOUND"
        ? `Version ${version} not found. Run 'viben app check' to see the latest version.`
        : "Failed to fetch release info. Please check your internet connection.";

    output(ctx, errorResponse(code, message), () => {
      console.log(chalk.red(`Error: ${message}`));
    });
    process.exit(1);
  }

  const asset = getAssetForPlatform(release, platform as SupportedPlatform, options.format);

  // Check only mode
  if (options.check) {
    output(
      ctx,
      successResponse({
        version: release.version,
        tag: release.tag,
        date: release.date,
        platform: getPlatformDisplayName(platform),
        asset: asset.name,
        size: asset.size,
      }),
      () => {
        console.log();
        console.log(`  Version:  ${chalk.bold("v" + release.version)}`);
        console.log(`  Platform: ${getPlatformDisplayName(platform)}`);
        console.log(`  Package:  ${asset.name}`);
        if (asset.size) {
          console.log(`  Size:     ${formatBytes(asset.size)}`);
        }
        console.log();
      }
    );
    return;
  }

  if (!ctx.quiet) {
    console.log(`  Version: ${chalk.bold("v" + release.version)}`);
    console.log(`  Platform: ${getPlatformDisplayName(platform)}`);
    console.log();
  }

  // Download
  const outputDir = options.output ?? getDefaultDownloadDir();
  const progressBar = createProgressBar();

  if (!ctx.quiet) {
    console.log(`Downloading ${chalk.cyan(asset.name)}...`);
    progressBar.start(asset.size ?? 100, 0, {
      downloaded: "0 B",
      total: formatBytes(asset.size ?? 0),
    });
  }

  let downloadedPath: string;
  try {
    downloadedPath = await downloadAsset(asset, {
      outputDir,
      force: options.force ?? false,
      format: options.format ?? "exe",
      onProgress: (downloaded, total) => {
        if (!ctx.quiet) {
          progressBar.update(downloaded, {
            downloaded: formatBytes(downloaded),
            total: formatBytes(total),
          });
        }
      },
    });
  } catch (error) {
    if (!ctx.quiet) {
      progressBar.stop();
    }
    const code = error instanceof Error ? error.message : "DOWNLOAD_FAILED";
    const message =
      code === "FILE_EXISTS"
        ? `File already exists. Use --force to overwrite.`
        : "Download failed.";

    output(ctx, errorResponse(code, message), () => {
      console.log(chalk.red(`\nError: ${message}`));
    });
    process.exit(1);
  }

  if (!ctx.quiet) {
    progressBar.stop();
  }

  // Install if requested
  if (options.install) {
    if (!ctx.quiet) {
      console.log(chalk.green(`\n✓ Downloaded to ${downloadedPath}`));
      console.log();
      console.log(chalk.cyan("Installing..."));
    }

    const installResult = await installPackage(downloadedPath);

    if (!installResult.success) {
      output(ctx, errorResponse("INSTALL_FAILED", installResult.error ?? "Installation failed"), () => {
        console.log(chalk.red(`Error: ${installResult.error}`));
        console.log();
        console.log(chalk.gray("To install manually, run:"));
        console.log(chalk.cyan(`  ${getManualInstallCommand(downloadedPath)}`));
      });
      process.exit(1);
    }

    output(
      ctx,
      successResponse({
        version: release.version,
        platform,
        file: downloadedPath,
        installed: true,
        installedPath: installResult.installedPath,
      }),
      () => {
        console.log(chalk.green("✓ Installed successfully"));
      }
    );
    return;
  }

  // Download only
  output(
    ctx,
    successResponse({
      version: release.version,
      platform,
      file: downloadedPath,
      size: asset.size,
    }),
    () => {
      console.log(chalk.green(`\n✓ Downloaded to ${downloadedPath}`));
      console.log();
      console.log(chalk.gray("To install, run:"));
      console.log(chalk.cyan(`  ${getManualInstallCommand(downloadedPath)}`));
    }
  );
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register the app command
 */
export function registerAppCommand(program: Command): void {
  const appCmd = program
    .command("app")
    .description("Launch or install Viben desktop app")
    .option("-y, --yes", "Skip confirmation prompts")
    .action(async (options: AppOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        await handleAppDefault(ctx, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // viben app install [version]
  appCmd
    .command("install [version]")
    .description("Download desktop app installer")
    .option("-c, --check", "Check version info only, don't download")
    .option("-i, --install", "Install after downloading")
    .option("-o, --output <dir>", "Output directory", getDefaultDownloadDir())
    .option("-f, --force", "Overwrite existing file")
    .option("--format <type>", "Windows installer format (exe or msi)", "exe")
    .action(async (version: string | undefined, options: InstallOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        await handleInstall(ctx, version, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // viben app check (alias for install --check)
  appCmd
    .command("check")
    .description("Check latest desktop app version")
    .action(async () => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        await handleInstall(ctx, undefined, { check: true });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
```

- [ ] **Step 2: Verify file created**

Run: `wc -l packages/core/src/cli/commands/app.ts`
Expected: Shows line count > 300

- [ ] **Step 3: Run typecheck**

Run: `cd /root/viben && pnpm turbo build --filter=@viben/core`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/cli/commands/app.ts
git commit -m "feat(cli): add viben app command with launch/install functionality"
```

---

## Task 9: Register app command

**Files:**
- Modify: `packages/core/src/cli/commands/index.ts`

- [ ] **Step 1: Add import and registration**

Add import at top of file:

```typescript
import { registerAppCommand } from "./app";
```

Add registration in `registerCommands` function:

```typescript
registerAppCommand(program);
```

- [ ] **Step 2: Verify registration**

Run: `grep -n "registerAppCommand" packages/core/src/cli/commands/index.ts`
Expected: Shows import line and registration line

- [ ] **Step 3: Run typecheck**

Run: `cd /root/viben && pnpm turbo build --filter=@viben/core`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/cli/commands/index.ts
git commit -m "feat(cli): register app command"
```

---

## Task 10: Manual integration test

**Files:**
- None (manual testing)

- [ ] **Step 1: Build the CLI**

Run: `cd /root/viben && pnpm turbo build --filter=@viben/core`
Expected: Build succeeds

- [ ] **Step 2: Test help output**

Run: `cd /root/viben && node packages/core/dist/cli/bin.cjs app --help`
Expected: Shows app command help with subcommands

- [ ] **Step 3: Test check subcommand**

Run: `cd /root/viben && node packages/core/dist/cli/bin.cjs app check`
Expected: Shows latest version info

- [ ] **Step 4: Test install --check**

Run: `cd /root/viben && node packages/core/dist/cli/bin.cjs app install --check`
Expected: Shows version and platform info

- [ ] **Step 5: Test JSON output**

Run: `cd /root/viben && node packages/core/dist/cli/bin.cjs --json app check`
Expected: Shows JSON formatted output

- [ ] **Step 6: Commit final changes if any fixes needed**

```bash
git add -A
git commit -m "fix(cli): integration test fixes" --allow-empty
```

---

## Task 11: Add unit tests for platform detection

**Files:**
- Create: `packages/core/src/cli/lib/app-installer.test.ts`

- [ ] **Step 1: Create test file**

```typescript
/**
 * Tests for app-installer
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  detectPlatform,
  isPlatformSupported,
  getPlatformDisplayName,
  formatBytes,
  getDefaultDownloadDir,
} from "./app-installer";

describe("app-installer", () => {
  describe("detectPlatform", () => {
    it("returns darwin-arm64 for macOS ARM", () => {
      vi.stubGlobal("process", { ...process, platform: "darwin", arch: "arm64" });
      expect(detectPlatform()).toBe("darwin-arm64");
      vi.unstubAllGlobals();
    });

    it("returns darwin-x64 for macOS Intel", () => {
      vi.stubGlobal("process", { ...process, platform: "darwin", arch: "x64" });
      expect(detectPlatform()).toBe("darwin-x64");
      vi.unstubAllGlobals();
    });

    it("returns win32-x64 for Windows x64", () => {
      vi.stubGlobal("process", { ...process, platform: "win32", arch: "x64" });
      expect(detectPlatform()).toBe("win32-x64");
      vi.unstubAllGlobals();
    });

    it("returns win32-arm64 for Windows ARM", () => {
      vi.stubGlobal("process", { ...process, platform: "win32", arch: "arm64" });
      expect(detectPlatform()).toBe("win32-arm64");
      vi.unstubAllGlobals();
    });

    it("returns linux-x64 for Linux x64", () => {
      vi.stubGlobal("process", { ...process, platform: "linux", arch: "x64" });
      expect(detectPlatform()).toBe("linux-x64");
      vi.unstubAllGlobals();
    });
  });

  describe("isPlatformSupported", () => {
    it("returns true for supported platforms", () => {
      expect(isPlatformSupported("darwin-arm64")).toBe(true);
      expect(isPlatformSupported("darwin-x64")).toBe(true);
      expect(isPlatformSupported("win32-x64")).toBe(true);
      expect(isPlatformSupported("linux-x64")).toBe(true);
    });

    it("returns false for unsupported platforms", () => {
      expect(isPlatformSupported("win32-arm64")).toBe(false);
      expect(isPlatformSupported("linux-arm64")).toBe(false);
      expect(isPlatformSupported("unknown")).toBe(false);
    });
  });

  describe("getPlatformDisplayName", () => {
    it("returns human-readable names", () => {
      expect(getPlatformDisplayName("darwin-arm64")).toBe("macOS (Apple Silicon)");
      expect(getPlatformDisplayName("darwin-x64")).toBe("macOS (Intel)");
      expect(getPlatformDisplayName("win32-x64")).toBe("Windows (x64)");
      expect(getPlatformDisplayName("linux-x64")).toBe("Linux (x64)");
    });
  });

  describe("formatBytes", () => {
    it("formats bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
      expect(formatBytes(1536 * 1024)).toBe("1.5 MB");
    });
  });

  describe("getDefaultDownloadDir", () => {
    it("returns Downloads directory in home", () => {
      const dir = getDefaultDownloadDir();
      expect(dir).toContain("Downloads");
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd /root/viben && pnpm turbo test --filter=@viben/core -- --run app-installer`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/cli/lib/app-installer.test.ts
git commit -m "test(cli): add unit tests for app-installer"
```

---

## Summary

After completing all tasks, you will have:

1. **`cli-progress`** dependency installed for download progress
2. **`app-installer.ts`** with all core logic:
   - Platform detection
   - Release info fetching (releases.json + GitHub API fallback)
   - Download with progress
   - Platform-specific installation
   - App launching
3. **`app.ts`** command with:
   - `viben app` - launch or prompt to install
   - `viben app install [version]` - download installer
   - `viben app check` - check latest version
4. **Unit tests** for platform detection and utilities
5. **Integration tested** via CLI
