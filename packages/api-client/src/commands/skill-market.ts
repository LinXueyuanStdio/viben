/**
 * viben skill-market — Skill Marketplace commands
 */
import type { Command } from "commander";
import { createClient } from "../client-factory";
import { readToken } from "../utils/token";

export function registerSkillMarketCommand(program: Command): void {
  const marketCmd = program.command("skill-market").description("Browse Skill packages on Viben Web");

  marketCmd
    .command("list")
    .description("List skill packages")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Items per page")
    .option("--sort <sort>", "Sort: latest, popular, downloads")
    .option("--category <cat>", "Filter by category")
    .option("--type <type>", "Filter: command, prompt, agent")
    .action(async (options: Record<string, string>) => {
      const client = createClient();
      const result = await client.skill.list({
        page: options.page ? Number(options.page) : undefined,
        limit: options.limit ? Number(options.limit) : undefined,
        sort: options.sort as "latest" | "popular" | "downloads" | undefined,
        category: options.category,
        type: options.type as "command" | "prompt" | "agent" | undefined,
      });
      for (const pkg of result.data) {
        console.log(`  ${pkg.name} [${pkg.skillType}] — ${pkg.description?.slice(0, 80) || ""} — ☆${pkg.ratingAvg}`);
      }
      console.log(`\nPage ${result.pagination.page}/${result.pagination.totalPages} — ${result.pagination.total} total`);
    });

  marketCmd
    .command("search")
    .description("Search skill packages")
    .argument("<query>", "Search query")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Items per page")
    .action(async (query: string, options: Record<string, string>) => {
      const client = createClient();
      const result = await client.skill.search(query, {
        page: options.page ? Number(options.page) : undefined,
        limit: options.limit ? Number(options.limit) : undefined,
      });
      for (const pkg of result.data) {
        console.log(`  ${pkg.name} [${pkg.skillType}] — ${pkg.description?.slice(0, 80) || ""}`);
      }
      console.log(`\n${result.pagination.total} results for "${query}"`);
    });

  marketCmd
    .command("view")
    .description("View skill package details")
    .argument("<id>", "Package ID or slug")
    .action(async (id: string) => {
      const client = createClient();
      const { package: pkg } = await client.skill.get(id);
      console.log(`Name:        ${pkg.name}`);
      console.log(`Type:        ${pkg.skillType}`);
      console.log(`Version:     ${pkg.version}`);
      console.log(`Description: ${pkg.description}`);
      if (pkg.longDescription) console.log(`\n${pkg.longDescription}`);
      console.log(`\nAuthor:      ${pkg.author?.displayName || "Unknown"}`);
      console.log(`Downloads:   ${pkg.downloadsCount}`);
      console.log(`Rating:      ${pkg.ratingAvg} / 5`);
      if (pkg.triggerPatterns?.length) console.log(`Triggers:    ${pkg.triggerPatterns.join(", ")}`);
    });

  marketCmd
    .command("download")
    .description("Download skill package")
    .argument("<id>", "Package ID or slug")
    .option("--output <path>", "Output file path")
    .action(async (id: string, options: { output?: string }) => {
      const client = createClient();
      console.log(`Downloading ${id}...`);
      const blob = await client.skill.download(id);
      const outputPath = options.output || `${id}.tar.gz`;
      const { writeFileSync } = await import("node:fs");
      writeFileSync(outputPath, Buffer.from(await blob.arrayBuffer()));
      console.log(`✓ Downloaded to ${outputPath}`);
    });

  marketCmd
    .command("favorite")
    .description("Toggle favorite on a skill package")
    .argument("<id>", "Package ID")
    .action(async (id: string) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      const result = await createClient({ apiKey: token }).skill.toggleFavorite(id);
      console.log(result.favorited ? "✓ Favorited." : "✓ Unfavorited.");
    });

  marketCmd
    .command("rate")
    .description("Rate a skill package (1-5)")
    .argument("<id>", "Package ID")
    .argument("<score>", "Rating (1-5)")
    .action(async (id: string, score: string) => {
      const s = Number(score);
      if (s < 1 || s > 5) { console.error("Score must be 1-5."); process.exit(1); }
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      await createClient({ apiKey: token }).skill.rate(id, s);
      console.log("✓ Rated.");
    });

  marketCmd
    .command("comments")
    .description("View comments on a skill package")
    .argument("<id>", "Package ID")
    .action(async (id: string) => {
      const { comments } = await createClient().skill.comments(id);
      if (comments.length === 0) { console.log("No comments yet."); return; }
      for (const c of comments) {
        console.log(`  ${c.user?.displayName || c.userId} — ${c.createdAt}`);
        console.log(`  ${c.content}\n`);
      }
    });

  marketCmd
    .command("comment")
    .description("Add a comment to a skill package")
    .argument("<id>", "Package ID")
    .argument("<text>", "Comment text")
    .option("--parent <id>", "Parent comment ID")
    .action(async (id: string, text: string, options: { parent?: string }) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      await createClient({ apiKey: token }).skill.addComment(id, text, options.parent);
      console.log("✓ Comment added.");
    });
}
