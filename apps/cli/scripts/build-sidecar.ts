#!/usr/bin/env npx tsx
/**
 * Build standalone Viben CLI binaries for Tauri sidecar bundling.
 *
 * The sidecar is a product artifact of apps/cli. packages/core provides the
 * underlying capabilities, but release binaries must be built from this package.
 */

import { execSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PACKAGE_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "../..");
const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, "apps/desktop/src-tauri/binaries");
const INPUT_FILE = join(PACKAGE_ROOT, "dist/index.js");

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
  "win-arm64": {
    bunTarget: "bun-windows-arm64",
    tauriSuffix: "aarch64-pc-windows-msvc",
  },
  "linux-x64": {
    bunTarget: "bun-linux-x64",
    tauriSuffix: "x86_64-unknown-linux-gnu",
  },
  "linux-arm64": {
    bunTarget: "bun-linux-arm64",
    tauriSuffix: "aarch64-unknown-linux-gnu",
  },
};

function getCurrentPlatform(): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin") {
    return arch === "arm64" ? "macos-arm64" : "macos-x64";
  }
  if (platform === "win32") {
    return arch === "arm64" ? "win-arm64" : "win-x64";
  }
  if (platform === "linux") {
    return arch === "arm64" ? "linux-arm64" : "linux-x64";
  }

  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

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
Viben apps/cli Sidecar Build Script (Bun)

Usage: pnpm exec tsx scripts/build-sidecar.ts [options]

Options:
  --platform <platform>  Build for specific platform (default: current)
                         Available: ${Object.keys(PLATFORMS).join(", ")}, all, current
  --output <dir>         Output directory (default: apps/desktop/src-tauri/binaries)
  --skip-build           Skip apps/cli Node build step
  -h, --help             Show this help message
`);
      process.exit(0);
    }
  }

  if (platforms.length === 0) {
    platforms = [getCurrentPlatform()];
  }

  return { platforms, outputDir, skipBuild };
}

function checkBunInstalled(): boolean {
  try {
    execSync("bun --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function installBun(): void {
  console.log("\nInstalling Bun...");

  if (process.platform === "win32") {
    execSync("npm install -g bun", { stdio: "inherit" });
  } else {
    execSync("curl -fsSL https://bun.sh/install | bash", { stdio: "inherit", shell: "/bin/bash" });
    const home = process.env.HOME || process.env.USERPROFILE || "";
    process.env.PATH = `${home}/.bun/bin:${process.env.PATH}`;
  }
}

function buildNodeCli(): void {
  console.log("\nBuilding apps/cli Node flavor...");

  const result = spawnSync("pnpm", ["build:node"], {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("apps/cli Node build failed");
  }
}

function copyTemplates(outputDir: string): void {
  const templatesSource = join(PACKAGE_ROOT, "dist/templates");
  const templatesTarget = join(outputDir, "templates");

  if (!existsSync(templatesSource)) {
    console.log(`Templates not found, skipping: ${templatesSource}`);
    return;
  }

  rmSync(templatesTarget, { recursive: true, force: true });
  cpSync(templatesSource, templatesTarget, { recursive: true });
  console.log(`Copied templates to ${templatesTarget}`);
}

function buildPlatform(platform: string, outputDir: string): void {
  const config = PLATFORMS[platform];

  const extension = platform.startsWith("win") ? ".exe" : "";
  const outputName = `viben-${config.tauriSuffix}${extension}`;
  const outputPath = join(outputDir, outputName);
  const tempOutput = join(outputDir, `viben${extension}`);

  console.log(`\nBuilding ${outputName}`);
  console.log(`Target: ${config.bunTarget}`);
  console.log(`Input: ${INPUT_FILE}`);
  console.log(`Output: ${outputPath}`);

  if (!existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}. Run 'pnpm build:node' first.`);
  }

  mkdirSync(outputDir, { recursive: true });

  const bunArgs = [
    "build",
    INPUT_FILE,
    "--compile",
    "--target",
    config.bunTarget,
    "--outfile",
    tempOutput,
  ];

  const result = spawnSync("bun", bunArgs, {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Bun build failed for ${platform}`);
  }

  if (existsSync(tempOutput)) {
    renameSync(tempOutput, outputPath);
  }

  if (!existsSync(outputPath)) {
    throw new Error(`Output file not created: ${outputPath}`);
  }

  if (!platform.startsWith("win")) {
    chmodSync(outputPath, 0o755);
  }

  console.log(`Built ${outputName}`);
}

async function main(): Promise<void> {
  console.log("Viben apps/cli sidecar build");
  console.log("============================");

  const { platforms, outputDir, skipBuild } = parseArgs();

  console.log(`Platforms: ${platforms.join(", ")}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Skip build: ${skipBuild}`);

  if (!checkBunInstalled()) {
    installBun();

    if (!checkBunInstalled()) {
      throw new Error("Failed to install Bun. Please install manually: https://bun.sh");
    }
  }

  const bunVersion = execSync("bun --version", { encoding: "utf-8" }).trim();
  console.log(`Using Bun ${bunVersion}`);

  if (!skipBuild) {
    buildNodeCli();
  }

  const results: { platform: string; success: boolean; skipped: boolean; error?: string }[] = [];

  for (const platform of platforms) {
    try {
      buildPlatform(platform, outputDir);
      results.push({ platform, success: true, skipped: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to build ${platform}: ${message}`);
      results.push({ platform, success: false, skipped: false, error: message });
    }
  }

  copyTemplates(outputDir);

  const failed = results.filter((result) => !result.success && !result.skipped);
  const skipped = results.filter((result) => result.skipped);
  const successful = results.filter((result) => result.success);

  console.log("\nBuild summary:");
  console.log(`Succeeded: ${successful.length}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
