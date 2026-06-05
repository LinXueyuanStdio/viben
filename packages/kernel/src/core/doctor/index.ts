import * as fs from "node:fs";
import * as path from "node:path";
import type { DoctorCheck, DoctorContext, DoctorReport, CategoryResult, PendingFix, CheckResult } from "./types.js";
import { ConfigManager, expandHome } from "../config/config.js";

import { configCheck } from "./checks/config.js";
import { agentsCheck } from "./checks/agents.js";
import { telegramCheck } from "./checks/telegram.js";
import { storageCheck } from "./checks/storage.js";
import { workspaceCheck } from "./checks/workspace.js";
import { pluginsCheck } from "./checks/plugins.js";
import { daemonCheck } from "./checks/daemon.js";
import { tunnelCheck } from "./checks/tunnel.js";

/** All registered checks, sorted by order before execution. */
const ALL_CHECKS: DoctorCheck[] = [
  configCheck,
  agentsCheck,
  telegramCheck,
  storageCheck,
  workspaceCheck,
  pluginsCheck,
  daemonCheck,
  tunnelCheck,
];

/** Per-check timeout — prevents a single hanging check from blocking the entire run. */
const CHECK_TIMEOUT_MS = 10_000;

/**
 * Orchestrates diagnostic checks for an Viben installation.
 *
 * Runs all registered checks in order, collects results, and automatically
 * applies safe fixes (unless in dry-run mode). Risky fixes are collected
 * as `pendingFixes` for the CLI to present interactively.
 */
export class DoctorEngine {
  private dryRun: boolean;
  private dataDir: string;

  constructor(options?: { dryRun?: boolean; dataDir?: string }) {
    this.dryRun = options?.dryRun ?? false;
    this.dataDir = options!.dataDir!;
  }

  /**
   * Executes all checks and returns an aggregated report.
   *
   * Safe fixes are applied inline (mutating CheckResult.message to show "Fixed").
   * Risky fixes are deferred to `report.pendingFixes` for user confirmation.
   */
  async runAll(): Promise<DoctorReport> {
    const ctx = await this.buildContext();
    const checks = [...ALL_CHECKS].sort((a, b) => a.order - b.order);

    const categories: CategoryResult[] = [];
    const pendingFixes: PendingFix[] = [];
    const summary = { passed: 0, warnings: 0, failed: 0, fixed: 0 };

    for (const check of checks) {
      let results: CheckResult[];
      try {
        results = await Promise.race([
          check.run(ctx),
          new Promise<CheckResult[]>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), CHECK_TIMEOUT_MS),
          ),
        ]);
      } catch {
        results = [{ status: "fail", message: `${check.name} check timed out` }];
      }

      for (const result of results) {
        if (result.fixable && result.fix) {
          if (result.fixRisk === "safe" && !this.dryRun) {
            try {
              const fixResult = await result.fix();
              if (fixResult.success) {
                result.message += ` → Fixed (${fixResult.message})`;
                result.status = "warn";
                delete result.fix;
                summary.fixed++;
              }
            } catch {
              // Fix failed, leave as-is
            }
          } else if (result.fixRisk === "risky") {
            pendingFixes.push({
              category: check.name,
              message: result.message,
              fix: result.fix,
            });
          }
        }

        if (result.status === "pass") summary.passed++;
        else if (result.status === "warn") summary.warnings++;
        else if (result.status === "fail") summary.failed++;
      }

      categories.push({ name: check.name, results });
    }

    return { categories, summary, pendingFixes };
  }

  /** Constructs the shared context used by all checks — loads config if available. */
  private async buildContext(): Promise<DoctorContext> {
    const dataDir = this.dataDir;
    const configPath = process.env.VIBEN_CONFIG_PATH || path.join(dataDir, "config.json");

    let config = null;
    let rawConfig: unknown = null;

    try {
      const content = fs.readFileSync(configPath, "utf-8");
      rawConfig = JSON.parse(content);
      const cm = new ConfigManager(configPath);
      await cm.load();
      config = cm.get();
    } catch {
      // Config may not exist or may be invalid — checks will handle this
    }

    const logsDir = config
      ? expandHome(config.logging.logDir)
      : path.join(dataDir, "logs");

    return {
      config,
      rawConfig,
      configPath,
      dataDir,
      sessionsPath: path.join(dataDir, "sessions.json"),
      pidPath: path.join(dataDir, "viben.pid"),
      portFilePath: path.join(dataDir, "api.port"),
      pluginsDir: path.join(dataDir, "plugins"),
      logsDir,
    };
  }
}

export type { DoctorReport, CategoryResult, PendingFix, CheckResult, DoctorContext } from "./types.js";
