/**
 * Telemetry CLI command
 *
 * Commands:
 *   viben telemetry list [date]       - List traces
 *   viben telemetry view <id> [date]  - View trace as tree
 *   viben telemetry stats             - Show telemetry statistics
 *   viben telemetry clean [days]      - Clean old files
 */
import type { Command } from "commander";
import chalk from "chalk";
import * as path from "path";
import {
  listTraces,
  listTraceDates,
  loadTraceSync,
  buildTraceTree,
  printTraceTree,
  getTraceStats,
  cleanOldTelemetryFiles,
  getDefaultTelemetryDir,
} from "../../telemetry";
import type { OutputContext } from "../types";
import { output, outputTable, handleCommandError, successResponse } from "../lib";

/**
 * Get output context from command
 */
function getContext(cmd: Command): OutputContext {
  const opts = cmd.optsWithGlobals();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Register telemetry command
 */
export function registerTelemetryCommand(program: Command): void {
  const telemetry = program
    .command("telemetry")
    .description("Manage telemetry traces and logs");

  // List command
  telemetry
    .command("list [date]")
    .description("List available traces. If date is provided, list traces for that date")
    .action(async function (this: Command, date?: string) {
      const ctx = getContext(this);
      const baseDir = getDefaultTelemetryDir();

      try {
        if (date) {
          // List traces for specific date
          const traces = await listTraces(baseDir, date);

          output(ctx, successResponse({ date, traces }), () => {
            if (traces.length === 0) {
              console.log(chalk.gray(`No traces found for ${date}`));
              return;
            }

            console.log(`\n${chalk.bold("Traces for " + date)}:\n`);
            outputTable(
              ctx,
              ["Trace ID", "Size", "Time"],
              traces.map((t) => [
                t.traceId,
                `${(t.size / 1024).toFixed(2)} KB`,
                t.mtime.toISOString().replace("T", " ").substring(0, 19),
              ])
            );
          });
        } else {
          // List available dates
          const dates = listTraceDates(baseDir);

          if (dates.length === 0) {
            output(ctx, successResponse({ dates: [] }), () => {
              console.log(chalk.gray("No traces found"));
              console.log(chalk.gray(`Telemetry directory: ${baseDir}`));
            });
            return;
          }

          const result = await Promise.all(
            dates.map(async (d) => ({
              date: d,
              count: (await listTraces(baseDir, d)).length,
            }))
          );

          output(ctx, successResponse({ dates: result }), () => {
            console.log(`\n${chalk.bold("Available dates")}:\n`);
            outputTable(
              ctx,
              ["Date", "Traces"],
              result.map((r) => [r.date, String(r.count)])
            );
            console.log(`\nTelemetry directory: ${chalk.cyan(baseDir)}`);
          });
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // View command
  telemetry
    .command("view <traceId> [date]")
    .description("View a trace as tree. Date defaults to today")
    .action(async function (this: Command, traceId: string, date?: string) {
      const ctx = getContext(this);
      const baseDir = getDefaultTelemetryDir();
      const targetDate = date || new Date().toISOString().split("T")[0];

      try {
        const filePath = path.join(baseDir, "traces", targetDate, `${traceId}.jsonl`);
        const spans = loadTraceSync(filePath);
        const tree = buildTraceTree(spans);

        if (!tree) {
          console.log(chalk.red("No spans found in trace"));
          process.exit(1);
        }

        output(ctx, successResponse({ tree, stats: getTraceStats(tree) }), () => {
          console.log(printTraceTree(tree));
          console.log("");

          // Print stats
          const stats = getTraceStats(tree);
          console.log(chalk.bold("统计信息:"));
          console.log(`  总 spans: ${stats.totalSpans}`);
          console.log(`  成功: ${chalk.green(stats.successSpans)}`);
          console.log(`  错误: ${chalk.red(stats.errorSpans)}`);
          console.log(`  最大深度: ${stats.maxDepth}`);
          console.log("");
          console.log(chalk.bold("操作耗时:"));
          for (const [op, data] of stats.operations) {
            const avgDuration = (data.totalDuration / data.count).toFixed(2);
            console.log(`  ${op}: ${data.count}次, 平均 ${chalk.yellow(avgDuration + "ms")}`);
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // Stats command
  telemetry
    .command("stats")
    .description("Show telemetry statistics")
    .action(async function (this: Command) {
      const ctx = getContext(this);
      const baseDir = getDefaultTelemetryDir();

      try {
        const dates = listTraceDates(baseDir);
        let totalTraces = 0;
        let totalSize = 0;

        for (const d of dates) {
          const traces = await listTraces(baseDir, d);
          totalTraces += traces.length;
          totalSize += traces.reduce((sum, t) => sum + t.size, 0);
        }

        const stats = {
          directory: baseDir,
          dates: dates.length,
          totalTraces,
          totalSizeBytes: totalSize,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        };

        output(ctx, successResponse(stats), () => {
          console.log(`\n${chalk.bold("Telemetry 统计")}:\n`);
          console.log(`  目录: ${chalk.cyan(stats.directory)}`);
          console.log(`  日期数: ${stats.dates}`);
          console.log(`  总 traces: ${stats.totalTraces}`);
          console.log(`  总大小: ${stats.totalSizeMB} MB`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // Clean command
  telemetry
    .command("clean [days]")
    .description("Clean old telemetry files. Default: 7 days retention")
    .action(async function (this: Command, days?: string) {
      const ctx = getContext(this);
      const baseDir = getDefaultTelemetryDir();
      const retentionDays = parseInt(days || "7", 10);

      if (isNaN(retentionDays) || retentionDays < 1) {
        console.log(chalk.red("Invalid retention days. Must be a positive number."));
        process.exit(1);
      }

      try {
        // Get before stats
        const datesBefore = listTraceDates(baseDir);
        let tracesBefore = 0;
        for (const d of datesBefore) {
          tracesBefore += (await listTraces(baseDir, d)).length;
        }

        // Clean
        cleanOldTelemetryFiles(baseDir, retentionDays);

        // Get after stats
        const datesAfter = listTraceDates(baseDir);
        let tracesAfter = 0;
        for (const d of datesAfter) {
          tracesAfter += (await listTraces(baseDir, d)).length;
        }

        const result = {
          retentionDays,
          datesRemoved: datesBefore.length - datesAfter.length,
          tracesRemoved: tracesBefore - tracesAfter,
        };

        output(ctx, successResponse(result), () => {
          console.log(
            chalk.green(`✓ Cleaned telemetry files older than ${retentionDays} days`)
          );
          console.log(`  Dates removed: ${result.datesRemoved}`);
          console.log(`  Traces removed: ${result.tracesRemoved}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
