/**
 * viben mcp-market — MCP Marketplace commands
 */
import type { Command } from "commander";
import { createClient } from "../client-factory";
import { readToken } from "../utils/token";

export function registerMcpMarketCommand(program: Command): void {
  const marketCmd = program.command("mcp-market").description("Browse MCP packages on Viben Web");

  // viben mcp-market list
  marketCmd
    .command("list")
    .description("List MCP packages")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Items per page")
    .option("--sort <sort>", "Sort by: latest, popular, downloads")
    .option("--category <cat>", "Filter by category")
    .action(async (options: Record<string, string>) => {
      const client = createClient();
      const result = await client.mcp.list({
        page: options.page ? Number(options.page) : undefined,
        limit: options.limit ? Number(options.limit) : undefined,
        sort: options.sort as "latest" | "popular" | "downloads" | undefined,
        category: options.category,
      });
      for (const pkg of result.data) {
        console.log(`  ${pkg.name} (${pkg.slug}) — ${pkg.description?.slice(0, 80) || ""} — ☆${pkg.ratingAvg}`);
      }
      console.log(`\nPage ${result.pagination.page}/${result.pagination.totalPages} — ${result.pagination.total} total`);
    });

  // viben mcp-market search <query>
  marketCmd
    .command("search")
    .description("Search MCP packages")
    .argument("<query>", "Search query")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Items per page")
    .action(async (query: string, options: Record<string, string>) => {
      const client = createClient();
      const result = await client.mcp.search(query, {
        page: options.page ? Number(options.page) : undefined,
        limit: options.limit ? Number(options.limit) : undefined,
      });
      for (const pkg of result.data) {
        console.log(`  ${pkg.name} — ${pkg.description?.slice(0, 80) || ""}`);
      }
      console.log(`\n${result.pagination.total} results for "${query}"`);
    });

  // viben mcp-market view <id>
  marketCmd
    .command("view")
    .description("View MCP package details")
    .argument("<id>", "Package ID or slug")
    .action(async (id: string) => {
      const client = createClient();
      const { package: pkg } = await client.mcp.get(id);
      console.log(`Name:        ${pkg.name}`);
      console.log(`Slug:        ${pkg.slug}`);
      console.log(`Version:     ${pkg.version}`);
      console.log(`Description: ${pkg.description}`);
      if (pkg.longDescription) console.log(`\n${pkg.longDescription}`);
      console.log(`\nAuthor:      ${pkg.author?.displayName || "Unknown"}`);
      console.log(`Downloads:   ${pkg.downloadsCount}`);
      console.log(`Rating:      ${pkg.ratingAvg} / 5 (${pkg.ratingCount || 0} ratings)`);
      console.log(`Favorites:   ${pkg.favoritesCount}`);
      if (pkg.tags?.length) console.log(`Tags:        ${pkg.tags.join(", ")}`);
    });

  // viben mcp-market download <id>
  marketCmd
    .command("download")
    .description("Download MCP package")
    .argument("<id>", "Package ID or slug")
    .option("--output <path>", "Output file path")
    .action(async (id: string, options: { output?: string }) => {
      const client = createClient();
      console.log(`Downloading ${id}...`);
      const blob = await client.mcp.download(id);
      const outputPath = options.output || `${id}.tar.gz`;
      const { writeFileSync } = await import("node:fs");
      const arrayBuffer = await blob.arrayBuffer();
      writeFileSync(outputPath, Buffer.from(arrayBuffer));
      console.log(`✓ Downloaded to ${outputPath}`);
    });

  // viben mcp-market favorite <id>
  marketCmd
    .command("favorite")
    .description("Toggle favorite on an MCP package")
    .argument("<id>", "Package ID")
    .action(async (id: string) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      const client = createClient({ apiKey: token });
      const result = await client.mcp.toggleFavorite(id);
      console.log(result.favorited ? "✓ Favorited." : "✓ Unfavorited.");
    });

  // viben mcp-market rate <id> <score>
  marketCmd
    .command("rate")
    .description("Rate an MCP package (1-5)")
    .argument("<id>", "Package ID")
    .argument("<score>", "Rating (1-5)")
    .action(async (id: string, score: string) => {
      const s = Number(score);
      if (s < 1 || s > 5) { console.error("Score must be 1-5."); process.exit(1); }
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      const client = createClient({ apiKey: token });
      await client.mcp.rate(id, s);
      console.log("✓ Rated.");
    });

  // viben mcp-market comments <id>
  marketCmd
    .command("comments")
    .description("View comments on an MCP package")
    .argument("<id>", "Package ID")
    .action(async (id: string) => {
      const client = createClient();
      const { comments } = await client.mcp.comments(id);
      if (comments.length === 0) {
        console.log("No comments yet.");
        return;
      }
      for (const c of comments) {
        console.log(`  ${c.user?.displayName || c.userId} — ${c.createdAt}`);
        console.log(`  ${c.content}`);
        console.log();
      }
    });

  // viben mcp-market comment <id> <text>
  marketCmd
    .command("comment")
    .description("Add a comment to an MCP package")
    .argument("<id>", "Package ID")
    .argument("<text>", "Comment text")
    .option("--parent <id>", "Parent comment ID (for replies)")
    .action(async (id: string, text: string, options: { parent?: string }) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      const client = createClient({ apiKey: token });
      await client.mcp.addComment(id, text, options.parent);
      console.log("✓ Comment added.");
    });
}
