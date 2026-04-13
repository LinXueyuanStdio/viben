/**
 * Runtime policies for onboarding
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/runtime-policies.ts
 */

// ============================================================================
// Polling Policies
// ============================================================================

export interface BackoffPollingPolicy {
  /** 总超时时间 (ms) */
  timeoutMs: number;
  /** 初始轮询间隔 (ms) */
  initialIntervalMs: number;
  /** 最大轮询间隔 (ms) */
  maxIntervalMs: number;
  /** 退避因子 */
  backoffFactor: number;
}

export const GATEWAY_READINESS_POLICY: BackoffPollingPolicy = {
  timeoutMs: 45_000,
  initialIntervalMs: 1_000,
  maxIntervalMs: 4_000,
  backoffFactor: 1.5,
};

export const CLI_AVAILABILITY_POLICY: BackoffPollingPolicy = {
  timeoutMs: 45_000,
  initialIntervalMs: 500,
  maxIntervalMs: 2_000,
  backoffFactor: 1.5,
};

// ============================================================================
// Timeout Policies
// ============================================================================

export const CLI_TIMEOUTS = {
  /** 默认命令超时 */
  defaultCommandTimeoutMs: 30_000,
  /** Gateway 启动超时 */
  gatewayStartTimeoutMs: 60_000,
  /** Gateway 停止超时 */
  gatewayStopTimeoutMs: 10_000,
  /** 版本检查超时 */
  versionCheckTimeoutMs: 5_000,
  /** 下载超时 */
  downloadTimeoutMs: 300_000,
};

// ============================================================================
// UI Runtime Defaults
// ============================================================================

export const UI_RUNTIME_DEFAULTS = Object.freeze({
  envCheck: {
    /** 加载提示轮换间隔 (ms) */
    loadingTipRotateMs: 3_000,
    /** 进度条更新间隔 (ms) */
    progressTickMs: 50,
    /** 每次进度增量 */
    progressStep: 2,
    /** 启动延迟 (ms) */
    startupDelayMs: 0,
    /** 短过渡时间 (ms) */
    transitionShortMs: 300,
    /** 标准过渡时间 (ms) */
    transitionStandardMs: 500,
    /** 稳定过渡时间 (ms) */
    transitionSettleMs: 800,
  },
  gatewayBootstrap: {
    /** 基线进度百分比 */
    baselineProgress: 8,
    /** 进度条动画时间 (ms) */
    progressAnimationMs: 300,
  },
});

// ============================================================================
// Task Weights for Progress Calculation
// ============================================================================

export type OnboardingTaskKey = "gateway" | "config" | "python" | "claude";

export const ONBOARDING_TASK_WEIGHTS: Record<OnboardingTaskKey, number> = {
  gateway: 0.5,
  config: 0.2,
  python: 0.2,
  claude: 0.1,
};

// ============================================================================
// Retry Policies
// ============================================================================

export const RETRY_POLICIES = {
  /** Gateway 启动最大重试次数 */
  gatewayStartMaxRetries: 3,
  /** CLI 安装最大重试次数 */
  cliInstallMaxRetries: 2,
  /** npm 镜像回退重试次数 */
  npmMirrorFallbackRetries: 2,
};
