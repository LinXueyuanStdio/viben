/**
 * Doctor check: Workspace — verifies the workspace directory (parent of
 * .viben/) exists and is writable. A missing workspace is auto-fixable.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { DoctorCheck, CheckResult } from "../types.js";

export const workspaceCheck: DoctorCheck = {
  name: "Workspace",
  order: 5,
  async run(ctx) {
    const results: CheckResult[] = [];

    // Workspace is the parent of the instance root (dataDir = .viben/)
    const workspace = path.dirname(ctx.dataDir);

    if (!fs.existsSync(workspace)) {
      results.push({
        status: "warn",
        message: `Workspace directory does not exist: ${workspace}`,
        fixable: true,
        fixRisk: "safe",
        fix: async () => {
          fs.mkdirSync(workspace, { recursive: true });
          return { success: true, message: "created directory" };
        },
      });
    } else {
      try {
        fs.accessSync(workspace, fs.constants.W_OK);
        results.push({ status: "pass", message: `Workspace directory exists: ${workspace}` });
      } catch {
        results.push({ status: "fail", message: `Workspace directory not writable: ${workspace}` });
      }
    }

    return results;
  },
};
