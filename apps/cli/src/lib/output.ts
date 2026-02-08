/**
 * Output management for Viben CLI
 *
 * Handles consistent output formatting for both human and JSON modes.
 */

import chalk from 'chalk';
import type { OutputContext, CliResponse } from '../types';

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
export function errorResponse(code: string, message: string, details?: unknown): CliResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Unified output function
 *
 * In JSON mode: outputs the response as JSON
 * In human mode: calls the humanFn to output human-readable text
 */
export function output<T>(
  ctx: OutputContext,
  response: CliResponse<T>,
  humanFn: () => void
): void {
  if (ctx.json) {
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  if (ctx.quiet && response.success) {
    // In quiet mode, only output errors
    return;
  }

  humanFn();
}

/**
 * Key-value item for output
 */
export interface KeyValueItem {
  key: string;
  value: string;
  origin?: string;
}

/**
 * Output key-value pairs with optional origin
 */
export function outputKeyValue(ctx: OutputContext, items: KeyValueItem[]): void {
  if (ctx.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  for (const item of items) {
    if (item.origin) {
      console.log(`${chalk.gray(item.origin + ':')} ${chalk.cyan(item.key)}=${item.value}`);
    } else {
      console.log(`${chalk.cyan(item.key)}=${item.value}`);
    }
  }
}

/**
 * Output a formatted table
 */
export function outputTable(
  ctx: OutputContext,
  headers: string[],
  rows: (string | undefined)[][]
): void {
  if (ctx.json) {
    // Convert to array of objects
    const data = rows.map((row) => {
      const obj: Record<string, string | undefined> = {};
      headers.forEach((header, index) => {
        obj[header.toLowerCase()] = row[index];
      });
      return obj;
    });
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const columnValues = [h, ...rows.map((r) => stripAnsi(r[i] || ''))];
    return Math.max(...columnValues.map((v) => v.length));
  });

  // Print header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
  console.log(chalk.bold(headerLine));

  // Print separator
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');
  console.log(chalk.gray(separator));

  // Print rows
  for (const row of rows) {
    const rowLine = row.map((cell, i) => {
      const stripped = stripAnsi(cell || '');
      const padding = widths[i] - stripped.length;
      return (cell || '') + ' '.repeat(Math.max(0, padding));
    }).join('  ');
    console.log(rowLine);
  }
}

/**
 * Strip ANSI escape codes from a string
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) {
    return chalk.gray('(unknown)');
  }

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 24 hours ago
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours === 0) {
        const minutes = Math.floor(diff / (60 * 1000));
        if (minutes === 0) {
          return 'just now';
        }
        return `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }

    // Less than 7 days ago
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}d ago`;
    }

    // Format as date
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

/**
 * Log verbose output (only shown in verbose mode)
 */
export function verbose(ctx: OutputContext, message: string): void {
  if (ctx.verbose && !ctx.json) {
    console.log(chalk.gray(`[verbose] ${message}`));
  }
}

/**
 * Log debug output (only shown in verbose mode)
 */
export function debug(ctx: OutputContext, message: string): void {
  if (ctx.verbose && !ctx.json) {
    console.log(chalk.gray(`[debug] ${message}`));
  }
}
