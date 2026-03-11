/**
 * Trace Context 自动注入
 *
 * 使用 OpenTelemetry API 获取当前 span context，
 * 通过 Pino mixin 自动注入到每条日志
 */
import { context, trace } from "@opentelemetry/api";

/**
 * Trace Context 信息
 */
export interface TraceContextInfo {
  /** Trace ID (32 hex chars) */
  traceId?: string;
  /** Span ID (16 hex chars) */
  spanId?: string;
  /** Trace Flags (用于采样决策) */
  traceFlags?: number;
}

/**
 * 无效的 Trace ID (全 0)
 */
const INVALID_TRACE_ID = "00000000000000000000000000000000";

/**
 * 无效的 Span ID (全 0)
 */
const INVALID_SPAN_ID = "0000000000000000";

/**
 * Trace Context Mixin 函数
 *
 * 用于 Pino 的 mixin 选项，自动从当前 OpenTelemetry context
 * 中提取 traceId/spanId 并注入到日志
 *
 * @returns 包含 trace context 的对象，或空对象（无活跃 span 时）
 *
 * @example
 * ```typescript
 * import pino from 'pino';
 * import { traceContextMixin } from './context';
 *
 * const logger = pino({
 *   mixin: traceContextMixin,
 * });
 *
 * // 在 OpenTelemetry span 内部调用
 * logger.info('This log will have traceId and spanId');
 * ```
 */
export function traceContextMixin(): TraceContextInfo {
  const span = trace.getSpan(context.active());

  if (!span) {
    return {};
  }

  const spanContext = span.spanContext();

  // 验证 trace context 是否有效
  if (
    spanContext.traceId === INVALID_TRACE_ID ||
    spanContext.spanId === INVALID_SPAN_ID
  ) {
    return {};
  }

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  };
}

/**
 * 检查当前是否在有效的 trace context 中
 *
 * @returns true 如果当前有活跃且有效的 span
 */
export function hasActiveTraceContext(): boolean {
  const span = trace.getSpan(context.active());

  if (!span) {
    return false;
  }

  const spanContext = span.spanContext();
  return (
    spanContext.traceId !== INVALID_TRACE_ID &&
    spanContext.spanId !== INVALID_SPAN_ID
  );
}

/**
 * 获取当前 Trace Context 信息
 *
 * @returns Trace Context 信息，或 null（无有效 context 时）
 */
export function getCurrentTraceContext(): TraceContextInfo | null {
  const info = traceContextMixin();
  if (!info.traceId) {
    return null;
  }
  return info;
}
