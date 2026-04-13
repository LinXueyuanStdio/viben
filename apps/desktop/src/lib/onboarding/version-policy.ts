/**
 * Version policy for Viben CLI
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/openclaw-version-policy.ts
 */

// ============================================================================
// Version Constants
// ============================================================================

/** 最低支持版本 */
export const MIN_SUPPORTED_VERSION = "0.5.0";

/** 最高支持版本 (超过此版本可能不兼容) */
export const MAX_SUPPORTED_VERSION = "1.0.0";

/** 推荐安装版本 */
export const PINNED_VERSION = "0.5.0";

// ============================================================================
// Version Enforcement Types
// ============================================================================

export type VersionEnforcement =
  | "none"              // 版本符合要求，无需操作
  | "optional_upgrade"  // 可选升级 (有新版本可用)
  | "required_upgrade"  // 必须升级 (低于最低版本)
  | "auto_downgrade"    // 自动降级 (高于最高版本)
  | "manual_block";     // 阻断需手动处理

export type VersionPolicyState =
  | "supported_target"    // 版本正好是推荐版本
  | "supported_not_target" // 版本在支持范围内但不是推荐版本
  | "below_min"           // 低于最低版本
  | "above_max";          // 高于最高版本

// ============================================================================
// Version Comparison
// ============================================================================

/**
 * 比较两个版本号
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const normalize = (v: string) => v.replace(/^v/, "").split("-")[0]; // 移除 v 前缀和预发布标签
  const partsA = normalize(a).split(".").map(Number);
  const partsB = normalize(b).split(".").map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

/**
 * 检查版本是否满足最低要求
 */
export function meetsMinVersion(version: string): boolean {
  return compareVersions(version, MIN_SUPPORTED_VERSION) >= 0;
}

/**
 * 检查版本是否超过最高版本
 */
export function exceedsMaxVersion(version: string): boolean {
  return compareVersions(version, MAX_SUPPORTED_VERSION) > 0;
}

// ============================================================================
// Version Policy Classification
// ============================================================================

/**
 * 分类版本状态
 *
 * Qclaw 参考: classifyOpenClawVersionLockState
 */
export function classifyVersionState(version: string | null | undefined): VersionPolicyState {
  if (!version) {
    return "below_min"; // 无版本视为低于最低要求
  }

  const normalized = version.replace(/^v/, "");

  if (compareVersions(normalized, MIN_SUPPORTED_VERSION) < 0) {
    return "below_min";
  }

  if (compareVersions(normalized, MAX_SUPPORTED_VERSION) > 0) {
    return "above_max";
  }

  if (compareVersions(normalized, PINNED_VERSION) === 0) {
    return "supported_target";
  }

  return "supported_not_target";
}

/**
 * 根据版本状态确定执行策略
 */
export function getVersionEnforcement(state: VersionPolicyState): VersionEnforcement {
  switch (state) {
    case "supported_target":
      return "none";
    case "supported_not_target":
      return "optional_upgrade";
    case "below_min":
      return "required_upgrade";
    case "above_max":
      return "auto_downgrade"; // 或 "manual_block" 根据配置
  }
}

// ============================================================================
// Version Check Result
// ============================================================================

export interface VersionCheckResult {
  /** 当前版本 */
  currentVersion: string | null;
  /** 版本状态 */
  state: VersionPolicyState;
  /** 执行策略 */
  enforcement: VersionEnforcement;
  /** 是否需要操作 */
  actionRequired: boolean;
  /** 目标版本 (如果需要升级/降级) */
  targetVersion: string | null;
  /** 人类可读的描述 */
  message: string;
}

export function checkVersion(version: string | null | undefined): VersionCheckResult {
  const state = classifyVersionState(version);
  const enforcement = getVersionEnforcement(state);
  const actionRequired = enforcement !== "none" && enforcement !== "optional_upgrade";

  let message: string;
  let targetVersion: string | null = null;

  switch (state) {
    case "supported_target":
      message = `当前版本 ${version} 是推荐版本`;
      break;
    case "supported_not_target":
      message = `当前版本 ${version} 可用，推荐升级到 ${PINNED_VERSION}`;
      targetVersion = PINNED_VERSION;
      break;
    case "below_min":
      message = `当前版本 ${version ?? "未知"} 低于最低要求 ${MIN_SUPPORTED_VERSION}，需要升级`;
      targetVersion = PINNED_VERSION;
      break;
    case "above_max":
      message = `当前版本 ${version} 高于测试版本 ${MAX_SUPPORTED_VERSION}，可能存在兼容性问题`;
      targetVersion = PINNED_VERSION;
      break;
  }

  return {
    currentVersion: version ?? null,
    state,
    enforcement,
    actionRequired,
    targetVersion,
    message,
  };
}

// ============================================================================
// Install Source Detection
// ============================================================================

export type CliInstallSource =
  | "npm-global"    // npm -g 安装
  | "npx"           // npx 运行
  | "homebrew"      // Homebrew 安装
  | "bundled"       // 应用内置
  | "manual"        // 手动安装
  | "unknown";      // 未知

/**
 * 判断安装来源是否支持自动版本修正
 */
export function supportsAutoCorrection(source: CliInstallSource): boolean {
  // npm-global 和 bundled 支持自动修正
  // homebrew 需要手动操作
  // manual 和 unknown 不确定
  return source === "npm-global" || source === "bundled";
}
