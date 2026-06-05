/**
 * Doctor check: Config — validates config.json exists, is parseable JSON,
 * passes Zod schema validation, and has no pending migrations.
 *
 * Pending migrations are auto-fixable (safe). This check runs first (order 1)
 * because most other checks depend on a valid config.
 */

import * as fs from "node:fs";
import { ConfigSchema } from "../../config/config.js";
import { applyMigrations } from "../../config/config-migrations.js";
import type { DoctorCheck, CheckResult } from "../types.js";

export const configCheck: DoctorCheck = {
  name: "Config",
  order: 1,
  async run(ctx) {
    const results: CheckResult[] = [];

    if (!fs.existsSync(ctx.configPath)) {
      results.push({ status: "fail", message: "Config file not found" });
      return results;
    }
    results.push({ status: "pass", message: "Config file exists" });

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(fs.readFileSync(ctx.configPath, "utf-8"));
    } catch (err) {
      results.push({
        status: "fail",
        message: `Config JSON invalid: ${err instanceof Error ? err.message : String(err)}`,
      });
      return results;
    }
    results.push({ status: "pass", message: "JSON valid" });

    const testRaw = structuredClone(raw);
    const { changed } = applyMigrations(testRaw);
    if (changed) {
      results.push({
        status: "warn",
        message: "Pending config migrations",
        fixable: true,
        fixRisk: "safe",
        fix: async () => {
          applyMigrations(raw);
          fs.writeFileSync(ctx.configPath, JSON.stringify(raw, null, 2));
          return { success: true, message: "applied migrations" };
        },
      });
    }

    const result = ConfigSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        results.push({
          status: "fail",
          message: `Validation: ${issue.path.join(".")} — ${issue.message}`,
        });
      }
    } else {
      results.push({ status: "pass", message: "Schema valid" });
    }

    return results;
  },
};
