import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatRelativeTime } from "@viben/kanban";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compare two arrays for equality by index (order-sensitive).
 * Works for arrays of primitives (strings, numbers, booleans).
 */
export function arraysEqual<T extends string | number | boolean>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

/**
 * Compare two arrays as sets (order-insensitive).
 * Works for arrays of primitives (strings, numbers, booleans).
 */
export function setsEqual<T extends string | number | boolean>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every(val => setB.has(val));
}

/**
 * Shallow-compare two arrays of objects by checking each key/value pair.
 * Assumes objects are flat (no nested objects/arrays).
 */
export function shallowArrayEqual<T extends object>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((obj, idx) => {
    const other = b[idx];
    const keys = Object.keys(obj) as (keyof T)[];
    const otherKeys = Object.keys(other) as (keyof T)[];
    if (keys.length !== otherKeys.length) return false;
    return keys.every(key => obj[key] === other[key]);
  });
}

export { formatRelativeTime };


/**
 * Format duration for display.
 * Handles milliseconds, seconds, minutes+seconds, and hours+minutes ranges.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m ${seconds % 60}s`;
}
