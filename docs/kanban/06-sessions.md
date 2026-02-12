# Sessions 会话管理

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/sessions/`
  - `mod.rs` - 主路由
  - `queue.rs` - 消息队列
  - `review.rs` - 代码审查
- **viben-core**: `crates/viben-core/src/gateway/routes/sessions.rs`

## 端点列表

| 方法 | 路径 | vibe-kanban | viben-core |
|------|------|-------------|------------|
| GET | `/sessions` | ❌ | ✅ |
| POST | `/sessions` | ✅ | ✅ |
| GET | `/sessions/stream/ws` | ✅ | ❌ |
| GET | `/sessions/{id}` | ✅ | ✅ |
| PUT | `/sessions/{id}` | ✅ | ✅ (PATCH) |
| DELETE | `/sessions/{id}` | ✅ | ✅ |
| POST | `/sessions/{id}/message` | ❌ | ✅ |
| POST | `/sessions/{id}/follow-up` | ✅ | ❌ |
| DELETE | `/sessions/{id}/reset` | ✅ | ❌ |
| POST | `/sessions/{id}/queue` | ✅ | ❌ |
| DELETE | `/sessions/{id}/queue` | ✅ | ❌ |
| POST | `/sessions/{id}/review` | ✅ | ❌ |

---

## POST /sessions

### 描述

创建新会话。vibe-kanban 中与 Workspace 关联，viben-core 中与 Agent 关联。

### 输入

**vibe-kanban:**

```typescript
interface CreateSession {
  workspace_id: UUID;  // 关联的工作空间
}
```

**viben-core:**

```typescript
interface CreateSessionRequest {
  agent_id: string;    // 关联的智能体
  task_id?: string;    // 可选关联任务
  prompt?: string;     // 初始提示词
}
```

### 输出

**vibe-kanban:**

```typescript
interface Session {
  id: UUID;
  workspace_id: UUID;
  created_at: DateTime;
  updated_at: DateTime;
}
```

**viben-core:**

```typescript
interface SessionResponse {
  id: string;
  agent_id: string;
  task_id?: string;
  status: string;
  prompt?: string;
  session_data: object;
  created_at: string;
  updated_at: string;
}
```

---

## GET /sessions/stream/ws

### 描述

通过 WebSocket 实时流式推送会话变更。

### 输入

**Query 参数:**

```typescript
interface SessionQuery {
  workspace_id: UUID;
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
// crates/server/src/routes/sessions/mod.rs:71-111

pub async fn stream_sessions_ws(
    ws: WebSocketUpgrade,
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<SessionQuery>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_sessions_ws(socket, deployment, query.workspace_id).await {
            tracing::warn!("sessions WS closed: {}", e);
        }
    })
}

async fn handle_sessions_ws(
    socket: WebSocket,
    deployment: DeploymentImpl,
    workspace_id: Uuid,
) -> anyhow::Result<()> {
    let mut stream = deployment
        .events()
        .stream_sessions_raw(workspace_id)
        .await?
        .map_ok(|msg| msg.to_ws_message_unchecked());

    let (mut sender, mut receiver) = socket.split();
    // ... WebSocket 处理逻辑
}
```

---

## POST /sessions/{id}/follow-up

### 描述

向会话发送后续消息。

### 输入

```typescript
interface FollowUpRequest {
  executor_profile_id: ExecutorProfileId;
  prompt: string;
}

interface ExecutorProfileId {
  executor: BaseCodingAgent;  // e.g., "claude", "cursor"
  variant?: string;
}
```

### 输出

```typescript
interface ExecutionProcess {
  id: UUID;
  session_id: UUID;
  status: ExecutionProcessStatus;
  // ...
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/sessions/mod.rs:146-217

pub async fn send_follow_up(
    Extension(session): Extension<Session>,
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<FollowUpRequest>,
) -> Result<ResponseJson<ApiResponse<ExecutionProcess, FollowUpError>>, ApiError> {
    let pool = &deployment.db().pool;

    let workspace = Workspace::find_by_id(pool, session.workspace_id)
        .await?
        .ok_or(ApiError::Workspace(WorkspaceError::ValidationError(
            "Workspace not found".to_string(),
        )))?;

    // 检查是否有正在运行的进程
    if ExecutionProcess::has_running_non_dev_server_processes_for_workspace(pool, workspace.id)
        .await?
    {
        return Ok(ResponseJson(ApiResponse::error_with_data(
            FollowUpError::ProcessAlreadyRunning,
        )));
    }

    // 确保容器存在
    let container_ref = deployment
        .container()
        .ensure_container_exists(&workspace)
        .await?;

    // 查找上一个 coding agent session
    let agent_session_id = CodingAgentTurn::find_latest_session_info(pool, session.id)
        .await?
        .map(|info| info.session_id);

    // 创建执行动作
    let action = ExecutorAction::new(
        ExecutorActionType::FollowUpMessage(FollowUpMessage {
            executor_profile_id: payload.executor_profile_id.clone(),
            prompt: payload.prompt.clone(),
            session_id: agent_session_id,
            working_dir: workspace.agent_working_dir.clone(),
        }),
        None,
    );

    // 启动执行
    let execution_process = deployment
        .container()
        .start_execution(
            &workspace,
            &session,
            &action,
            &ExecutionProcessRunReason::CodingAgent,
        )
        .await?;

    Ok(ResponseJson(ApiResponse::success(execution_process)))
}
```

---

## DELETE /sessions/{id}/reset

### 描述

重置会话，清除所有执行进程记录。

### 输出

```typescript
interface Response {
  success: boolean;
  data?: ();
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/sessions/mod.rs:219-255

pub async fn reset_session(
    Extension(session): Extension<Session>,
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let pool = &deployment.db().pool;

    // 停止所有运行中的执行进程
    let execution_processes = ExecutionProcess::find_by_session_id(pool, session.id).await?;
    for ep in &execution_processes {
        deployment
            .container()
            .stop_execution(ep, ExecutionProcessStatus::Killed)
            .await?;
    }

    // 软删除所有执行进程记录 (保留审计追踪)
    ExecutionProcess::soft_delete_by_session_id(pool, session.id).await?;

    // 重置工作空间的 Git 状态
    let workspace = Workspace::find_by_id(pool, session.workspace_id)
        .await?
        .ok_or(WorkspaceError::WorkspaceNotFound)?;

    if let Some(container_ref) = &workspace.container_ref {
        let workspace_path = PathBuf::from(container_ref);
        let repos = WorkspaceRepo::find_repos_for_workspace(pool, workspace.id).await?;

        for repo in repos {
            let repo_path = workspace_path.join(&repo.name);
            if repo_path.exists() {
                deployment.git().reset_hard(&repo_path)?;
                deployment.git().clean(&repo_path)?;
            }
        }
    }

    Ok(ResponseJson(ApiResponse::success(())))
}
```

---

## POST /sessions/{id}/queue

### 描述

将消息加入队列，等待当前执行完成后自动发送。

### 输入

```typescript
interface QueueMessageRequest {
  executor_profile_id: ExecutorProfileId;
  prompt: string;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/sessions/queue.rs:1-84

pub async fn queue_message(
    Extension(session): Extension<Session>,
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<QueueMessageRequest>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let pool = &deployment.db().pool;

    // 检查是否有进程正在运行
    let has_running_process =
        ExecutionProcess::has_running_non_dev_server_processes_for_workspace(
            pool, workspace.id,
        )
        .await?;

    if has_running_process {
        // 加入队列等待
        deployment.queued_message_service().enqueue(QueuedMessage {
            workspace_id: workspace.id,
            session_id: session.id,
            executor_profile_id: payload.executor_profile_id,
            prompt: payload.prompt,
        });
        Ok(ResponseJson(ApiResponse::success(())))
    } else {
        // 直接发送
        send_follow_up(/* ... */).await
    }
}
```

---

## DELETE /sessions/{id}/queue

### 描述

取消队列中的待发送消息。

### vibe-kanban 实现

```rust
// crates/server/src/routes/sessions/queue.rs:86-98

pub async fn cancel_queue(
    Extension(session): Extension<Session>,
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let pool = &deployment.db().pool;
    let workspace = Workspace::find_by_id(pool, session.workspace_id)
        .await?
        .ok_or(WorkspaceError::WorkspaceNotFound)?;

    deployment
        .queued_message_service()
        .cancel(workspace.id);

    Ok(ResponseJson(ApiResponse::success(())))
}
```

---

## POST /sessions/{id}/review

### 描述

启动代码审查。

### 输入

```typescript
interface StartReviewRequest {
  executor_profile_id: ExecutorProfileId;
  additional_prompt?: string;
  use_all_workspace_commits: boolean;  // 是否审查所有提交
}
```

### 输出

```typescript
type Response =
  | { success: true; data: ExecutionProcess }
  | { success: false; error: ReviewError };

type ReviewError = { type: "process_already_running" };
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/sessions/review.rs:1-140

pub async fn start_review(
    Extension(session): Extension<Session>,
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<StartReviewRequest>,
) -> Result<ResponseJson<ApiResponse<ExecutionProcess, ReviewError>>, ApiError> {
    let pool = &deployment.db().pool;

    // 检查是否有运行中进程
    if ExecutionProcess::has_running_non_dev_server_processes_for_workspace(pool, workspace.id)
        .await?
    {
        return Ok(ResponseJson(ApiResponse::error_with_data(
            ReviewError::ProcessAlreadyRunning,
        )));
    }

    // 获取审查上下文
    let context: Option<Vec<ExecutorRepoReviewContext>> = if payload.use_all_workspace_commits {
        let repos = WorkspaceRepo::find_repos_with_target_branch_for_workspace(pool, workspace.id)
            .await?;

        let mut contexts = Vec::new();
        for repo in repos {
            let worktree_path = workspace_path.join(&repo.repo.name);
            if let Ok(base_commit) = deployment.git().get_fork_point(
                &worktree_path,
                &repo.target_branch,
                &workspace.branch,
            ) {
                contexts.push(ExecutorRepoReviewContext {
                    repo_id: repo.repo.id,
                    repo_name: repo.repo.display_name,
                    base_commit,
                });
            }
        }
        if contexts.is_empty() { None } else { Some(contexts) }
    } else {
        None
    };

    // 构建审查提示
    let prompt = build_review_prompt(context.as_deref(), payload.additional_prompt.as_deref());

    // 创建审查动作
    let action = ExecutorAction::new(
        ExecutorActionType::ReviewRequest(ReviewAction {
            executor_profile_id: payload.executor_profile_id.clone(),
            context,
            prompt,
            session_id: agent_session_id,
            working_dir: workspace.agent_working_dir.clone(),
        }),
        None,
    );

    // 启动执行
    let execution_process = deployment
        .container()
        .start_execution(&workspace, &session, &action, &ExecutionProcessRunReason::CodingAgent)
        .await?;

    Ok(ResponseJson(ApiResponse::success(execution_process)))
}
```

---

## 差异分析

| 方面 | vibe-kanban | viben-core |
|------|-------------|------------|
| 关联实体 | Workspace | Agent |
| 状态管理 | 通过 ExecutionProcess | 直接在 Session |
| 消息发送 | follow-up | /message |
| 消息队列 | 支持 | 不支持 |
| 代码审查 | 支持 | 不支持 |
| 重置功能 | 支持 (Git reset) | 不支持 |
| 实时流 | WebSocket | 不支持 |

---

## 迁移建议

**状态**: 需增强 (优先级 P1)

### 需要添加的功能

1. **WebSocket 流** (`/sessions/stream/ws`)
   - 会话变更实时推送

2. **消息队列** (`/sessions/{id}/queue`)
   - 实现 QueuedMessageService
   - 队列消息入队/出队/取消

3. **代码审查** (`/sessions/{id}/review`)
   - 集成 Git 分支对比
   - 构建审查提示

4. **会话重置** (`/sessions/{id}/reset`)
   - 停止执行进程
   - Git 重置工作目录

### 适配要点

- Session 模型需要关联 Workspace 或保持当前 Agent 关联
- 需要实现 ExecutionProcess 模型来跟踪执行状态
- 消息队列需要线程安全的队列实现
