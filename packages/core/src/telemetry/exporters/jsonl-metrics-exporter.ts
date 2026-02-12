/**
 * JSONL Metrics 导出器
 *
 * 按日期存储 metrics 数据
 */
import type {
  PushMetricExporter,
  ResourceMetrics,
} from "@opentelemetry/sdk-metrics";
import type { ExportResult } from "@opentelemetry/core";
import { ExportResultCode } from "@opentelemetry/core";
import * as fs from "fs";
import * as path from "path";
import type { MetricRecord } from "../types";

export class JsonlMetricsExporter implements PushMetricExporter {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.join(baseDir, "metrics");
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  /**
   * 获取当天的 metrics 文件路径
   */
  private getFilePath(): string {
    const date = new Date().toISOString().split("T")[0];
    return path.join(this.baseDir, `${date}.jsonl`);
  }

  /**
   * 获取指标类型名称
   */
  private getMetricType(
    metricDescriptor: unknown
  ): "counter" | "gauge" | "histogram" | "summary" {
    // 使用 any 来兼容不同版本的 SDK
    const descriptor = metricDescriptor as { type?: number };
    const descriptorType = descriptor?.type ?? 0;

    // 根据 OpenTelemetry InstrumentType
    switch (descriptorType) {
      case 0: // COUNTER
      case 1: // UP_DOWN_COUNTER
        return "counter";
      case 2: // HISTOGRAM
        return "histogram";
      case 3: // OBSERVABLE_COUNTER
      case 4: // OBSERVABLE_UP_DOWN_COUNTER
      case 5: // OBSERVABLE_GAUGE
        return "gauge";
      default:
        return "gauge";
    }
  }

  /**
   * 导出 metrics
   */
  export(
    metrics: ResourceMetrics,
    resultCallback: (result: ExportResult) => void
  ): void {
    try {
      const timestamp = Date.now();
      const lines: string[] = [];

      for (const scopeMetrics of metrics.scopeMetrics) {
        for (const metric of scopeMetrics.metrics) {
          for (const dataPoint of metric.dataPoints) {
            const record: MetricRecord = {
              timestamp,
              name: metric.descriptor.name,
              description: metric.descriptor.description || undefined,
              unit: metric.descriptor.unit || undefined,
              type: this.getMetricType(metric.descriptor),
              value: dataPoint.value as number,
              attributes: dataPoint.attributes as Record<string, unknown>,
              resource: metrics.resource.attributes as Record<string, unknown>,
            };
            lines.push(JSON.stringify(record));
          }
        }
      }

      if (lines.length > 0) {
        fs.appendFileSync(this.getFilePath(), lines.join("\n") + "\n");
      }

      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      console.error("[Telemetry] Metrics export error:", error);
      resultCallback({ code: ExportResultCode.FAILED, error: error as Error });
    }
  }

  /**
   * 强制刷新
   */
  async forceFlush(): Promise<void> {
    // No-op: 同步写入，无需刷新
  }

  /**
   * 关闭导出器
   */
  async shutdown(): Promise<void> {
    // No-op: 无需清理
  }
}
