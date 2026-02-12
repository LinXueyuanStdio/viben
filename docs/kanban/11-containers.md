# Containers 容器管理

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/containers.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/containers/info` | 获取容器信息 |
| POST | `/containers/attempt-context` | 尝试获取上下文 |

---

## GET /containers/info

### 描述

根据路径获取工作空间信息。用于编辑器扩展确定当前目录对应的工作空间。

### 输入

**Query 参数:**

```typescript
interface ContainerInfoQuery {
  path: string;  // 文件或目录路径
}
```

### 输出

```typescript
interface ContainerInfo {
  workspace_id: UUID;
  workspace: Workspace;
  session_id?: UUID;
  session?: Session;
  working_dir: string;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/containers.rs:1-80

#[derive(Debug, Deserialize)]
pub struct ContainerInfoQuery {
    path: String,
}

#[derive(Debug, Serialize, TS)]
pub struct ContainerInfo {
    pub workspace_id: Uuid,
    pub workspace: Workspace,
    pub session_id: Option<Uuid>,
    pub session: Option<Session>,
    pub working_dir: String,
}

pub async fn get_container_info(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ContainerInfoQuery>,
) -> Result<ResponseJson<ApiResponse<ContainerInfo>>, ApiError> {
    let pool = &deployment.db().pool;
    let path = PathBuf::from(&query.path);

    // 规范化路径
    let canonical_path = path.canonicalize()
        .map_err(|_| ApiError::BadRequest("Invalid path".to_string()))?;

    // 遍历所有非归档的工作空间，查找匹配的容器
    let workspaces = Workspace::fetch_all(pool, None).await?
        .into_iter()
        .filter(|w| !w.archived)
        .collect::<Vec<_>>();

    for workspace in workspaces {
        if let Some(container_ref) = &workspace.container_ref {
            let container_path = PathBuf::from(container_ref);
            if let Ok(canonical_container) = container_path.canonicalize() {
                // 检查路径是否在容器内
                if canonical_path.starts_with(&canonical_container) {
                    // 获取最新会话
                    let session = Session::find_latest_by_workspace_id(pool, workspace.id).await?;

                    // 计算工作目录 (相对于容器根目录)
                    let working_dir = canonical_path
                        .strip_prefix(&canonical_container)
                        .unwrap_or(&canonical_path)
                        .to_string_lossy()
                        .to_string();

                    return Ok(ResponseJson(ApiResponse::success(ContainerInfo {
                        workspace_id: workspace.id,
                        workspace,
                        session_id: session.as_ref().map(|s| s.id),
                        session,
                        working_dir,
                    })));
                }
            }
        }
    }

    Err(ApiError::BadRequest("Path not found in any container".to_string()))
}
```

---

## POST /containers/attempt-context

### 描述

尝试从路径解析上下文信息，用于初始化编辑器扩展。

### 输入

```typescript
interface AttemptContextRequest {
  path: string;
}
```

### 输出

```typescript
interface AttemptContext {
  workspace_id?: UUID;
  repo_id?: UUID;
  file_path?: string;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/containers.rs:82-140

#[derive(Debug, Deserialize)]
pub struct AttemptContextRequest {
    path: String,
}

#[derive(Debug, Serialize, TS)]
pub struct AttemptContext {
    pub workspace_id: Option<Uuid>,
    pub repo_id: Option<Uuid>,
    pub file_path: Option<String>,
}

pub async fn attempt_context(
    State(deployment): State<DeploymentImpl>,
    Json(request): Json<AttemptContextRequest>,
) -> Result<ResponseJson<ApiResponse<AttemptContext>>, ApiError> {
    let pool = &deployment.db().pool;
    let path = PathBuf::from(&request.path);

    // 尝试规范化路径
    let canonical_path = match path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            return Ok(ResponseJson(ApiResponse::success(AttemptContext {
                workspace_id: None,
                repo_id: None,
                file_path: None,
            })));
        }
    };

    // 先尝试查找工作空间
    let workspaces = Workspace::fetch_all(pool, None).await?
        .into_iter()
        .filter(|w| !w.archived)
        .collect::<Vec<_>>();

    for workspace in &workspaces {
        if let Some(container_ref) = &workspace.container_ref {
            let container_path = PathBuf::from(container_ref);
            if let Ok(canonical_container) = container_path.canonicalize() {
                if canonical_path.starts_with(&canonical_container) {
                    // 找到工作空间，尝试解析仓库
                    let relative_path = canonical_path.strip_prefix(&canonical_container)
                        .unwrap_or(&canonical_path);

                    // 获取工作空间的仓库
                    let repos = WorkspaceRepo::find_repos_for_workspace(pool, workspace.id).await?;

                    for repo in repos {
                        if relative_path.starts_with(&repo.name) {
                            let file_path = relative_path.strip_prefix(&repo.name)
                                .map(|p| p.to_string_lossy().to_string());

                            return Ok(ResponseJson(ApiResponse::success(AttemptContext {
                                workspace_id: Some(workspace.id),
                                repo_id: Some(repo.id),
                                file_path,
                            })));
                        }
                    }

                    // 在工作空间内但不在特定仓库
                    return Ok(ResponseJson(ApiResponse::success(AttemptContext {
                        workspace_id: Some(workspace.id),
                        repo_id: None,
                        file_path: Some(relative_path.to_string_lossy().to_string()),
                    })));
                }
            }
        }
    }

    // 未找到任何上下文
    Ok(ResponseJson(ApiResponse::success(AttemptContext {
        workspace_id: None,
        repo_id: None,
        file_path: None,
    })))
}
```

---

## 路由配置

```rust
pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/containers/info", get(get_container_info))
        .route("/containers/attempt-context", post(attempt_context))
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P2)

### 用途

这些端点主要用于编辑器扩展 (如 VS Code 扩展) 来：
1. 确定当前文件属于哪个工作空间
2. 获取工作空间的上下文信息
3. 关联会话以发送消息

### 迁移步骤

1. 实现 Workspace 模型 (如果尚未实现)
2. 创建 `containers.rs` 路由模块
3. 实现路径解析逻辑

### 适配要点

- 路径规范化在不同操作系统上可能有差异
- 需要与 Workspace 和 Session 模型集成
