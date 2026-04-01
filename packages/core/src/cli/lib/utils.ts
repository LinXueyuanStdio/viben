/**
 * Shared CLI utility functions
 */
import type { Command } from "commander";
import type { OutputContext } from "../types";

/**
 * Get output context from program options
 */
export function getOutputContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Format a date string for relative display
 * @param dateStr - ISO date string
 * @returns Human-readable relative time (e.g., "5m ago", "2d ago")
 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) {
    return "-";
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
          return "just now";
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
 * Truncate a string for display
 * @param str - String to truncate
 * @param maxLen - Maximum length including ellipsis
 * @returns Truncated string with "..." if needed
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + "...";
}

/**
 * Mask a secret value for display
 * Shows first and last 4 characters, masks middle with ****
 * @param value - Secret value to mask
 * @returns Masked string
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "****";
  }
  return value.substring(0, 4) + "****" + value.substring(value.length - 4);
}
