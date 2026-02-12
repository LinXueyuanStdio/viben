# Search 多仓库搜索

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/search.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/search` | 跨多个仓库搜索文件 |

---

## GET /search

### 描述

在多个仓库中搜索文件，支持文件名和内容搜索。

### 输入

**Query 参数:**

```typescript
interface MultiRepoSearchQuery {
  q: string;          // 搜索关键词
  mode?: SearchMode;  // 搜索模式 (默认: "filename")
  repo_ids: string;   // 逗号分隔的仓库 ID 列表
}

type SearchMode = "filename" | "content" | "fuzzy";
```

### 输出

```typescript
interface SearchResult {
  file_path: string;     // 文件路径 (相对于仓库根目录)
  repo_id: UUID;         // 仓库 ID
  repo_name: string;     // 仓库名称
  line_number?: number;  // 匹配的行号 (内容搜索时)
  match_content?: string; // 匹配的内容 (内容搜索时)
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/search.rs:1-76

#[derive(Debug, Deserialize)]
pub struct MultiRepoSearchQuery {
    pub q: String,
    #[serde(default)]
    pub mode: SearchMode,
    pub repo_ids: String,
}

pub async fn search_files(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<MultiRepoSearchQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<SearchResult>>>, ApiError> {
    // 解析仓库 ID 列表
    let repo_ids: Vec<Uuid> = query
        .repo_ids
        .split(',')
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().parse::<Uuid>())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| ApiError::BadRequest("Invalid repo_id format".to_string()))?;

    if repo_ids.is_empty() {
        return Err(ApiError::BadRequest("repo_ids parameter is required".to_string()));
    }

    if query.q.trim().is_empty() {
        return Ok(ResponseJson(ApiResponse::error(
            "Query parameter 'q' is required and cannot be empty",
        )));
    }

    // 获取仓库信息
    let repos = Repo::find_by_ids(&deployment.db().pool, &repo_ids).await?;

    // 构建搜索查询
    let search_query = SearchQuery {
        q: query.q,
        mode: query.mode,
    };

    // 执行搜索
    let results = deployment
        .project()
        .search_files(
            deployment.file_search_cache().as_ref(),
            &repos,
            &search_query,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to search files: {}", e);
            ApiError::BadRequest(format!("Search failed: {}", e))
        })?;

    Ok(ResponseJson(ApiResponse::success(results)))
}

pub fn router(deployment: &DeploymentImpl) -> Router<DeploymentImpl> {
    Router::new()
        .route("/search", get(search_files))
        .with_state(deployment.clone())
}
```

---

## 关键依赖

```rust
// FileSearchCache
struct FileSearchCache {
    cache: DashMap<PathBuf, CachedSearchIndex>,
}

impl FileSearchCache {
    async fn search_repo(&self, path: &Path, query: &str, mode: SearchMode) -> Result<Vec<SearchResult>>;
}

// ProjectService
trait ProjectService {
    async fn search_files(
        &self,
        cache: &FileSearchCache,
        repos: &[Repo],
        query: &SearchQuery,
    ) -> Result<Vec<SearchResult>>;
}

// SearchQuery
struct SearchQuery {
    q: String,
    mode: SearchMode,
}

// SearchMode
enum SearchMode {
    Filename,  // 文件名匹配
    Content,   // 内容搜索
    Fuzzy,     // 模糊匹配
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P2)

### 功能特点

1. **跨仓库搜索** - 可同时搜索多个仓库
2. **搜索模式** - 支持文件名、内容、模糊搜索
3. **搜索缓存** - 使用 FileSearchCache 提高性能

### 迁移步骤

1. 实现 FileSearchCache (或复用 viben-core 现有搜索)
2. 创建 `search.rs` 路由模块
3. 实现多仓库搜索逻辑

### 适配要点

- viben-core 可能已有文件搜索实现，可以复用
- 考虑使用 ripgrep 或 ignore crate 提高搜索性能
- 搜索缓存需要处理文件变更失效
