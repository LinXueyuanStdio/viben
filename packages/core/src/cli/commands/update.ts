/**
 * viben update - Update Viben CLI and workspace components
 *
 * Subcommands/Options:
 * - (no options): Self-update CLI to latest version
 * - --check: Check for available updates
 * - --idea-types: Update idea-types templates in docs/idea-types/
 * - --reward-types: Update reward-types templates in docs/reward-types/
 */
import chalk from "chalk";
import { resolve } from "node:path";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  handleCommandError,
} from "../lib";
import { updateIdeaTypes, updateRewardTypes } from "../../workspace/update";
import { proxyFetch } from "../../http";

const execAsync = promisify(exec);

// Injected by tsup at build time
declare const __VERSION__: string;
const CURRENT_VERSION =
  typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

const GITHUB_REPO = "LinXueyuanStdio/viben";
const NPM_PACKAGE = "viben";

interface UpdateOptions {
  /** Check for updates without installing */
  check?: boolean;
  /** Update idea-types templates */
  ideaTypes?: boolean;
  /** Update reward-types templates */
  rewardTypes?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Skip existing files without error */
  skipExisting?: boolean;
}

interface ReleaseInfo {
  version: string;
  tag: string;
  date: string;
  hasUpdate: boolean;
  currentVersion: string;
}

/**
 * Compare semver versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareSemver(a: string, b: string): number {
  const parseVersion = (v: string): number[] => {
    return v
      .replace(/^v/, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  };

  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);

  if (aMajor !== bMajor) return aMajor > bMajor ? 1 : -1;
  if (aMinor !== bMinor) return aMinor > bMinor ? 1 : -1;
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1;
  return 0;
}

/**
 * Fetch the latest release info from GitHub
 */
async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const response = await proxyFetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": `viben/${CURRENT_VERSION}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const releases = (await response.json()) as Array<{
      tag_name: string;
      published_at: string;
      prerelease: boolean;
    }>;

    // Find the latest non-prerelease version
    const release = releases.find(
      (r) => r.tag_name.startsWith("v") && !r.prerelease
    );

    if (!release) {
      return null;
    }

    const latestVersion = release.tag_name.replace(/^v/, "");

    return {
      version: latestVersion,
      tag: release.tag_name,
      date: release.published_at,
      hasUpdate: compareSemver(latestVersion, CURRENT_VERSION) > 0,
      currentVersion: CURRENT_VERSION,
    };
  } catch {
    return null;
  }
}

/**
 * Detect the package manager used to install viben
 */
async function detectPackageManager(): Promise<
  "npm" | "pnpm" | "yarn" | "bun" | null
> {
  // Check if running in a global context by checking common paths
  try {
    const { stdout: npmPrefix } = await execAsync("npm config get prefix");
    const { stdout: whichViben } = await execAsync("which viben").catch(
      () => ({ stdout: "" })
    );

    if (whichViben.includes(npmPrefix.trim())) {
      return "npm";
    }
  } catch {
    // Ignore errors
  }

  // Check available package managers
  const managers = ["pnpm", "yarn", "bun", "npm"] as const;

  for (const manager of managers) {
    try {
      await execAsync(`which ${manager}`);

      // Check if viben is installed with this manager
      if (manager === "pnpm") {
        const { stdout } = await execAsync("pnpm list -g viben").catch(() => ({
          stdout: "",
        }));
        if (stdout.includes("viben")) return "pnpm";
      } else if (manager === "yarn") {
        const { stdout } = await execAsync("yarn global list").catch(() => ({
          stdout: "",
        }));
        if (stdout.includes("viben")) return "yarn";
      } else if (manager === "bun") {
        const { stdout } = await execAsync("bun pm ls -g").catch(() => ({
          stdout: "",
        }));
        if (stdout.includes("viben")) return "bun";
      }
    } catch {
      // Package manager not found, continue
    }
  }

  // Default to npm
  return "npm";
}

/**
 * Get the update command for the detected package manager
 */
function getUpdateCommand(manager: "npm" | "pnpm" | "yarn" | "bun"): string[] {
  switch (manager) {
    case "pnpm":
      return ["pnpm", "add", "-g", NPM_PACKAGE];
    case "yarn":
      return ["yarn", "global", "add", NPM_PACKAGE];
    case "bun":
      return ["bun", "add", "-g", NPM_PACKAGE];
    case "npm":
    default:
      // Use --force to overwrite existing binary (handles EEXIST error)
      return ["npm", "install", "-g", "--force", NPM_PACKAGE];
  }
}

/**
 * Run the update command
 */
async function runUpdate(
  ctx: OutputContext,
  manager: "npm" | "pnpm" | "yarn" | "bun"
): Promise<boolean> {
  const [cmd, ...args] = getUpdateCommand(manager);

  return new Promise((resolve) => {
    if (!ctx.quiet) {
      console.log(chalk.cyan(`Running: ${cmd} ${args.join(" ")}`));
      console.log();
    }

    const child = spawn(cmd, args, {
      stdio: ctx.quiet ? "ignore" : "inherit",
    });

    child.on("close", (code) => {
      resolve(code === 0);
    });

    child.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Handle self-update
 */
async function handleSelfUpdate(
  ctx: OutputContext,
  checkOnly: boolean
): Promise<void> {
  if (!ctx.quiet) {
    console.log(chalk.cyan("Checking for updates..."));
    console.log(chalk.gray(`  Current version: v${CURRENT_VERSION}`));
    console.log();
  }

  const releaseInfo = await fetchLatestRelease();

  if (!releaseInfo) {
    output(
      ctx,
      errorResponse(
        "FETCH_FAILED",
        "Failed to fetch release information from GitHub"
      ),
      () => {
        console.log(chalk.red("Error: Failed to check for updates."));
        console.log(
          chalk.gray("  Please check your internet connection and try again.")
        );
      }
    );
    process.exit(1);
  }

  if (!releaseInfo.hasUpdate) {
    output(
      ctx,
      successResponse({
        status: "up_to_date",
        currentVersion: CURRENT_VERSION,
        latestVersion: releaseInfo.version,
      }),
      () => {
        console.log(
          chalk.green(`✓ You're already on the latest version (v${CURRENT_VERSION})`)
        );
      }
    );
    return;
  }

  // Update is available
  if (checkOnly) {
    output(
      ctx,
      successResponse({
        status: "update_available",
        currentVersion: CURRENT_VERSION,
        latestVersion: releaseInfo.version,
        releaseDate: releaseInfo.date,
      }),
      () => {
        console.log(
          chalk.yellow(
            `⬆ Update available: v${CURRENT_VERSION} → v${releaseInfo.version}`
          )
        );
        console.log();
        console.log("To update, run:");
        console.log(chalk.cyan("  viben update"));
        console.log();
        console.log(
          chalk.gray(
            `Release date: ${new Date(releaseInfo.date).toLocaleDateString()}`
          )
        );
        console.log(
          chalk.gray(
            `Changelog: https://github.com/${GITHUB_REPO}/releases/tag/${releaseInfo.tag}`
          )
        );
      }
    );
    return;
  }

  // Perform the update
  if (!ctx.quiet) {
    console.log(
      chalk.yellow(
        `⬆ Updating: v${CURRENT_VERSION} → v${releaseInfo.version}`
      )
    );
    console.log();
  }

  const manager = await detectPackageManager();

  if (!manager) {
    output(
      ctx,
      errorResponse(
        "NO_PACKAGE_MANAGER",
        "Could not detect package manager. Please update manually."
      ),
      () => {
        console.log(
          chalk.red("Error: Could not detect how viben was installed.")
        );
        console.log();
        console.log("Please update manually using one of:");
        console.log(chalk.cyan("  npm install -g viben"));
        console.log(chalk.cyan("  pnpm add -g viben"));
        console.log(chalk.cyan("  yarn global add viben"));
        console.log(chalk.cyan("  bun add -g viben"));
      }
    );
    process.exit(1);
  }

  if (!ctx.quiet) {
    console.log(chalk.gray(`  Detected package manager: ${manager}`));
    console.log();
  }

  const success = await runUpdate(ctx, manager);

  if (success) {
    output(
      ctx,
      successResponse({
        status: "updated",
        previousVersion: CURRENT_VERSION,
        newVersion: releaseInfo.version,
        packageManager: manager,
      }),
      () => {
        console.log();
        console.log(
          chalk.green(`✓ Successfully updated to v${releaseInfo.version}`)
        );
        console.log();
        console.log("What's new:");
        console.log(
          chalk.gray(
            `  https://github.com/${GITHUB_REPO}/releases/tag/${releaseInfo.tag}`
          )
        );
      }
    );
  } else {
    output(
      ctx,
      errorResponse("UPDATE_FAILED", "Failed to update viben"),
      () => {
        console.log();
        console.log(chalk.red("Error: Update failed."));
        console.log();
        console.log("Please try updating manually:");
        console.log(chalk.cyan(`  ${getUpdateCommand(manager).join(" ")}`));
        console.log();
        console.log(
          chalk.gray("If you encounter permission issues, try running with sudo:")
        );
        console.log(chalk.gray(`  sudo ${getUpdateCommand(manager).join(" ")}`));
      }
    );
    process.exit(1);
  }
}

/**
 * Handle workspace component updates
 */
async function handleWorkspaceUpdate(
  ctx: OutputContext,
  targetDir: string,
  options: UpdateOptions
): Promise<void> {
  const resolvedDir = resolve(targetDir);
  const createdFiles: string[] = [];

  const writeOpts = {
    force: options.force,
    skipExisting: options.skipExisting,
  };

  if (!ctx.quiet) {
    console.log(chalk.cyan("Updating Viben workspace..."));
    console.log(chalk.gray(`  Target: ${resolvedDir}`));
    console.log();
  }

  // Update idea-types templates
  if (options.ideaTypes) {
    if (!ctx.quiet) {
      console.log(chalk.gray("  Updating idea-types templates..."));
    }
    await updateIdeaTypes(resolvedDir, writeOpts, createdFiles);
  }

  // Update reward-types templates
  if (options.rewardTypes) {
    if (!ctx.quiet) {
      console.log(chalk.gray("  Updating reward-types templates..."));
    }
    await updateRewardTypes(resolvedDir, writeOpts, createdFiles);
  }

  output(
    ctx,
    successResponse({
      path: resolvedDir,
      files: createdFiles,
      count: createdFiles.length,
    }),
    () => {
      console.log(chalk.green("✓ Workspace updated successfully!"));
      console.log();
      if (createdFiles.length > 0) {
        console.log(`Updated ${chalk.bold(createdFiles.length)} files:`);
        for (const file of createdFiles) {
          console.log(chalk.gray(`  ${file}`));
        }
      } else {
        console.log(
          chalk.gray("No files were updated (all files already exist).")
        );
      }
    }
  );
}

/**
 * Register the update command
 */
export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update Viben CLI or workspace components")
    .argument(
      "[target-dir]",
      "Target directory for workspace updates (default: current directory)",
      "."
    )
    .option("-c, --check", "Check for updates without installing")
    .option("--idea-types", "Update idea-types templates in docs/idea-types/")
    .option(
      "--reward-types",
      "Update reward-types templates in docs/reward-types/"
    )
    .option("-f, --force", "Force overwrite existing files")
    .option("-s, --skip-existing", "Skip existing files without error")
    .action(async (targetDir: string, options: UpdateOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        // Check if workspace update options are specified
        const hasWorkspaceOptions = options.ideaTypes || options.rewardTypes;

        if (hasWorkspaceOptions) {
          // Handle workspace component updates
          await handleWorkspaceUpdate(ctx, targetDir, options);
        } else {
          // Handle CLI self-update
          await handleSelfUpdate(ctx, options.check ?? false);
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
