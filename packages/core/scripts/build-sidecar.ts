#!/usr/bin/env npx tsx
/**
 * Build script for creating standalone Viben CLI binaries (sidecars for Tauri)
 *
 * This script compiles the Viben CLI as platform-specific standalone binaries
 * that can be bundled with the Tauri desktop application.
 *
 * Usage:
 *   npx tsx packages/core/scripts/build-sidecar.ts [options]
 *
 * Options:
 *   --platform <platform>  Build for specific platform: macos-arm64, macos-x64, win-x64, linux-x64, all (default: current)
 *   --output <dir>         Output directory (default: apps/desktop/src-tauri/binaries)
 *   --skip-build           Skip the TypeScript build step (use existing dist)
 *
 * Output files (Tauri sidecar naming convention):
 *   - viben-aarch64-apple-darwin     (macOS ARM64)
 *   - viben-x86_64-apple-darwin      (macOS x64)
 *   - viben-x86_64-pc-windows-msvc.exe (Windows x64)
 *   - viben-x86_64-unknown-linux-gnu (Linux x64)
 *
 * Known limitations:
 *   - The viben CLI has complex dependencies that may cause pkg warnings
 *   - Some dependencies like @modelcontextprotocol/sdk use subpath imports that
 *     pkg may not resolve correctly at build time
 *   - Consider using Node.js SEA (Single Executable Application) for Node 20+
 *     as an alternative if pkg fails
 *
 * Alternative approaches (future consideration):
 *   1. Node.js SEA (--experimental-sea-config) for Node 20+
 *   2. Bun compile (bun build --compile)
 *   3. Deno compile
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Package root is one level up from scripts/
const PACKAGE_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");
const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, "apps/desktop/src-tauri/binaries");

// Platform configurations
// Maps our platform names to pkg targets and Tauri binary suffixes
interface PlatformConfig {
  pkgTarget: string;
  tauriSuffix: string;
  nodeVersion: string;
}

const PLATFORMS: Record<string, PlatformConfig> = {
  "macos-arm64": {
    pkgTarget: "node18-macos-arm64",
    tauriSuffix: "aarch64-apple-darwin",
    nodeVersion: "18",
  },
  "macos-x64": {
    pkgTarget: "node18-macos-x64",
    tauriSuffix: "x86_64-apple-darwin",
    nodeVersion: "18",
  },
  "win-x64": {
    pkgTarget: "node18-win-x64",
    tauriSuffix: "x86_64-pc-windows-msvc",
    nodeVersion: "18",
  },
  "linux-x64": {
    pkgTarget: "node18-linux-x64",
    tauriSuffix: "x86_64-unknown-linux-gnu",
    nodeVersion: "18",
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
      } else if (PLATFORMS[platform]) {
        platforms = [platform];
      } else {
        console.error(`Unknown platform: ${platform}`);
        console.error(`Available platforms: ${Object.keys(PLATFORMS).join(", ")}, all`);
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
Viben Sidecar Build Script

Usage: npx tsx build-sidecar.ts [options]

Options:
  --platform <platform>  Build for specific platform (default: current)
                         Available: ${Object.keys(PLATFORMS).join(", ")}, all
  --output <dir>         Output directory (default: apps/desktop/src-tauri/binaries)
  --skip-build           Skip TypeScript compilation step
  -h, --help             Show this help message

Examples:
  npx tsx build-sidecar.ts                          # Build for current platform
  npx tsx build-sidecar.ts --platform all           # Build for all platforms
  npx tsx build-sidecar.ts --platform macos-arm64   # Build for macOS ARM64 only
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

// Check if pkg is available
function checkPkgInstalled(): boolean {
  try {
    execSync("npx pkg --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
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

// Build binary for a specific platform
function buildPlatform(platform: string, outputDir: string): void {
  const config = PLATFORMS[platform];
  const inputFile = join(PACKAGE_ROOT, "dist/cli/bin.cjs");
  const extension = platform.startsWith("win") ? ".exe" : "";
  const outputName = `viben-${config.tauriSuffix}${extension}`;
  const outputPath = join(outputDir, outputName);

  console.log(`\n🔨 Building for ${platform}...`);
  console.log(`   Target: ${config.pkgTarget}`);
  console.log(`   Output: ${outputPath}`);

  // Ensure input file exists
  if (!existsSync(inputFile)) {
    throw new Error(`Input file not found: ${inputFile}. Run 'pnpm build' first.`);
  }

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Build with pkg
  // Using npx to run pkg without needing it installed globally
  const pkgArgs = [
    "pkg",
    inputFile,
    "--target",
    config.pkgTarget,
    "--output",
    outputPath,
    "--compress",
    "GZip",
  ];

  console.log(`   Running: npx ${pkgArgs.join(" ")}`);

  const result = spawnSync("npx", pkgArgs, {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error(`pkg build failed for ${platform}`);
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
  console.log("🚀 Viben Sidecar Build Script");
  console.log("============================");

  const { platforms, outputDir, skipBuild } = parseArgs();

  console.log(`\nConfiguration:`);
  console.log(`  Platforms: ${platforms.join(", ")}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Skip build: ${skipBuild}`);

  // Check pkg is available
  if (!checkPkgInstalled()) {
    console.log("\n⚠️  pkg not found. Installing...");
    execSync("npm install -g pkg", { stdio: "inherit" });
  }

  // Build TypeScript if not skipping
  if (!skipBuild) {
    buildTypeScript();
  }

  // Build for each platform
  const results: { platform: string; success: boolean; error?: string }[] = [];

  for (const platform of platforms) {
    try {
      buildPlatform(platform, outputDir);
      results.push({ platform, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to build for ${platform}: ${message}`);
      results.push({ platform, success: false, error: message });
    }
  }

  // Summary
  console.log("\n============================");
  console.log("Build Summary:");
  console.log("============================");

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  for (const result of results) {
    const status = result.success ? "✅" : "❌";
    const config = PLATFORMS[result.platform];
    const extension = result.platform.startsWith("win") ? ".exe" : "";
    const filename = `viben-${config.tauriSuffix}${extension}`;
    console.log(`  ${status} ${result.platform}: ${filename}`);
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  }

  console.log(`\nTotal: ${successful.length} succeeded, ${failed.length} failed`);

  if (failed.length > 0) {
    process.exit(1);
  }

  console.log("\n🎉 Build complete!");
  console.log(`\nBinaries are located at: ${outputDir}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
