#!/usr/bin/env node
/**
 * Telemetry CLI 工具
 *
 * 用于查看和分析 traces
 *
 * Usage:
 *   npx ts-node src/telemetry/cli.ts list [date]
 *   npx ts-node src/telemetry/cli.ts view <traceId> [date]
 *   npx ts-node src/telemetry/cli.ts clean [retentionDays]
 */
import {
  listTraces,
  listTraceDates,
  loadTraceSync,
  buildTraceTree,
  printTraceTree,
  getTraceStats,
} from "./trace-viewer";
import { cleanOldTelemetryFiles, getDefaultTelemetryDir } from "./index";
import * as path from "path";

const baseDir = process.env.VIBEN_TELEMETRY_DIR || getDefaultTelemetryDir();

async function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case "list": {
      const date = args[0];
      if (date) {
        // 列出指定日期的 traces
        const traces = await listTraces(baseDir, date);
        if (traces.length === 0) {
          console.log(`No traces found for ${date}`);
        } else {
          console.log(`Traces for ${date}:`);
          console.log("");
          for (const trace of traces) {
            const sizeKb = (trace.size / 1024).toFixed(2);
            console.log(`  ${trace.traceId}  ${sizeKb}KB  ${trace.mtime.toISOString()}`);
          }
        }
      } else {
        // 列出所有可用日期
        const dates = listTraceDates(baseDir);
        if (dates.length === 0) {
          console.log("No traces found");
        } else {
          console.log("Available dates:");
          for (const d of dates) {
            const traces = await listTraces(baseDir, d);
            console.log(`  ${d}  (${traces.length} traces)`);
          }
        }
      }
      break;
    }

    case "view": {
      const traceId = args[0];
      const date = args[1] || new Date().toISOString().split("T")[0];

      if (!traceId) {
        console.error("Usage: telemetry view <traceId> [date]");
        process.exit(1);
      }

      const filePath = path.join(baseDir, "traces", date, `${traceId}.jsonl`);

      try {
        const spans = loadTraceSync(filePath);
        const tree = buildTraceTree(spans);

        if (!tree) {
          console.log("No spans found in trace");
          process.exit(1);
        }

        console.log(printTraceTree(tree));
        console.log("");

        // 打印统计信息
        const stats = getTraceStats(tree);
        console.log("统计信息:");
        console.log(`  总 spans: ${stats.totalSpans}`);
        console.log(`  成功: ${stats.successSpans}`);
        console.log(`  错误: ${stats.errorSpans}`);
        console.log(`  最大深度: ${stats.maxDepth}`);
        console.log("");
        console.log("操作耗时:");
        for (const [op, data] of stats.operations) {
          const avgDuration = (data.totalDuration / data.count).toFixed(2);
          console.log(`  ${op}: ${data.count}次, 平均 ${avgDuration}ms`);
        }
      } catch (error) {
        console.error(`Failed to load trace: ${error}`);
        process.exit(1);
      }
      break;
    }

    case "clean": {
      const retentionDays = parseInt(args[0] || "7", 10);
      console.log(`Cleaning telemetry files older than ${retentionDays} days...`);
      cleanOldTelemetryFiles(baseDir, retentionDays);
      console.log("Done");
      break;
    }

    case "stats": {
      const dates = listTraceDates(baseDir);
      let totalTraces = 0;
      let totalSize = 0;

      for (const d of dates) {
        const traces = await listTraces(baseDir, d);
        totalTraces += traces.length;
        totalSize += traces.reduce((sum, t) => sum + t.size, 0);
      }

      console.log("Telemetry 统计:");
      console.log(`  目录: ${baseDir}`);
      console.log(`  日期数: ${dates.length}`);
      console.log(`  总 traces: ${totalTraces}`);
      console.log(`  总大小: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
      break;
    }

    default:
      console.log("Viben Telemetry CLI");
      console.log("");
      console.log("Usage:");
      console.log("  telemetry list [date]       - List traces (dates or traces for a date)");
      console.log("  telemetry view <id> [date]  - View a trace as tree");
      console.log("  telemetry stats             - Show telemetry statistics");
      console.log("  telemetry clean [days]      - Clean old files (default: 7 days)");
      console.log("");
      console.log(`Telemetry directory: ${baseDir}`);
  }
}

main().catch(console.error);
