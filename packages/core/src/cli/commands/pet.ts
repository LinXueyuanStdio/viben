// packages/core/src/cli/commands/pet.ts
import type { Command } from "commander";
import chalk from "chalk";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  outputSuccess,
  handleCommandError,
} from "../lib";
import { petManager, PetError } from "../../pet";

function getContext(cmd: Command): OutputContext {
  const opts = cmd.optsWithGlobals();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

export function registerPetCommand(program: Command): void {
  const pet = program.command("pet").description("Manage pets");

  // pet list (alias: ls)
  pet
    .command("list")
    .alias("ls")
    .description("List all pets (builtin + installed)")
    .action(async function (this: Command) {
      const ctx = getContext(this);
      try {
        const [pets, config] = await Promise.all([
          petManager.listPets(),
          petManager.getConfig(),
        ]);

        output(ctx, successResponse({ pets, current: config.current }), () => {
          if (pets.length === 0) {
            console.log(chalk.gray("No pets installed"));
            return;
          }
          outputTable(
            ctx,
            ["ID", "Name", "Source", "Current"],
            pets.map((p) => [
              p.id,
              p.metadata.displayName,
              p.isBuiltin ? "builtin" : p.metadata.source ?? "local",
              config.current === p.id ? chalk.green("*") : "",
            ]),
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet show <id>
  pet
    .command("show <id>")
    .description("Show pet details")
    .action(async function (this: Command, id: string) {
      const ctx = getContext(this);
      try {
        const p = await petManager.getPet(id);
        if (!p) {
          throw new PetError(`Pet "${id}" not found`, "PET_NOT_FOUND");
        }

        output(ctx, successResponse({ pet: p }), () => {
          console.log(chalk.bold(`Pet: ${p.metadata.displayName}`));
          outputKeyValue(ctx, {
            ID: p.id,
            Description: p.metadata.description,
            Author: p.metadata.author ?? "-",
            Tags: p.metadata.tags?.join(", ") ?? "-",
            Builtin: p.isBuiltin ? "Yes" : "No",
            Path: p.localPath,
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet set <id>
  pet
    .command("set <id>")
    .description("Set current pet")
    .action(async function (this: Command, id: string) {
      const ctx = getContext(this);
      try {
        await petManager.setCurrent(id);
        output(ctx, successResponse({ current: id }), () => {
          outputSuccess(ctx, `Set current pet to "${id}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet remove <id> (alias: rm)
  pet
    .command("remove <id>")
    .alias("rm")
    .description("Remove an installed pet")
    .option("-y, --yes", "Skip confirmation")
    .action(async function (this: Command, id: string, options: { yes?: boolean }) {
      const ctx = getContext(this);
      try {
        if (!options.yes) {
          const readline = await import("node:readline");
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          const answer = await new Promise<string>((resolve) => {
            rl.question(`Are you sure you want to remove "${id}"? [y/N] `, resolve);
          });
          rl.close();
          if (answer.toLowerCase() !== "y") {
            console.log(chalk.gray("Cancelled"));
            return;
          }
        }

        await petManager.removePet(id);
        output(ctx, successResponse({ removed: id }), () => {
          outputSuccess(ctx, `Removed pet "${id}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet import <path>
  pet
    .command("import <path>")
    .description("Import pet from local zip file")
    .action(async function (this: Command, zipPath: string) {
      const ctx = getContext(this);
      try {
        const pet = await petManager.importPet(zipPath);
        output(ctx, successResponse({ pet }), () => {
          outputSuccess(ctx, `Imported pet "${pet.metadata.displayName}" (${pet.id})`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet export <id>
  pet
    .command("export <id>")
    .description("Export pet to zip file")
    .option("-o, --output <path>", "Output path")
    .action(async function (this: Command, id: string, options: { output?: string }) {
      const ctx = getContext(this);
      try {
        const outPath = options.output ?? `./${id}.zip`;
        const path = await petManager.exportPet(id, outPath);
        output(ctx, successResponse({ path }), () => {
          outputSuccess(ctx, `Exported pet to "${path}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet community
  pet
    .command("community")
    .description("List community pets")
    .option("-s, --source <source>", "Filter by source")
    .action(async function (this: Command, options: { source?: string }) {
      const ctx = getContext(this);
      try {
        const pets = await petManager.listCommunityPets(options.source);
        output(ctx, successResponse({ pets }), () => {
          if (pets.length === 0) {
            console.log(chalk.gray("No community pets found"));
            return;
          }
          outputTable(
            ctx,
            ["ID", "Name", "Author", "Source"],
            pets.map((p) => [p.id, p.displayName, p.author ?? "-", p.source]),
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet search <query>
  pet
    .command("search <query>")
    .description("Search community pets")
    .action(async function (this: Command, query: string) {
      const ctx = getContext(this);
      try {
        const pets = await petManager.searchCommunityPets(query);
        output(ctx, successResponse({ pets }), () => {
          if (pets.length === 0) {
            console.log(chalk.gray(`No pets found matching "${query}"`));
            return;
          }
          outputTable(
            ctx,
            ["ID", "Name", "Author", "Source"],
            pets.map((p) => [p.id, p.displayName, p.author ?? "-", p.source]),
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet preview <id>
  pet
    .command("preview <id>")
    .description("Preview community pet info")
    .option("-s, --source <source>", "Specify source")
    .action(async function (this: Command, id: string, options: { source?: string }) {
      const ctx = getContext(this);
      try {
        const pet = await petManager.previewPet(id, options.source);
        if (!pet) {
          throw new PetError(`Pet "${id}" not found`, "PET_NOT_FOUND");
        }
        output(ctx, successResponse({ pet }), () => {
          console.log(chalk.bold(`Pet: ${pet.displayName}`));
          outputKeyValue(ctx, {
            ID: pet.id,
            Description: pet.description,
            Author: pet.author ?? "-",
            Tags: pet.tags?.join(", ") ?? "-",
            Source: pet.source,
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet install <id>
  pet
    .command("install <id>")
    .description("Install community pet")
    .option("-s, --source <source>", "Specify source", "codex-pet-share")
    .action(async function (this: Command, id: string, options: { source: string }) {
      const ctx = getContext(this);
      try {
        const pet = await petManager.installPet(id, options.source);
        output(ctx, successResponse({ pet }), () => {
          outputSuccess(ctx, `Installed pet "${pet.metadata.displayName}" (${pet.id})`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet sources (subcommand group)
  const sources = pet.command("sources").description("Manage pet sources");

  // pet sources list
  sources
    .command("list")
    .description("List all sources")
    .action(async function (this: Command) {
      const ctx = getContext(this);
      try {
        const sourceList = await petManager.listSources();
        output(ctx, successResponse({ sources: sourceList }), () => {
          if (sourceList.length === 0) {
            console.log(chalk.gray("No sources configured"));
            return;
          }
          outputTable(
            ctx,
            ["Name", "URL", "Enabled", "Builtin"],
            sourceList.map((s) => [
              s.name,
              s.url.length > 40 ? s.url.substring(0, 37) + "..." : s.url,
              s.enabled ? chalk.green("Yes") : chalk.red("No"),
              s.builtin ? "Yes" : "No",
            ]),
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet sources add
  sources
    .command("add")
    .description("Add a new source")
    .requiredOption("-n, --name <name>", "Source name")
    .requiredOption("-u, --url <url>", "Source URL (must be HTTPS)")
    .action(async function (this: Command, options: { name: string; url: string }) {
      const ctx = getContext(this);
      try {
        const source = await petManager.addSource(options.name, options.url);
        output(ctx, successResponse({ source }), () => {
          outputSuccess(ctx, `Added source "${source.name}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // pet sources remove <name>
  sources
    .command("remove <name>")
    .description("Remove a source")
    .action(async function (this: Command, name: string) {
      const ctx = getContext(this);
      try {
        await petManager.removeSource(name);
        output(ctx, successResponse({ removed: name }), () => {
          outputSuccess(ctx, `Removed source "${name}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
