# Projects 项目管理

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/projects.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/projects` | 获取所有项目 |
| POST | `/projects` | 创建项目 |
| GET | `/projects/stream/ws` | 项目流 (WebSocket) |
| GET | `/projects/{id}` | 获取项目详情 |
| PUT | `/projects/{id}` | 更新项目 |
| DELETE | `/projects/{id}` | 删除项目 |
| GET | `/projects/{id}/search` | 搜索项目文件 |
| POST | `/projects/{id}/open-editor` | 在编辑器中打开项目 |
| GET | `/projects/{id}/repositories` | 获取项目仓库 |
| POST | `/projects/{id}/repositories` | 添加仓库到项目 |
| GET | `/projects/{project_id}/repositories/{repo_id}` | 获取项目仓库详情 |
| DELETE | `/projects/{project_id}/repositories/{repo_id}` | 从项目移除仓库 |

---

## GET /projects

### 描述

获取所有项目列表。

### 输出

```typescript
interface Project {
  id: UUID;
  name: string;
  description?: string;
  created_at: DateTime;
  updated_at: DateTime;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/projects.rs:28-33

pub async fn get_projects(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<Vec<Project>>>, ApiError> {
    let projects = Project::find_all(&deployment.db().pool).await?;
    Ok(ResponseJson(ApiResponse::success(projects)))
}
```

---

## POST /projects

### 描述

创建新项目。

### 输入

```typescript
interface CreateProject {
  name: string;
  description?: string;
  repositories: CreateProjectRepo[];
}

interface CreateProjectRepo {
  git_repo_path: string;    // 本地 Git 仓库路径
  display_name: string;     // 显示名称
}
```

### 输出

```typescript
interface Project {
  id: UUID;
  name: string;
  description?: string;
  created_at: DateTime;
  updated_at: DateTime;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/projects.rs:83-127

pub async fn create_project(
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<CreateProject>,
) -> Result<ResponseJson<ApiResponse<Project>>, ApiError> {
    let repo_count = payload.repositories.len();

    match deployment
        .project()
        .create_project(&deployment.db().pool, deployment.repo(), payload)
        .await
    {
        Ok(project) => {
            deployment
                .track_if_analytics_allowed("project_created", serde_json::json!({
                    "project_id": project.id.to_string(),
                    "repository_count": repo_count,
                }))
                .await;
            Ok(ResponseJson(ApiResponse::success(project)))
        }
        Err(ProjectServiceError::DuplicateGitRepoPath) => {
            Ok(ResponseJson(ApiResponse::error("Duplicate repository path provided")))
        }
        Err(ProjectServiceError::DuplicateRepositoryName) => {
            Ok(ResponseJson(ApiResponse::error("Duplicate repository name provided")))
        }
        Err(ProjectServiceError::PathNotFound(_)) => {
            Ok(ResponseJson(ApiResponse::error("The specified path does not exist")))
        }
        Err(ProjectServiceError::PathNotDirectory(_)) => {
            Ok(ResponseJson(ApiResponse::error("The specified path is not a directory")))
        }
        Err(ProjectServiceError::NotGitRepository(_)) => {
            Ok(ResponseJson(ApiResponse::error("The specified directory is not a git repository")))
        }
        Err(e) => Err(ProjectError::CreateFailed(e.to_string()).into()),
    }
}
```

---

## GET /projects/stream/ws

### 描述

通过 WebSocket 实时流式推送项目列表变更。

### WebSocket 消息

```typescript
type LogMsg =
  | { type: "json_patch"; patch: JsonPatch }
  | { type: "finished" };
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/projects.rs:35-75

pub async fn stream_projects_ws(
    ws: WebSocketUpgrade,
    State(deployment): State<DeploymentImpl>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_projects_ws(socket, deployment).await {
            tracing::warn!("projects WS closed: {}", e);
        }
    })
}

async fn handle_projects_ws(socket: WebSocket, deployment: DeploymentImpl) -> anyhow::Result<()> {
    let mut stream = deployment
        .events()
        .stream_projects_raw()
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

## GET /projects/{id}/search

### 描述

搜索项目内的文件。

### 输入

**Query 参数:**

```typescript
interface SearchQuery {
  q: string;          // 搜索关键词
  mode?: SearchMode;  // 搜索模式
}

type SearchMode = "filename" | "content" | "fuzzy";
```

### 输出

```typescript
interface SearchResult {
  file_path: string;
  repo_id: UUID;
  repo_name: string;
  line_number?: number;
  match_content?: string;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/projects.rs:248-286

pub async fn search_project_files(
    State(deployment): State<DeploymentImpl>,
    Extension(project): Extension<Project>,
    Query(search_query): Query<SearchQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<SearchResult>>>, StatusCode> {
    if search_query.q.trim().is_empty() {
        return Ok(ResponseJson(ApiResponse::error(
            "Query parameter 'q' is required and cannot be empty",
        )));
    }

    let repositories = deployment
        .project()
        .get_repositories(&deployment.db().pool, project.id)
        .await?;

    let results = deployment
        .project()
        .search_files(
            deployment.file_search_cache().as_ref(),
            &repositories,
            &search_query,
        )
        .await?;

    Ok(ResponseJson(ApiResponse::success(results)))
}
```

---

## POST /projects/{id}/open-editor

### 描述

在指定编辑器中打开项目。

### 输入

```typescript
interface OpenEditorRequest {
  editor_type?: string;     // 编辑器类型 (vscode, cursor, etc.)
  git_repo_path?: string;   // 指定打开的仓库路径
}
```

### 输出

```typescript
interface OpenEditorResponse {
  url?: string;  // 远程模式时返回 URL
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/projects.rs:190-246

pub async fn open_project_in_editor(
    Extension(project): Extension<Project>,
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<Option<OpenEditorRequest>>,
) -> Result<ResponseJson<ApiResponse<OpenEditorResponse>>, ApiError> {
    // 确定要打开的路径
    let path = if let Some(ref req) = payload
        && let Some(ref specified_path) = req.git_repo_path
    {
        specified_path.clone()
    } else {
        // 使用第一个仓库的路径
        let repositories = deployment
            .project()
            .get_repositories(&deployment.db().pool, project.id)
            .await?;
        repositories
            .first()
            .map(|r| r.path.clone())
            .ok_or_else(|| ApiError::BadRequest("Project has no repositories".to_string()))?
    };

    // 获取编辑器配置
    let editor_config = {
        let config = deployment.config().read().await;
        let editor_type_str = payload.as_ref().and_then(|req| req.editor_type.as_deref());
        config.editor.with_override(editor_type_str)
    };

    // 打开编辑器
    match editor_config.open_file(&path).await {
        Ok(url) => Ok(ResponseJson(ApiResponse::success(OpenEditorResponse { url }))),
        Err(e) => Err(ApiError::EditorOpen(e)),
    }
}
```

---

## GET/POST/DELETE /projects/{id}/repositories

### 描述

管理项目关联的仓库。

### 输入 (POST)

```typescript
interface CreateProjectRepo {
  git_repo_path: string;
  display_name: string;
}
```

### 输出

```typescript
interface Repo {
  id: UUID;
  name: string;
  display_name: string;
  path: PathBuf;
  default_branch?: string;
  default_working_dir?: string;
  created_at: DateTime;
  updated_at: DateTime;
}
```

---

## 路由配置

```rust
// crates/server/src/routes/projects.rs:436-463

pub fn router(deployment: &DeploymentImpl) -> Router<DeploymentImpl> {
    let project_id_router = Router::new()
        .route("/", get(get_project).put(update_project).delete(delete_project))
        .route("/search", get(search_project_files))
        .route("/open-editor", post(open_project_in_editor))
        .route("/repositories", get(get_project_repositories).post(add_project_repository))
        .layer(from_fn_with_state(deployment.clone(), load_project_middleware));

    let projects_router = Router::new()
        .route("/", get(get_projects).post(create_project))
        .route(
            "/{project_id}/repositories/{repo_id}",
            get(get_project_repository).delete(delete_project_repository),
        )
        .route("/stream/ws", get(stream_projects_ws))
        .nest("/{id}", project_id_router);

    Router::new().nest("/projects", projects_router)
}
```

---

## 关键依赖

```rust
// ProjectService
trait ProjectService {
    async fn create_project(&self, pool: &Pool, repo_service: &RepoService, data: CreateProject)
        -> Result<Project>;
    async fn get_repositories(&self, pool: &Pool, project_id: Uuid) -> Result<Vec<Repo>>;
    async fn add_repository(&self, pool: &Pool, repo_service: &RepoService, project_id: Uuid, data: &CreateProjectRepo)
        -> Result<Repo>;
    async fn search_files(&self, cache: &FileSearchCache, repos: &[Repo], query: &SearchQuery)
        -> Result<Vec<SearchResult>>;
}

// EditorConfig
struct EditorConfig {
    editor_type: EditorType,
    // ...
}

impl EditorConfig {
    fn with_override(&self, editor_type: Option<&str>) -> EditorConfig;
    async fn open_file(&self, path: &Path) -> Result<Option<String>>;
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P2)

### 需要实现的组件

1. **Project 模型**
   - 数据库表和 CRUD
   - 仓库关联表

2. **ProjectService**
   - 项目创建/更新/删除
   - 仓库管理
   - 文件搜索

3. **WebSocket 流**
   - 项目列表变更推送

4. **编辑器集成**
   - 打开项目功能

### 迁移步骤

1. 创建 Project 和 ProjectRepo 模型
2. 实现 ProjectService
3. 创建 `projects.rs` 路由模块
4. 集成文件搜索功能 (可复用现有实现)

### 适配要点

- 项目概念是 vibe-kanban 的核心，viben-core 需要决定是否采用
- 文件搜索可复用 viben-core 现有实现
- 编辑器配置需要与 config.rs 集成
