# Tags 标签管理

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/tags.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/tags` | 列出标签 |
| POST | `/tags` | 创建标签 |
| PUT | `/tags/{tag_id}` | 更新标签 |
| DELETE | `/tags/{tag_id}` | 删除标签 |

---

## 核心类型

```typescript
interface Tag {
  id: UUID;
  tag_name: string;
  color?: string;
  created_at: DateTime;
  updated_at: DateTime;
}

interface CreateTag {
  tag_name: string;
  color?: string;
}

interface UpdateTag {
  tag_name?: string;
  color?: string;
}
```

---

## GET /tags

### 描述

列出所有标签，支持搜索过滤。

### 输入

**Query 参数:**

```typescript
interface TagSearchParams {
  search?: string;  // 搜索关键词
}
```

### 输出

```typescript
interface Tag[] { /* ... */ }
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/tags.rs:22-35

pub async fn get_tags(
    State(deployment): State<DeploymentImpl>,
    Query(params): Query<TagSearchParams>,
) -> Result<ResponseJson<ApiResponse<Vec<Tag>>>, ApiError> {
    let mut tags = Tag::find_all(&deployment.db().pool).await?;

    // 搜索过滤
    if let Some(search_query) = params.search {
        let search_lower = search_query.to_lowercase();
        tags.retain(|tag| tag.tag_name.to_lowercase().contains(&search_lower));
    }

    Ok(ResponseJson(ApiResponse::success(tags)))
}
```

---

## POST /tags

### 描述

创建新标签。

### 输入

```typescript
interface CreateTag {
  tag_name: string;
  color?: string;
}
```

### 输出

```typescript
interface Tag { /* ... */ }
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/tags.rs:37-54

pub async fn create_tag(
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<CreateTag>,
) -> Result<ResponseJson<ApiResponse<Tag>>, ApiError> {
    let tag = Tag::create(&deployment.db().pool, &payload).await?;

    deployment
        .track_if_analytics_allowed("tag_created", serde_json::json!({
            "tag_id": tag.id.to_string(),
            "tag_name": tag.tag_name,
        }))
        .await;

    Ok(ResponseJson(ApiResponse::success(tag)))
}
```

---

## PUT /tags/{tag_id}

### 描述

更新标签。

### 输入

```typescript
interface UpdateTag {
  tag_name?: string;
  color?: string;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/tags.rs:56-74

pub async fn update_tag(
    Extension(tag): Extension<Tag>,
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<UpdateTag>,
) -> Result<ResponseJson<ApiResponse<Tag>>, ApiError> {
    let updated_tag = Tag::update(&deployment.db().pool, tag.id, &payload).await?;

    deployment
        .track_if_analytics_allowed("tag_updated", serde_json::json!({
            "tag_id": tag.id.to_string(),
            "tag_name": updated_tag.tag_name,
        }))
        .await;

    Ok(ResponseJson(ApiResponse::success(updated_tag)))
}
```

---

## DELETE /tags/{tag_id}

### 描述

删除标签。

### vibe-kanban 实现

```rust
// crates/server/src/routes/tags.rs:76-86

pub async fn delete_tag(
    Extension(tag): Extension<Tag>,
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let rows_affected = Tag::delete(&deployment.db().pool, tag.id).await?;
    if rows_affected == 0 {
        Err(ApiError::Database(sqlx::Error::RowNotFound))
    } else {
        Ok(ResponseJson(ApiResponse::success(())))
    }
}
```

---

## 路由配置

```rust
// crates/server/src/routes/tags.rs:88-98

pub fn router(deployment: &DeploymentImpl) -> Router<DeploymentImpl> {
    let tag_router = Router::new()
        .route("/", put(update_tag).delete(delete_tag))
        .layer(from_fn_with_state(deployment.clone(), load_tag_middleware));

    let inner = Router::new()
        .route("/", get(get_tags).post(create_tag))
        .nest("/{tag_id}", tag_router);

    Router::new().nest("/tags", inner)
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P3)

### 功能特点

1. **简单 CRUD** - 基本的标签管理
2. **搜索过滤** - 支持按名称搜索
3. **颜色支持** - 用于 UI 显示

### 迁移步骤

1. 创建 Tag 模型
2. 创建 `tags.rs` 路由模块
3. 实现 CRUD 操作

### 适配要点

- 标签可以关联到任务或其他实体
- 颜色字段用于前端显示
- 可以考虑与 viben-core 现有模型集成
