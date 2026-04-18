# Viben Desktop Onboarding 环境检查自动安装实现计划

## Context

当前 Viben Desktop 的 onboarding 流程存在以下问题：
1. **Node.js 安装**是占位符实现，只返回"请手动安装"错误
2. **macOS Xcode CLT** 检查命令存在但未集成到前端流程
3. 用户在缺失依赖时需要手动安装，体验不佳

参考 Qclaw 实现，需要增强自动安装能力：
- macOS: 检测 Git/Xcode CLT → 触发系统安装弹窗 → 用户手动重试检测
- Node.js: 自动下载官方安装包 → 验证签名 → 提权安装 → 刷新环境
- 支持 nvm 安装策略作为替代方案

## Implementation Plan

### Phase 1: Rust 后端实现

**文件**: `apps/desktop/src-tauri/src/commands/cli_installer.rs`

#### 1.1 新增数据结构

```rust
/// macOS Git 工具准备结果 (参考 Qclaw)
#[derive(Debug, Serialize, Deserialize)]
pub struct MacGitToolsPrepareResult {
    pub ok: bool,
    pub error_code: Option<String>,  // "xcode_clt_pending" | "git_unavailable" | "prepare_failed"
    pub stderr: Option<String>,
}

/// Node.js 安装计划 (完整版，参考 Qclaw)
#[derive(Debug, Serialize, Deserialize)]
pub struct NodeInstallPlan {
    pub version: String,              // e.g., "v22.16.0"
    pub required_version: String,     // 最低要求版本 "22.16.0"
    pub requirement_source: String,   // "env-override" | "bundled-fallback"
    pub source: String,               // "official-dist-index" | "bundled-fallback"
    pub platform: String,             // "darwin" | "win32"
    pub detected_arch: String,        // 检测到的架构 "x64" | "arm64"
    pub installer_arch: String,       // 安装包架构 "x64" | "arm64" | "universal"
    pub dist_base_url: String,        // "https://nodejs.org/dist"
    pub url: String,                  // 完整下载 URL
    pub filename: String,             // e.g., "node-v22.16.0.pkg"
}

/// Node.js 检查结果 (增强版)
#[derive(Debug, Serialize, Deserialize)]
pub struct NodeCheckResultEnhanced {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub needs_upgrade: bool,
    pub required_version: String,
    pub target_version: Option<String>,
    pub install_strategy: String,     // "nvm" | "installer"
    pub error: Option<String>,
}

/// 下载进度事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,
    pub percent: Option<f32>,
    pub stage: String,                // "downloading" | "verifying" | "installing"
}

/// 安装器检查结果
#[derive(Debug, Serialize, Deserialize)]
pub struct InstallerInspectResult {
    pub ok: bool,
    pub issue_kind: Option<String>,   // 错误类型
    pub message: Option<String>,
    pub details: Option<String>,
}

/// 完整安装结果
#[derive(Debug, Serialize, Deserialize)]
pub struct InstallEnvResult {
    pub ok: bool,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub stage: Option<String>,        // 失败阶段
}
```

#### 1.2 新增命令

| 命令 | 功能 | 平台 |
|------|------|------|
| `prepare_mac_git_tools()` | 检查并准备 Git/Xcode CLT (参考 Qclaw) | macOS |
| `get_node_install_plan()` | 获取推荐的 Node.js 版本和下载 URL | 全平台 |
| `check_node_enhanced()` | 增强版 Node.js 检查，返回安装策略 | 全平台 |
| `download_node_installer(plan, window)` | 下载安装包，发送进度事件 | 全平台 |
| `inspect_node_installer(path)` | 验证安装包签名和系统策略 | macOS |
| `install_env(options)` | 统一安装入口，避免多次提权弹窗 | 全平台 |
| `refresh_environment()` | 刷新 PATH 环境变量 | 全平台 |

#### 1.3 macOS Xcode CLT 实现 (参考 Qclaw)

**核心脚本**:
```rust
const MAC_GIT_TOOLS_PREPARE_SCRIPT: &str = r#"
unset DEVELOPER_DIR
xcode-select -p >/dev/null 2>&1 || {
    xcode-select --install >/dev/null 2>&1 || true
    xcode-select -p >/dev/null 2>&1 || {
        echo "xcode_clt_pending"
        exit 1
    }
}
"#;
```

**prepare_mac_git_tools 逻辑**:
1. 先检测 `git --version` 是否可用
2. 如果失败，检查错误是否为开发者工具缺失
3. 执行安装脚本触发系统弹窗
4. 刷新环境变量
5. 重新检测 git
6. 如果仍失败，返回 `xcode_clt_pending` 让用户手动"重试识别"

#### 1.4 Node.js 安装实现要点

**macOS 安装流程**:
1. 检测架构，macOS 使用 `universal` 安装包
2. 下载 `.pkg` 文件到临时目录
3. 使用 `pkgutil --check-signature` 验证签名
4. 使用 `spctl --assess --type install` 检查系统策略
5. 使用 `id -Gn` 检查是否有管理员权限
6. 使用 `osascript` + AppleScript 提权运行 `installer -pkg ... -target /`

**Windows 安装流程**:
1. 获取安装计划:
   - 检测 CPU 架构: `std::env::consts::ARCH` (x86_64 → x64, aarch64 → arm64)
   - 构建下载 URL: `https://nodejs.org/dist/v{version}/node-v{version}-{arch}.msi`
2. 下载 `.msi` 文件到临时目录 `%TEMP%\node-installer\`
3. 使用 `msiexec` 静默安装:
   ```rust
   Command::new("msiexec")
       .args(["/i", &installer_path, "/qn", "/norestart"])
       .output()
   ```
4. 刷新环境变量 (从注册表读取):
   ```rust
   // 读取系统 PATH
   let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
   let env = hklm.open_subkey("SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment")?;
   let system_path: String = env.get_value("Path")?;

   // 读取用户 PATH
   let hkcu = RegKey::predef(HKEY_CURRENT_USER);
   let user_env = hkcu.open_subkey("Environment")?;
   let user_path: String = user_env.get_value("Path")?;

   // 更新当前进程 PATH
   std::env::set_var("PATH", format!("{};{}", system_path, user_path));
   ```
5. 重新检测 Node.js 验证安装成功

**nvm 安装策略** (可选，P2 功能):
- 检测系统是否有 nvm/fnm/volta
- 如果有，使用版本管理器安装: `nvm install <version>`

### Phase 2: 前端 Hook 修改

#### 2.1 修改 `use-node-installer.ts` (参考 Qclaw 流程)

**文件**: `apps/desktop/src/hooks/use-node-installer.ts`

```typescript
// 新增类型 (参考 Qclaw)
interface NodeInstallProgress {
  stage: "planning" | "downloading" | "verifying" | "installing" | "finalizing";
  percent: number;
  message: string;
}

interface UseNodeInstallerReturn {
  state: NodeInstallerState;
  issue: NodeInstallerIssue | null;
  currentVersion: string | null;
  currentPath: string | null;
  progress: NodeInstallProgress | null;
  installStrategy: "nvm" | "installer";  // NEW: 安装策略

  /** 增强版检查，返回安装策略 */
  checkNode: () => Promise<NodeCheckResult>;

  /** 准备 macOS Git 工具 (Xcode CLT) */
  prepareMacGitTools: () => Promise<MacGitToolsPrepareResult>;

  /** 下载 Node.js 安装包 */
  downloadInstaller: (plan: NodeInstallPlan) => Promise<string>;

  /** 检查安装包完整性 (macOS) */
  inspectInstaller: (path: string) => Promise<InstallerInspectResult>;

  /** 执行安装 */
  installEnv: (options: InstallEnvOptions) => Promise<InstallEnvResult>;

  reset: () => void;
}
```

**关键实现** (参考 Qclaw `runChecks` 流程):
1. macOS 先调用 `prepareMacGitTools()`
2. 如果返回 `xcode_clt_pending`，显示 StartupIssueDialog，用户点击"重试识别"
3. Node.js 检查失败时，获取 `installPlan`，下载、验证、安装
4. 监听 Tauri 事件 `node-install-progress` 更新进度

#### 2.2 修改 `use-env-orchestrator.ts`

**文件**: `apps/desktop/src/hooks/use-env-orchestrator.ts`

**关键修改** (参考 Qclaw `runChecks` 流程):

```typescript
// 执行流程 (非 DAG，而是条件分支)
const runChecks = async () => {
  // 1. macOS 特有：先检查 Git/Xcode CLT
  if (platform === 'darwin') {
    updateNode("nodejs", "checking", undefined, { message: "正在检查 Git 与 Xcode Command Line Tools..." });
    const macGitToolsResult = await nodeInstaller.prepareMacGitTools();

    if (!macGitToolsResult.ok) {
      const issue = classifyMacGitToolsIssue(macGitToolsResult);
      if (issue.kind === 'xcode-clt-pending') {
        // 显示 StartupIssueDialog，等待用户点击"重试识别"
        setStartupIssuePrompt(issue);
        updateNode("nodejs", "pending-install", undefined, {
          message: "请先完成 Xcode Command Line Tools 安装，再点击「重试识别」"
        });
        return; // 停止流程，等待用户操作
      }
      updateNode("nodejs", "error", issue.message);
      return;
    }
  }

  // 2. 检测 Node.js
  updateNode("nodejs", "checking", undefined, { message: "正在检查 Node.js..." });
  const nodeResult = await nodeInstaller.checkNode();
  const needNode = !nodeResult.installed;
  const nodeNeedsUpgrade = nodeResult.installed && nodeResult.needsUpgrade;

  // 3. 如果版本过低，提示手动升级
  if (nodeNeedsUpgrade) {
    updateNode("nodejs", "pending-install", undefined, {
      version: nodeResult.version,
      message: `Node.js ${nodeResult.requiredVersion} 或更高版本。当前版本过低，请手动升级。`
    });
    return;
  }

  // 4. 如果未安装，自动安装
  if (needNode) {
    // 获取安装计划
    const plan = await nodeInstaller.getInstallPlan();

    // 下载
    updateNode("nodejs", "checking", undefined, { message: `正在下载 Node.js ${plan.version}...` });
    const installerPath = await nodeInstaller.downloadInstaller(plan);

    // macOS: 验证签名
    if (platform === 'darwin') {
      updateNode("nodejs", "checking", undefined, { message: "正在校验安装包..." });
      const inspection = await nodeInstaller.inspectInstaller(installerPath);
      if (!inspection.ok) {
        setStartupIssuePrompt(createNodeInstallerIssue(inspection.issue_kind, inspection.message));
        return;
      }
    }

    // 执行安装
    updateNode("nodejs", "checking", undefined, { message: "正在安装 Node.js..." });
    const installResult = await nodeInstaller.installEnv({ needNode: true, nodeInstallerPath: installerPath });

    if (!installResult.ok) {
      const issue = classifyMacNodeInstallerFailure(installResult.stderr);
      setStartupIssuePrompt(issue);
      updateNode("nodejs", "error", issue.message);
      return;
    }

    // 刷新环境变量
    updateNode("nodejs", "checking", undefined, { message: "正在刷新环境变量..." });
    await nodeInstaller.refreshEnvironment();

    // 重新检测
    const recheck = await nodeInstaller.checkNode();
    if (!recheck.installed) {
      updateNode("nodejs", "error", "安装后仍无法检测到 Node.js");
      return;
    }
  }

  updateNode("nodejs", "success", undefined, { version: nodeResult.version });

  // 5. 继续检测 CLI...
};
```

#### 2.3 修改 `startup-issue-dialog.tsx` (参考 Qclaw)

**文件**: `apps/desktop/src/components/onboarding/startup-issue-dialog.tsx`

```typescript
// 参考 Qclaw 的 StartupIssueDialog
interface StartupIssueDialogProps {
  issue: NodeInstallerIssue;
  supportActions: EnvCheckSupportAction[];
  onClose: () => void;
  onRestart: () => void;  // "重试识别" 或 "继续安装"
}

// 关键逻辑
const restartLabel = issue.kind === 'xcode-clt-pending' ? '重试识别' : '继续安装';
const showXcodeInstallHint = issue.kind === 'xcode-clt-pending';

// 针对 xcode-clt-pending 显示特殊的安装图标 UI (两个应用图标)
{showXcodeInstallHint && <XcodeInstallVisualization />}
```

### Phase 3: 流程设计 (参考 Qclaw，非 DAG)

**说明**: Qclaw 实际上不是严格的 DAG 执行，而是**条件分支**的顺序流程。

**macOS 流程**:
```
1. 检查 Git/Xcode CLT (prepareMacGitTools)
   ├── 成功 → 继续
   └── xcode_clt_pending → 显示 StartupIssueDialog，用户点击"重试识别"

2. 检测 Node.js (checkNode)
   ├── 已安装且版本OK → 继续
   ├── 已安装但版本低 → 显示"请手动升级"，提供升级按钮
   └── 未安装 → 自动安装流程:
       a. 获取安装计划 (getNodeInstallPlan)
       b. 下载安装包 (downloadNodeInstaller) + 进度事件
       c. 验证签名 (inspectNodeInstaller)
       d. 执行安装 (installEnv)
       e. 刷新环境变量 (refreshEnvironment)
       f. 重新检测

3. 检测 CLI (checkVibenCli)
   ├── 已安装 → 继续
   └── 未安装 → 自动安装 (installVibenCli with npm 镜像回退)

4. 启动 Gateway → 验证连接 → 完成
```

**Windows 流程**:
```
1. 检测 Node.js (checkNode)
   ├── 已安装且版本OK → 继续
   ├── 已安装但版本低 → 显示"请手动升级"，提供升级按钮
   └── 未安装 → 自动安装流程:
       a. 获取安装计划 (getNodeInstallPlan)
          - platform: "win32"
          - arch: 检测 CPU 架构 (x64/x86/arm64)
          - filename: "node-v22.16.0-x64.msi"
          - url: "https://nodejs.org/dist/v22.16.0/node-v22.16.0-x64.msi"
       b. 下载安装包 (downloadNodeInstaller) + 进度事件
          - 下载到临时目录 %TEMP%\node-installer\
       c. 执行静默安装 (installEnv)
          - 命令: msiexec /i <path> /qn /norestart
          - 或使用 PowerShell: Start-Process msiexec -ArgumentList '/i <path> /qn /norestart' -Wait -NoNewWindow
       d. 刷新环境变量 (refreshEnvironment)
          - 从注册表读取最新 PATH:
            HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\Environment\Path
            HKEY_CURRENT_USER\Environment\Path
          - 更新当前进程的 PATH 环境变量
       e. 重新检测 Node.js

2. 检测 CLI (checkVibenCli)
   ├── 已安装且版本OK → 继续
   ├── 已安装但版本不兼容 → 显示版本问题，提供升级/降级按钮
   └── 未安装 → 自动安装 (installVibenCli)
       a. 使用 npm.cmd install -g viben@<version>
       b. 支持 npm 镜像回退:
          - registry.npmjs.org (默认)
          - registry.npmmirror.com (淘宝镜像)
          - mirrors.cloud.tencent.com/npm/ (腾讯镜像)
       c. 验证安装: viben --version

3. 启动 Gateway (startGateway)
   ├── 检查是否已运行 (检测端口 18790)
   ├── 如已运行 → 验证连接
   └── 如未运行 → 启动进程
       a. 定位 viben 二进制: where viben
       b. 执行: viben gateway start --port 18790
       c. 等待启动完成 (轮询 health endpoint)

4. 验证连接 (checkConnection)
   ├── 请求: GET http://127.0.0.1:18790/health
   ├── 使用退避轮询策略 (pollWithBackoff)
   └── 成功 → 完成，进入下一步
```

**状态管理** (参考 Qclaw):
```typescript
type StepStatus =
  | 'pending'         // 等待
  | 'checking'        // 检查中
  | 'ok'              // 完成
  | 'installing'      // 安装中
  | 'pending-install' // 等待安装 (需要用户操作)
  | 'error'           // 错误
  | 'canceled';       // 已取消
```

### Phase 4: UI 组件修改

#### 4.1 修改 `env-check-step-item.tsx`

**文件**: `apps/desktop/src/components/onboarding/env-check-step-item.tsx`

新增 props：
- `progress?: { percent: number; message: string }` - 安装进度条
- `logs?: string[]` - 操作日志

在 `checking` 状态显示进度条和消息。

#### 4.2 修改 `env-check-page.tsx`

**文件**: `apps/desktop/src/components/onboarding/env-check-page.tsx`

- 从 orchestrator 获取各节点的进度信息
- 传递 progress 到 EnvCheckStepItem

### Phase 5: 错误处理增强 (参考 Qclaw)

**文件**: `apps/desktop/src/lib/onboarding/node-installer-issues.ts`

**Qclaw 定义的 15 种错误类型** (确保都支持):

```typescript
export type NodeInstallerIssueKind =
  | 'missing-installer'           // 安装包不存在
  | 'corrupted-installer'         // 安装包损坏
  | 'missing-system-command'      // 缺少系统命令
  | 'xcode-clt-pending'           // Xcode CLT 等待安装
  | 'git-unavailable'             // Git 不可用
  | 'developer-tools-prepare-failed' // 开发者工具准备失败
  | 'not-admin-user'              // 非管理员用户
  | 'blocked-by-policy'           // 被策略阻止
  | 'unsupported-macos'           // 不支持的 macOS 版本
  | 'user-cancelled'              // 用户取消
  | 'permission-denied'           // 权限被拒
  | 'installer-failed'            // 安装器失败
  | 'download-failed';            // 下载失败

// 每种错误都需要:
// 1. 中文标题和详细描述
// 2. 建议操作 (重试、跳过、手动下载、打开链接等)
// 3. 支持操作链接 (如 Node.js 官网)
```

**支持操作策略**:
```typescript
// 需要显示手动下载链接的错误类型
const NODE_MANUAL_DOWNLOAD_ISSUE_KINDS = new Set([
  'download-failed',
  'installer-failed',
  'permission-denied',
  'blocked-by-policy',
]);

export function getEnvCheckSupportActionsForIssueKind(issueKind?: string): EnvCheckSupportAction[] {
  if (!issueKind || !NODE_MANUAL_DOWNLOAD_ISSUE_KINDS.has(issueKind)) return [];
  return [{ kind: 'external-link', label: '打开 Node 官网', href: 'https://nodejs.org/' }];
}
```

### Phase 6: 国际化

**文件**: `apps/desktop/src/i18n/locales/zh-CN.json`

新增文案：
- `onboarding.envCheck.checkingGitTools` - "正在检查 Git 与 Xcode Command Line Tools..."
- `onboarding.envCheck.xcodeCltPending` - "请先完成 Xcode Command Line Tools 安装，再点击「重试识别」"
- `onboarding.envCheck.nodeDownloading` - "正在下载 Node.js {version}..."
- `onboarding.envCheck.nodeVerifying` - "正在校验安装包..."
- `onboarding.envCheck.nodeInstalling` - "正在安装 Node.js..."
- `onboarding.envCheck.refreshingEnv` - "正在刷新环境变量..."
- `onboarding.envCheck.retryDetect` - "重试识别"
- `onboarding.envCheck.continueInstall` - "继续安装"

## Critical Files

| 文件 | 修改类型 | 优先级 |
|------|----------|--------|
| `src-tauri/src/commands/cli_installer.rs` | 重大修改 | P0 |
| `src/hooks/use-xcode-clt-installer.ts` | 新增 | P0 |
| `src/hooks/use-node-installer.ts` | 修改 | P0 |
| `src/hooks/use-env-orchestrator.ts` | 修改 | P0 |
| `src/lib/onboarding/check-dag.ts` | 修改 | P0 |
| `src/components/onboarding/env-check-step-item.tsx` | 修改 | P1 |
| `src/components/onboarding/env-check-page.tsx` | 修改 | P1 |
| `src/i18n/locales/zh-CN.json` | 修改 | P1 |

## Existing Utilities to Reuse

- `node-installer-issues.ts` - 已有 13 种错误类型定义，需补充到 15 种
- `env-check-policy.ts` - `getEnvCheckSupportActionsForIssueKind()` 获取支持操作
- `cancellation.ts` - `CancellationRegistry` 用于取消支持
- `use-cli-installer.ts` - npm 镜像回退机制可复用

## P2 功能 (未来实现)

以下是 Qclaw 实现但本次不实现的功能：

1. **nvm 安装策略**: 检测系统是否有 nvm，使用 nvm 安装
2. **历史数据恢复**: `recoverHistoryOnlyOpenClaw()` 恢复旧版本数据
3. **版本升降级管理**: `checkOpenClawUpgrade()` 自动升级/降级
4. **接管备份机制**: `ensureOpenClawBaselineBackup()` 备份原有数据
5. **权限自动修复**: `runCliLikeWithPermissionAutoRepair()` 自动处理权限问题

## Verification

### 手动测试清单

1. **macOS Xcode CLT 流程**
   - [ ] 全新 macOS 环境触发 Xcode CLT 安装弹窗
   - [ ] 等待安装完成后自动继续
   - [ ] 取消安装显示错误提示

2. **Node.js 安装流程**
   - [ ] macOS: 下载 .pkg 并提权安装
   - [ ] Windows: 下载 .msi 静默安装
   - [ ] 安装进度 UI 正确显示
   - [ ] 安装后 PATH 刷新成功

3. **错误恢复**
   - [ ] 网络中断后重试成功
   - [ ] 权限不足显示清晰提示
   - [ ] 安装器验证失败显示原因

### 验证命令

```bash
# 构建 desktop 应用
cd apps/desktop && pnpm build

# 运行开发模式
cd apps/desktop && pnpm tauri dev
```
