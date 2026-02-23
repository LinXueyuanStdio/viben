/**
 * JSONL Trace 导出器
 *
 * 一个 trace 一个 jsonl 文件，支持树形可视化
 */
import type { SpanExporter, ReadableSpan } from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";
import { ExportResultCode } from "@opentelemetry/core";
import * as fs from "fs";
import * as path from "path";
import { getRouteName, getSpanName } from "../route-names";
import type { TraceSpan, TraceEvent } from "../types";

export class JsonlTraceExporter implements SpanExporter {
  private baseDir: string;
  private pendingSpans: Map<string, ReadableSpan[]> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private flushDelayMs: number;
  private batchSize: number;

  constructor(
    baseDir: string,
    options?: { flushDelayMs?: number; batchSize?: number }
  ) {
    this.baseDir = path.join(baseDir, "traces");
    this.flushDelayMs = options?.flushDelayMs ?? 5000;
    this.batchSize = options?.batchSize ?? 100;
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  /**
   * 获取 trace 文件路径
   * 按日期分目录，一个 trace 一个文件
   */
  private getFilePath(traceId: string): string {
    const date = new Date().toISOString().split("T")[0];
    const dateDir = path.join(this.baseDir, date);
    fs.mkdirSync(dateDir, { recursive: true });
    return path.join(dateDir, `${traceId}.jsonl`);
  }

  /**
   * 将 OpenTelemetry hrTime 转换为毫秒
   */
  private hrTimeToMs(hrTime: [number, number]): number {
    return hrTime[0] * 1000 + hrTime[1] / 1_000_000;
  }

  /**
   * 获取 span 的中文显示名称
   */
  private getDisplayName(span: ReadableSpan): string {
    const method = span.attributes["http.method"] as string | undefined;
    const route = span.attributes["http.route"] as string | undefined;
    const target = span.attributes["http.target"] as string | undefined;

    // HTTP 请求使用路由名称映射
    // 优先使用 http.route，如果没有则使用 http.target（去掉查询参数）
    if (method) {
      const routePath = route || (target ? target.split("?")[0] : undefined);
      if (routePath) {
        return getRouteName(method, routePath);
      }
    }

    // 其他 span 使用 span 名称映射
    return getSpanName(span.name);
  }

  /**
   * 获取 parentSpanId
   */
  private getParentSpanId(span: ReadableSpan): string | undefined {
    // ReadableSpan has parentSpanContext that contains the parent span ID
    const parentContext = span.parentSpanContext;
    if (!parentContext) {
      return undefined;
    }
    const parentId = parentContext.spanId;
    // Return undefined if empty string or invalid (all zeros)
    if (!parentId || parentId === "0000000000000000") {
      return undefined;
    }
    return parentId;
  }

  /**
   * 转换 OpenTelemetry Span 为存储格式
   */
  private convertSpan(span: ReadableSpan): TraceSpan {
    const startMs = this.hrTimeToMs(span.startTime);
    const endMs = this.hrTimeToMs(span.endTime);

    const events: TraceEvent[] = span.events.map((e) => ({
      name: e.name,
      time: this.hrTimeToMs(e.time),
      attributes: e.attributes as Record<string, unknown> | undefined,
    }));

    return {
      spanId: span.spanContext().spanId,
      parentSpanId: this.getParentSpanId(span),
      name: span.name,
      displayName: this.getDisplayName(span),
      kind: span.kind,
      startTime: startMs,
      endTime: endMs,
      duration: Math.round((endMs - startMs) * 100) / 100, // 保留 2 位小数
      status: {
        code: span.status.code,
        message: span.status.message,
      },
      attributes: span.attributes as Record<string, unknown>,
      events,
      resource: span.resource.attributes as Record<string, unknown>,
    };
  }

  /**
   * 调度刷新
   */
  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushAll();
      this.flushTimer = null;
    }, this.flushDelayMs);
  }

  /**
   * 检查是否需要立即刷新
   */
  private checkImmediateFlush(traceId: string): void {
    const spans = this.pendingSpans.get(traceId);
    if (spans && spans.length >= this.batchSize) {
      this.writeTrace(traceId, spans);
      this.pendingSpans.delete(traceId);
    }
  }

  /**
   * 刷新所有待写入的 traces
   */
  private flushAll(): void {
    for (const [traceId, spans] of this.pendingSpans) {
      this.writeTrace(traceId, spans);
    }
    this.pendingSpans.clear();
  }

  /**
   * 写入 trace 到文件
   */
  private writeTrace(traceId: string, spans: ReadableSpan[]): void {
    try {
      const filePath = this.getFilePath(traceId);
      const lines = spans.map((span) => JSON.stringify(this.convertSpan(span))).join("\n") + "\n";
      fs.appendFileSync(filePath, lines);
    } catch (error) {
      console.error(`[Telemetry] Failed to write trace ${traceId}:`, error);
    }
  }

  /**
   * 检查是否应该过滤掉该 span
   * 过滤 CORS 预检请求 (OPTIONS) 等噪音
   */
  private shouldFilterSpan(span: ReadableSpan): boolean {
    const method = span.attributes["http.method"] as string | undefined;
    // 过滤 OPTIONS 预检请求
    if (method === "OPTIONS") {
      return true;
    }
    return false;
  }

  /**
   * 导出 spans
   */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    try {
      // 按 traceId 分组，过滤掉噪音 spans
      for (const span of spans) {
        // 跳过应该过滤的 spans
        if (this.shouldFilterSpan(span)) {
          continue;
        }

        const traceId = span.spanContext().traceId;
        const existing = this.pendingSpans.get(traceId) || [];
        existing.push(span);
        this.pendingSpans.set(traceId, existing);

        // 检查是否需要立即刷新
        this.checkImmediateFlush(traceId);
      }

      this.scheduleFlush();
      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      console.error("[Telemetry] Export error:", error);
      resultCallback({ code: ExportResultCode.FAILED, error: error as Error });
    }
  }

  /**
   * 强制刷新
   */
  async forceFlush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushAll();
  }

  /**
   * 关闭导出器
   */
  async shutdown(): Promise<void> {
    await this.forceFlush();
  }
}
