/**
 * Telemetry 类型定义
 */

/**
 * Trace Span 数据结构
 * 用于 JSONL 文件存储，支持树形可视化
 */
export interface TraceSpan {
  /** Span 唯一标识 */
  spanId: string;
  /** 父 Span ID，根 span 没有此字段 */
  parentSpanId?: string;
  /** 原始 span 名称 */
  name: string;
  /** 中文显示名称 */
  displayName: string;
  /** Span 类型: 0=INTERNAL, 1=SERVER, 2=CLIENT, 3=PRODUCER, 4=CONSUMER */
  kind: number;
  /** 开始时间 (Unix 毫秒) */
  startTime: number;
  /** 结束时间 (Unix 毫秒) */
  endTime: number;
  /** 持续时间 (毫秒) */
  duration: number;
  /** 状态 */
  status: {
    /** 状态码: 0=UNSET, 1=OK, 2=ERROR */
    code: number;
    /** 错误信息 */
    message?: string;
  };
  /** 属性 */
  attributes: Record<string, unknown>;
  /** 事件 */
  events: TraceEvent[];
  /** 资源信息 */
  resource?: Record<string, unknown>;
}

/**
 * Trace 事件
 */
export interface TraceEvent {
  /** 事件名称 */
  name: string;
  /** 事件时间 (Unix 毫秒) */
  time: number;
  /** 事件属性 */
  attributes?: Record<string, unknown>;
}

/**
 * Trace 树结构
 * 用于可视化
 */
export interface TraceTree {
  /** Trace ID */
  traceId: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
  /** 总持续时间 (毫秒) */
  totalDuration: number;
  /** 根 span */
  root: TraceSpanNode;
  /** 元数据 */
  metadata?: {
    serviceName?: string;
    serviceVersion?: string;
  };
}

/**
 * Trace Span 节点 (带子节点)
 */
export interface TraceSpanNode extends TraceSpan {
  /** 子 span 列表 */
  children: TraceSpanNode[];
}

/**
 * Metrics 数据结构
 */
export interface MetricRecord {
  /** 记录时间 (Unix 毫秒) */
  timestamp: number;
  /** 指标名称 */
  name: string;
  /** 指标描述 */
  description?: string;
  /** 单位 */
  unit?: string;
  /** 指标类型 */
  type: "counter" | "gauge" | "histogram" | "summary";
  /** 指标值 */
  value: number | { sum: number; count: number; buckets?: Record<string, number> };
  /** 属性/标签 */
  attributes: Record<string, unknown>;
  /** 资源信息 */
  resource?: Record<string, unknown>;
}

/**
 * Log 记录
 */
export interface LogRecord {
  /** 时间戳 (ISO 8601) */
  time: string;
  /** 日志级别 */
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  /** 日志消息 */
  msg: string;
  /** 服务名称 */
  service?: string;
  /** 服务版本 */
  version?: string;
  /** Trace ID (用于关联) */
  traceId?: string;
  /** Span ID (用于关联) */
  spanId?: string;
  /** 额外字段 */
  [key: string]: unknown;
}

/**
 * Telemetry 配置
 */
export interface TelemetryConfig {
  /** 服务名称 */
  serviceName: string;
  /** 服务版本 */
  serviceVersion: string;
  /** 存储目录 */
  baseDir: string;
  /** 是否启用 */
  enabled?: boolean;
  /** Trace 配置 */
  trace?: {
    /** 批量大小 */
    batchSize?: number;
    /** 刷新延迟 (毫秒) */
    flushDelayMs?: number;
  };
  /** Metrics 配置 */
  metrics?: {
    /** 导出间隔 (毫秒) */
    exportIntervalMs?: number;
  };
  /** Log 配置 */
  log?: {
    /** 日志级别 */
    level?: string;
  };
  /** 保留天数 */
  retentionDays?: number;
}
