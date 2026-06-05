/**
 * Doctor check: Daemon — verifies daemon process state, PID file validity,
 * and API port availability. Stale PID files are auto-fixable.
 */

import * as fs from "node:fs";
import * as net from "node:net";
import type { DoctorCheck, CheckResult } from "../types.js";

/** Sends signal 0 to check if a process exists without killing it. */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Attempts to bind the port — if binding fails, the port is in use. */
function checkPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port, "127.0.0.1");
  });
}

export const daemonCheck: DoctorCheck = {
  name: "Daemon",
  order: 7,
  async run(ctx) {
    const results: CheckResult[] = [];

    if (fs.existsSync(ctx.pidPath)) {
      const content = fs.readFileSync(ctx.pidPath, "utf-8").trim();
      const pid = parseInt(content, 10);
      if (isNaN(pid)) {
        results.push({
          status: "warn",
          message: "PID file contains invalid data",
          fixable: true,
          fixRisk: "safe",
          fix: async () => {
            fs.unlinkSync(ctx.pidPath);
            return { success: true, message: "removed invalid PID file" };
          },
        });
      } else if (!isProcessAlive(pid)) {
        results.push({
          status: "warn",
          message: `Stale PID file (PID ${pid} not running)`,
          fixable: true,
          fixRisk: "safe",
          fix: async () => {
            fs.unlinkSync(ctx.pidPath);
            return { success: true, message: "removed stale PID file" };
          },
        });
      } else {
        results.push({ status: "pass", message: `Daemon running (PID ${pid})` });
      }
    }

    if (fs.existsSync(ctx.portFilePath)) {
      const content = fs.readFileSync(ctx.portFilePath, "utf-8").trim();
      const port = parseInt(content, 10);
      if (isNaN(port)) {
        results.push({
          status: "warn",
          message: "Port file contains invalid data",
          fixable: true,
          fixRisk: "safe",
          fix: async () => {
            fs.unlinkSync(ctx.portFilePath);
            return { success: true, message: "removed invalid port file" };
          },
        });
      } else {
        results.push({ status: "pass", message: `Port file valid (port ${port})` });
      }
    }

    if (ctx.config) {
      const apiPort = 21420;
      const inUse = await checkPortInUse(apiPort);
      if (inUse) {
        if (fs.existsSync(ctx.pidPath)) {
          const pid = parseInt(fs.readFileSync(ctx.pidPath, "utf-8").trim(), 10);
          if (!isNaN(pid) && isProcessAlive(pid)) {
            results.push({ status: "pass", message: `API port ${apiPort} in use by Viben daemon` });
          } else {
            results.push({ status: "warn", message: `API port ${apiPort} in use by another process` });
          }
        } else {
          results.push({ status: "warn", message: `API port ${apiPort} in use by another process` });
        }
      } else {
        results.push({ status: "pass", message: `API port ${apiPort} available` });
      }
    }

    return results;
  },
};
