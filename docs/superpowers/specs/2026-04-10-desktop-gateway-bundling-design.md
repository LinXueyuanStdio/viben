# Desktop Gateway Bundling Design

> 桌面端内置 viben CLI，实现开箱即用的 Gateway 服务

## 问题背景

当前桌面端 (`apps/desktop`) 依赖用户系统已安装的 `viben` CLI 来启动 Gateway 服务。用户下载安装桌面端后，必须先执行 `npm install -g @viben/cli` 才能使用，这破坏了开箱即用的体验。

## 目标

1. 桌面端 bundle 一个 viben CLI sidecar binary
2. 启动时自动检测可用的 viben CLI（bundled + 系统安装）
3. 提供 UI 让用户选择使用哪个 viben CLI
4. 支持 macOS、Windows、Linux 三个平台

## 设计方案

### 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                 Gateway Selection UI                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Detected CLI Paths ──────────────────────────────────┐  │
│  │                                                       │  │
│  │  ● (Bundled) /Applications/Viben.app/.../viben        │  │
│  │    v1.0.0 - Built-in                                  │  │
│  │                                                       │  │
│  │  ○ /opt/homebrew/bin/viben                            │  │
│  │    v1.2.3 - Homebrew                                  │  │
│  │                                                       │  │
│  │  ○ /Users/xxx/.npm-global/bin/viben                   │  │
│  │    v1.1.0 - npm                                       │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Custom Path ─────────────────────────────────────────┐  │
│  │  [/path/to/viben                          ] [Check]   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Gateway Status:  🟢 Running on http://127.0.0.1:18790     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 连接逻辑

```
App Launch
    │
    ▼
Read selected viben path from ~/.viben/config.yaml (cli_tools.viben)
    │
    ├─ Has selected path? ─► Try connect to gateway
    │       │
    │       ├─ Gateway running? ─► Use it ✓
    │       │
    │       └─ Not running? ─► Start selected viben gateway
    │               │
    │               ├─ Success? ─► Use it ✓
    │               │
    │               └─ Failed? ─► Show settings, let user choose
    │
    └─ No selected path ─► Auto-detect & select first available
            │
            ▼
    Detect all viben CLI paths (bundled first, then system)
            │
            ▼
    Auto-select bundled if available, otherwise first detected
            │
            ▼
    Start gateway with selected path
```

### 检测优先级

1. **User-selected** - `~/.viben/config.yaml` 中的 `cli_tools.viben`
2. **Bundled (Sidecar)** - App bundle 内置的 viben 二进制
3. **Homebrew** - `/opt/homebrew/bin/viben`, `/usr/local/bin/viben`
4. **npm global** - `~/.npm-global/bin/viben`
5. **System PATH** - `which viben` / `where viben`

### 跨平台检测路径

| 平台 | Source | 路径 |
|------|--------|------|
| **macOS** | Bundled Sidecar | `$APP_BUNDLE/Contents/MacOS/viben` |
| | Homebrew | `/opt/homebrew/bin/viben`, `/usr/local/bin/viben` |
| | npm global | `~/.npm-global/bin/viben` |
| | nvm | `~/.nvm/versions/node/*/bin/viben` |
| | System PATH | `which viben` |
| **Windows** | Bundled Sidecar | `$APP_DIR\viben.exe` |
| | npm global | `%APPDATA%\npm\viben.cmd` |
| | Scoop | `%USERPROFILE%\scoop\shims\viben.exe` |
| | System PATH | `where viben` |
| **Linux** | Bundled Sidecar | `$APP_DIR/viben` (AppImage extracted) |
| | npm global | `~/.npm-global/bin/viben` |
| | nvm | `~/.nvm/versions/node/*/bin/viben` |
| | System PATH | `/usr/bin/viben`, `/usr/local/bin/viben` |
| | Snap | `/snap/bin/viben` |

### Sidecar Binary 构建

使用 `pkg` 或 `esbuild + node-sea` 将 Node.js CLI 编译为平台原生二进制：

| 平台 | Target Triple | 输出文件 |
|------|--------------|---------|
| macOS (Apple Silicon) | `aarch64-apple-darwin` | `viben-aarch64-apple-darwin` |
| macOS (Intel) | `x86_64-apple-darwin` | `viben-x86_64-apple-darwin` |
| Windows | `x86_64-pc-windows-msvc` | `viben-x86_64-pc-windows-msvc.exe` |
| Linux | `x86_64-unknown-linux-gnu` | `viben-x86_64-unknown-linux-gnu` |

### 配置存储

**存储位置**: `~/.viben/config.yaml`

```yaml
cli_tools:
  python: "/opt/homebrew/bin/python3"
  git: "/usr/bin/git"
  viben: "/Applications/Viben.app/Contents/MacOS/viben"  # 新增
```

**API 接口** (复用现有):
- `GET /api/cli-tools/detect` - 检测所有 CLI 工具（新增 viben）
- `GET /api/cli-tools/config` - 读取配置
- `PATCH /api/cli-tools/config` - 更新单个工具路径

## 实现变更

### 1. Tauri Sidecar 配置

**文件**: `apps/desktop/src-tauri/tauri.conf.json`

```json
{
  "bundle": {
    "externalBin": [
      "binaries/viben"
    ]
  }
}
```

### 2. 新增 CLI Tool: viben

**文件**: `packages/core/src/gateway/routes/python.ts`

扩展 `CliToolName` 类型和 `TOOL_CONFIGS`：

```typescript
export type CliToolName =
  | "python" | "git" | "gh" | "claude" | "codex"
  | "aider" | "goose" | "cline" | "continue" | "cursor"
  | "viben";  // 新增

const TOOL_CONFIGS: Record<CliToolName, ToolConfig> = {
  // ... existing tools
  viben: {
    versionArg: "--version",
    versionRegex: /viben\/(\d+\.\d+\.\d+)/,
    detectMethod: "npm-global",
  },
};
```

更新 `CliToolsInfo` 和 `CliToolsConfig` 类型。

### 3. 增强 Rust Gateway 命令

**文件**: `apps/desktop/src-tauri/src/commands/gateway.rs`

```rust
/// Get bundled sidecar viben path
#[tauri::command]
pub fn get_bundled_viben_path(app: AppHandle) -> Result<Option<String>, String> {
    // Use Tauri's sidecar resolution
    app.path_resolver()
        .resolve_resource("binaries/viben")
        .map(|p| Some(p.to_string_lossy().to_string()))
        .ok_or_else(|| "Bundled viben not found".to_string())
}

/// Start gateway with specified viben path
#[tauri::command]
pub async fn start_gateway_with_path(
    state: State<'_, GatewayState>,
    viben_path: String,
    port: Option<u16>,
    host: Option<String>,
) -> Result<GatewayStatus, String>
```

更新 `find_gateway_binary()` 函数，增加 bundled sidecar 检测。

### 4. 前端状态管理

**文件**: `apps/desktop/src/stores/app-store.ts`

```typescript
interface AppStore {
  // ... existing
  vibenPath: string;
  setVibenPath: (path: string) => void;
}
```

### 5. 前端 Hook

**新建文件**: `apps/desktop/src/hooks/use-viben-cli.ts`

参考 `use-python.ts` 的实现模式：
- 从 CLI tools cache 获取检测结果
- 支持用户选择路径
- 支持自定义路径验证

### 6. Gateway 设置 UI

**文件**: `apps/desktop/src/pages/settings-gateway.tsx`

增强现有页面，添加：
- 检测到的 viben CLI 列表（参考 Python onboarding UI）
- 标记 bundled 版本
- 自定义路径输入框
- Gateway 状态显示

### 7. Sidecar 构建脚本

**新建文件**: `packages/core/scripts/build-sidecar.ts`

```typescript
// 使用 pkg 或 esbuild 构建跨平台 sidecar binary
// 输出到 apps/desktop/src-tauri/binaries/
```

## 文件结构变更

```
apps/desktop/
├── src-tauri/
│   ├── tauri.conf.json              # + externalBin 配置
│   ├── binaries/                    # Sidecar binaries (构建时生成)
│   │   ├── viben-aarch64-apple-darwin
│   │   ├── viben-x86_64-apple-darwin
│   │   ├── viben-x86_64-pc-windows-msvc.exe
│   │   └── viben-x86_64-unknown-linux-gnu
│   └── src/commands/
│       └── gateway.rs               # 增强 sidecar 支持
│
├── src/
│   ├── hooks/
│   │   └── use-viben-cli.ts         # 新增
│   └── pages/
│       └── settings-gateway.tsx     # 增强 UI

packages/core/
├── src/gateway/routes/
│   └── python.ts                    # 扩展 CliToolName 类型
└── scripts/
    └── build-sidecar.ts             # 新增构建脚本
```

## 测试计划

1. **单元测试**
   - viben CLI 检测逻辑（各平台路径）
   - 版本解析正则表达式
   - 配置读写

2. **集成测试**
   - Gateway 启动/停止流程
   - sidecar 路径解析
   - 配置持久化

3. **手动测试**
   - macOS: Apple Silicon + Intel
   - Windows: x64
   - Linux: x64
   - 场景：无系统 CLI、有系统 CLI、自定义路径

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| sidecar binary 体积过大 | 使用 esbuild 优化，排除不必要依赖 |
| 跨平台 binary 构建复杂 | 使用 CI 矩阵构建，每个平台独立验证 |
| 版本不一致（bundled vs system） | UI 显示版本号，让用户知情选择 |
| 权限问题（Linux/macOS） | 构建时设置正确的 executable 权限 |
