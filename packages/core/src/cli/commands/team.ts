/**
 * viben team - Team and workspace initialization commands
 *
 * Subcommands:
 * - init: Initialize a Viben team workspace with AI-assisted development workflow
 */
import chalk from "chalk";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  handleCommandError,
} from "../lib";
import { initTeam, type ProjectType, type ExecutorType } from "../../team";

/**
 * Executor type mapping from CLI flag to internal type
 */
const EXECUTOR_MAP: Record<string, ExecutorType> = {
  CURSOR: "cursor",
  CLAUDE_CODE: "claude",
  CLAUDE: "claude",
  IFLOW: "iflow",
  OPENCODE: "opencode",
  CODEX: "codex",
  KILO: "kilo",
  KIRO: "kiro",
  GEMINI: "gemini",
  ANTIGRAVITY: "antigravity",
};

/**
 * Detect developer name from git config
 */
function detectDeveloperName(cwd: string): string | undefined {
  const isGitRepo = existsSync(join(cwd, ".git"));
  if (!isGitRepo) return undefined;

  try {
    return execSync("git config user.name", {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Register the team command
 */
export function registerTeamCommand(program: Command): void {
  const teamCmd = program
    .command("team")
    .description("Team and workspace initialization");

  // team init
  teamCmd
    .command("init")
    .description("Initialize a Viben team workspace with AI-assisted development workflow")
    .argument("[target-dir]", "Target directory (default: current directory)", ".")
    // General options
    .option("-y, --yes", "Skip prompts and use defaults")
    .option("-u, --user <name>", "Developer name (auto-detected from git if not provided)")
    .option("-f, --force", "Force overwrite existing files")
    .option("-s, --skip-existing", "Skip existing files without error")
    // Executor selection
    .option("--executor <type>", "AI executor to configure: CURSOR, CLAUDE_CODE, IFLOW, OPENCODE, CODEX, KILO, KIRO, GEMINI, ANTIGRAVITY")
    .option("--cursor", "Include Cursor configuration")
    .option("--claude", "Include Claude Code configuration")
    .option("--iflow", "Include iFlow CLI configuration")
    .option("--opencode", "Include OpenCode configuration")
    .option("--codex", "Include Codex skills")
    .option("--kilo", "Include Kilo CLI configuration")
    .option("--kiro", "Include Kiro Code skills")
    .option("--gemini", "Include Gemini CLI configuration")
    .option("--antigravity", "Include Antigravity workflows")
    .action(async (targetDir: string, options: {
      yes?: boolean;
      user?: string;
      force?: boolean;
      skipExisting?: boolean;
      executor?: string;
      cursor?: boolean;
      claude?: boolean;
      iflow?: boolean;
      opencode?: boolean;
      codex?: boolean;
      kilo?: boolean;
      kiro?: boolean;
      gemini?: boolean;
      antigravity?: boolean;
    }) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        const resolvedDir = resolve(targetDir);

        // Determine developer name
        let developerName = options.user;
        if (!developerName) {
          developerName = detectDeveloperName(resolvedDir);
        }

        // In non-interactive mode (-y), require user name or git detection
        if (!developerName && options.yes) {
          output(
            ctx,
            errorResponse("MISSING_USER_NAME", "Developer name required. Use --user <name> or configure git user.name"),
            () => {
              console.log(chalk.red("Error: Developer name is required in non-interactive mode."));
              console.log();
              console.log("Options:");
              console.log(chalk.cyan("  viben team init -y --user <name>"));
              console.log(chalk.cyan("  git config user.name \"Your Name\""));
            }
          );
          process.exit(1);
        }

        // If still no name and not in yes mode, we could prompt, but for now require it
        if (!developerName) {
          output(
            ctx,
            errorResponse("MISSING_USER_NAME", "Developer name is required. Use --user <name>"),
            () => {
              console.log(chalk.red("Error: Developer name is required."));
              console.log();
              console.log("Usage:");
              console.log(chalk.cyan("  viben team init --user <name> [target-dir]"));
              console.log(chalk.cyan("  viben team init -y --user <name>  # Non-interactive mode"));
              console.log();
              console.log("Example:");
              console.log(chalk.gray("  viben team init --user john-doe ./my-project"));
            }
          );
          process.exit(1);
        }

        // Determine which executors to configure
        const executors: ExecutorType[] = [];

        // Check --executor flag
        if (options.executor) {
          const executorKey = options.executor.toUpperCase();
          if (EXECUTOR_MAP[executorKey]) {
            executors.push(EXECUTOR_MAP[executorKey]);
          } else {
            output(
              ctx,
              errorResponse("INVALID_EXECUTOR", `Invalid executor: ${options.executor}`),
              () => {
                console.log(chalk.red(`Error: Invalid executor "${options.executor}".`));
                console.log();
                console.log("Valid executors:");
                console.log(chalk.gray("  CURSOR, CLAUDE_CODE, IFLOW, OPENCODE, CODEX, KILO, KIRO, GEMINI, ANTIGRAVITY"));
              }
            );
            process.exit(1);
          }
        }

        // Check individual executor flags
        if (options.cursor) executors.push("cursor");
        if (options.claude) executors.push("claude");
        if (options.iflow) executors.push("iflow");
        if (options.opencode) executors.push("opencode");
        if (options.codex) executors.push("codex");
        if (options.kilo) executors.push("kilo");
        if (options.kiro) executors.push("kiro");
        if (options.gemini) executors.push("gemini");
        if (options.antigravity) executors.push("antigravity");

        // Default: Cursor + Claude if no explicit selection and -y mode
        if (executors.length === 0 && options.yes) {
          executors.push("cursor", "claude");
        }

        // Default: Cursor + Claude if no explicit selection
        if (executors.length === 0) {
          executors.push("cursor", "claude");
        }

        // Deduplicate
        const uniqueExecutors = [...new Set(executors)];

        if (!ctx.quiet) {
          console.log(chalk.cyan("Initializing Viben team workspace..."));
          console.log(chalk.gray(`  Target: ${resolvedDir}`));
          console.log(chalk.gray(`  Developer: ${developerName}`));
          console.log(chalk.gray(`  Executors: ${uniqueExecutors.join(", ")}`));
          console.log();
        }

        const result = await initTeam({
          targetDir: resolvedDir,
          developerName,
          force: options.force,
          skipExisting: options.skipExisting,
          executors: uniqueExecutors,
        });

        output(
          ctx,
          successResponse({
            path: result.path,
            files: result.files,
            count: result.files.length,
            warnings: result.warnings,
          }),
          () => {
            console.log(chalk.green("✓ Workspace initialized successfully!"));
            console.log();
            console.log(`Created ${chalk.bold(result.files.length)} files:`);
            console.log(chalk.gray("  .viben/     - Workflow files, scripts, specs"));

            if (uniqueExecutors.includes("claude")) {
              console.log(chalk.gray("  .claude/    - Claude Code configuration"));
            }
            if (uniqueExecutors.includes("cursor")) {
              console.log(chalk.gray("  .cursor/    - Cursor IDE configuration"));
            }
            if (uniqueExecutors.includes("iflow")) {
              console.log(chalk.gray("  .iflow/     - iFlow CLI configuration"));
            }
            if (uniqueExecutors.includes("opencode")) {
              console.log(chalk.gray("  .opencode/  - OpenCode configuration"));
            }
            if (uniqueExecutors.includes("codex")) {
              console.log(chalk.gray("  .agents/skills/ - Codex skills"));
            }
            if (uniqueExecutors.includes("kilo")) {
              console.log(chalk.gray("  .kilocode/  - Kilo CLI configuration"));
            }
            if (uniqueExecutors.includes("kiro")) {
              console.log(chalk.gray("  .kiro/skills/ - Kiro Code skills"));
            }
            if (uniqueExecutors.includes("gemini")) {
              console.log(chalk.gray("  .gemini/    - Gemini CLI configuration"));
            }
            if (uniqueExecutors.includes("antigravity")) {
              console.log(chalk.gray("  .agent/workflows/ - Antigravity workflows"));
            }

            console.log(chalk.gray("  AGENTS.md   - Root instructions file"));

            if (result.warnings && result.warnings.length > 0) {
              console.log();
              console.log(chalk.yellow("Warnings:"));
              for (const warning of result.warnings) {
                console.log(chalk.yellow(`  ⚠ ${warning}`));
              }
            }

            console.log();
            console.log("Next steps:");
            console.log(chalk.cyan("  1. Review and customize .viben/spec/ guidelines"));
            console.log(chalk.cyan("  2. Run python3 ./.viben/scripts/get_context.py to verify setup"));
            console.log(chalk.cyan("  3. Start developing with AI assistance!"));
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
