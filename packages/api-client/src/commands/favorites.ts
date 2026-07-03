/**
 * viben favorites — List favorites
 */
import type { Command } from "commander";
import { createAuthenticatedClient } from "../client-factory";

export function registerFavoritesCommand(program: Command): void {
  program
    .command("favorites")
    .description("List your Viben Web favorites")
    .action(async () => {
      const client = await createAuthenticatedClient();
      if (!client) { console.error("Not logged in."); process.exit(1); }
      const { favorites } = await client.user.favorites();
      if (favorites.length === 0) {
        console.log("No favorites yet.");
        return;
      }
      for (const fav of favorites) {
        console.log(`  [${fav.entityType}] ${fav.entityId}`);
      }
    });
}
