# Filesystem 文件系统

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/filesystem.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/filesystem/directory` | 列出目录内容 |
| GET | `/filesystem/git-repos` | 列出 Git 仓库 |

---

## GET /filesystem/directory

### 描述

列出指定目录的内容，用于文件浏览器。

### 输入

**Query 参数:**

```typescript
interface ListDirectoryQuery {
  path?: string;  // 目录路径，不指定时使用用户主目录
}
```

### 输出

```typescript
interface DirectoryListResponse {
  path: string;
  entries: DirectoryEntry[];
  parent?: string;
}

interface DirectoryEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_hidden: boolean;
  size?: number;
  modified?: DateTime;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/filesystem.rs:19-39

pub async fn list_directory(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ListDirectoryQuery>,
) -> Result<ResponseJson<ApiResponse<DirectoryListResponse>>, ApiError> {
    match deployment.filesystem().list_directory(query.path).await {
        Ok(response) => Ok(ResponseJson(ApiResponse::success(response))),
        Err(FilesystemError::DirectoryDoesNotExist) => {
            Ok(ResponseJson(ApiResponse::error("Directory does not exist")))
        }
        Err(FilesystemError::PathIsNotDirectory) => {
            Ok(ResponseJson(ApiResponse::error("Path is not a directory")))
        }
        Err(FilesystemError::Io(e)) => {
            tracing::error!("Failed to read directory: {}", e);
            Ok(ResponseJson(ApiResponse::error(&format!(
                "Failed to read directory: {}",
                e
            ))))
        }
    }
}
```

---

## GET /filesystem/git-repos

### 描述

搜索指定目录下的 Git 仓库。

### 输入

**Query 参数:**

```typescript
interface ListDirectoryQuery {
  path?: string;  // 搜索起始路径，不指定时搜索常见位置
}
```

### 输出

```typescript
type DirectoryEntry[]
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/filesystem.rs:41-72

pub async fn list_git_repos(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ListDirectoryQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<DirectoryEntry>>>, ApiError> {
    let res = if let Some(ref path) = query.path {
        // 搜索指定路径
        deployment
            .filesystem()
            .list_git_repos(
                Some(path.clone()),
                800,    // 超时毫秒 (单目录)
                1200,   // 总超时毫秒
                Some(3) // 最大深度
            )
            .await
    } else {
        // 搜索常见位置 (~, ~/Documents, ~/Projects, etc.)
        deployment
            .filesystem()
            .list_common_git_repos(
                800,    // 超时毫秒 (单目录)
                1200,   // 总超时毫秒
                Some(4) // 最大深度
            )
            .await
    };

    match res {
        Ok(response) => Ok(ResponseJson(ApiResponse::success(response))),
        Err(FilesystemError::DirectoryDoesNotExist) => {
            Ok(ResponseJson(ApiResponse::error("Directory does not exist")))
        }
        Err(FilesystemError::PathIsNotDirectory) => {
            Ok(ResponseJson(ApiResponse::error("Path is not a directory")))
        }
        Err(FilesystemError::Io(e)) => {
            tracing::error!("Failed to read directory: {}", e);
            Ok(ResponseJson(ApiResponse::error(&format!(
                "Failed to read directory: {}",
                e
            ))))
        }
    }
}
```

---

## 路由配置

```rust
pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/filesystem/directory", get(list_directory))
        .route("/filesystem/git-repos", get(list_git_repos))
}
```

---

## 关键依赖

```rust
// FilesystemService
struct FilesystemService;

impl FilesystemService {
    async fn list_directory(&self, path: Option<String>) -> Result<DirectoryListResponse, FilesystemError>;

    async fn list_git_repos(
        &self,
        path: Option<String>,
        timeout_per_dir_ms: u64,
        total_timeout_ms: u64,
        max_depth: Option<usize>,
    ) -> Result<Vec<DirectoryEntry>, FilesystemError>;

    async fn list_common_git_repos(
        &self,
        timeout_per_dir_ms: u64,
        total_timeout_ms: u64,
        max_depth: Option<usize>,
    ) -> Result<Vec<DirectoryEntry>, FilesystemError>;
}

// FilesystemError
enum FilesystemError {
    DirectoryDoesNotExist,
    PathIsNotDirectory,
    Io(std::io::Error),
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P2)

### 功能特点

1. **目录浏览** - 列出目录内容
2. **Git 仓库发现** - 自动发现本地 Git 仓库
3. **超时控制** - 防止在大目录中卡住

### 迁移步骤

1. 实现 FilesystemService
2. 创建 `filesystem.rs` 路由模块
3. 实现目录遍历和 Git 仓库检测

### 适配要点

- Git 仓库检测通过查找 `.git` 目录实现
- 需要处理符号链接和权限问题
- 超时控制对用户体验很重要
- 隐藏文件 (以 `.` 开头) 需要特殊处理
