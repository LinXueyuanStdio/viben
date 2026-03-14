/**
 * Task display utilities
 *
 * Formatting functions for CLI output (status, priority, colors)
 */

import chalk from "chalk";

/**
 * Format task status for display
 * Uses unified status values: backlog, queue, in_progress, paused, review, completed, failed, cancelled
 */
export function formatStatus(status: string): string {
  switch (status) {
    // Completed states
    case "completed":
      return chalk.green(status);
    // In-progress states
    case "in_progress":
    case "queue":
      return chalk.blue(status);
    // Waiting states
    case "backlog":
    case "review":
    case "paused":
      return chalk.yellow(status);
    // Error/terminal states
    case "failed":
    case "cancelled":
      return chalk.red(status);
    default:
      return chalk.gray(status);
  }
}

/**
 * Format priority for display
 * Uses IssuePriority: urgent, high, medium, low, none
 */
export function formatPriority(priority: string): string {
  switch (priority) {
    case "urgent":
      return chalk.red(priority);
    case "high":
      return chalk.yellow(priority);
    case "medium":
      return chalk.blue(priority);
    case "low":
      return chalk.gray(priority);
    case "none":
      return chalk.dim(priority);
    default:
      return priority;
  }
}

/**
 * Get status color (returns colored string)
 * Same logic as formatStatus but named differently for clarity
 */
export function statusColor(status: string): string {
  return formatStatus(status);
}

/**
 * Get priority chalk color function
 * Uses IssuePriority: urgent, high, medium, low, none
 */
export function getPriorityColor(priority: string): typeof chalk {
  switch (priority) {
    case "urgent":
      return chalk.red;
    case "high":
      return chalk.yellow;
    case "medium":
      return chalk.blue;
    case "low":
      return chalk.gray;
    case "none":
      return chalk.dim;
    default:
      return chalk.white;
  }
}
