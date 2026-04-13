/**
 * Gateway runtime state and diagnostics
 *
 * Qclaw 参考:
 * - /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-runtime-state.ts
 * - /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-runtime-diagnostics.ts
 */

// ============================================================================
// Gateway Runtime State Codes (18 types)
// ============================================================================

export type GatewayRuntimeStateCode =
  | "healthy"                      // 正常运行
  | "not_running"                  // 未运行
  | "starting"                     // 正在启动
  | "stopping"                     // 正在停止
  | "port_conflict_same"           // 端口被同一 Gateway 占用
  | "port_conflict_foreign"        // 端口被其他进程占用
  | "token_mismatch"               // Token 不匹配
  | "auth_missing"                 // 认证信息缺失
  | "config_invalid"               // 配置无效
  | "version_mismatch"             // 版本不匹配
  | "cli_not_found"                // CLI 未找到
  | "cli_error"                    // CLI 执行错误
  | "connection_refused"           // 连接被拒绝
  | "connection_timeout"           // 连接超时
  | "websocket_error"              // WebSocket 错误
  | "network_blocked"              // 网络被阻断
  | "service_stale"                // 服务过期
  | "unknown_error";               // 未知错误

// ============================================================================
// Gateway State
// ============================================================================

export interface GatewayRuntimeState {
  code: GatewayRuntimeStateCode;
  /** 是否健康 */
  healthy: boolean;
  /** 进程 ID (如果运行中) */
  pid?: number;
  /** 端口号 */
  port?: number;
  /** Gateway URL */
  url?: string;
  /** 版本号 */
  version?: string;
  /** 错误详情 */
  error?: string;
  /** 最后检查时间 */
  lastChecked: number;
}

// ============================================================================
// State Classification
// ============================================================================

/**
 * 判断状态是否允许继续
 */
export function isRecoverableState(code: GatewayRuntimeStateCode): boolean {
  const recoverableCodes: GatewayRuntimeStateCode[] = [
    "not_running",
    "starting",
    "port_conflict_same",
    "token_mismatch",
    "service_stale",
  ];
  return recoverableCodes.includes(code);
}

/**
 * 判断状态是否为致命错误
 */
export function isFatalState(code: GatewayRuntimeStateCode): boolean {
  const fatalCodes: GatewayRuntimeStateCode[] = [
    "cli_not_found",
    "config_invalid",
    "network_blocked",
  ];
  return fatalCodes.includes(code);
}

/**
 * 判断状态是否为软警告 (可继续但有问题)
 */
export function isWarningState(code: GatewayRuntimeStateCode): boolean {
  const warningCodes: GatewayRuntimeStateCode[] = [
    "version_mismatch",
    "port_conflict_foreign",
  ];
  return warningCodes.includes(code);
}

// ============================================================================
// Error Pattern Matching
// ============================================================================

/**
 * 从错误输出分类 Gateway 状态
 *
 * Qclaw 参考: gateway-runtime-diagnostics.ts
 */
export function classifyGatewayError(errorOutput: string): GatewayRuntimeStateCode {
  const normalized = errorOutput.toLowerCase();

  // 端口冲突
  if (normalized.includes("eaddrinuse") || normalized.includes("port") && normalized.includes("in use")) {
    if (normalized.includes("viben") || normalized.includes("gateway")) {
      return "port_conflict_same";
    }
    return "port_conflict_foreign";
  }

  // Token/认证问题
  if (normalized.includes("token") || normalized.includes("unauthorized") || normalized.includes("401")) {
    return "token_mismatch";
  }
  if (normalized.includes("auth") || normalized.includes("authentication")) {
    return "auth_missing";
  }

  // 连接问题
  if (normalized.includes("econnrefused") || normalized.includes("connection refused")) {
    return "connection_refused";
  }
  if (normalized.includes("etimedout") || normalized.includes("timeout")) {
    return "connection_timeout";
  }
  if (normalized.includes("websocket") || normalized.includes("ws://") || normalized.includes("1006")) {
    return "websocket_error";
  }

  // CLI 问题
  if (normalized.includes("command not found") || normalized.includes("not found")) {
    return "cli_not_found";
  }

  // 配置问题
  if (normalized.includes("config") || normalized.includes("invalid")) {
    return "config_invalid";
  }

  return "unknown_error";
}

// ============================================================================
// Human-Readable State Description
// ============================================================================

export interface GatewayStateDescription {
  title: string;
  detail: string;
  severity: "info" | "warning" | "error";
}

export function getGatewayStateDescription(code: GatewayRuntimeStateCode): GatewayStateDescription {
  switch (code) {
    case "healthy":
      return { title: "Gateway 运行正常", detail: "所有服务正常运行中。", severity: "info" };
    case "not_running":
      return { title: "Gateway 未运行", detail: "Gateway 服务尚未启动。", severity: "warning" };
    case "starting":
      return { title: "Gateway 正在启动", detail: "请稍候...", severity: "info" };
    case "stopping":
      return { title: "Gateway 正在停止", detail: "请稍候...", severity: "info" };
    case "port_conflict_same":
      return { title: "端口被占用", detail: "检测到另一个 Gateway 实例正在运行。", severity: "warning" };
    case "port_conflict_foreign":
      return { title: "端口冲突", detail: "端口被其他程序占用。建议更换端口或关闭冲突程序。", severity: "error" };
    case "token_mismatch":
      return { title: "认证 Token 不匹配", detail: "尝试重新启动 Gateway 以刷新认证。", severity: "warning" };
    case "auth_missing":
      return { title: "认证信息缺失", detail: "需要重新配置认证信息。", severity: "error" };
    case "config_invalid":
      return { title: "配置无效", detail: "Gateway 配置文件存在问题。请检查配置。", severity: "error" };
    case "version_mismatch":
      return { title: "版本不匹配", detail: "Gateway 版本与应用不兼容。建议更新。", severity: "warning" };
    case "cli_not_found":
      return { title: "CLI 未找到", detail: "无法找到 Viben CLI。请先安装。", severity: "error" };
    case "cli_error":
      return { title: "CLI 执行错误", detail: "执行 Viben CLI 命令时出错。", severity: "error" };
    case "connection_refused":
      return { title: "连接被拒绝", detail: "无法连接到 Gateway。服务可能未启动。", severity: "error" };
    case "connection_timeout":
      return { title: "连接超时", detail: "连接 Gateway 超时。请检查网络或重试。", severity: "error" };
    case "websocket_error":
      return { title: "WebSocket 错误", detail: "WebSocket 连接异常。", severity: "error" };
    case "network_blocked":
      return { title: "网络被阻断", detail: "网络连接被防火墙或代理阻断。", severity: "error" };
    case "service_stale":
      return { title: "服务过期", detail: "Gateway 服务状态过期，需要重新启动。", severity: "warning" };
    case "unknown_error":
    default:
      return { title: "未知错误", detail: "发生未知错误。请查看日志获取详情。", severity: "error" };
  }
}
