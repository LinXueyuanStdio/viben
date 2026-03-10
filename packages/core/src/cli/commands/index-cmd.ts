/**
 * viben index - Generate project context index
 *
 * Creates markdown index files for AI agents and developers:
 * - overview.md: Project overview with tech stack and structure
 * - code-index.md: Code structure with packages, apps, and key files
 * - docs-index.md: Documentation index organized by category
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import { output, successResponse, errorResponse, handleCommandError, outputError } from "../lib";
import { IndexBuilder } from "../../index-generator";

interface IndexGenerateOptions {
  /** Disable AI enhancement */
  ai?: boolean;
  /** Output directory */
  output?: string;
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Register the index command
 */
export function registerIndexCommand(program: Command): void {
  const indexCmd = program
    .command("index")
    .description("Generate project context index files");

  indexCmd
    .command("generate")
    .description("Generate or update index files")
    .option("--no-ai", "Disable AI enhancement, use static analysis only")
    .option("--output <dir>", "Output directory", "docs/index")
    .option("--verbose", "Show detailed logging")
    .action(async (options: IndexGenerateOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: options.verbose ?? program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        const builder = new IndexBuilder({
          projectDir: process.cwd(),
          outputDir: options.output || "docs/index",
          enableAI: options.ai !== false,
          verbose: ctx.verbose,
        });

        const result = await builder.generate();

        if (result.success) {
          output(
            ctx,
            successResponse({
              message: "Index generated successfully",
              outputDir: result.outputDir,
              files: result.files,
              duration: `${(result.duration / 1000).toFixed(1)}s`,
            }),
            () => {
              // Output is already handled by IndexBuilder
            }
          );
        } else {
          outputError(
            ctx,
            "INDEX_GENERATION_FAILED",
            result.errors?.join(", ") || "Unknown error"
          );
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
