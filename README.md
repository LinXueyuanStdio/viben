# Viben

多智能体工作空间管理器，提供看板、日历、时间线和任务管理功能。

## 核心特性

- **多智能体编排** - 在本地工作空间中协调 AI Agent 集群
- **MCP 协议支持** - 完整支持 Model Context Protocol
- **跨平台应用** - CLI、桌面应用、Web 应用三端统一
- **灵活配置** - 基于 YAML 的 Provider/Model 配置管理
- **看板管理** - 可拖拽的任务看板组件
- **会话追踪** - 实时监控 Agent 对话和工具调用

## 架构概览

```mermaid
graph TB
    subgraph Apps["应用层"]
        CLI["CLI<br/><small>viben 命令行</small>"]
        Desktop["Desktop<br/><small>Tauri 桌面应用</small>"]
        Web["Web<br/><small>Next.js 市场</small>"]
    end

    subgraph Core["packages/core · 核心层"]
        direction TB
        Agents["Agent 管理"]
        Providers["Provider 配置"]
        Models["Model 管理"]
        MCP["MCP Client"]
        Gateway["Gateway API"]
    end

    subgraph UI["UI 组件"]
        PkgUI["ui"]
        PkgChat["chat"]
        PkgKanban["kanban"]
    end

    subgraph External["外部服务"]
        MCPServer["MCP Servers"]
        LLM["LLM APIs"]
    end

    CLI --> Core
    Desktop --> Core
    Desktop --> UI
    Web --> Core

    Gateway -.->|":18790"| Desktop
    Gateway -.->|":18790"| Web

    MCP --> MCPServer
    Providers --> LLM
```

**核心设计原则**: `packages/core` 是所有应用访问底层能力的唯一边界，配置使用 file-native 范式 (YAML)，存储在 `~/.viben/`。

## 下载安装

### 桌面应用

| 平台 | 下载 |
|------|------|
| macOS (Universal) | [.dmg](https://github.com/LinXueyuanStdio/viben/releases/latest) |
| Windows (64-bit) | [.msi](https://github.com/LinXueyuanStdio/viben/releases/latest) / [.exe](https://github.com/LinXueyuanStdio/viben/releases/latest) |
| Linux | [.AppImage](https://github.com/LinXueyuanStdio/viben/releases/latest) / [.deb](https://github.com/LinXueyuanStdio/viben/releases/latest) |

> 💡 访问 [Releases](https://github.com/LinXueyuanStdio/viben/releases) 查看所有版本

### CLI 命令行工具

**Shell Script (macOS/Linux)**
```bash
curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash
```

**npm**
```bash
npm install -g viben
```

**npx (无需安装)**
```bash
npx viben
```

**Homebrew (macOS/Linux)**
```bash
brew tap LinXueyuanStdio/viben
brew install viben
```

## 快速开始

### 环境要求 (开发)

- Node.js >= 20.0.0
- pnpm >= 9.15.0
- Rust (桌面应用需要)

### 从源码构建

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben
pnpm install
```

### 运行 CLI

```bash
# 全局构建
pnpm build

# 运行 CLI
pnpm viben <command>

# 或直接运行
node apps/cli/bin/viben.js
```

### 运行桌面应用

```bash
# 开发模式
pnpm desktop:dev

# 构建
pnpm desktop:build
```

### 运行 Web 应用

```bash
# 开发模式
cd apps/web
pnpm dev

# 构建
pnpm build
```

### 启动 Gateway 服务

```bash
pnpm gateway:restart
```

Gateway 服务运行在 `http://127.0.0.1:18790`。

## 项目结构

```
viben/
├── apps/
│   ├── cli/              # 命令行工具 (viben)
│   ├── desktop/          # Tauri 桌面应用
│   ├── web/              # Next.js Web 应用 (MCP 市场、技能库)
│   └── docs/             # 文档站点
│
├── packages/
│   ├── core/             # 核心功能库 (所有应用的唯一边界)
│   │   ├── agents/       # Agent 管理
│   │   ├── providers/    # Provider 配置
│   │   ├── models/       # Model 管理
│   │   ├── config/       # 配置管理
│   │   └── gateway/      # HTTP Gateway 服务 (:18790)
│   ├── ui/               # 共享 UI 组件库
│   ├── chat/             # 聊天 UI 组件
│   ├── kanban/           # 看板组件
│   └── api-client/       # Gateway API 客户端
│
├── .github/workflows/
│   ├── release-desktop.yml  # 桌面应用发布 (生成 desktop-releases.json)
│   └── release-cli.yml      # CLI 发布 (生成 cli-releases.json)
│
├── scripts/              # 构建和运维脚本
└── ~/.viben/             # 用户配置目录 (YAML)
```

## 配置

配置文件存储在 `~/.viben/` 目录，使用 YAML 格式：

```
~/.viben/
├── config.yaml           # 全局配置
├── providers.yaml        # Provider 配置 (API Keys, Endpoints)
├── models.yaml           # Model 配置 (模型参数)
├── channels.yaml         # 通知渠道配置
├── cron.yaml             # 定时任务配置
├── workspaces.yaml       # 工作空间配置
│
├── agents/               # Agent 定义 (每个 Agent 一个目录)
│   └── <agent-name>/
│       └── AGENTS.md     # Agent 配置
│
├── skills/               # 技能定义
├── cron/                 # 定时任务脚本
├── queue/                # 任务队列持久化
├── logs/                 # 运行日志
└── telemetry/            # 遥测数据
```

## 开发

```bash
# 安装依赖
pnpm install

# 全量构建
pnpm build

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 清理构建产物
pnpm clean
```

### 重启服务

```bash
# 重启桌面应用开发服务器
pnpm desktop:restart

# 重启 Gateway
pnpm gateway:restart
```

## 技术栈

- **构建工具**: pnpm + Turbo
- **语言**: TypeScript
- **桌面应用**: Tauri + React + Vite
- **Web 应用**: Next.js 15
- **UI 框架**: Tailwind CSS + Radix UI
- **状态管理**: Zustand
- **数据库** (Web): Drizzle ORM + PostgreSQL

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

[MIT License](./LICENSE)

Copyright (c) 2025 OPENAGS
