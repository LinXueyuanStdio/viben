/**
 * Doctor check: Storage — verifies the data directory (.viben/), session
 * store, and log directory exist and are writable. Corrupt sessions.json
 * is a risky fix (resetting it drops session history).
 */

import * as fs from "node:fs";
import type { DoctorCheck, CheckResult } from "../types.js";

export const storageCheck: DoctorCheck = {
  name: "Storage",
  order: 4,
  async run(ctx) {
    const results: CheckResult[] = [];

    if (!fs.existsSync(ctx.dataDir)) {
      results.push({
        status: "fail",
        message: "Data directory ~/.viben does not exist",
        fixable: true,
        fixRisk: "safe",
        fix: async () => {
          fs.mkdirSync(ctx.dataDir, { recursive: true });
          return { success: true, message: "created directory" };
        },
      });
    } else {
      try {
        fs.accessSync(ctx.dataDir, fs.constants.W_OK);
        results.push({ status: "pass", message: "Data directory exists and writable" });
      } catch {
        results.push({ status: "fail", message: "Data directory not writable" });
      }
    }

    if (fs.existsSync(ctx.sessionsPath)) {
      try {
        const content = fs.readFileSync(ctx.sessionsPath, "utf-8");
        const data = JSON.parse(content);
        if (typeof data === "object" && data !== null && "sessions" in data) {
          results.push({ status: "pass", message: "Sessions file valid" });
        } else {
          results.push({
            status: "fail",
            message: "Sessions file has invalid structure",
            fixable: true,
            fixRisk: "risky",
            fix: async () => {
              fs.writeFileSync(ctx.sessionsPath, JSON.stringify({ version: 1, sessions: {} }, null, 2));
              return { success: true, message: "reset sessions file" };
            },
          });
        }
      } catch {
        results.push({
          status: "fail",
          message: "Sessions file corrupt (invalid JSON)",
          fixable: true,
          fixRisk: "risky",
          fix: async () => {
            fs.writeFileSync(ctx.sessionsPath, JSON.stringify({ version: 1, sessions: {} }, null, 2));
            return { success: true, message: "reset sessions file" };
          },
        });
      }
    } else {
      results.push({ status: "pass", message: "Sessions file not present yet (created on first session)" });
    }

    if (!fs.existsSync(ctx.logsDir)) {
      results.push({
        status: "warn",
        message: "Log directory does not exist",
        fixable: true,
        fixRisk: "safe",
        fix: async () => {
          fs.mkdirSync(ctx.logsDir, { recursive: true });
          return { success: true, message: "created log directory" };
        },
      });
    } else {
      try {
        fs.accessSync(ctx.logsDir, fs.constants.W_OK);
        results.push({ status: "pass", message: "Log directory exists and writable" });
      } catch {
        results.push({ status: "fail", message: "Log directory not writable" });
      }
    }

    return results;
  },
};
