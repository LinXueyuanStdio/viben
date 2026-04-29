import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

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

/**
 * Format a timestamp to a human-readable relative time string.
 * Accepts either an ISO date string or a Date object.
 *
 * @param dateInput - ISO date string or Date object
 * @param t - Optional i18n translation function. When omitted, returns English abbreviations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatRelativeTime(
  dateInput: string | Date,
  t?: (key: string, options?: any) => string
): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (t) {
    if (minutes < 1) return t("common.justNow", { defaultValue: "just now" });
    if (minutes < 60) return t("common.minutesAgo", { defaultValue: "{{count}}m ago", count: minutes });
    if (hours < 24) return t("common.hoursAgo", { defaultValue: "{{count}}h ago", count: hours });
    if (days < 7) return t("common.daysAgo", { defaultValue: "{{count}}d ago", count: days });
  } else {
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Hook for formatting relative time with i18n support.
 * Returns a memoized function that formats dates using the current locale.
 */
export function useFormatRelativeTime() {
  const { t } = useTranslation();
  return useCallback(
    (dateInput: string | Date) => formatRelativeTime(dateInput, t),
    [t]
  );
}

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
