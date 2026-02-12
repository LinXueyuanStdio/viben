# Repo 仓库管理

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/repo.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/repos` | 获取所有仓库 |
| POST | `/repos` | 注册仓库 |
| GET | `/repos/recent` | 获取最近使用的仓库 |
| POST | `/repos/init` | 初始化新仓库 |
| POST | `/repos/batch` | 批量获取仓库 |
| GET | `/repos/{repo_id}` | 获取仓库详情 |
| PUT | `/repos/{repo_id}` | 更新仓库 |
| GET | `/repos/{repo_id}/branches` | 获取分支列表 |
| GET | `/repos/{repo_id}/remotes` | 获取远程仓库列表 |
| GET | `/repos/{repo_id}/prs` | 获取打开的 PR 列表 |
| GET | `/repos/{repo_id}/search` | 搜索仓库文件 |
| POST | `/repos/{repo_id}/open-editor` | 在编辑器中打开仓库 |

---

## GET /repos

### 描述

获取所有已注册的仓库。

### 输出

```typescript
interface Repo {
  id: UUID;
  name: string;
  display_name: string;
  path: string;           // 本地路径
  default_branch?: string;
  default_working_dir?: string;
  created_at: DateTime;
  updated_at: DateTime;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/repo.rs:113-118

pub async fn get_repos(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<Vec<Repo>>>, ApiError> {
    let repos = Repo::list_all(&deployment.db().pool).await?;
    Ok(ResponseJson(ApiResponse::success(repos)))
}
```

---

## POST /repos

### 描述

注册现有的 Git 仓库。

### 输入

```typescript
interface RegisterRepoRequest {
  path: string;           // 本地 Git 仓库路径
  display_name?: string;  // 显示名称
}
```

### 输出

```typescript
interface Repo {
  id: UUID;
  name: string;
  display_name: string;
  path: string;
  // ...
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/repo.rs:46-60

pub async fn register_repo(
    State(deployment): State<DeploymentImpl>,
    ResponseJson(payload): ResponseJson<RegisterRepoRequest>,
) -> Result<ResponseJson<ApiResponse<Repo>>, ApiError> {
    let repo = deployment
        .repo()
        .register(
            &deployment.db().pool,
            &payload.path,
            payload.display_name.as_deref(),
        )
        .await?;

    Ok(ResponseJson(ApiResponse::success(repo)))
}
```

---

## POST /repos/init

### 描述

在指定位置初始化新的 Git 仓库。

### 输入

```typescript
interface InitRepoRequest {
  parent_path: string;   // 父目录路径
  folder_name: string;   // 新仓库文件夹名称
}
```

### 输出

```typescript
interface Repo {
  id: UUID;
  name: string;
  // ...
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/repo.rs:62-77

pub async fn init_repo(
    State(deployment): State<DeploymentImpl>,
    ResponseJson(payload): ResponseJson<InitRepoRequest>,
) -> Result<ResponseJson<ApiResponse<Repo>>, ApiError> {
    let repo = deployment
        .repo()
        .init_repo(
            &deployment.db().pool,
            deployment.git(),
            &payload.parent_path,
            &payload.folder_name,
        )
        .await?;

    Ok(ResponseJson(ApiResponse::success(repo)))
}
```

---

## GET /repos/{repo_id}/branches

### 描述

获取仓库的所有分支。

### 输出

```typescript
interface GitBranch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/repo.rs:79-90

pub async fn get_repo_branches(
    State(deployment): State<DeploymentImpl>,
    Path(repo_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Vec<GitBranch>>>, ApiError> {
    let repo = deployment
        .repo()
        .get_by_id(&deployment.db().pool, repo_id)
        .await?;

    let branches = deployment.git().get_all_branches(&repo.path)?;
    Ok(ResponseJson(ApiResponse::success(branches)))
}
```

---

## GET /repos/{repo_id}/remotes

### 描述

获取仓库的所有远程仓库。

### 输出

```typescript
interface GitRemote {
  name: string;
  url: string;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/repo.rs:92-103

pub async fn get_repo_remotes(
    State(deployment): State<DeploymentImpl>,
    Path(repo_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Vec<GitRemote>>>, ApiError> {
    let repo = deployment
        .repo()
        .get_by_id(&deployment.db().pool, repo_id)
        .await?;

    let remotes = deployment.git().list_remotes(&repo.path)?;
    Ok(ResponseJson(ApiResponse::success(remotes)))
}
```

---

## GET /repos/{repo_id}/prs

### 描述

获取仓库打开的 Pull Request 列表。支持 GitHub、GitLab 等。

### 输入

**Query 参数:**

```typescript
interface ListPrsQuery {
  remote?: string;  // 指定远程仓库名称，默认使用 origin
}
```

### 输出

```typescript
type Response =
  | { success: true; data: OpenPrInfo[] }
  | { success: false; error: ListPrsError };

interface OpenPrInfo {
  number: number;
  title: string;
  url: string;
  author: string;
  head_branch: string;
  base_branch: string;
  state: string;
  created_at: DateTime;
  updated_at: DateTime;
}

type ListPrsError =
  | { type: "cli_not_installed"; provider: ProviderKind }
  | { type: "auth_failed"; message: string }
  | { type: "unsupported_provider" };

type ProviderKind = "github" | "gitlab" | "bitbucket";
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/repo.rs:244-291

pub async fn list_open_prs(
    State(deployment): State<DeploymentImpl>,
    Path(repo_id): Path<Uuid>,
    Query(query): Query<ListPrsQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<OpenPrInfo>, ListPrsError>>, ApiError> {
    let repo = deployment.repo().get_by_id(&deployment.db().pool, repo_id).await?;

    // 获取远程仓库信息
    let remote = match query.remote {
        Some(name) => GitRemote {
            url: deployment.git().get_remote_url(&repo.path, &name)?,
            name,
        },
        None => deployment.git().get_default_remote(&repo.path)?,
    };

    // 创建 Git Host 服务
    let git_host = match GitHostService::from_url(&remote.url) {
        Ok(host) => host,
        Err(GitHostError::UnsupportedProvider) => {
            return Ok(ResponseJson(ApiResponse::error_with_data(
                ListPrsError::UnsupportedProvider,
            )));
        }
        Err(e) => return Ok(ResponseJson(ApiResponse::error(&e.to_string()))),
    };

    // 获取 PR 列表
    match git_host.list_open_prs(&repo.path, &remote.url).await {
        Ok(prs) => Ok(ResponseJson(ApiResponse::success(prs))),
        Err(GitHostError::CliNotInstalled { provider }) => {
            Ok(ResponseJson(ApiResponse::error_with_data(
                ListPrsError::CliNotInstalled { provider },
            )))
        }
        Err(GitHostError::AuthFailed(message)) => {
            Ok(ResponseJson(ApiResponse::error_with_data(
                ListPrsError::AuthFailed { message },
            )))
        }
        Err(e) => Ok(ResponseJson(ApiResponse::error(&e.to_string()))),
    }
}
```

---

## GET /repos/{repo_id}/search

### 描述

搜索仓库内的文件。

### 输入

**Query 参数:**

```typescript
interface SearchQuery {
  q: string;          // 搜索关键词
  mode?: SearchMode;  // 搜索模式
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/repo.rs:194-228

pub async fn search_repo(
    State(deployment): State<DeploymentImpl>,
    Path(repo_id): Path<Uuid>,
    Query(search_query): Query<SearchQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<SearchResult>>>, StatusCode> {
    if search_query.q.trim().is_empty() {
        return Ok(ResponseJson(ApiResponse::error(
            "Query parameter 'q' is required and cannot be empty",
        )));
    }

    let repo = deployment.repo().get_by_id(&deployment.db().pool, repo_id).await?;

    let results = deployment
        .file_search_cache()
        .search_repo(&repo.path, &search_query.q, search_query.mode)
        .await?;

    Ok(ResponseJson(ApiResponse::success(results)))
}
```

---

## 路由配置

```rust
// crates/server/src/routes/repo.rs:293-305

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/repos", get(get_repos).post(register_repo))
        .route("/repos/recent", get(get_recent_repos))
        .route("/repos/init", post(init_repo))
        .route("/repos/batch", post(get_repos_batch))
        .route("/repos/{repo_id}", get(get_repo).put(update_repo))
        .route("/repos/{repo_id}/branches", get(get_repo_branches))
        .route("/repos/{repo_id}/remotes", get(get_repo_remotes))
        .route("/repos/{repo_id}/prs", get(list_open_prs))
        .route("/repos/{repo_id}/search", get(search_repo))
        .route("/repos/{repo_id}/open-editor", post(open_repo_in_editor))
}
```

---

## 关键依赖

```rust
// RepoService
trait RepoService {
    async fn register(&self, pool: &Pool, path: &str, display_name: Option<&str>) -> Result<Repo>;
    async fn init_repo(&self, pool: &Pool, git: &GitService, parent_path: &str, folder_name: &str)
        -> Result<Repo>;
    async fn get_by_id(&self, pool: &Pool, repo_id: Uuid) -> Result<Repo>;
}

// GitService
trait GitService {
    fn get_all_branches(&self, path: &Path) -> Result<Vec<GitBranch>>;
    fn list_remotes(&self, path: &Path) -> Result<Vec<GitRemote>>;
    fn get_remote_url(&self, path: &Path, name: &str) -> Result<String>;
    fn get_default_remote(&self, path: &Path) -> Result<GitRemote>;
}

// GitHostService
trait GitHostService {
    fn from_url(url: &str) -> Result<Self>;
    async fn list_open_prs(&self, path: &Path, url: &str) -> Result<Vec<OpenPrInfo>>;
}

// FileSearchCache
trait FileSearchCache {
    async fn search_repo(&self, path: &Path, query: &str, mode: SearchMode)
        -> Result<Vec<SearchResult>>;
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P2)

### 需要实现的组件

1. **Repo 模型**
   - 数据库表和 CRUD
   - 路径验证

2. **GitService**
   - 分支管理
   - 远程仓库管理
   - Git 操作封装

3. **GitHostService**
   - GitHub/GitLab/Bitbucket 集成
   - PR 列表获取

4. **文件搜索**
   - 可复用 viben-core 现有实现

### 迁移步骤

1. 创建 Repo 模型和 RepoService
2. 实现 GitService (可复用 git2 或调用 git CLI)
3. 实现 GitHostService (调用 gh/glab CLI)
4. 创建 `repo.rs` 路由模块

### 适配要点

- Git 操作可使用 git2 crate 或调用 git CLI
- PR 获取依赖 gh/glab CLI，需要处理未安装情况
- 文件搜索可复用现有实现
