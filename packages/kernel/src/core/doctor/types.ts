/**
 * Type definitions for the doctor diagnostic system.
 *
 * The doctor runs a collection of checks, each producing CheckResults
 * with a severity level. The CLI renders these results and optionally
 * applies automatic fixes:
 *
 * - **pass** — check succeeded, shown as green checkmark
 * - **warn** — non-critical issue, shown as yellow warning
 * - **fail** — critical issue that will prevent Viben from working
 *
 * Fixable results include a `fix()` function with a risk level:
 * - **safe** — auto-applied without prompting (e.g. creating missing dirs)
 * - **risky** — requires user confirmation (e.g. resetting corrupted data)
 */

import type { Config } from "../config/config.js";

/** Shared context passed to all doctor checks, built once per run. */
export interface DoctorContext {
  /** Parsed and validated config, or null if config couldn't be loaded. */
  config: Config | null;
  /** Raw parsed JSON before Zod validation — available even if validation fails. */
  rawConfig: unknown;
  configPath: string;
  dataDir: string;
  sessionsPath: string;
  pidPath: string;
  portFilePath: string;
  pluginsDir: string;
  logsDir: string;
}

/** Result of a single diagnostic check within a category. */
export interface CheckResult {
  status: "pass" | "warn" | "fail";
  message: string;
  /** Whether this result has an associated automatic fix. */
  fixable?: boolean;
  /** "safe" fixes are applied automatically; "risky" fixes require user confirmation. */
  fixRisk?: "safe" | "risky";
  fix?: () => Promise<FixResult>;
}

/** Outcome of applying a fix. */
export interface FixResult {
  success: boolean;
  message: string;
}

/**
 * A named diagnostic check that produces one or more results.
 * Checks are sorted by `order` before execution.
 */
export interface DoctorCheck {
  name: string;
  /** Lower order runs first. Config (1) must run before checks that depend on it. */
  order: number;
  run(ctx: DoctorContext): Promise<CheckResult[]>;
}

/** Aggregated report returned by DoctorEngine.runAll(). */
export interface DoctorReport {
  categories: CategoryResult[];
  summary: { passed: number; warnings: number; failed: number; fixed: number };
  /** Risky fixes that were deferred for user confirmation. */
  pendingFixes: PendingFix[];
}

/** All results for a single check category (e.g. "Config", "Agents"). */
export interface CategoryResult {
  name: string;
  results: CheckResult[];
}

/** A risky fix deferred for interactive user confirmation. */
export interface PendingFix {
  category: string;
  message: string;
  fix: () => Promise<FixResult>;
}
