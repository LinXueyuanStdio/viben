# Viben Desktop

Viben 桌面应用程序，基于 Tauri 2 + React 19 + TypeScript 构建，提供跨平台的 AI 智能体管理和对话体验。

## 技术栈

- **框架**: [Tauri 2](https://tauri.app/) - 跨平台桌面应用框架
- **前端**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite 7](https://vitejs.dev/)
- **路由**: [React Router 7](https://reactrouter.com/)
- **状态管理**: [Zustand](https://zustand.docs.pmnd.rs/)
- **数据获取**: [TanStack Query](https://tanstack.com/query/)
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI 组件**: [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/)
- **国际化**: [i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/)

## 功能模块

### MCP 服务管理

| 页面 | 路径 | 说明 |
|------|------|------|
| 仪表盘 | `/mcp-services/dashboard` | MCP 服务概览和状态监控 |
| 数据源 | `/mcp-services/data-sources` | Provider 配置和管理 |
| 搜索服务 | `/mcp-services/search-service` | 搜索服务配置 |
| 日志 | `/mcp-services/logs` | 系统和调试日志 |
| Inspector | `/inspector` | MCP 协议调试工具 |
| MCP 市场 | `/mcp-marketplace` | 浏览和安装 MCP 服务 |

### 工作区 (Workspace)

| 页面 | 路径 | 说明 |
|------|------|------|
| 工作区详情 | `/workspace/:id` | 工作区概览 |
| 对话 | `/workspace/:id/chat` | AI 对话界面 |
| 看板 | `/workspace/:id/kanban` | 任务管理看板 |
| 文件 | `/workspace/:id/files` | 文件浏览器 |
| 定时任务 | `/workspace/:id/cron` | Cron 任务管理 |
| 智能体 | `/workspace/:id/agents` | 工作区智能体配置 |

### 智能体和技能

| 页面 | 路径 | 说明 |
|------|------|------|
| 智能体详情 | `/agent/:agentId` | 智能体配置和编辑 |
| 技能详情 | `/skill/:skillId` | 技能详情和配置 |
| 技能市场 | `/skills-market` | 浏览和安装技能 |
| 子智能体详情 | `/subagent/:configId` | 子智能体配置 |

### 创作者中心

| 页面 | 路径 | 说明 |
|------|------|------|
| 发布 | `/publish` | 发布 MCP 服务或技能 |
| 我的包 | `/my-packages` | 管理已发布的包 |
| 分析 | `/analytics` | 下载和使用统计 |

### 系统设置

| 页面 | 路径 | 说明 |
|------|------|------|
| 设置 | `/settings` | 通用设置 |
| 网关设置 | `/settings/gateway` | Gateway API 配置 |
| 渠道设置 | `/settings/channels` | 通知渠道配置 |
| 模型设置 | `/settings/model` | AI 模型配置 |
| 执行器设置 | `/settings/executors` | 代码执行器配置 |
| 沙箱设置 | `/settings/sandbox` | 沙箱环境配置 |
| 关于 | `/about` | 应用版本信息 |

### 其他

| 页面 | 路径 | 说明 |
|------|------|------|
| 对话监控 | `/chat-monitor` | 实时对话监控 |
| 文档 | `/documents` | 内置文档 |
| 系统托盘弹窗 | `/tray-popup` | 托盘状态弹窗 |
| 新手引导 | `/onboarding` | 首次启动引导 |

## 开发

### 环境要求

- Node.js 20+
- pnpm 9+
- Rust (用于 Tauri 构建)

### 安装依赖

```bash
# 在项目根目录
pnpm install
```

### 启动开发服务器

```bash
# 在项目根目录
pnpm desktop:dev

# 或在 apps/desktop 目录
pnpm tauri-dev
```

开发服务器将在 `http://localhost:1420` 启动。

### 重启应用

如果应用挂起或端口被占用：

```bash
# 在项目根目录
pnpm desktop:restart
```

## 构建

### 构建前端

```bash
pnpm build
```

### 构建桌面应用

```bash
pnpm tauri-build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录。

## 项目结构

```
apps/desktop/
├── src/
│   ├── components/     # React 组件
│   │   ├── ui/        # 基础 UI 组件
│   │   ├── layout/    # 布局组件
│   │   ├── chat/      # 对话相关组件
│   │   ├── workspace/ # 工作区组件
│   │   └── ...
│   ├── pages/         # 页面组件
│   ├── hooks/         # 自定义 Hooks
│   ├── stores/        # Zustand 状态管理
│   ├── i18n/          # 国际化配置
│   │   └── locales/   # 翻译文件 (en.json, zh-CN.json)
│   ├── lib/           # 工具函数
│   ├── App.tsx        # 应用入口和路由配置
│   └── main.tsx       # React 入口
├── src-tauri/         # Tauri Rust 后端
│   ├── src/
│   │   └── lib.rs     # Rust 命令和插件
│   ├── tauri.conf.json
│   └── Cargo.toml
└── package.json
```

## IDE 设置

推荐使用以下 VS Code 扩展：

- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 相关文档

- [Tauri 文档](https://tauri.app/v2/guide/)
- [React 文档](https://react.dev/)
- [Vite 文档](https://vitejs.dev/)
