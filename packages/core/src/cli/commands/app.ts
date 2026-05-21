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
  detectAppPlatform,
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
} from "../lib/app-installer";
import type { SupportedPlatform, WindowsFormat } from "../lib/app-installer";
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
  const platform = detectAppPlatform();

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
  const platform = detectAppPlatform();

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
