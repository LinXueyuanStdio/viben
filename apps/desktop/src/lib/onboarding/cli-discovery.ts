/**
 * CLI Discovery mechanism
 *
 * Scans multiple locations to find Viben CLI installation
 * Supports ownership detection and baseline backup
 */

// ============================================================================
// Types
// ============================================================================

/**
 * CLI 所有权状态
 */
export type CliOwnershipState =
  | "viben-installed"        // Viben 自己安装的
  | "external-preexisting"   // 外部预装的
  | "unknown-external";      // 未知来源

/**
 * CLI 发现结果
 */
export interface CliDiscoveryResult {
  found: boolean;
  path?: string;
  version?: string;
  ownership: CliOwnershipState;
  installMethod?: "npm" | "npx" | "bundled" | "manual";
}

/**
 * CLI 搜索位置
 */
export interface CliSearchLocation {
  path: string;
  priority: number;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * CLI 搜索位置优先级列表 (macOS)
 */
export const CLI_SEARCH_LOCATIONS: CliSearchLocation[] = [
  // Bundled sidecar (highest priority)
  { path: "$RESOURCE_DIR/viben", priority: 1, description: "Bundled sidecar" },
  // User-selected path
  { path: "$USER_SELECTED", priority: 2, description: "User selected path" },
  // Global npm install
  { path: "/usr/local/bin/viben", priority: 3, description: "Global npm (Intel Mac)" },
  { path: "/opt/homebrew/bin/viben", priority: 4, description: "Global npm (Apple Silicon)" },
  // NVM installations
  { path: "$HOME/.nvm/versions/node/*/bin/viben", priority: 5, description: "NVM installation" },
  // Homebrew Node
  { path: "/usr/local/lib/node_modules/viben/bin/viben", priority: 6, description: "Homebrew Node modules" },
  // User local
  { path: "$HOME/.local/bin/viben", priority: 7, description: "User local bin" },
];

/**
 * 最低支持的 CLI 版本
 */
export const MIN_CLI_VERSION = "0.1.0";

// ============================================================================
// Discovery Functions
// ============================================================================

/**
 * 解析路径中的环境变量
 */
export function resolvePathVariables(
  path: string,
  context: {
    resourceDir?: string;
    userSelected?: string;
    homeDir?: string;
  }
): string {
  let resolved = path;

  if (context.resourceDir) {
    resolved = resolved.replace("$RESOURCE_DIR", context.resourceDir);
  }
  if (context.userSelected) {
    resolved = resolved.replace("$USER_SELECTED", context.userSelected);
  }
  if (context.homeDir) {
    resolved = resolved.replace("$HOME", context.homeDir);
  }

  return resolved;
}

/**
 * 解析版本字符串中的语义版本
 */
export function parseCliVersion(versionOutput: string): string | null {
  // Match patterns like "viben 0.1.0", "v0.1.0", "0.1.0"
  const match = versionOutput.match(/v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/);
  return match ? match[1] : null;
}

/**
 * 比较语义版本
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map((x) => parseInt(x, 10) || 0);
  const partsB = b.split(".").map((x) => parseInt(x, 10) || 0);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;
    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }

  return 0;
}

/**
 * 检查版本是否满足最低要求
 */
export function isVersionSatisfied(version: string, minVersion: string = MIN_CLI_VERSION): boolean {
  return compareVersions(version, minVersion) >= 0;
}

/**
 * 推断 CLI 所有权状态
 */
export function inferCliOwnership(
  path: string,
  context: {
    vibenInstallMarkerExists?: boolean;
    resourceDir?: string;
  }
): CliOwnershipState {
  // Bundled sidecar is always viben-installed
  if (context.resourceDir && path.startsWith(context.resourceDir)) {
    return "viben-installed";
  }

  // Check for Viben install marker
  if (context.vibenInstallMarkerExists) {
    return "viben-installed";
  }

  // Global npm path suggests external installation
  if (
    path.includes("/usr/local/bin") ||
    path.includes("/opt/homebrew/bin") ||
    path.includes("node_modules")
  ) {
    return "external-preexisting";
  }

  return "unknown-external";
}

// ============================================================================
// Baseline Backup
// ============================================================================

/**
 * 基线备份信息
 */
export interface BaselineBackup {
  originalPath: string;
  originalVersion: string;
  backupPath?: string;
  backupTime: number;
}

/**
 * 创建基线备份描述
 */
export function createBaselineBackupDescription(backup: BaselineBackup): string {
  const date = new Date(backup.backupTime);
  return `CLI v${backup.originalVersion} at ${backup.originalPath} (backed up ${date.toLocaleString()})`;
}
