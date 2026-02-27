/**
 * CLI output utilities
 */
import chalk from "chalk";
import type { CliResponse, OutputContext } from "../types";

/**
 * Create a success response
 */
export function successResponse<T>(data: T): CliResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create an error response
 */
export function errorResponse(code: string, message: string): CliResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

/**
 * Output a response in the appropriate format
 * @param ctx - Output context
 * @param response - The response to output
 * @param humanRender - Optional function to render human-readable output
 */
export function output<T>(
  ctx: OutputContext,
  response: CliResponse<T>,
  humanRender?: () => void
): void {
  if (ctx.json) {
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  if (ctx.quiet && response.success) {
    return;
  }

  if (humanRender) {
    humanRender();
  } else if (response.success && response.data !== undefined) {
    // Default human render - just stringify the data
    if (typeof response.data === "string") {
      console.log(response.data);
    } else {
      console.log(JSON.stringify(response.data, null, 2));
    }
  }
}

/**
 * Output an error message
 */
export function outputError(ctx: OutputContext, code: string, message: string): void {
  if (ctx.json) {
    console.log(JSON.stringify(errorResponse(code, message), null, 2));
    return;
  }

  console.error(chalk.red(`Error: ${message}`));
  if (ctx.verbose) {
    console.error(chalk.gray(`Code: ${code}`));
  }
}

/**
 * Output a success message
 */
export function outputSuccess(ctx: OutputContext, message: string): void {
  if (ctx.json) {
    console.log(JSON.stringify(successResponse({ message }), null, 2));
    return;
  }

  if (!ctx.quiet) {
    console.log(chalk.green(message));
  }
}

/**
 * Output a warning message
 */
export function outputWarning(ctx: OutputContext, message: string): void {
  if (ctx.json) {
    return; // Warnings are not included in JSON output
  }

  if (!ctx.quiet) {
    console.warn(chalk.yellow(`Warning: ${message}`));
  }
}

/**
 * Output an info message
 */
export function outputInfo(ctx: OutputContext, message: string): void {
  if (ctx.json) {
    return; // Info messages are not included in JSON output
  }

  if (!ctx.quiet && ctx.verbose) {
    console.log(chalk.blue(message));
  }
}

/**
 * Simple table output
 */
export function outputTable(
  ctx: OutputContext,
  headers: string[],
  rows: (string | number | boolean | undefined)[][]
): void {
  if (ctx.json) {
    return; // Tables are handled by the main output function
  }

  if (ctx.quiet) {
    return;
  }

  if (rows.length === 0) {
    console.log(chalk.gray("No data"));
    return;
  }

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const dataWidth = Math.max(...rows.map((r) => String(r[i] ?? "").length));
    return Math.max(h.length, dataWidth);
  });

  // Print header
  const headerLine = headers
    .map((h, i) => h.padEnd(widths[i]))
    .join("  ");
  console.log(chalk.bold(headerLine));

  // Print separator
  const separator = widths.map((w) => "─".repeat(w)).join("──");
  console.log(chalk.gray(separator));

  // Print rows
  for (const row of rows) {
    const line = row
      .map((cell, i) => String(cell ?? "").padEnd(widths[i]))
      .join("  ");
    console.log(line);
  }
}

/**
 * Output a list with bullets
 */
export function outputList(
  ctx: OutputContext,
  items: string[],
  bullet = "•"
): void {
  if (ctx.json) {
    return;
  }

  if (ctx.quiet) {
    return;
  }

  for (const item of items) {
    console.log(`  ${bullet} ${item}`);
  }
}

/**
 * Output key-value pairs
 */
export function outputKeyValue(
  ctx: OutputContext,
  pairs: Record<string, string | number | boolean | undefined>
): void {
  if (ctx.json) {
    return;
  }

  if (ctx.quiet) {
    return;
  }

  const maxKeyLength = Math.max(...Object.keys(pairs).map((k) => k.length));

  for (const [key, value] of Object.entries(pairs)) {
    const paddedKey = key.padEnd(maxKeyLength);
    console.log(`${chalk.gray(paddedKey)}  ${value ?? chalk.gray("(not set)")}`);
  }
}
