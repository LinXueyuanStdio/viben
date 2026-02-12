/**
 * Viben Telemetry
 *
 * 可观测性模块，提供 Traces、Metrics、Logs 三大支柱
 * 使用 OpenTelemetry 标准，JSONL 文件存储
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import * as fs from "fs";
import * as path from "path";

import { JsonlTraceExporter } from "./exporters/jsonl-trace-exporter";
import { JsonlMetricsExporter } from "./exporters/jsonl-metrics-exporter";
import { createLogger, createDualLogger } from "./logger";
import type { TelemetryConfig } from "./types";

export type { TelemetryConfig, TraceSpan, TraceTree, TraceSpanNode, MetricRecord, LogRecord } from "./types";
export { getRouteName, getSpanName, ROUTE_NAMES, SPAN_NAMES } from "./route-names";
export { JsonlTraceExporter } from "./exporters/jsonl-trace-exporter";
export { JsonlMetricsExporter } from "./exporters/jsonl-metrics-exporter";
export {
  loadTrace,
  loadTraceSync,
  buildTraceTree,
  printTraceTree,
  traceTreeToJson,
  getTraceStats,
  listTraces,
  listTraceDates,
} from "./trace-viewer";
export { createLogger, createDualLogger, createConsoleLogger, createChildLogger } from "./logger";
export type { Logger } from "./logger";

// Re-export OpenTelemetry API for manual instrumentation
export { trace, metrics, context, SpanStatusCode } from "@opentelemetry/api";
export type { Span, Tracer, Meter } from "@opentelemetry/api";

/**
 * Telemetry 实例
 */
export interface TelemetryInstance {
  /** OpenTelemetry SDK */
  sdk: NodeSDK | null;
  /** 结构化日志记录器 */
  logger: ReturnType<typeof createLogger>;
  /** 配置 */
  config: TelemetryConfig;
  /** 关闭 telemetry */
  shutdown: () => Promise<void>;
}

/**
 * 初始化 Telemetry
 *
 * @param config - 配置
 * @returns Telemetry 实例
 */
export function initTelemetry(config: TelemetryConfig): TelemetryInstance {
  // 创建存储目录
  fs.mkdirSync(config.baseDir, { recursive: true });

  // 创建 logger
  const logger =
    process.env.NODE_ENV === "production"
      ? createLogger(config)
      : createDualLogger(config);

  // 如果禁用，只返回 logger
  if (config.enabled === false) {
    logger.info({ enabled: false }, "Telemetry disabled");
    return {
      sdk: null,
      logger,
      config,
      shutdown: async () => {},
    };
  }

  // 创建导出器
  const traceExporter = new JsonlTraceExporter(config.baseDir, {
    flushDelayMs: config.trace?.flushDelayMs ?? 5000,
    batchSize: config.trace?.batchSize ?? 100,
  });

  const metricsExporter = new JsonlMetricsExporter(config.baseDir);

  // 创建 OpenTelemetry SDK
  const sdk = new NodeSDK({
    serviceName: config.serviceName,
    spanProcessor: new BatchSpanProcessor(traceExporter, {
      maxQueueSize: 100,
      scheduledDelayMillis: config.trace?.flushDelayMs ?? 5000,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricsExporter,
      exportIntervalMillis: config.metrics?.exportIntervalMs ?? 60000,
    }),
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => {
          // 忽略健康检查
          return req.url === "/health" || req.url === "/api/health";
        },
      }),
      new FastifyInstrumentation(),
    ],
  });

  // 启动 SDK
  sdk.start();
  logger.info(
    {
      baseDir: config.baseDir,
      serviceName: config.serviceName,
    },
    "Telemetry initialized"
  );

  // 注册关闭钩子
  const shutdown = async () => {
    logger.info("Shutting down telemetry...");
    await sdk.shutdown();
    logger.info("Telemetry shutdown complete");
  };

  process.on("SIGTERM", () => {
    shutdown().catch(console.error);
  });

  process.on("SIGINT", () => {
    shutdown().catch(console.error);
  });

  return {
    sdk,
    logger,
    config,
    shutdown,
  };
}

/**
 * 清理旧的 telemetry 文件
 *
 * @param baseDir - 存储目录
 * @param retentionDays - 保留天数，默认 7 天
 */
export function cleanOldTelemetryFiles(baseDir: string, retentionDays = 7): void {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const subdirs = ["traces", "logs", "metrics"];

  for (const subdir of subdirs) {
    const dir = path.join(baseDir, subdir);
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // traces 按日期分目录
        const stat = fs.statSync(entryPath);
        if (stat.mtimeMs < cutoff) {
          fs.rmSync(entryPath, { recursive: true });
        }
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        // logs 和 metrics 按日期命名
        const stat = fs.statSync(entryPath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(entryPath);
        }
      }
    }
  }
}

/**
 * 获取默认 telemetry 目录
 */
export function getDefaultTelemetryDir(): string {
  const stateDir = process.env.VIBEN_STATE_DIR || path.join(process.env.HOME || "~", ".viben");
  return path.join(stateDir, "telemetry");
}
