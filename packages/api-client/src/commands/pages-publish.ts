/**
 * viben page — Page publishing commands (web platform subset)
 *
 * Adds web platform publishing subcommands to the page command group.
 */
import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { createClient } from "../client-factory";
import { readToken } from "../utils/token";

export function registerPagesPublishCommand(program: Command): void {
  const pageCmd = program.command("page").description("Manage workspace pages");

  // viben page publish — publish a static page to the web
  pageCmd
    .command("publish")
    .description("Publish a page to Viben Web")
    .option("--uid <uid>", "Page UID (required)")
    .option("--title <title>", "Page title (required)")
    .option("--html <path>", "HTML file path")
    .option("--description <desc>", "Page description")
    .action(async (options: { uid?: string; title?: string; html?: string; description?: string }) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in. Run: viben auth login"); process.exit(1); }

      if (!options.uid) { console.error("--uid is required"); process.exit(1); }
      if (!options.title) { console.error("--title is required"); process.exit(1); }

      let html = "";
      if (options.html) {
        html = readFileSync(options.html, "utf-8");
      } else {
        // Try reading from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        html = Buffer.concat(chunks).toString("utf-8");
      }

      if (!html) { console.error("No HTML content provided."); process.exit(1); }

      const client = createClient({ apiKey: token });
      console.log("Publishing...");
      const result = await client.pages.publish({
        uid: options.uid,
        title: options.title,
        description: options.description || null,
        html,
      });

      if (result.success) {
        console.log(`✓ Published: ${result.url}`);
      } else {
        console.error("Publish failed.");
        process.exit(1);
      }
    });

  // viben page publish-status <uid>
  pageCmd
    .command("publish-status")
    .description("Check if a page is published")
    .option("--uid <uid>", "Page UID")
    .option("--user-slug <slug>", "Your user slug")
    .action(async (options: { uid?: string; userSlug?: string }) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      if (!options.uid || !options.userSlug) {
        console.error("--uid and --user-slug are required");
        process.exit(1);
      }

      const client = createClient({ apiKey: token });
      const result = await client.pages.publishStatus(options.userSlug, options.uid);
      console.log(result.published ? `✓ Published: ${result.url}` : "Not published.");
    });

  // viben page publish-history <uid>
  pageCmd
    .command("publish-history")
    .description("View publish history for a page")
    .option("--uid <uid>", "Page UID")
    .action(async (options: { uid?: string }) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      if (!options.uid) { console.error("--uid is required"); process.exit(1); }

      const client = createClient({ apiKey: token });
      const { history } = await client.pages.publishHistory(options.uid);
      if (history.length === 0) {
        console.log("No publish history.");
        return;
      }
      for (const item of history) {
        console.log(`  v${item.version} — ${item.title} — ${item.published_at}`);
      }
    });

  // viben page publish-rollback <uid> <version>
  pageCmd
    .command("publish-rollback")
    .description("Rollback a published page")
    .option("--uid <uid>", "Page UID")
    .option("--version <v>", "Version number")
    .action(async (options: { uid?: string; version?: string }) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      if (!options.uid || !options.version) {
        console.error("--uid and --version are required");
        process.exit(1);
      }

      const client = createClient({ apiKey: token });
      await client.pages.publishRollback(options.uid, Number(options.version));
      console.log("✓ Rolled back.");
    });
}
