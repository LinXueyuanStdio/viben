# Vibe-Kanban Routes 迁移分析

本文档详细分析 `vibe-kanban/crates/server/src/routes` 中的所有 API 端点，为迁移到 `viben-core` 提供参考。

**注意**: 本文档仅考虑本地操作、容器操作和 GitHub 公开 API，不包含远程服务代理相关功能。

## 源码位置

- **vibe-kanban**: `~/Documents/GitHub/others/vibe-kanban/crates/server/src/routes/`
- **viben-core**: `crates/viben-core/src/gateway/routes/`

## 路由模块概览

| 模块 | 文件 | 端点数 | 迁移优先级 | 状态 |
|------|------|--------|------------|------|
| [health](./01-health.md) | `health.rs` | 1 | P0 | 已有对应 |
| [events](./02-events.md) | `events.rs` | 1 | P0 | 已有对应 |
| [terminal](./03-terminal.md) | `terminal.rs` | 1 | P0 | 已有对应 |
| [config](./04-config.md) | `config.rs` | 8 | P1 | 待迁移 |
| [tasks](./05-tasks.md) | `tasks.rs` | 6 | P1 | 需增强 |
| [sessions](./06-sessions.md) | `sessions/` | 9 | P1 | 需增强 |
| [execution_processes](./07-execution-processes.md) | `execution_processes.rs` | 5 | P1 | 待迁移 |
| [projects](./08-projects.md) | `projects.rs` | 10 | P2 | 待迁移 |
| [repo](./09-repo.md) | `repo.rs` | 11 | P2 | 待迁移 |
| [task_attempts](./10-task-attempts.md) | `task_attempts.rs` + 子模块 | 30+ | P2 | 待迁移 |
| [containers](./11-containers.md) | `containers.rs` | 2 | P2 | 待迁移 |
| [search](./12-search.md) | `search.rs` | 1 | P2 | 待迁移 |
| [filesystem](./13-filesystem.md) | `filesystem.rs` | 2 | P2 | 待迁移 |
| [images](./14-images.md) | `images.rs` | 6 | P3 | 待迁移 |
| [tags](./18-tags.md) | `tags.rs` | 4 | P3 | 待迁移 |
| [scratch](./19-scratch.md) | `scratch.rs` | 5 | P3 | 待迁移 |
| [approvals](./20-approvals.md) | `approvals.rs` | 1 | P3 | 待迁移 |

## 关键差异

### State 类型

| 项目 | State 类型 | 核心组件 |
|------|-----------|----------|
| vibe-kanban | `DeploymentImpl` | db, events, container, git, config, analytics, pty, approvals, image, project, repo, filesystem, queued_message |
| viben-core | `AppState` | db, events, container, pty, history, session_store, cron, channel, channel_router |

### 响应格式

```rust
// vibe-kanban: 使用包装类型
use utils::response::ApiResponse;
Json(ApiResponse::success(data))
Json(ApiResponse::error("message"))
Json(ApiResponse::error_with_data(error_enum))

// viben-core: 直接返回
Json(data)
Err(GatewayError::...)
```

### 路由参数风格

```rust
// vibe-kanban
Router::new().route("/tasks/{task_id}", get(handler))
Path(task_id): Path<Uuid>

// viben-core
Router::new().route("/api/tasks/:id", get(handler))
Path(task_id): Path<String>
```

### 中间件模式

```rust
// vibe-kanban: 使用 Extension 中间件加载实体
.layer(from_fn_with_state(deployment.clone(), load_task_middleware))
async fn handler(Extension(task): Extension<Task>) -> ...

// viben-core: 直接在 handler 中查询
async fn handler(Path(id): Path<String>, State(state): State<AppState>) -> {
    let task = Task::find_by_id(&state.db.pool, &id).await?;
}
```

## 迁移策略

### Phase 1: 基础设施 (P0)

已完成的路由保持现状：
- `health.rs` - 健康检查
- `events.rs` - SSE 事件流
- `terminal.rs` - PTY WebSocket

### Phase 2: 核心功能 (P1)

需要新增或增强：
- `config.rs` - 配置管理、MCP 服务器、Profile、编辑器/智能体可用性
- `tasks.rs` - 增加 WebSocket 流、create-and-start 功能
- `sessions.rs` - 增加 follow-up、reset、queue、review 功能
- `execution_processes.rs` - 执行进程日志流

### Phase 3: 项目/仓库管理 (P2)

新增功能：
- `projects.rs` - 项目 CRUD、仓库关联、搜索
- `repo.rs` - 仓库管理、分支、远程、PR (使用 GitHub 公开 API)
- `task_attempts.rs` - 工作空间生命周期、Git 操作
- `containers.rs` - 容器解析
- `search.rs` - 多仓库搜索
- `filesystem.rs` - 文件系统浏览

### Phase 4: 辅助功能 (P3)

可选功能：
- `images.rs` - 图片上传/服务
- `tags.rs` - 标签管理
- `scratch.rs` - 草稿存储
- `approvals.rs` - 审批工作流

## 文件索引

每个详细文档包含：
1. 端点列表
2. 输入/输出类型定义
3. 相关代码引用
4. 迁移建议
