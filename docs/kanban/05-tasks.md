# Tasks 任务管理

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/tasks.rs`
- **viben-core**: `crates/viben-core/src/gateway/routes/tasks.rs`

## 端点列表

| 方法 | 路径 | vibe-kanban | viben-core |
|------|------|-------------|------------|
| GET | `/tasks` | ✅ (需 project_id) | ✅ |
| POST | `/tasks` | ✅ | ✅ |
| GET | `/tasks/stream/ws` | ✅ | ❌ |
| POST | `/tasks/create-and-start` | ✅ | ❌ |
| GET | `/tasks/{task_id}` | ✅ | ✅ |
| PUT | `/tasks/{task_id}` | ✅ | ✅ (PATCH) |
| DELETE | `/tasks/{task_id}` | ✅ | ✅ |

---

## GET /tasks

### 描述

获取任务列表。

### 输入

**vibe-kanban Query 参数:**

```typescript
interface TaskQuery {
  project_id: UUID;  // 必填
}
```

**viben-core:**

无参数，返回所有任务。

### 输出

**vibe-kanban:**

```typescript
interface TaskWithAttemptStatus {
  task: Task;
  has_in_progress_attempt: boolean;
  last_attempt_failed: boolean;
  executor: string;
}

interface Task {
  id: UUID;
  project_id: UUID;
  title: string;
  description?: string;
  status: TaskStatus;
  parent_workspace_id?: UUID;
  created_at: DateTime;
  updated_at: DateTime;
}
```

**viben-core:**

```typescript
interface TaskResponse {
  id: string;
  title: string;
  description?: string;
  status: string;
  agent_id?: string;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/tasks.rs:45-54

pub async fn get_tasks(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<TaskQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<TaskWithAttemptStatus>>>, ApiError> {
    let tasks =
        Task::find_by_project_id_with_attempt_status(&deployment.db().pool, query.project_id)
            .await?;

    Ok(ResponseJson(ApiResponse::success(tasks)))
}
```

### viben-core 实现

```rust
// crates/viben-core/src/gateway/routes/tasks.rs:43-57

pub async fn list_tasks(
    State(state): State<AppState>,
) -> Result<Json<ListTasksResponse>, GatewayError> {
    let tasks = Task::find_all(&state.db.pool).await?;
    let task_responses: Vec<TaskResponse> = tasks.into_iter().map(TaskResponse::from).collect();

    Ok(Json(ListTasksResponse { tasks: task_responses }))
}
```

---

## GET /tasks/stream/ws

### 描述

通过 WebSocket 实时流式推送任务变更。

### 输入

**Query 参数:**

```typescript
interface TaskQuery {
  project_id: UUID;
}
```

### WebSocket 消息

服务器 -> 客户端:

```typescript
type LogMsg =
  | { type: "json_patch"; patch: JsonPatch }
  | { type: "finished" };
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/tasks.rs:56-101

pub async fn stream_tasks_ws(
    ws: WebSocketUpgrade,
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<TaskQuery>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_tasks_ws(socket, deployment, query.project_id).await {
            tracing::warn!("tasks WS closed: {}", e);
        }
    })
}

async fn handle_tasks_ws(
    socket: WebSocket,
    deployment: DeploymentImpl,
    project_id: Uuid,
) -> anyhow::Result<()> {
    let mut stream = deployment
        .events()
        .stream_tasks_raw(project_id)
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

## POST /tasks/create-and-start

### 描述

创建任务并立即启动工作空间。

### 输入

```typescript
interface CreateAndStartTaskRequest {
  task: CreateTask;
  executor_profile_id: ExecutorProfileId;
  repos: WorkspaceRepoInput[];
  linked_issue?: LinkedIssueInfo;
}

interface CreateTask {
  project_id: UUID;
  title: string;
  description?: string;
  image_ids?: UUID[];
}

interface WorkspaceRepoInput {
  repo_id: UUID;
  target_branch: string;
}

interface LinkedIssueInfo {
  remote_project_id: UUID;
  issue_id: UUID;
}
```

### 输出

```typescript
interface TaskWithAttemptStatus {
  task: Task;
  has_in_progress_attempt: boolean;
  last_attempt_failed: boolean;
  executor: string;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/tasks.rs:233-376

pub async fn create_task_and_start(
    State(deployment): State<DeploymentImpl>,
    Json(mut payload): Json<CreateAndStartTaskRequest>,
) -> Result<ResponseJson<ApiResponse<TaskWithAttemptStatus>>, ApiError> {
    if payload.repos.is_empty() {
        return Err(ApiError::BadRequest("At least one repository is required".to_string()));
    }

    let pool = &deployment.db().pool;

    // 从链接的远程 issue 导入图片
    if let Some(linked_issue) = &payload.linked_issue
        && let Ok(client) = deployment.remote_client()
    {
        match import_issue_attachments(&client, deployment.image(), linked_issue.issue_id).await {
            Ok(imported) if !imported.is_empty() => {
                // 替换 attachment:// 引用为本地路径
                if let Some(desc) = &mut payload.task.description {
                    for img in &imported {
                        let placeholder = format!("attachment://{}", img.attachment_id);
                        *desc = desc.replace(&placeholder, &img.vibe_path);
                    }
                }
                // ...
            }
            _ => {}
        }
    }

    // 创建任务
    let task_id = Uuid::new_v4();
    let task = Task::create(pool, &payload.task, task_id).await?;

    // 关联图片
    if let Some(image_ids) = &payload.task.image_ids {
        TaskImage::associate_many_dedup(pool, task.id, image_ids).await?;
    }

    // 创建工作空间
    let attempt_id = Uuid::new_v4();
    let git_branch_name = deployment
        .container()
        .git_branch_from_workspace(&attempt_id, &task.title)
        .await;

    let agent_working_dir = if payload.repos.len() == 1 {
        // 单仓库时设置工作目录
        let repo = Repo::find_by_id(pool, payload.repos[0].repo_id).await?;
        // ...
    } else {
        None
    };

    let workspace = Workspace::create(pool, &CreateWorkspace {
        branch: git_branch_name,
        agent_working_dir,
    }, attempt_id, task.id).await?;

    // 创建工作空间-仓库关联
    WorkspaceRepo::create_many(pool, workspace.id, &workspace_repos).await?;

    // 启动工作空间
    let is_attempt_running = deployment
        .container()
        .start_workspace(&workspace, payload.executor_profile_id.clone())
        .await
        .is_ok();

    Ok(ResponseJson(ApiResponse::success(TaskWithAttemptStatus {
        task,
        has_in_progress_attempt: is_attempt_running,
        last_attempt_failed: false,
        executor: payload.executor_profile_id.executor.to_string(),
    })))
}
```

---

## POST /tasks

### 描述

创建新任务。

### 输入

**vibe-kanban:**

```typescript
interface CreateTask {
  project_id: UUID;
  title: string;
  description?: string;
  image_ids?: UUID[];
}
```

**viben-core:**

```typescript
interface CreateTaskRequest {
  title: string;
  description?: string;
  agent_id?: string;
}
```

---

## PUT /tasks/{task_id}

### 描述

更新任务。

### 输入

**vibe-kanban:**

```typescript
interface UpdateTask {
  title?: string;
  description?: string;  // 空字符串 = 清除
  status?: TaskStatus;
  parent_workspace_id?: UUID;
  image_ids?: UUID[];
}
```

**viben-core:**

```typescript
interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: string;
  agent_id?: string;
}
```

---

## DELETE /tasks/{task_id}

### 描述

删除任务及其关联的工作空间。

### vibe-kanban 特性

- 停止运行中的执行进程
- 清理工作空间目录
- 删除孤立的仓库记录
- 返回 `202 Accepted` 表示后台清理已启动

```rust
// crates/server/src/routes/tasks.rs:415-520

pub async fn delete_task(
    Extension(task): Extension<Task>,
    State(deployment): State<DeploymentImpl>,
) -> Result<(StatusCode, ResponseJson<ApiResponse<()>>), ApiError> {
    let pool = &deployment.db().pool;

    // 获取任务的所有工作空间
    let attempts = Workspace::fetch_all(pool, Some(task.id)).await?;

    // 停止运行中的执行进程
    for workspace in &attempts {
        deployment.container().try_stop(workspace, true).await;
    }

    // 收集需要清理的目录
    let workspace_dirs: Vec<PathBuf> = attempts
        .iter()
        .filter_map(|attempt| attempt.container_ref.as_ref().map(PathBuf::from))
        .collect();

    // 使用事务删除
    let mut tx = pool.begin().await?;
    Task::nullify_children_by_workspace_id(&mut *tx, attempt.id).await?;
    Task::delete(&mut *tx, task.id).await?;
    tx.commit().await?;

    // 后台清理工作空间
    tokio::spawn(async move {
        for workspace_dir in &workspace_dirs {
            WorkspaceManager::cleanup_workspace(workspace_dir, &repositories).await?;
        }
        Repo::delete_orphaned(&pool).await?;
    });

    Ok((StatusCode::ACCEPTED, ResponseJson(ApiResponse::success(()))))
}
```

---

## 差异分析

| 方面 | vibe-kanban | viben-core |
|------|-------------|------------|
| 项目关联 | 任务属于项目 (project_id) | 无项目概念 |
| 工作空间 | 任务关联多个工作空间 | 无工作空间 |
| 图片关联 | 支持图片附件 | 不支持 |
| 实时流 | WebSocket 推送 | 不支持 |
| 一键启动 | create-and-start | 不支持 |
| 删除清理 | 后台清理工作空间 | 简单删除 |

---

## 迁移建议

**状态**: 需增强 (优先级 P1)

### 需要添加的功能

1. **WebSocket 流** (`/tasks/stream/ws`)
   - 在 EventService 中添加任务变更流
   - 实现 JSON Patch 格式推送

2. **create-and-start** (可选)
   - 如果需要一键创建任务并启动，需要实现：
     - Workspace 模型
     - ContainerService.start_workspace()
     - 分支命名逻辑

3. **项目关联** (可选)
   - 添加 project_id 字段
   - 实现 Project 模型

### 适配要点

- Task 模型可能需要扩展字段
- 删除逻辑需要考虑级联关系
