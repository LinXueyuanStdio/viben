/**
 * viben auth — Authentication commands
 *
 * Subcommands: login, logout, whoami, status, register
 * Migrated from packages/core and refactored to use VibenClient directly.
 */
import { createInterface } from "node:readline";
import type { Command } from "commander";
import { VibenClient, ApiError } from "../client";
import { createClient } from "../client-factory";
import { readToken, writeToken, deleteToken, validateTokenFormat } from "../utils/token";
import { getWebUrl } from "../utils/config";

const TOKEN_URL = `${getWebUrl()}/settings/api_keys`;

async function promptInput(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function promptConfirm(prompt: string): Promise<boolean> {
  const answer = await promptInput(`${prompt} (y/N) `);
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

async function openBrowser(url: string): Promise<boolean> {
  try {
    const open = await import("open");
    await open.default(url);
    return true;
  } catch {
    return false;
  }
}

export function registerAuthCommand(program: Command): void {
  const authCmd = program.command("auth").description("Authenticate with Viben Web");

  // viben auth login
  authCmd
    .command("login")
    .description("Log in to Viben Web with an API token")
    .option("--token <token>", "API token (non-interactive)")
    .option("--no-browser", "Don't open browser automatically")
    .option("-f, --force", "Overwrite existing token without confirmation")
    .action(async (options: { token?: string; browser?: boolean; force?: boolean }) => {
      try {
        const existingToken = await readToken();
        if (existingToken && !options.force && !options.token) {
          try {
            const client = createClient({ apiKey: existingToken });
            const { user } = await client.user.me();
            console.log(`You are already logged in as ${user.username}.`);
            if (!(await promptConfirm("Overwrite existing token?"))) return;
          } catch {
            // token invalid, proceed
          }
        }

        let token = options.token;
        if (!token) {
          if (options.browser !== false) {
            const opened = await openBrowser(TOKEN_URL);
            if (opened) {
              console.log(`Opening ${TOKEN_URL} in your browser...`);
            } else {
              console.log(`Could not open browser. Please visit:`);
              console.log(`  ${TOKEN_URL}`);
            }
            console.log();
          } else {
            console.log(`Get your token from: ${TOKEN_URL}`);
            console.log();
          }
          token = await promptInput("? Enter your token: ");
        }

        if (!token) {
          console.error("No token provided");
          process.exit(1);
        }

        if (!validateTokenFormat(token)) {
          console.error('Invalid token format. Token should start with "bmcp_"');
          process.exit(1);
        }

        console.log("Validating token...");
        try {
          const client = new VibenClient({ baseUrl: getWebUrl(), apiKey: token });
          const { user } = await client.user.me();
          await writeToken(token);
          console.log(`✓ Logged in as ${user.username} (${user.email})`);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            console.error("Invalid or expired token.");
          } else {
            console.error(String(error));
          }
          process.exit(1);
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // viben auth logout
  authCmd
    .command("logout")
    .description("Log out from Viben Web")
    .action(async () => {
      const token = await readToken();
      if (!token) {
        console.log("Not logged in.");
        return;
      }
      await deleteToken();
      console.log("✓ Logged out successfully.");
    });

  // viben auth whoami
  authCmd
    .command("whoami")
    .description("Show current logged-in user")
    .action(async () => {
      const token = await readToken();
      if (!token) {
        console.error('Not logged in. Run "viben auth login" first.');
        process.exit(1);
      }

      try {
        const client = new VibenClient({ baseUrl: getWebUrl(), apiKey: token });
        const { user } = await client.user.me();
        console.log(`Logged in as ${user.username} (${user.email})`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          console.error("Token is invalid or expired. Run: viben auth login");
        } else {
          console.error(String(error));
        }
        process.exit(1);
      }
    });

  // viben auth status
  authCmd
    .command("status")
    .description("Check token validity")
    .action(async () => {
      const token = await readToken();
      if (!token) {
        console.log("Not logged in.");
        process.exit(1);
      }

      try {
        const client = new VibenClient({ baseUrl: getWebUrl(), apiKey: token });
        const { user } = await client.user.me();
        console.log(`Valid — logged in as ${user.username}`);
      } catch {
        console.log("Invalid or expired token.");
        process.exit(1);
      }
    });

  // viben auth register
  authCmd
    .command("register")
    .description("Create a new Viben Web account")
    .option("--email <email>", "Email address")
    .option("--username <username>", "Username")
    .option("--password <password>", "Password")
    .action(async (options: { email?: string; username?: string; password?: string }) => {
      try {
        const email = options.email || await promptInput("Email: ");
        const username = options.username || await promptInput("Username: ");
        const password = options.password || await promptInput("Password: ");

        const response = await fetch(`${getWebUrl()}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, password }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "Registration failed" }));
          console.error(`Registration failed: ${err.error || `HTTP ${response.status}`}`);
          process.exit(1);
        }

        const data = await response.json();
        if (data.accessToken) {
          await writeToken(data.accessToken);
          console.log(`✓ Registered and logged in as ${data.user?.username || username}`);
        } else {
          console.log("✓ Registration successful. Please log in with: viben auth login");
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
