/**
 * Doctor check: Plugins — verifies the plugins directory exists and its
 * package.json is valid. Missing directory or package.json are auto-fixable.
 * Corrupt package.json is a risky fix (requires user confirmation since
 * resetting it loses the dependency list).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { DoctorCheck, CheckResult } from "../types.js";

export const pluginsCheck: DoctorCheck = {
  name: "Plugins",
  order: 6,
  async run(ctx) {
    const results: CheckResult[] = [];

    if (!fs.existsSync(ctx.pluginsDir)) {
      results.push({
        status: "warn",
        message: "Plugins directory does not exist",
        fixable: true,
        fixRisk: "safe",
        fix: async () => {
          fs.mkdirSync(ctx.pluginsDir, { recursive: true });
          fs.writeFileSync(
            path.join(ctx.pluginsDir, "package.json"),
            JSON.stringify({ name: "viben-plugins", private: true, dependencies: {} }, null, 2),
          );
          return { success: true, message: "initialized plugins directory" };
        },
      });
      return results;
    }
    results.push({ status: "pass", message: "Plugins directory exists" });

    const pkgPath = path.join(ctx.pluginsDir, "package.json");
    if (!fs.existsSync(pkgPath)) {
      results.push({
        status: "warn",
        message: "Plugins package.json missing",
        fixable: true,
        fixRisk: "safe",
        fix: async () => {
          fs.writeFileSync(
            pkgPath,
            JSON.stringify({ name: "viben-plugins", private: true, dependencies: {} }, null, 2),
          );
          return { success: true, message: "created package.json" };
        },
      });
      return results;
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = pkg.dependencies || {};
      const count = Object.keys(deps).length;
      results.push({ status: "pass", message: `Plugins package.json valid (${count} plugins)` });
    } catch {
      results.push({
        status: "fail",
        message: "Plugins package.json is invalid JSON",
        fixable: true,
        fixRisk: "risky",
        fix: async () => {
          fs.writeFileSync(
            pkgPath,
            JSON.stringify({ name: "viben-plugins", private: true, dependencies: {} }, null, 2),
          );
          return { success: true, message: "reset package.json" };
        },
      });
    }

    return results;
  },
};
