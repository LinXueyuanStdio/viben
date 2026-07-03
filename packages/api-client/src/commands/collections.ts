/**
 * viben collection — Collection management commands
 */
import type { Command } from "commander";
import { createClient } from "../client-factory";
import { readToken } from "../utils/token";

export function registerCollectionsCommand(program: Command): void {
  const colCmd = program.command("collection").description("Manage Viben Web collections");

  colCmd
    .command("list")
    .description("List your collections")
    .option("--page <n>", "Page number")
    .option("--limit <n>", "Items per page")
    .option("--type <type>", "Filter: mcp, skill")
    .action(async (options: Record<string, string>) => {
      const token = await readToken();
      const client = createClient({ apiKey: token || undefined });
      const { collections, pagination } = await client.collections.list({
        page: options.page ? Number(options.page) : undefined,
        limit: options.limit ? Number(options.limit) : undefined,
        entityType: options.type as "mcp" | "skill" | undefined,
      });
      for (const c of collections) {
        console.log(`  ${c.name} (${c.itemCount || 0} items) — ${c.entityType} — ${c.isPublic ? "public" : "private"}`);
      }
      if (collections.length === 0) console.log("No collections found.");
      console.log(`\n${pagination.total} total`);
    });

  colCmd
    .command("view")
    .description("View collection details")
    .argument("<id>", "Collection ID")
    .action(async (id: string) => {
      const token = await readToken();
      const { collection, items } = await createClient({ apiKey: token || undefined }).collections.get(id);
      console.log(`Name:    ${collection.name}`);
      console.log(`Type:    ${collection.entityType}`);
      console.log(`Public:  ${collection.isPublic}`);
      if (collection.description) console.log(`Desc:    ${collection.description}`);
      console.log(`Owner:   ${collection.owner?.displayName || collection.ownerId}`);
      console.log(`Items:   ${items.length}`);
    });

  colCmd
    .command("create")
    .description("Create a new collection")
    .argument("<name>", "Collection name")
    .option("--description <desc>", "Description")
    .option("--type <type>", "Entity type: mcp or skill", "mcp")
    .option("--public", "Make public")
    .action(async (name: string, options: Record<string, string>) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      const { collection } = await createClient({ apiKey: token }).collections.create({
        name,
        description: options.description,
        entityType: options.type as "mcp" | "skill",
        isPublic: !!options.public,
      });
      console.log(`✓ Collection created: ${collection.id}`);
    });

  colCmd
    .command("delete")
    .description("Delete a collection")
    .argument("<id>", "Collection ID")
    .option("-f, --force", "Skip confirmation")
    .action(async (id: string, options: { force?: boolean }) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      if (!options.force) {
        console.log("Use --force to confirm deletion.");
        return;
      }
      await createClient({ apiKey: token }).collections.delete(id);
      console.log("✓ Collection deleted.");
    });

  colCmd
    .command("add")
    .description("Add an item to a collection")
    .argument("<id>", "Collection ID")
    .argument("<entity-id>", "Entity ID to add")
    .option("--note <note>", "Optional note")
    .action(async (id: string, entityId: string, options: { note?: string }) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      await createClient({ apiKey: token }).collections.addItem(id, entityId, options.note);
      console.log("✓ Item added.");
    });

  colCmd
    .command("remove")
    .description("Remove an item from a collection")
    .argument("<id>", "Collection ID")
    .argument("<entity-id>", "Entity ID to remove")
    .action(async (id: string, entityId: string) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      await createClient({ apiKey: token }).collections.removeItem(id, entityId);
      console.log("✓ Item removed.");
    });

  colCmd
    .command("fork")
    .description("Fork a collection")
    .argument("<id>", "Collection ID")
    .action(async (id: string) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }
      const { collection } = await createClient({ apiKey: token }).collections.fork(id);
      console.log(`✓ Forked: ${collection.id}`);
    });
}
