/**
 * viben api-key — API key management
 */
import type { Command } from "commander";
import { createAuthenticatedClient } from "../client-factory";

export function registerApiKeyCommand(program: Command): void {
  const keyCmd = program.command("api-key").description("Manage Viben Web API keys");

  // viben api-key list
  keyCmd
    .command("list")
    .description("List your API keys")
    .action(async () => {
      const client = await createAuthenticatedClient();
      if (!client) { console.error("Not logged in."); process.exit(1); }
      const { apiKeys } = await client.user.apiKeys();
      if (apiKeys.length === 0) {
        console.log("No API keys found.");
        return;
      }
      for (const key of apiKeys) {
        console.log(`  ${key.name} (${key.keyPrefix}...) — created ${key.createdAt}`);
      }
    });

  // viben api-key create <name>
  keyCmd
    .command("create")
    .description("Create a new API key")
    .argument("<name>", "Key name")
    .option("--scopes <scopes>", "Comma-separated scopes")
    .option("--expires-in <days>", "Expiration in days")
    .action(async (name: string, options: { scopes?: string; expiresIn?: string }) => {
      const client = await createAuthenticatedClient();
      if (!client) { console.error("Not logged in."); process.exit(1); }
      const result = await client.user.createApiKey({
        name,
        scopes: options.scopes?.split(",").map((s) => s.trim()),
        expiresIn: options.expiresIn ? Number(options.expiresIn) : undefined,
      });
      console.log(`✓ API key created: ${result.apiKey.name}`);
      console.log(`  Key: ${result.key}`);
      console.log("  Save this key — it won't be shown again!");
    });

  // viben api-key delete <id>
  keyCmd
    .command("delete")
    .description("Delete an API key")
    .argument("<id>", "Key ID")
    .option("-f, --force", "Skip confirmation")
    .action(async (id: string, options: { force?: boolean }) => {
      if (!options.force) {
        console.log(`Deleting API key: ${id}`);
        const { createInterface } = await import("node:readline");
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((resolve) => {
          rl.question("Are you sure? (y/N) ", resolve);
        });
        rl.close();
        if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") return;
      }

      const client = await createAuthenticatedClient();
      if (!client) { console.error("Not logged in."); process.exit(1); }
      await client.user.deleteApiKey(id);
      console.log("✓ API key deleted.");
    });
}
