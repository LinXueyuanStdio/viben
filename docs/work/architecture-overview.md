# WorkAny 整体架构概述

## 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WorkAny Desktop (Tauri)                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Frontend (React/TypeScript)                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │   useAgent   │  │ PlanApproval │  │ Background   │  │   Database   │ │ │
│  │  │    Hook      │  │  Component   │  │   Tasks      │  │  Abstraction │ │ │
│  │  └──────┬───────┘  └──────────────┘  └──────┬───────┘  └──────┬───────┘ │ │
│  │         │                                    │                  │         │ │
│  │         │         SSE Stream                 │                  │         │ │
│  │         ▼                                    ▼                  ▼         │ │
│  └─────────┼────────────────────────────────────┼──────────────────┼─────────┘ │
│            │                                    │                  │           │
│  ┌─────────▼────────────────────────────────────▼──────────────────▼─────────┐ │
│  │                         Backend API (Hono)                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │
│  │  │  /agent/*    │  │  /sandbox/*  │  │  /providers  │  │  /health     │  │ │
│  │  │  Routes      │  │  Routes      │  │  Routes      │  │  Routes      │  │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────┘  └──────────────┘  │ │
│  │         │                  │                                              │ │
│  │         ▼                  ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                     Agent Service Layer                              │ │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │ │ │
│  │  │  │ ClaudeAgent  │  │  CodexAgent  │  │ DeepAgents   │               │ │ │
│  │  │  │ (Claude SDK) │  │  (Process)   │  │  (Custom)    │               │ │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘               │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                           │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                     Sandbox Provider Layer                           │ │ │
│  │  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │ │ │
│  │  │  │ Docker │  │ Native │  │  E2B   │  │ Codex  │  │ Claude │        │ │ │
│  │  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘        │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Tauri Rust Core                                     ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐││
│  │  │   Sidecar    │  │   Database   │  │   File       │  │   Shell          │││
│  │  │  (API)       │  │   Plugin     │  │   Plugin     │  │   Plugin         │││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. 前端层 (Frontend)

**源文件位置**: `workany/src/`

| 模块 | 文件路径 | 职责 |
|------|----------|------|
| useAgent Hook | `src/shared/hooks/useAgent.ts` | SSE 连接管理、任务状态追踪 |
| Background Tasks | `src/shared/lib/background-tasks.ts` | 后台任务生命周期管理 |
| Database | `src/shared/db/` | 跨平台数据库抽象 |
| PlanApproval | `src/components/task/PlanApproval.tsx` | 计划审批 UI 组件 |

### 2. 后端 API 层 (Backend API)

**源文件位置**: `workany/src-api/`

| 模块 | 文件路径 | 职责 |
|------|----------|------|
| API Server | `src-api/src/index.ts` | Hono 服务器入口 |
| Agent Routes | `src-api/src/app/api/agent.ts` | 智能体 API 端点 |
| Agent Service | `src-api/src/shared/services/agent.ts` | 智能体服务层 |
| Agent Types | `src-api/src/core/agent/types.ts` | 类型定义 |
| Claude Agent | `src-api/src/extensions/agent/claude/index.ts` | Claude SDK 适配器 |
| Sandbox Types | `src-api/src/core/sandbox/types.ts` | 沙箱提供者接口 |

### 3. 桌面封装层 (Desktop Wrapper)

**源文件位置**: `workany/src-tauri/`

| 模块 | 文件路径 | 职责 |
|------|----------|------|
| Tauri Core | `src-tauri/src/lib.rs` | Rust 核心逻辑 |
| Database Migrations | `src-tauri/src/lib.rs:72-182` | SQLite 数据库迁移 |
| Sidecar Management | `src-tauri/src/lib.rs:209-287` | API 服务器进程管理 |

## 数据流

```
用户输入 → useAgent Hook → SSE POST → Agent Routes → Agent Service
                                                          │
                                                          ▼
                                                    ClaudeAgent
                                                          │
                                     ┌────────────────────┼────────────────────┐
                                     ▼                    ▼                    ▼
                              Planning Phase      Execution Phase       Direct Mode
                                     │                    │                    │
                                     ▼                    ▼                    ▼
                              返回 TaskPlan         工具调用/结果          流式响应
                                     │                    │                    │
                                     ▼                    ▼                    ▼
SSE 响应 ← Agent Routes ← Agent Service ←────────────────┴────────────────────┘
    │
    ▼
useAgent Hook → 状态更新 → UI 渲染
    │
    ▼
Database 持久化 (SQLite/IndexedDB)
```

## 端口配置

| 环境 | API 端口 | 用途 |
|------|----------|------|
| 开发 | 2026 | `pnpm dev:api` 启动开发服务器 |
| 生产 | 2620 | Tauri sidecar 打包后的端口 |

## 原始文件引用

- 架构入口: [`workany/src-api/src/index.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/index.ts)
- API 路由: [`workany/src-api/src/app/api/agent.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/app/api/agent.ts)
- 智能体服务: [`workany/src-api/src/shared/services/agent.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/shared/services/agent.ts)
- Tauri 核心: [`workany/src-tauri/src/lib.rs`](/Users/lxy/Documents/GitHub/others/workany/src-tauri/src/lib.rs)
