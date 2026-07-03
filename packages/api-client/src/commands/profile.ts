/**
 * viben profile — User profile commands
 */
import type { Command } from "commander";
import { createAuthenticatedClient } from "../client-factory";
import { readToken } from "../utils/token";
import { getWebUrl } from "../utils/config";
import { VibenClient } from "../client";

export function registerProfileCommand(program: Command): void {
  const profileCmd = program.command("profile").description("Manage your Viben Web profile");

  // viben profile
  profileCmd
    .command("show")
    .description("Show your profile")
    .action(async () => {
      const client = await createAuthenticatedClient();
      if (!client) { console.error("Not logged in."); process.exit(1); }
      const { user } = await client.user.me();
      console.log(`Username:     ${user.username}`);
      console.log(`Display Name: ${user.displayName}`);
      console.log(`Email:        ${user.email}`);
      if (user.bio) console.log(`Bio:          ${user.bio}`);
      if (user.githubUsername) console.log(`GitHub:       ${user.githubUsername}`);
    });

  // viben profile update
  profileCmd
    .command("update")
    .description("Update your profile")
    .option("--display-name <name>", "Display name")
    .option("--bio <bio>", "Bio")
    .option("--website <url>", "Website URL")
    .action(async (options: { displayName?: string; bio?: string; website?: string }) => {
      const client = await createAuthenticatedClient();
      if (!client) { console.error("Not logged in."); process.exit(1); }
      await client.user.update({
        displayName: options.displayName,
        bio: options.bio,
        websiteUrl: options.website,
      });
      console.log("✓ Profile updated.");
    });

  // viben profile view <username>
  profileCmd
    .command("view")
    .description("View a user's public profile")
    .argument("<username>", "Username to view")
    .action(async (username: string) => {
      const token = await readToken();
      const client = new VibenClient({ baseUrl: getWebUrl(), apiKey: token || undefined });
      try {
        const { user } = await client.user.profile(username);
        console.log(`Username:     ${user.username}`);
        console.log(`Display Name: ${user.displayName}`);
        if (user.bio) console.log(`Bio:          ${user.bio}`);
        if (user.githubUsername) console.log(`GitHub:       ${user.githubUsername}`);
      } catch {
        console.error(`User "${username}" not found.`);
        process.exit(1);
      }
    });

  // Default: show profile
  profileCmd.action(async () => {
    const client = await createAuthenticatedClient();
    if (!client) { console.error("Not logged in."); process.exit(1); }
    const { user } = await client.user.me();
    console.log(`Username:     ${user.username}`);
    console.log(`Display Name: ${user.displayName}`);
    console.log(`Email:        ${user.email}`);
  });
}
