#!/usr/bin/env npx tsx
/**
 * Build script for creating standalone Viben CLI binaries (sidecars for Tauri)
 *
 * This script compiles the Viben CLI as platform-specific standalone binaries
 * that can be bundled with the Tauri desktop application.
 *
 * Uses Bun to compile the CLI into standalone executables.
 * Bun handles Node.js built-in modules and complex dependencies better than pkg.
 *
 * Usage:
 *   npx tsx packages/core/scripts/build-sidecar.ts [options]
 *
 * Options:
 *   --platform <platform>  Build for specific platform: macos-arm64, macos-x64, win-x64, linux-x64, all, current (default: current)
 *   --output <dir>         Output directory (default: apps/desktop/src-tauri/binaries)
 *   --skip-build           Skip the TypeScript build step (use existing dist)
 *
 * Output files (Tauri sidecar naming convention):
 *   - viben-aarch64-apple-darwin     (macOS ARM64)
 *   - viben-x86_64-apple-darwin      (macOS x64)
 *   - viben-x86_64-pc-windows-msvc.exe (Windows x64)
 *   - viben-x86_64-unknown-linux-gnu (Linux x64)
 *
 * Note: Bun can only compile for the current platform. Cross-compilation requires
 * running this script on each target platform (handled by CI matrix).
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, chmodSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Package root is one level up from scripts/
const PACKAGE_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");
const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, "apps/desktop/src-tauri/binaries");

// Platform configurations
interface PlatformConfig {
  bunTarget: string;
  tauriSuffix: string;
}

const PLATFORMS: Record<string, PlatformConfig> = {
  "macos-arm64": {
    bunTarget: "bun-darwin-arm64",
    tauriSuffix: "aarch64-apple-darwin",
  },
  "macos-x64": {
    bunTarget: "bun-darwin-x64",
    tauriSuffix: "x86_64-apple-darwin",
  },
  "win-x64": {
    bunTarget: "bun-windows-x64",
    tauriSuffix: "x86_64-pc-windows-msvc",
  },
  "linux-x64": {
    bunTarget: "bun-linux-x64",
    tauriSuffix: "x86_64-unknown-linux-gnu",
  },
};

// Detect current platform
function getCurrentPlatform(): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin") {
    return arch === "arm64" ? "macos-arm64" : "macos-x64";
  } else if (platform === "win32") {
    return "win-x64";
  } else if (platform === "linux") {
    return "linux-x64";
  }

  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

// Parse command line arguments
function parseArgs(): { platforms: string[]; outputDir: string; skipBuild: boolean } {
  const args = process.argv.slice(2);
  let platforms: string[] = [];
  let outputDir = DEFAULT_OUTPUT_DIR;
  let skipBuild = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--platform" && args[i + 1]) {
      const platform = args[i + 1];
      if (platform === "all") {
        platforms = Object.keys(PLATFORMS);
      } else if (platform === "current") {
        platforms = [getCurrentPlatform()];
      } else if (PLATFORMS[platform]) {
        platforms = [platform];
      } else {
        console.error(`Unknown platform: ${platform}`);
        console.error(`Available platforms: ${Object.keys(PLATFORMS).join(", ")}, all, current`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      outputDir = resolve(args[i + 1]);
      i++;
    } else if (args[i] === "--skip-build") {
      skipBuild = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Viben Sidecar Build Script (Bun)

Usage: npx tsx build-sidecar.ts [options]

Options:
  --platform <platform>  Build for specific platform (default: current)
                         Available: ${Object.keys(PLATFORMS).join(", ")}, all, current
  --output <dir>         Output directory (default: apps/desktop/src-tauri/binaries)
  --skip-build           Skip TypeScript compilation step
  -h, --help             Show this help message

Examples:
  npx tsx build-sidecar.ts                          # Build for current platform
  npx tsx build-sidecar.ts --platform current       # Build for current platform
  npx tsx build-sidecar.ts --platform macos-arm64   # Build for macOS ARM64 only

Note: Bun can only compile for the current platform natively.
      Cross-platform builds are handled by CI running on each target platform.
`);
      process.exit(0);
    }
  }

  // Default to current platform if none specified
  if (platforms.length === 0) {
    platforms = [getCurrentPlatform()];
  }

  return { platforms, outputDir, skipBuild };
}

// Check if Bun is available
function checkBunInstalled(): boolean {
  try {
    execSync("bun --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// Install Bun
function installBun(): void {
  console.log("\n📦 Installing Bun...");
  const platform = process.platform;

  if (platform === "win32") {
    // Windows: use npm to install bun
    execSync("npm install -g bun", { stdio: "inherit" });
  } else {
    // macOS/Linux: use the official install script
    execSync("curl -fsSL https://bun.sh/install | bash", { stdio: "inherit", shell: "/bin/bash" });
    // Add bun to PATH for this session
    const home = process.env.HOME || process.env.USERPROFILE || "";
    process.env.PATH = `${home}/.bun/bin:${process.env.PATH}`;
  }
}

// Build TypeScript with tsup
function buildTypeScript(): void {
  console.log("\n📦 Building TypeScript with tsup...");

  const result = spawnSync("pnpm", ["build"], {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error("TypeScript build failed");
  }

  console.log("✅ TypeScript build complete");
}

// Build binary for a specific platform using Bun
function buildPlatform(platform: string, outputDir: string): void {
  const config = PLATFORMS[platform];
  const currentPlatform = getCurrentPlatform();

  // Bun can only compile for the current platform
  if (platform !== currentPlatform) {
    console.log(`\n⚠️  Skipping ${platform} (current platform is ${currentPlatform})`);
    console.log(`   Cross-compilation not supported. Run on target platform or use CI.`);
    return;
  }

  const inputFile = join(PACKAGE_ROOT, "dist/cli/bin.cjs");
  const extension = platform.startsWith("win") ? ".exe" : "";
  const outputName = `viben-${config.tauriSuffix}${extension}`;
  const outputPath = join(outputDir, outputName);
  const tempOutput = join(outputDir, `viben${extension}`);

  console.log(`\n🔨 Building for ${platform} using Bun...`);
  console.log(`   Target: ${config.bunTarget}`);
  console.log(`   Output: ${outputPath}`);

  // Ensure input file exists
  if (!existsSync(inputFile)) {
    throw new Error(`Input file not found: ${inputFile}. Run 'pnpm build' first.`);
  }

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Build with Bun
  const bunArgs = [
    "build",
    inputFile,
    "--compile",
    "--target",
    config.bunTarget,
    "--outfile",
    tempOutput,
  ];

  console.log(`   Running: bun ${bunArgs.join(" ")}`);

  const result = spawnSync("bun", bunArgs, {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error(`Bun build failed for ${platform}`);
  }

  // Rename to Tauri sidecar naming convention
  if (existsSync(tempOutput)) {
    renameSync(tempOutput, outputPath);
  }

  // Verify output exists
  if (!existsSync(outputPath)) {
    throw new Error(`Output file not created: ${outputPath}`);
  }

  // Make executable on Unix platforms
  if (!platform.startsWith("win")) {
    chmodSync(outputPath, 0o755);
  }

  console.log(`✅ Built ${outputName}`);
}

// Main function
async function main(): Promise<void> {
  console.log("🚀 Viben Sidecar Build Script (Bun)");
  console.log("===================================");

  const { platforms, outputDir, skipBuild } = parseArgs();

  console.log(`\nConfiguration:`);
  console.log(`  Platforms: ${platforms.join(", ")}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Skip build: ${skipBuild}`);

  // Check Bun is available
  if (!checkBunInstalled()) {
    console.log("\n⚠️  Bun not found. Installing...");
    installBun();

    // Verify installation
    if (!checkBunInstalled()) {
      throw new Error("Failed to install Bun. Please install manually: https://bun.sh");
    }
  }

  const bunVersion = execSync("bun --version", { encoding: "utf-8" }).trim();
  console.log(`\nUsing Bun ${bunVersion}`);

  // Build TypeScript if not skipping
  if (!skipBuild) {
    buildTypeScript();
  }

  // Build for each platform
  const results: { platform: string; success: boolean; skipped: boolean; error?: string }[] = [];

  for (const platform of platforms) {
    const currentPlatform = getCurrentPlatform();
    if (platform !== currentPlatform) {
      results.push({ platform, success: false, skipped: true });
      continue;
    }

    try {
      buildPlatform(platform, outputDir);
      results.push({ platform, success: true, skipped: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to build for ${platform}: ${message}`);
      results.push({ platform, success: false, skipped: false, error: message });
    }
  }

  // Summary
  console.log("\n===================================");
  console.log("Build Summary:");
  console.log("===================================");

  const successful = results.filter((r) => r.success);
  const skipped = results.filter((r) => r.skipped);
  const failed = results.filter((r) => !r.success && !r.skipped);

  for (const result of results) {
    const config = PLATFORMS[result.platform];
    const extension = result.platform.startsWith("win") ? ".exe" : "";
    const filename = `viben-${config.tauriSuffix}${extension}`;

    if (result.skipped) {
      console.log(`  ⏭️  ${result.platform}: ${filename} (skipped - wrong platform)`);
    } else if (result.success) {
      console.log(`  ✅ ${result.platform}: ${filename}`);
    } else {
      console.log(`  ❌ ${result.platform}: ${filename}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    }
  }

  console.log(`\nTotal: ${successful.length} succeeded, ${skipped.length} skipped, ${failed.length} failed`);

  if (failed.length > 0) {
    process.exit(1);
  }

  if (successful.length > 0) {
    console.log("\n🎉 Build complete!");
    console.log(`\nBinaries are located at: ${outputDir}`);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
