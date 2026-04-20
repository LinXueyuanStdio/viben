/**
 * CLI page command - Manage workspace pages
 *
 * Uses page/ops functions for all operations.
 */
import chalk from "chalk";
import type { Command } from "commander";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  outputSuccess,
  outputWarning,
  handleCommandError,
  getOutputContext,
} from "../lib";
import { CliError } from "../types";
import { findVibenRoot } from "../lib/viben-workspace";
import {
  listPages,
  viewPage,
  createPage,
  deletePage,
  isStaticPage,
  isServerPage,
  isProxyPage,
  PAGE_TYPES,
  listTemplatesResult,
} from "../../page/ops";
import type { PageConfig, PageTemplate } from "../../page/ops";

/**
 * Ensure we're in a Viben workspace
 */
function ensureWorkspaceRoot(cwd: string): string {
  const workspacePath = findVibenRoot(cwd);
  if (!workspacePath) {
    throw CliError.operationFailed(
      "Page command",
      `Not a Viben workspace (.viben not found). Run "viben init" first.`
    );
  }
  return workspacePath;
}

/**
 * Format page type for display
 */
function formatPageType(page: PageConfig): string {
  if (isStaticPage(page)) {
    return `static (${page.file})`;
  }
  if (isServerPage(page)) {
    return `server (${page.command})`;
  }
  if (isProxyPage(page)) {
    return `proxy (${page.url})`;
  }
  return page.type;
}

/**
 * Register the page command
 */
export function registerPageCommand(program: Command): void {
  const pageCmd = program
    .command("page")
    .description("Manage workspace pages");

  // viben page list
  pageCmd
    .command("list")
    .description("List all pages in workspace")
    .option("-t, --type <type>", "Filter by page type (static, markdown, server, proxy)")
    .action(async (options: { type?: string }) => {
      const ctx = getOutputContext(program);
      try {
        const workspacePath = ensureWorkspaceRoot(process.cwd());

        const result = await listPages({ workspace_path: workspacePath });

        if (!result.success) {
          throw new Error(result.error);
        }

        let pages = result.pages;

        // Filter by type if specified
        if (options.type) {
          if (!PAGE_TYPES.includes(options.type as typeof PAGE_TYPES[number])) {
            throw CliError.validation(
              `Invalid page type: ${options.type}. Valid types: ${PAGE_TYPES.join(", ")}`
            );
          }
          pages = pages.filter((p) => p.type === options.type);
        }

        output(
          ctx,
          successResponse({ pages, count: pages.length }),
          () => {
            if (pages.length === 0) {
              if (options.type) {
                console.log(chalk.gray(`No pages found with type "${options.type}".`));
              } else {
                console.log(chalk.gray("No pages found in workspace."));
              }
              console.log();
              console.log("Create a page with:");
              console.log(chalk.cyan("  viben page create <slug> --name \"Page Name\""));
              return;
            }

            console.log(chalk.bold("Workspace Pages:"));
            console.log();
            outputTable(
              ctx,
              ["Slug", "Name", "Type", "Permission"],
              pages.map((p) => [
                p.slug,
                p.name,
                formatPageType(p),
                p.permission.join(", "),
              ])
            );
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // viben page view <slug>
  pageCmd
    .command("view <slug>")
    .description("View page details")
    .action(async (slug: string) => {
      const ctx = getOutputContext(program);
      try {
        const workspacePath = ensureWorkspaceRoot(process.cwd());

        const result = await viewPage({
          workspace_path: workspacePath,
          slug,
        });

        if (!result.success || !result.page) {
          throw new Error(result.error || `Page not found: ${slug}`);
        }

        const page = result.page;

        output(ctx, successResponse({ page }), () => {
          console.log(chalk.bold(`Page: ${page.name}`));
          console.log();

          const details: Record<string, string | undefined> = {
            Slug: page.slug,
            Name: page.name,
            Type: page.type,
            Description: page.description,
            Permission: page.permission.join(", "),
            Path: page.path,
            Icon: page.icon ? `${page.icon.type}:${page.icon.value}` : undefined,
          };

          // Add type-specific fields
          if (isStaticPage(page)) {
            details["File"] = page.file;
          } else if (isServerPage(page)) {
            details["Command"] = page.command;
            details["Port"] = page.port?.toString();
            details["Ready Pattern"] = page.ready_pattern;
            details["Timeout"] = page.timeout?.toString();
          } else if (isProxyPage(page)) {
            details["URL"] = page.url;
          }

          outputKeyValue(ctx, details);

          // Show skill content if present
          if (page.skill_content) {
            console.log();
            console.log(chalk.bold("Content:"));
            console.log(chalk.gray("─".repeat(40)));
            console.log(page.skill_content);
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // viben page templates
  pageCmd
    .command("templates")
    .description("List available page templates")
    .action(async () => {
      const ctx = getOutputContext(program);
      try {
        // Try to get workspace path for custom templates, but it's optional
        let workspacePath: string | undefined;
        try {
          workspacePath = findVibenRoot(process.cwd()) ?? undefined;
        } catch {
          // Not in a workspace, only show builtin templates
        }

        const result = await listTemplatesResult(workspacePath);

        if (!result.success) {
          throw new Error(result.error);
        }

        output(
          ctx,
          successResponse({ templates: result.templates }),
          () => {
            if (result.templates.length === 0) {
              console.log(chalk.gray("No templates found."));
              console.log();
              console.log(chalk.gray("Available page types:"));
              for (const type of PAGE_TYPES) {
                console.log(chalk.cyan(`  - ${type}`));
              }
              console.log();
              console.log("Create a page with:");
              console.log(chalk.cyan("  viben page create <slug> --name \"Page Name\" --type <type>"));
              return;
            }

            console.log(chalk.bold("Available Page Templates:"));
            console.log();

            // Group templates by type
            const byType = new Map<string, PageTemplate[]>();
            for (const template of result.templates) {
              const list = byType.get(template.type) ?? [];
              list.push(template);
              byType.set(template.type, list);
            }

            for (const [type, templates] of byType) {
              console.log(chalk.bold.underline(`${type.charAt(0).toUpperCase() + type.slice(1)} Templates:`));
              for (const template of templates) {
                const source = template.source === "custom" ? chalk.yellow(" [custom]") : "";
                console.log(`  ${chalk.cyan(template.id)}${source}`);
                console.log(`    ${template.name}`);
                if (template.description) {
                  console.log(`    ${chalk.gray(template.description)}`);
                }
              }
              console.log();
            }

            console.log("Use a template with:");
            console.log(chalk.cyan("  viben page create <slug> --name \"Page Name\" --template <template-id>"));
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // viben page create <slug>
  pageCmd
    .command("create <slug>")
    .description("Create a new page")
    .requiredOption("-n, --name <name>", "Page name (required)")
    .option("-d, --description <desc>", "Page description")
    .option("-t, --type <type>", "Page type (static, markdown, server, proxy)", "static")
    .option("--template <id>", "Template ID (not yet implemented)")
    .option("--file <file>", "File path for static pages", "index.html")
    .option("--command <cmd>", "Command for server pages")
    .option("--port <port>", "Port for server pages")
    .option("--url <url>", "URL for proxy pages")
    .action(
      async (
        slug: string,
        options: {
          name: string;
          description?: string;
          type: string;
          template?: string;
          file?: string;
          command?: string;
          port?: string;
          url?: string;
        }
      ) => {
        const ctx = getOutputContext(program);
        try {
          const workspacePath = ensureWorkspaceRoot(process.cwd());

          // Validate type
          if (!PAGE_TYPES.includes(options.type as typeof PAGE_TYPES[number])) {
            throw CliError.validation(
              `Invalid page type: ${options.type}. Valid types: ${PAGE_TYPES.join(", ")}`
            );
          }

          const pageType = options.type as "static" | "markdown" | "server" | "proxy";

          // Validate type-specific options
          if (pageType === "server" && !options.command) {
            outputWarning(ctx, "No --command specified for server page. Using default: pnpm dev");
          }
          if (pageType === "proxy" && !options.url) {
            throw CliError.validation("--url is required for proxy pages");
          }

          // Warn about template (not yet implemented)
          if (options.template) {
            outputWarning(ctx, "Templates are not yet implemented. Ignoring --template option.");
          }

          const result = await createPage({
            workspace_path: workspacePath,
            slug,
            name: options.name,
            description: options.description,
            type: pageType,
            file: options.file,
            command: options.command,
            port: options.port ? parseInt(options.port, 10) : undefined,
            url: options.url,
          });

          if (!result.success) {
            throw new Error(result.error);
          }

          output(ctx, successResponse({ page: result.page }), () => {
            outputSuccess(ctx, `Page "${slug}" created successfully.`);
            console.log();
            if (result.page) {
              outputKeyValue(ctx, {
                Slug: result.page.slug,
                Name: result.page.name,
                Type: result.page.type,
                Path: result.page.path,
              });
            }
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // viben page delete <slug>
  pageCmd
    .command("delete <slug>")
    .description("Delete a page")
    .option("-f, --force", "Skip confirmation")
    .action(async (slug: string, options: { force?: boolean }) => {
      const ctx = getOutputContext(program);
      try {
        const workspacePath = ensureWorkspaceRoot(process.cwd());

        // Check if page exists first
        const viewResult = await viewPage({
          workspace_path: workspacePath,
          slug,
        });

        if (!viewResult.success || !viewResult.page) {
          throw new Error(`Page not found: ${slug}`);
        }

        // Confirm deletion if not forced
        if (!options.force && !ctx.json) {
          console.log(chalk.yellow(`About to delete page "${slug}" (${viewResult.page.name})`));
          console.log(chalk.yellow(`Path: ${viewResult.page.path}`));
          console.log();
          console.log(chalk.red("This action cannot be undone."));
          console.log();
          console.log("Use --force to skip this confirmation.");
          process.exit(1);
        }

        const result = await deletePage({
          workspace_path: workspacePath,
          slug,
        });

        if (!result.success) {
          throw new Error(result.error);
        }

        output(ctx, successResponse({ slug: result.slug }), () => {
          outputSuccess(ctx, `Page "${slug}" deleted successfully.`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
