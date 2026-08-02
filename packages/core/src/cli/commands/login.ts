/**
 * viben login/logout/whoami - Authentication commands
 */
import { createInterface } from "node:readline";
import chalk from "chalk";
import open from "open";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  handleCommandError,
  outputError,
} from "../lib";
import { VIBEN_WEB_URL } from "@viben/api-client";
import {
  readToken,
  writeToken,
  deleteToken,
  validateTokenFormat,
  verifyToken,
  AuthApiError,
} from "../../auth";

const TOKEN_URL = `${VIBEN_WEB_URL}/settings/api_keys`;

/**
 * Prompt user for input
 */
async function promptInput(prompt: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for yes/no confirmation
 */
async function promptConfirm(prompt: string): Promise<boolean> {
  const answer = await promptInput(`${prompt} (y/N) `);
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

/**
 * Try to open URL in browser
 */
async function openBrowser(url: string): Promise<boolean> {
  try {
    await open(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get output context from program options
 */
function getOutputContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Register login/logout/whoami commands
 */
export function registerLoginCommand(program: Command): void {
  // viben login
  program
    .command("login")
    .description("Log in to Viben with an API token")
    .option("--token <token>", "API token (non-interactive)")
    .option("--no-browser", "Don't open browser automatically")
    .option("-f, --force", "Overwrite existing token without confirmation")
    .action(async (options: { token?: string; browser?: boolean; force?: boolean }) => {
      const ctx = getOutputContext(program);

      try {
        // Check for existing token
        const existingToken = await readToken();
        if (existingToken && !options.force && !options.token) {
          // Verify existing token to show username
          try {
            const user = await verifyToken(existingToken);
            console.log(`You are already logged in as ${chalk.cyan(user.username)}.`);
            const overwrite = await promptConfirm("Overwrite existing token?");
            if (!overwrite) {
              return;
            }
          } catch {
            // Token is invalid, proceed with login
          }
        }

        let token = options.token;

        if (!token) {
          // Interactive mode
          if (options.browser !== false) {
            const opened = await openBrowser(TOKEN_URL);
            if (opened) {
              console.log(`Opening ${chalk.cyan(TOKEN_URL)} in your browser...`);
            } else {
              console.log(`Could not open browser. Please visit:`);
              console.log(`  ${chalk.cyan(TOKEN_URL)}`);
            }
            console.log();
          } else {
            console.log(`Get your token from: ${chalk.cyan(TOKEN_URL)}`);
            console.log();
          }

          token = await promptInput("? Enter your token: ");
        }

        if (!token) {
          outputError(ctx, "NO_TOKEN", "No token provided");
          process.exit(1);
        }

        // Validate format
        if (!validateTokenFormat(token)) {
          outputError(
            ctx,
            "INVALID_FORMAT",
            'Invalid token format. Token should start with "bmcp_"'
          );
          process.exit(1);
        }

        // Verify with server
        console.log("Validating token...");
        let user;
        try {
          user = await verifyToken(token);
        } catch (error) {
          if (error instanceof AuthApiError) {
            outputError(ctx, error.code, error.message);
          } else {
            outputError(ctx, "UNKNOWN", String(error));
          }
          process.exit(1);
        }

        // Save token
        await writeToken(token);

        output(
          ctx,
          successResponse({
            username: user.username,
            email: user.email,
            id: user.id,
          }),
          () => {
            console.log(
              chalk.green("✓") +
                ` Logged in as ${chalk.cyan(user.username)} (${user.email})`
            );
            console.log(`  Token saved to ~/.viben/token`);
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // viben logout
  program
    .command("logout")
    .description("Log out and remove saved token")
    .action(async () => {
      const ctx = getOutputContext(program);

      try {
        const existingToken = await readToken();

        if (!existingToken) {
          output(ctx, successResponse({ wasLoggedIn: false }), () => {
            console.log("Not logged in.");
          });
          return;
        }

        await deleteToken();

        output(ctx, successResponse({ wasLoggedIn: true }), () => {
          console.log(chalk.green("✓") + " Logged out successfully.");
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // viben whoami
  program
    .command("whoami")
    .description("Show current logged-in user")
    .action(async () => {
      const ctx = getOutputContext(program);

      try {
        const token = await readToken();

        if (!token) {
          if (ctx.json) {
            output(ctx, successResponse({ loggedIn: false }), () => {});
          } else {
            console.error('Not logged in. Run "viben login" first.');
            process.exit(1);
          }
          return;
        }

        // Verify token and get user info
        let user;
        try {
          user = await verifyToken(token);
        } catch (error) {
          if (error instanceof AuthApiError) {
            if (ctx.json) {
              output(
                ctx,
                successResponse({ loggedIn: false, error: error.message }),
                () => {}
              );
            } else {
              console.error(error.message);
              process.exit(1);
            }
            return;
          }
          throw error;
        }

        output(
          ctx,
          successResponse({
            loggedIn: true,
            username: user.username,
            email: user.email,
            id: user.id,
          }),
          () => {
            console.log(`${user.username} (${user.email})`);
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
