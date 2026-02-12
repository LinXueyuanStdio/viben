# Execution Processes 执行进程

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/execution_processes.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/execution-processes/{id}` | 获取执行进程 |
| POST | `/execution-processes/{id}/stop` | 停止执行进程 |
| GET | `/execution-processes/{id}/repo-states` | 获取仓库状态 |
| GET | `/execution-processes/{id}/raw-logs/ws` | 原始日志流 (WebSocket) |
| GET | `/execution-processes/{id}/normalized-logs/ws` | 标准化日志流 (WebSocket) |
| GET | `/execution-processes/stream/session/ws` | 会话执行进程流 (WebSocket) |

---

## GET /execution-processes/{id}

### 描述

获取执行进程详情。

### 输入

**Path 参数:**

```typescript
id: UUID  // 执行进程 ID
```

### 输出

```typescript
interface ExecutionProcess {
  id: UUID;
  session_id: UUID;
  workspace_id: UUID;
  status: ExecutionProcessStatus;
  run_reason: ExecutionProcessRunReason;
  pid?: number;
  started_at: DateTime;
  ended_at?: DateTime;
  exit_code?: number;
  created_at: DateTime;
  updated_at: DateTime;
}

type ExecutionProcessStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "killed";

type ExecutionProcessRunReason =
  | "coding_agent"
  | "dev_server"
  | "script";
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/execution_processes.rs:33-38

pub async fn get_execution_process_by_id(
    Extension(execution_process): Extension<ExecutionProcess>,
    State(_deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<ExecutionProcess>>, ApiError> {
    Ok(ResponseJson(ApiResponse::success(execution_process)))
}
```

---

## POST /execution-processes/{id}/stop

### 描述

停止执行进程。

### 输入

**Path 参数:**

```typescript
id: UUID  // 执行进程 ID
```

### 输出

```typescript
interface Response {
  success: boolean;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/execution_processes.rs:169-179

pub async fn stop_execution_process(
    Extension(execution_process): Extension<ExecutionProcess>,
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    deployment
        .container()
        .stop_execution(&execution_process, ExecutionProcessStatus::Killed)
        .await?;

    Ok(ResponseJson(ApiResponse::success(())))
}
```

---

## GET /execution-processes/{id}/repo-states

### 描述

获取执行进程关联的仓库状态。

### 输出

```typescript
interface ExecutionProcessRepoState {
  id: UUID;
  execution_process_id: UUID;
  repo_id: UUID;
  branch: string;
  commit_hash: string;
  dirty: boolean;
  created_at: DateTime;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/execution_processes.rs:236-244

pub async fn get_execution_process_repo_states(
    Extension(execution_process): Extension<ExecutionProcess>,
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<Vec<ExecutionProcessRepoState>>>, ApiError> {
    let pool = &deployment.db().pool;
    let repo_states =
        ExecutionProcessRepoState::find_by_execution_process_id(pool, execution_process.id).await?;
    Ok(ResponseJson(ApiResponse::success(repo_states)))
}
```

---

## GET /execution-processes/{id}/raw-logs/ws

### 描述

通过 WebSocket 流式获取原始日志输出。

### WebSocket 消息

服务器 -> 客户端:

```typescript
type LogMsg =
  | { type: "stdout"; content: string }
  | { type: "stderr"; content: string }
  | { type: "finished" };

// 实际传输时转换为 JSON Patch 格式
interface JsonPatch {
  op: "add";
  path: string;  // e.g., "/0", "/1"
  value: {
    type: "stdout" | "stderr";
    content: string;
  };
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/execution_processes.rs:40-121

pub async fn stream_raw_logs_ws(
    ws: WebSocketUpgrade,
    State(deployment): State<DeploymentImpl>,
    Path(exec_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    // 检查流是否存在
    let _stream = deployment
        .container()
        .stream_raw_logs(&exec_id)
        .await
        .ok_or_else(|| {
            ApiError::ExecutionProcess(ExecutionProcessError::ExecutionProcessNotFound)
        })?;

    Ok(ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_raw_logs_ws(socket, deployment, exec_id).await {
            tracing::warn!("raw logs WS closed: {}", e);
        }
    }))
}

async fn handle_raw_logs_ws(
    socket: WebSocket,
    deployment: DeploymentImpl,
    exec_id: Uuid,
) -> anyhow::Result<()> {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use executors::logs::utils::patch::ConversationPatch;

    // 获取原始日志流
    let raw_stream = deployment
        .container()
        .stream_raw_logs(&exec_id)
        .await
        .ok_or_else(|| anyhow::anyhow!("Execution process not found"))?;

    // 转换为 JSON Patch 格式
    let counter = Arc::new(AtomicUsize::new(0));
    let mut stream = raw_stream.map_ok({
        let counter = counter.clone();
        move |m| match m {
            LogMsg::Stdout(content) => {
                let index = counter.fetch_add(1, Ordering::SeqCst);
                let patch = ConversationPatch::add_stdout(index, content);
                LogMsg::JsonPatch(patch).to_ws_message_unchecked()
            }
            LogMsg::Stderr(content) => {
                let index = counter.fetch_add(1, Ordering::SeqCst);
                let patch = ConversationPatch::add_stderr(index, content);
                LogMsg::JsonPatch(patch).to_ws_message_unchecked()
            }
            LogMsg::Finished => LogMsg::Finished.to_ws_message_unchecked(),
            _ => unreachable!("Raw stream should only have Stdout/Stderr/Finished"),
        }
    });

    let (mut sender, mut receiver) = socket.split();
    tokio::spawn(async move { while let Some(Ok(_)) = receiver.next().await {} });

    while let Some(item) = stream.next().await {
        match item {
            Ok(msg) => {
                if sender.send(msg).await.is_err() {
                    break;
                }
            }
            Err(e) => {
                tracing::error!("stream error: {}", e);
                break;
            }
        }
    }
    Ok(())
}
```

---

## GET /execution-processes/{id}/normalized-logs/ws

### 描述

通过 WebSocket 流式获取标准化日志输出 (已解析的结构化消息)。

### WebSocket 消息

服务器 -> 客户端:

```typescript
type LogMsg =
  | { type: "json_patch"; patch: JsonPatch }
  | { type: "ready" }
  | { type: "finished" };
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/execution_processes.rs:123-167

pub async fn stream_normalized_logs_ws(
    ws: WebSocketUpgrade,
    State(deployment): State<DeploymentImpl>,
    Path(exec_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let stream = deployment
        .container()
        .stream_normalized_logs(&exec_id)
        .await
        .ok_or_else(|| {
            ApiError::ExecutionProcess(ExecutionProcessError::ExecutionProcessNotFound)
        })?;

    let stream = stream.err_into::<anyhow::Error>().into_stream();

    Ok(ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_normalized_logs_ws(socket, stream).await {
            tracing::warn!("normalized logs WS closed: {}", e);
        }
    }))
}

async fn handle_normalized_logs_ws(
    socket: WebSocket,
    stream: impl futures_util::Stream<Item = anyhow::Result<LogMsg>> + Unpin + Send + 'static,
) -> anyhow::Result<()> {
    let mut stream = stream.map_ok(|msg| msg.to_ws_message_unchecked());
    let (mut sender, mut receiver) = socket.split();
    tokio::spawn(async move { while let Some(Ok(_)) = receiver.next().await {} });

    while let Some(item) = stream.next().await {
        match item {
            Ok(msg) => {
                if sender.send(msg).await.is_err() {
                    break;
                }
            }
            Err(e) => {
                tracing::error!("stream error: {}", e);
                break;
            }
        }
    }
    Ok(())
}
```

---

## GET /execution-processes/stream/session/ws

### 描述

流式获取指定会话的执行进程列表变更。

### 输入

**Query 参数:**

```typescript
interface SessionExecutionProcessQuery {
  session_id: UUID;
  show_soft_deleted?: boolean;  // 是否显示已软删除的进程
}
```

### WebSocket 消息

```typescript
type LogMsg =
  | { type: "json_patch"; patch: JsonPatch }
  | { type: "finished" };
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/execution_processes.rs:181-234

pub async fn stream_execution_processes_by_session_ws(
    ws: WebSocketUpgrade,
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<SessionExecutionProcessQuery>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_execution_processes_by_session_ws(
            socket,
            deployment,
            query.session_id,
            query.show_soft_deleted.unwrap_or(false),
        )
        .await
        {
            tracing::warn!("execution processes by session WS closed: {}", e);
        }
    })
}

async fn handle_execution_processes_by_session_ws(
    socket: WebSocket,
    deployment: DeploymentImpl,
    session_id: Uuid,
    show_soft_deleted: bool,
) -> anyhow::Result<()> {
    let mut stream = deployment
        .events()
        .stream_execution_processes_for_session_raw(session_id, show_soft_deleted)
        .await?
        .map_ok(|msg| msg.to_ws_message_unchecked());

    let (mut sender, mut receiver) = socket.split();
    tokio::spawn(async move { while let Some(Ok(_)) = receiver.next().await {} });

    while let Some(item) = stream.next().await {
        match item {
            Ok(msg) => {
                if sender.send(msg).await.is_err() {
                    break;
                }
            }
            Err(e) => {
                tracing::error!("stream error: {}", e);
                break;
            }
        }
    }
    Ok(())
}
```

---

## 路由配置

```rust
// crates/server/src/routes/execution_processes.rs:246-266

pub fn router(deployment: &DeploymentImpl) -> Router<DeploymentImpl> {
    let workspace_id_router = Router::new()
        .route("/", get(get_execution_process_by_id))
        .route("/stop", post(stop_execution_process))
        .route("/repo-states", get(get_execution_process_repo_states))
        .route("/raw-logs/ws", get(stream_raw_logs_ws))
        .route("/normalized-logs/ws", get(stream_normalized_logs_ws))
        .layer(from_fn_with_state(
            deployment.clone(),
            load_execution_process_middleware,
        ));

    let workspaces_router = Router::new()
        .route(
            "/stream/session/ws",
            get(stream_execution_processes_by_session_ws),
        )
        .nest("/{id}", workspace_id_router);

    Router::new().nest("/execution-processes", workspaces_router)
}
```

---

## 关键依赖

```rust
// ContainerService
trait ContainerService {
    async fn stream_raw_logs(&self, exec_id: &Uuid) -> Option<impl Stream<Item = Result<LogMsg>>>;
    async fn stream_normalized_logs(&self, exec_id: &Uuid) -> Option<impl Stream<Item = Result<LogMsg>>>;
    async fn stop_execution(&self, ep: &ExecutionProcess, status: ExecutionProcessStatus) -> Result<()>;
}

// EventService
trait EventService {
    async fn stream_execution_processes_for_session_raw(
        &self,
        session_id: Uuid,
        show_soft_deleted: bool,
    ) -> Result<impl Stream<Item = Result<LogMsg>>>;
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P1)

### 需要实现的组件

1. **ExecutionProcess 模型**
   - 数据库表和 CRUD 操作
   - 状态机管理

2. **日志流服务**
   - ContainerService 的日志流实现
   - 原始日志 -> JSON Patch 转换

3. **WebSocket 路由**
   - 原始日志流
   - 标准化日志流
   - 会话进程列表流

### 迁移步骤

1. 创建 `execution_processes.rs` 路由模块
2. 实现 ExecutionProcess 模型
3. 在 ContainerService 中添加日志流方法
4. 实现 WebSocket 处理逻辑

### 适配要点

- 日志流需要与 viben-core 的 ContainerService 集成
- JSON Patch 格式需要前端配合
- 考虑是否需要软删除功能
