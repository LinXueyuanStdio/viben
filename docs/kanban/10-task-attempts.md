# Task Attempts (Workspaces) 工作空间管理

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/task_attempts.rs` + 子模块
  - `task_attempts/mod.rs` - 主路由 (1900+ 行)
  - `task_attempts/codex_setup.rs` - Codex 设置
  - `task_attempts/cursor_setup.rs` - Cursor 设置
  - `task_attempts/gh_cli_setup.rs` - GitHub CLI 设置
  - `task_attempts/images.rs` - 图片管理
  - `task_attempts/pr.rs` - PR 管理
  - `task_attempts/workspace_summary.rs` - 工作空间摘要
- **viben-core**: `crates/viben-core/src/gateway/routes/workspaces.rs` (不同实现)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/task-attempts` | 获取工作空间列表 |
| POST | `/task-attempts` | 创建工作空间 |
| GET | `/task-attempts/stream/ws` | 工作空间流 (WebSocket) |
| GET | `/task-attempts/{id}` | 获取工作空间详情 |
| PUT | `/task-attempts/{id}` | 更新工作空间 |
| DELETE | `/task-attempts/{id}` | 删除工作空间 |
| POST | `/task-attempts/{id}/run-agent-setup` | 运行智能体设置脚本 |
| GET | `/task-attempts/{id}/diff/ws` | 差异流 (WebSocket) |
| POST | `/task-attempts/{id}/merge` | 合并分支 |
| POST | `/task-attempts/{id}/push` | 推送分支 |
| POST | `/task-attempts/{id}/pull` | 拉取更新 |
| POST | `/task-attempts/{id}/rebase` | 变基分支 |
| POST | `/task-attempts/{id}/continue-rebase` | 继续变基 |
| POST | `/task-attempts/{id}/abort-conflicts` | 中止冲突解决 |
| POST | `/task-attempts/{id}/link` | 关联远程 Issue |
| POST | `/task-attempts/{id}/pr` | 创建 Pull Request |
| GET | `/task-attempts/{id}/pr/{merge_id}` | 获取 PR 状态 |
| POST | `/task-attempts/{id}/pr/{merge_id}/sync` | 同步 PR 状态 |
| GET | `/task-attempts/{id}/summary` | 获取工作空间摘要 |
| GET | `/task-attempts/{id}/images` | 获取工作空间图片 |
| POST | `/task-attempts/{id}/images` | 上传图片 |
| POST | `/task-attempts/{id}/gh-cli-setup` | GitHub CLI 设置 |

---

## 核心类型

```typescript
interface Workspace {
  id: UUID;
  task_id: UUID;
  branch: string;
  container_ref?: string;    // 容器目录路径
  agent_working_dir?: string;
  archived: boolean;
  pinned: boolean;
  name?: string;
  created_at: DateTime;
  updated_at: DateTime;
}

interface WorkspaceRepoInput {
  repo_id: UUID;
  target_branch: string;
}

type GitOperationError =
  | { type: "merge_conflicts"; message: string; op: ConflictOp; conflicted_files: string[]; target_branch: string }
  | { type: "rebase_in_progress" };

type ConflictOp = "merge" | "rebase" | "pull";
```

---

## GET /task-attempts

### 描述

获取工作空间列表。

### 输入

**Query 参数:**

```typescript
interface TaskAttemptQuery {
  task_id?: UUID;  // 过滤指定任务的工作空间
}
```

### 输出

```typescript
interface Workspace[] { /* ... */ }
```

---

## POST /task-attempts

### 描述

创建新的工作空间。

### 输入

```typescript
interface CreateTaskAttemptBody {
  task_id: UUID;
  executor_profile_id: ExecutorProfileId;
  repos: WorkspaceRepoInput[];
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/task_attempts.rs:213-300

pub async fn create_task_attempt(
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<CreateTaskAttemptBody>,
) -> Result<ResponseJson<ApiResponse<Workspace>>, ApiError> {
    if payload.repos.is_empty() {
        return Err(ApiError::BadRequest("At least one repository is required".to_string()));
    }

    let pool = &deployment.db().pool;
    let task = Task::find_by_id(pool, payload.task_id).await?
        .ok_or(SqlxError::RowNotFound)?;

    // 计算 agent_working_dir
    let agent_working_dir = if payload.repos.len() == 1 {
        let repo = Repo::find_by_id(pool, payload.repos[0].repo_id).await?;
        match repo.default_working_dir {
            Some(subdir) => Some(PathBuf::from(&repo.name).join(&subdir).to_string_lossy().to_string()),
            None => Some(repo.name),
        }
    } else {
        None
    };

    // 生成分支名称
    let attempt_id = Uuid::new_v4();
    let git_branch_name = deployment
        .container()
        .git_branch_from_workspace(&attempt_id, &task.title)
        .await;

    // 创建工作空间
    let workspace = Workspace::create(pool, &CreateWorkspace {
        branch: git_branch_name.clone(),
        agent_working_dir,
    }, attempt_id, payload.task_id).await?;

    // 创建工作空间-仓库关联
    WorkspaceRepo::create_many(pool, workspace.id, &workspace_repos).await?;

    // 启动工作空间
    deployment
        .container()
        .start_workspace(&workspace, payload.executor_profile_id.clone())
        .await?;

    Ok(ResponseJson(ApiResponse::success(workspace)))
}
```

---

## POST /task-attempts/{id}/merge

### 描述

将工作空间分支合并到目标分支。

### 输入

```typescript
interface MergeTaskAttemptRequest {
  repo_id: UUID;
}
```

### 输出

```typescript
type Response =
  | { success: true; data: () }
  | { success: false; error: GitOperationError };
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/task_attempts.rs:463-577

pub async fn merge_task_attempt(
    Extension(workspace): Extension<Workspace>,
    State(deployment): State<DeploymentImpl>,
    Json(request): Json<MergeTaskAttemptRequest>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let pool = &deployment.db().pool;

    // 获取仓库信息
    let workspace_repo = WorkspaceRepo::find_by_workspace_and_repo_id(pool, workspace.id, request.repo_id)
        .await?
        .ok_or(RepoError::NotFound)?;
    let repo = Repo::find_by_id(pool, workspace_repo.repo_id).await?;

    // 检查是否有打开的 PR
    let merges = Merge::find_by_workspace_and_repo_id(pool, workspace.id, request.repo_id).await?;
    let has_open_pr = merges.iter().any(|m| matches!(m, Merge::Pr(pr) if matches!(pr.pr_info.status, MergeStatus::Open)));
    if has_open_pr {
        return Err(ApiError::BadRequest(
            "Cannot merge directly when a pull request is open for this repository.".to_string(),
        ));
    }

    // 检查目标分支类型
    let target_branch_type = deployment.git().find_branch_type(&repo.path, &workspace_repo.target_branch)?;
    if target_branch_type == BranchType::Remote {
        return Err(ApiError::BadRequest(
            "Cannot merge directly into a remote branch. Please create a pull request instead.".to_string(),
        ));
    }

    // 执行合并
    let worktree_path = get_worktree_path(&workspace, &repo);
    match deployment.git().merge(&worktree_path, &workspace_repo.target_branch, &workspace.branch) {
        Ok(_) => {
            // 记录合并
            Merge::record_direct_merge(pool, workspace.id, repo.id, &workspace.branch, &workspace_repo.target_branch).await?;
            Ok(ResponseJson(ApiResponse::success(())))
        }
        Err(GitServiceError::MergeConflicts { conflicted_files }) => {
            Ok(ResponseJson(ApiResponse::error_with_data(GitOperationError::MergeConflicts {
                message: "Merge resulted in conflicts".to_string(),
                op: ConflictOp::Merge,
                conflicted_files,
                target_branch: workspace_repo.target_branch,
            })))
        }
        Err(e) => Err(e.into()),
    }
}
```

---

## POST /task-attempts/{id}/push

### 描述

将工作空间分支推送到远程仓库。

### 输入

```typescript
interface PushTaskAttemptRequest {
  repo_id: UUID;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/task_attempts.rs:579-650

pub async fn push_task_attempt(
    Extension(workspace): Extension<Workspace>,
    State(deployment): State<DeploymentImpl>,
    Json(request): Json<PushTaskAttemptRequest>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let pool = &deployment.db().pool;
    let repo = Repo::find_by_id(pool, request.repo_id).await?;
    let worktree_path = get_worktree_path(&workspace, &repo);

    // 推送到远程
    deployment.git().push(&worktree_path, &workspace.branch, false)?;

    // 同步到远程服务
    if let Ok(client) = deployment.remote_client() {
        let stats = diff_stream::compute_diff_stats(pool, deployment.git(), &workspace).await;
        tokio::spawn(async move {
            remote_sync::sync_workspace_to_remote(&client, workspace.id, None, None, stats.as_ref()).await;
        });
    }

    Ok(ResponseJson(ApiResponse::success(())))
}
```

---

## POST /task-attempts/{id}/rebase

### 描述

将工作空间分支变基到新的基础分支。

### 输入

```typescript
interface RebaseTaskAttemptRequest {
  repo_id: UUID;
  old_base_branch?: string;  // 旧的基础分支
  new_base_branch?: string;  // 新的基础分支
}
```

### 输出

```typescript
type Response =
  | { success: true; data: () }
  | { success: false; error: GitOperationError };
```

---

## POST /task-attempts/{id}/pr

### 描述

创建 Pull Request。

### 输入

```typescript
interface CreatePrRequest {
  repo_id: UUID;
  title?: string;
  body?: string;
  draft?: boolean;
}
```

### 输出

```typescript
type Response =
  | { success: true; data: PullRequestInfo }
  | { success: false; error: CreatePrError };

interface PullRequestInfo {
  pr_number: number;
  html_url: string;
  state: PrState;
  title: string;
  body?: string;
  head_branch: string;
  base_branch: string;
  merged: boolean;
  created_at: DateTime;
  updated_at: DateTime;
}

type CreatePrError =
  | { type: "gh_cli_setup_needed"; error: GhCliSetupError }
  | { type: "no_changes" }
  | { type: "remote_not_found" }
  | { type: "already_exists"; pr_url: string };
```

---

## GET /task-attempts/{id}/diff/ws

### 描述

通过 WebSocket 流式获取工作空间的代码差异。

### 输入

**Query 参数:**

```typescript
interface DiffStreamQuery {
  stats_only?: boolean;  // 仅返回统计信息
}
```

### WebSocket 消息

```typescript
type LogMsg =
  | { type: "json_patch"; patch: JsonPatch }
  | { type: "ready" }
  | { type: "finished" };

interface DiffStats {
  files_changed: number;
  insertions: number;
  deletions: number;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/task_attempts.rs:335-395

pub async fn stream_task_attempt_diff_ws(
    ws: WebSocketUpgrade,
    Query(params): Query<DiffStreamQuery>,
    Extension(workspace): Extension<Workspace>,
    State(deployment): State<DeploymentImpl>,
) -> impl IntoResponse {
    let _ = deployment.container().touch(&workspace).await;
    let stats_only = params.stats_only;

    ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_task_attempt_diff_ws(socket, deployment, workspace, stats_only).await {
            tracing::warn!("diff WS closed: {}", e);
        }
    })
}

async fn handle_task_attempt_diff_ws(
    socket: WebSocket,
    deployment: DeploymentImpl,
    workspace: Workspace,
    stats_only: bool,
) -> anyhow::Result<()> {
    let stream = deployment.container().stream_diff(&workspace, stats_only).await?;
    let mut stream = stream.map_ok(|msg: LogMsg| msg.to_ws_message_unchecked());

    let (mut sender, mut receiver) = socket.split();

    loop {
        tokio::select! {
            item = stream.next() => {
                match item {
                    Some(Ok(msg)) => {
                        if sender.send(msg).await.is_err() { break; }
                    }
                    Some(Err(e)) => {
                        tracing::error!("stream error: {}", e);
                        break;
                    }
                    None => break,
                }
            }
            msg = receiver.next() => {
                if msg.is_none() { break; }
            }
        }
    }
    Ok(())
}
```

---

## GET /task-attempts/{id}/summary

### 描述

获取工作空间摘要，用于生成 PR 描述。

### 输出

```typescript
interface WorkspaceSummary {
  changes_summary: string;
  suggested_title: string;
  suggested_body: string;
}
```

---

## 路由配置

```rust
// crates/server/src/routes/task_attempts.rs (部分)

pub fn router(deployment: &DeploymentImpl) -> Router<DeploymentImpl> {
    let workspace_id_router = Router::new()
        .route("/", get(get_task_attempt).put(update_workspace).delete(delete_workspace))
        .route("/run-agent-setup", post(run_agent_setup))
        .route("/diff/ws", get(stream_task_attempt_diff_ws))
        .route("/merge", post(merge_task_attempt))
        .route("/push", post(push_task_attempt))
        .route("/pull", post(pull_task_attempt))
        .route("/rebase", post(rebase_task_attempt))
        .route("/continue-rebase", post(continue_rebase))
        .route("/abort-conflicts", post(abort_conflicts))
        .route("/link", post(link_workspace_to_issue))
        .route("/pr", post(create_pr))
        .route("/pr/{merge_id}", get(get_pr_status))
        .route("/pr/{merge_id}/sync", post(sync_pr_status))
        .route("/summary", get(workspace_summary::get_workspace_summary))
        .route("/images", get(images::get_workspace_images).post(images::upload_workspace_image))
        .route("/gh-cli-setup", post(gh_cli_setup::handle_gh_cli_setup))
        .layer(from_fn_with_state(deployment.clone(), load_workspace_middleware));

    Router::new()
        .route("/task-attempts", get(get_task_attempts).post(create_task_attempt))
        .route("/task-attempts/stream/ws", get(stream_workspaces_ws))
        .nest("/task-attempts/{id}", workspace_id_router)
}
```

---

## 关键依赖

```rust
// ContainerService
trait ContainerService {
    async fn git_branch_from_workspace(&self, id: &Uuid, title: &str) -> String;
    async fn start_workspace(&self, workspace: &Workspace, executor: ExecutorProfileId) -> Result<()>;
    async fn touch(&self, workspace: &Workspace) -> Result<()>;
    async fn stream_diff(&self, workspace: &Workspace, stats_only: bool) -> Result<impl Stream<Item = Result<LogMsg>>>;
    async fn archive_workspace(&self, id: Uuid) -> Result<()>;
}

// GitService (扩展)
trait GitService {
    fn merge(&self, path: &Path, target: &str, source: &str) -> Result<()>;
    fn push(&self, path: &Path, branch: &str, force: bool) -> Result<()>;
    fn pull(&self, path: &Path, branch: &str) -> Result<()>;
    fn rebase(&self, path: &Path, onto: &str) -> Result<()>;
    fn continue_rebase(&self, path: &Path) -> Result<()>;
    fn abort_rebase(&self, path: &Path) -> Result<()>;
    fn abort_merge(&self, path: &Path) -> Result<()>;
}

// GitHostService (扩展)
trait GitHostService {
    async fn create_pr(&self, path: &Path, title: &str, body: &str, draft: bool) -> Result<PullRequestInfo>;
    async fn get_pr_status(&self, path: &Path, pr_number: i32) -> Result<PullRequestInfo>;
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P2)

### 复杂度评估

这是 vibe-kanban 中最复杂的模块，包含：
- 工作空间生命周期管理
- Git 操作 (merge/push/pull/rebase)
- PR 创建和管理
- 差异流
- 智能体设置脚本

### 分阶段迁移建议

**Phase 1: 基础工作空间管理**
- Workspace 模型
- CRUD 操作
- 工作空间流 (WebSocket)

**Phase 2: Git 操作**
- Merge/Push/Pull/Rebase
- 冲突处理
- 差异流

**Phase 3: PR 管理**
- PR 创建
- PR 状态同步
- GitHub CLI 集成

**Phase 4: 高级功能**
- 智能体设置脚本
- 工作空间摘要
- 图片管理

### 适配要点

- 工作空间是 vibe-kanban 的核心概念
- Git 操作需要使用 git2 或 git CLI
- PR 创建依赖 gh CLI
- 差异流需要实现 ContainerService.stream_diff
