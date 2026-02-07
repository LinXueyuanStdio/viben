/**
 * Output utilities for human-readable and JSON output
 */

export interface CLIResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface OutputOptions {
  json?: boolean;
  quiet?: boolean;
}

/**
 * Output result in human-readable or JSON format
 */
export function outputResult(result: CLIResult, options: OutputOptions): void {
  if (options.json) {
    // JSON output for Agent parsing
    console.log(JSON.stringify(result, null, 2));
  } else if (!options.quiet) {
    // Human-readable output
    if (result.success) {
      if (result.message) {
        console.log(result.message);
      }
    } else {
      console.error(`Error [${result.error?.code}]: ${result.error?.message}`);
    }
  }

  // Exit with error code if failed
  if (!result.success) {
    process.exitCode = 1;
  }
}

/**
 * Format a table for human output
 */
export function formatTable(
  headers: string[],
  rows: string[][]
): string {
  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || "").length))
  );

  // Format header
  const headerLine = headers
    .map((h, i) => h.padEnd(widths[i]))
    .join("  ");
  const separatorLine = widths.map((w) => "-".repeat(w)).join("  ");

  // Format rows
  const rowLines = rows.map((row) =>
    row.map((cell, i) => (cell || "").padEnd(widths[i])).join("  ")
  );

  return [headerLine, separatorLine, ...rowLines].join("\n");
}
