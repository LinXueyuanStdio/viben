# WorkAny 架构分析文档

> 本文档分析 `/Users/lxy/Documents/GitHub/others/workany` 项目的后台任务和智能体架构实现

## 目录结构

- [architecture-overview.md](./architecture-overview.md) - 整体架构概述
- [backend-api.md](./backend-api.md) - 后端 API 端点详解
- [agent-system.md](./agent-system.md) - 智能体系统实现
- [background-tasks.md](./background-tasks.md) - 后台任务管理
- [database-layer.md](./database-layer.md) - 数据库层设计
- [frontend-integration.md](./frontend-integration.md) - 前端集成方案
- [sandbox-system.md](./sandbox-system.md) - 沙箱执行系统

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端** | React 19, TypeScript, Tailwind CSS 4 | 用户界面和状态管理 |
| **后端 API** | Hono, Claude Agent SDK, MCP SDK | 任务执行和智能体编排 |
| **桌面端** | Tauri 2, Rust, SQLite | 原生应用封装和数据持久化 |
| **智能体运行时** | Claude Code CLI, Sandbox providers | AI 执行环境 |

## 核心设计理念

1. **三层架构**: 前端 (React) → 后端 API (Hono) → 桌面封装 (Tauri)
2. **两阶段执行**: Planning (规划) → Execution (执行)
3. **实时通信**: Server-Sent Events (SSE) 实现实时进度更新
4. **跨平台存储**: SQLite (Tauri) / IndexedDB (浏览器) 自动切换
5. **沙箱执行**: 支持多种沙箱提供者 (Docker, Native, Codex, Claude, E2B)
