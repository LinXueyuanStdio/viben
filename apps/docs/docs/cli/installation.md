---
sidebar_position: 2
title: "安装"
description: "使用 npm、pnpm 或从源码安装 Viben CLI"
---

# 安装

Viben CLI 可以通过 npm/pnpm 全局安装，或从源码构建进行开发。

## 快速安装

### 使用 npm

```bash
npm install -g @viben/cli
```

### 使用 pnpm

```bash
pnpm add -g @viben/cli
```

### 使用 npx（无需安装）

直接运行而不安装：

```bash
npx @viben/cli --help
```

## 系统要求

| 要求 | 版本 |
|------|------|
| **Node.js** | 18.0 或更高 |
| **npm** | 9.0 或更高（或 pnpm 8.0+） |

### 检查环境

```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version
```

## 验证安装

安装后，验证 Viben CLI 是否正确安装：

```bash
viben --help
```

你应该看到类似以下输出：

```
Usage: viben <command> [options]

Bootstrap CLI for Viben - 配置应用、管理服务和查询状态。

Commands:
  init          在当前目录初始化工作区
  config        配置管理（git 风格）
  service       管理后台服务
  gateway       启动 Gateway
  executor      发现和查看执行器
  agent         管理智能体实例和模板
  provider      管理 API 提供商
  model         管理模型、别名和回退链
  mcp           管理 MCP 服务器
  skill         管理技能
  channel       管理聊天渠道
  cron          管理定时任务
  team          团队协作工作区管理
  workspace     工作区操作
  version       显示版本信息
  help          显示帮助

Options:
  --json              输出 JSON
  --global, -g        使用全局配置
  --workspace         使用工作区配置
  -n, --name <id>     指定智能体名称/ID
  --verbose, -v       详细输出
  --quiet, -q         抑制非必要输出
  --help, -h          显示帮助
```

检查版本：

```bash
viben version
```

## 从源码安装（开发）

对于想要修改 CLI 或贡献代码的开发者：

### 1. 克隆仓库

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 构建 CLI

```bash
pnpm build --filter=@viben/cli
```

### 4. 链接到本地开发

```bash
cd apps/cli
pnpm link --global
```

现在你可以在全局使用 `viben` 命令，重新构建后更改会生效。

### 5. 开发模式

对于活跃开发并自动重建：

```bash
cd apps/cli
pnpm dev
```

## 配置位置

安装后，Viben CLI 将其配置存储在：

| 平台 | 位置 |
|------|------|
| **macOS/Linux** | `~/.viben/` |
| **Windows** | `%USERPROFILE%\.viben\` |

配置目录在首次使用时自动创建。

### 目录结构

```
~/.viben/
├── config.yaml           # 全局配置
├── providers.yaml        # API 提供商配置
├── models.yaml           # 模型配置
├── channels.yaml         # 渠道配置
├── cron.yaml             # 定时任务配置
├── agents/               # 智能体实例
├── mcp/                  # 共享 MCP 服务器
└── skills/               # 共享技能
```

## 更新

### npm

```bash
npm update -g @viben/cli
```

### pnpm

```bash
pnpm update -g @viben/cli
```

### 从源码

```bash
cd viben
git pull
pnpm install
pnpm build --filter=@viben/cli
```

## 卸载

### npm

```bash
npm uninstall -g @viben/cli
```

### pnpm

```bash
pnpm remove -g @viben/cli
```

### 清理配置（可选）

要删除所有配置和数据：

```bash
# macOS/Linux
rm -rf ~/.viben

# Windows (PowerShell)
Remove-Item -Recurse -Force $env:USERPROFILE\.viben
```

:::warning
删除 `.viben` 目录将删除所有智能体配置、记忆和会话。请确保先备份重要数据。
:::

## 故障排除

### 命令未找到

如果安装后找不到 `viben` 命令：

1. **检查 PATH**：确保 npm 全局 bin 目录在你的 PATH 中

   ```bash
   # 查找 npm 全局 bin 目录
   npm bin -g

   # 添加到 PATH（bash/zsh）
   export PATH="$(npm bin -g):$PATH"
   ```

2. **重启终端**：安装后关闭并重新打开终端

3. **重新安装**：尝试使用详细输出重新安装

   ```bash
   npm install -g @viben/cli --verbose
   ```

### 权限错误

在 macOS/Linux 上，如果遇到权限错误：

```bash
# 选项 1：使用 sudo（不推荐）
sudo npm install -g @viben/cli

# 选项 2：修复 npm 权限（推荐）
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install -g @viben/cli
```

### 版本冲突

如果有多个 Node.js 版本，使用版本管理器：

```bash
# 使用 nvm
nvm use 18
npm install -g @viben/cli
```

## 下一步

- [快速开始](./quick-start) - 初始化并配置你的第一个工作区
