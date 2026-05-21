# viben app 命令设计文档

## 概述

实现 `viben app` 命令，用于从 GitHub releases 下载并安装 Viben 桌面端应用。支持自动检测平台、指定版本下载、可选自动安装。

## 命令结构

```bash
viben app install [version]   # 下载桌面端安装包
  -c, --check                 # 仅检查版本，不下载
  -i, --install               # 下载后自动安装
  -o, --output <dir>          # 指定下载目录（默认：~/Downloads）
  -f, --force                 # 覆盖已存在的下载文件
  --format <exe|msi>          # Windows 安装包格式（默认 exe）

viben app check               # 检查桌面端最新版本（等同于 install --check）
```

> **注意**：`viben app check` 是 `viben app install --check` 的简写。

### 版本参数格式

- `viben app install` - 下载最新版本
- `viben app install v1.2.0` - 下载指定版本
- `viben app install 1.2.0` - 同上（自动补 v 前缀）

## 平台检测

根据 `process.platform` 和 `process.arch` 自动选择对应安装包：

| 平台 | 架构 | 安装包 |
|------|------|--------|
| darwin | arm64 | `Viben_x.x.x_aarch64.dmg` |
| darwin | x64 | `Viben_x.x.x_x64.dmg` |
| win32 | x64 | `Viben_x.x.x_x64-setup.exe`（默认） |
| win32 | x64 | `Viben_x.x.x_x64_en-US.msi`（--format msi） |
| linux | x64 | `Viben_x.x.x_amd64.deb` |

**暂不支持的平台**（显示明确错误提示）：
- Windows ARM64
- Linux ARM64

> 文件名中 `x64` 与 `x86_64` 可能混用，实现时需兼容两种格式匹配。

## 版本信息获取

采用两者结合策略，优先使用 releases.json，失败时 fallback 到 GitHub API：

### 优先：releases.json

```
# 最新版本
https://github.com/LinXueyuanStdio/viben/releases/latest/download/releases.json

# 指定版本
https://github.com/LinXueyuanStdio/viben/releases/download/v{version}/releases.json
```

releases.json 结构（与 release workflow 生成的一致）：

```json
{
  "version": "1.2.0",
  "tag": "v1.2.0",
  "date": "2026-05-20T00:00:00Z",
  "repository": "LinXueyuanStdio/viben",
  "components": {
    "cli": true,
    "desktop": true
  },
  "cli": {
    "install_methods": { ... },
    "assets": { ... }
  },
  "desktop": {
    "assets": {
      "macos": {
        "arm64": { "url": "https://...", "name": "Viben_1.2.0_aarch64.dmg" },
        "x64": { "url": "https://...", "name": "Viben_1.2.0_x64.dmg" }
      },
      "windows": {
        "msi": { "url": "https://...", "name": "Viben_1.2.0_x64_en-US.msi" },
        "exe": { "url": "https://...", "name": "Viben_1.2.0_x64-setup.exe" }
      },
      "linux": {
        "deb": { "url": "https://...", "name": "Viben_1.2.0_amd64.deb" }
      }
    }
  },
  "links": { ... }
}
```

> 实现时只需读取 `desktop.assets` 部分。

### Fallback：GitHub API

```
# 最新版本
https://api.github.com/repos/LinXueyuanStdio/viben/releases/latest

# 指定版本
https://api.github.com/repos/LinXueyuanStdio/viben/releases/tags/v{version}
```

从 API 响应的 `assets` 数组中根据文件名匹配对应平台的安装包。

## 下载流程

```
用户执行 viben app install [version]
    ↓
检测当前平台 (process.platform + process.arch)
    ↓
获取版本信息 (releases.json → fallback GitHub API)
    ↓
根据平台选择对应安装包 URL
    ↓
下载到目标目录（使用 cli-progress 显示进度条）
    ↓
如果指定 --install：执行平台特定安装逻辑
    ↓
显示结果（成功/失败 + 后续操作提示）
```

## 自动安装逻辑

当用户指定 `--install` 时，执行平台特定的安装流程：

### macOS (.dmg)

```bash
# 1. 挂载 DMG 并获取实际挂载点
MOUNT_OUTPUT=$(hdiutil attach Viben_x.x.x_aarch64.dmg -nobrowse -readonly)
MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep -o '/Volumes/[^[:space:]]*')

# 2. 复制到 Applications
cp -R "$MOUNT_POINT/Viben.app" /Applications/

# 3. 卸载 DMG
hdiutil detach "$MOUNT_POINT" -quiet

# 4. 清除隔离属性（避免"已损坏"提示）
xattr -cr /Applications/Viben.app 2>/dev/null || true
```

> **注意**：DMG 卷名可能包含版本号，需从 `hdiutil attach` 输出动态解析挂载点。

### Windows (.exe)

```bash
# 静默安装（NSIS 安装程序）
Viben_x.x.x_x64-setup.exe /S
```

### Linux (.deb)

```bash
# 优先使用 apt install（自动处理依赖）
sudo apt install ./Viben_x.x.x_amd64.deb

# 如果 apt 不可用，fallback 到 dpkg + apt-get -f
sudo dpkg -i Viben_x.x.x_amd64.deb && sudo apt-get install -f
```

### 权限处理

- **macOS**：不需要额外权限（xattr 失败时静默忽略）
- **Windows**：可能需要管理员权限（静默安装时）
- **Linux**：需要 sudo 权限，无权限时显示完整的手动安装命令供用户复制

## 错误处理

### 错误代码定义

| 错误代码 | 场景 | 处理方式 |
|----------|------|----------|
| `NETWORK_ERROR` | 网络不可用/超时/DNS 解析失败 | 显示具体错误类型，提示检查网络连接 |
| `VERSION_NOT_FOUND` | 指定版本不存在 | 显示错误，提示运行 `viben app check` 查看最新版本 |
| `PLATFORM_NOT_SUPPORTED` | 平台不支持（如 win32-arm64） | 显示错误，列出当前支持的平台 |
| `RATE_LIMITED` | GitHub API 限流 | 显示重试时间，建议稍后重试 |
| `DOWNLOAD_FAILED` | 下载中断/校验失败 | 支持断点续传，失败时提示手动下载 URL |
| `INSTALL_FAILED` | 安装失败 | 显示具体错误，提供手动安装命令 |
| `INSUFFICIENT_SPACE` | 磁盘空间不足 | 下载前检查，提前警告 |
| `OUTPUT_DIR_ERROR` | 输出目录不存在或不可写 | 显示错误，提示创建目录或检查权限 |
| `FILE_EXISTS` | 下载文件已存在（未指定 --force） | 提示使用 --force 覆盖 |

### JSON 错误输出格式

```json
{
  "success": false,
  "error": {
    "code": "VERSION_NOT_FOUND",
    "message": "Version v9.9.9 not found. Run 'viben app check' to see the latest version."
  }
}
```

## 输出格式

### 普通输出

```bash
$ viben app install
Checking latest version...
  Latest: v1.2.0
  Platform: macOS (Apple Silicon)

Downloading Viben_1.2.0_aarch64.dmg...
  [████████████████████░░░░] 80% (45.2 MB / 56.5 MB)

✓ Downloaded to ~/Downloads/Viben_1.2.0_aarch64.dmg

To install, run:
  open ~/Downloads/Viben_1.2.0_aarch64.dmg
```

### JSON 输出 (--json)

```json
{
  "success": true,
  "version": "1.2.0",
  "platform": "darwin-arm64",
  "file": "~/Downloads/Viben_1.2.0_aarch64.dmg",
  "size": 59277312
}
```

## 文件结构

```
packages/core/src/cli/commands/app.ts       # 命令注册与子命令
packages/core/src/cli/lib/app-installer.ts  # 下载与安装逻辑
```

## 依赖

```json
{
  "cli-progress": "^3.12.0"
}
```

`cli-progress` 是成熟的 CLI 进度条库，支持多种预设样式、自定义格式、ETA 计算。

## 类型定义

```typescript
interface ReleaseAsset {
  url: string;
  name: string;
  size?: number;
}

interface PlatformAssets {
  macos: { arm64: ReleaseAsset; x64: ReleaseAsset };
  windows: { exe: ReleaseAsset; msi: ReleaseAsset };
  linux: { deb: ReleaseAsset };
}

type Platform = "darwin-arm64" | "darwin-x64" | "win32-x64" | "linux-x64";
type UnsupportedPlatform = "win32-arm64" | "linux-arm64";

type WindowsFormat = "exe" | "msi";
```

## 命令注册

遵循现有 CLI 命令模式：

```typescript
// packages/core/src/cli/commands/index.ts
import { registerAppCommand } from "./app";

export function registerCommands(program: Command): void {
  // ... existing commands
  registerAppCommand(program);
}
```
