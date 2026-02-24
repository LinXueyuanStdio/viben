/**
 * Viben Business Metrics
 *
 * 集中定义所有业务指标，避免在各处重复创建 meter
 * 使用 OpenTelemetry Metrics API
 */
import { metrics } from "@opentelemetry/api";
import type { Counter, Histogram, ObservableGauge, BatchObservableCallback } from "@opentelemetry/api";

// 创建统一的 Meter
const meter = metrics.getMeter("viben-gateway", "1.0.0");

// ============================================================================
// Agent Metrics
// ============================================================================

/**
 * Agent 请求计数器
 * Labels: agent_name, status (success|error|cancelled), error_category
 */
export const agentRequestsTotal: Counter = meter.createCounter("viben_agent_requests_total", {
  description: "Total number of agent run requests",
  unit: "1",
});

/**
 * Agent 执行时长直方图
 * Labels: agent_name, status
 */
export const agentDurationSeconds: Histogram = meter.createHistogram("viben_agent_duration_seconds", {
  description: "Agent execution duration in seconds",
  unit: "s",
});

/**
 * Agent 工具调用计数器
 * Labels: agent_name, tool_name, status (success|error)
 */
export const agentToolCallsTotal: Counter = meter.createCounter("viben_agent_tool_calls_total", {
  description: "Total number of tool calls per agent",
  unit: "1",
});

/**
 * Agent 文本响应长度计数器
 * Labels: agent_name
 */
export const agentTextCharsTotal: Counter = meter.createCounter("viben_agent_text_chars_total", {
  description: "Total text response characters",
  unit: "1",
});

/**
 * Agent SSE 消息计数器
 * Labels: agent_name, message_type (text|tool_use|tool_result|error|done)
 */
export const agentMessagesTotal: Counter = meter.createCounter("viben_agent_messages_total", {
  description: "Total SSE messages sent",
  unit: "1",
});

// ============================================================================
// Cron Metrics
// ============================================================================

/**
 * Cron 执行计数器
 * Labels: job_id, job_name, job_type (agent|script), status (success|error), trigger (schedule|manual)
 */
export const cronExecutionsTotal: Counter = meter.createCounter("viben_cron_executions_total", {
  description: "Total number of cron job executions",
  unit: "1",
});

/**
 * Cron 执行时长直方图
 * Labels: job_id, job_name, job_type
 */
export const cronDurationSeconds: Histogram = meter.createHistogram("viben_cron_duration_seconds", {
  description: "Cron job execution duration in seconds",
  unit: "s",
});

// ============================================================================
// WebSocket Metrics
// ============================================================================

/**
 * WebSocket 消息计数器
 * Labels: direction (sent|received), message_type
 */
export const wsMessagesTotal: Counter = meter.createCounter("viben_ws_messages_total", {
  description: "Total WebSocket messages",
  unit: "1",
});

/**
 * WebSocket 连接计数器
 * Labels: -
 */
export const wsConnectionsTotal: Counter = meter.createCounter("viben_ws_connections_total", {
  description: "Total WebSocket connections established",
  unit: "1",
});

/**
 * WebSocket 断开计数器
 * Labels: reason (normal|error|timeout)
 */
export const wsDisconnectsTotal: Counter = meter.createCounter("viben_ws_disconnects_total", {
  description: "Total WebSocket disconnections",
  unit: "1",
});

// ============================================================================
// Observable Gauges (需要回调函数)
// ============================================================================

/**
 * 当前活跃 Agent 会话数
 * 由 AgentService 提供回调
 */
export const agentActiveSessions: ObservableGauge = meter.createObservableGauge(
  "viben_agent_active_sessions",
  {
    description: "Number of currently active agent sessions",
    unit: "1",
  }
);

/**
 * 当前活跃 WebSocket 连接数
 * 由 WebSocket 路由提供回调
 */
export const wsActiveConnections: ObservableGauge = meter.createObservableGauge(
  "viben_ws_active_connections",
  {
    description: "Number of currently active WebSocket connections",
    unit: "1",
  }
);

/**
 * Cron 作业总数
 * Labels: enabled (true|false), job_type
 */
export const cronJobsTotal: ObservableGauge = meter.createObservableGauge("viben_cron_jobs_total", {
  description: "Total number of configured cron jobs",
  unit: "1",
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 记录 Agent 请求完成
 */
export function recordAgentRequest(params: {
  agentName: string;
  status: "success" | "error" | "cancelled";
  durationMs: number;
  errorCategory?: string;
  toolUseCount?: number;
  toolResultCount?: number;
  textLength?: number;
  messageCount?: number;
}) {
  const { agentName, status, durationMs, errorCategory, toolUseCount, toolResultCount, textLength, messageCount } =
    params;

  // 请求计数
  agentRequestsTotal.add(1, {
    agent_name: agentName,
    status,
    ...(errorCategory && { error_category: errorCategory }),
  });

  // 执行时长 (转换为秒)
  agentDurationSeconds.record(durationMs / 1000, {
    agent_name: agentName,
    status,
  });

  // 文本长度
  if (textLength !== undefined && textLength > 0) {
    agentTextCharsTotal.add(textLength, { agent_name: agentName });
  }

  // 消息计数
  if (messageCount !== undefined && messageCount > 0) {
    agentMessagesTotal.add(messageCount, { agent_name: agentName, message_type: "total" });
  }
}

/**
 * 记录 Agent 工具调用
 */
export function recordAgentToolCall(params: {
  agentName: string;
  toolName: string;
  status: "success" | "error";
}) {
  agentToolCallsTotal.add(1, {
    agent_name: params.agentName,
    tool_name: params.toolName,
    status: params.status,
  });
}

/**
 * 记录 Cron 执行
 */
export function recordCronExecution(params: {
  jobId: string;
  jobName: string;
  jobType: "agent" | "script";
  status: "success" | "error";
  trigger: "schedule" | "manual";
  durationMs: number;
}) {
  const { jobId, jobName, jobType, status, trigger, durationMs } = params;

  cronExecutionsTotal.add(1, {
    job_id: jobId,
    job_name: jobName,
    job_type: jobType,
    status,
    trigger,
  });

  cronDurationSeconds.record(durationMs / 1000, {
    job_id: jobId,
    job_name: jobName,
    job_type: jobType,
  });
}

/**
 * 记录 WebSocket 消息
 */
export function recordWsMessage(params: { direction: "sent" | "received"; messageType: string }) {
  wsMessagesTotal.add(1, {
    direction: params.direction,
    message_type: params.messageType,
  });
}

/**
 * 记录 WebSocket 连接
 */
export function recordWsConnection() {
  wsConnectionsTotal.add(1);
}

/**
 * 记录 WebSocket 断开
 */
export function recordWsDisconnect(reason: "normal" | "error" | "timeout" = "normal") {
  wsDisconnectsTotal.add(1, { reason });
}

/**
 * 注册 Observable Gauge 回调
 * 用于定期获取当前值
 */
export function registerGaugeCallbacks(callbacks: {
  getActiveAgentSessions?: () => number;
  getActiveWsConnections?: () => number;
  getCronJobCounts?: () => { enabled: number; disabled: number; agent: number; script: number };
}) {
  if (callbacks.getActiveAgentSessions) {
    const cb = callbacks.getActiveAgentSessions;
    agentActiveSessions.addCallback((result) => {
      result.observe(cb());
    });
  }

  if (callbacks.getActiveWsConnections) {
    const cb = callbacks.getActiveWsConnections;
    wsActiveConnections.addCallback((result) => {
      result.observe(cb());
    });
  }

  if (callbacks.getCronJobCounts) {
    const cb = callbacks.getCronJobCounts;
    cronJobsTotal.addCallback((result) => {
      const counts = cb();
      result.observe(counts.enabled, { enabled: "true", job_type: "all" });
      result.observe(counts.disabled, { enabled: "false", job_type: "all" });
      result.observe(counts.agent, { enabled: "all", job_type: "agent" });
      result.observe(counts.script, { enabled: "all", job_type: "script" });
    });
  }
}
