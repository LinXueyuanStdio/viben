# Images 图片管理

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/images.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/images/upload` | 上传图片 |
| GET | `/images/{id}/file` | 获取图片文件 |
| DELETE | `/images/{id}` | 删除图片 |
| GET | `/images/task/{task_id}` | 获取任务关联的图片 |
| GET | `/images/task/{task_id}/metadata` | 获取图片元数据 |
| POST | `/images/task/{task_id}/upload` | 上传图片并关联任务 |

---

## 核心类型

```typescript
interface ImageResponse {
  id: UUID;
  file_path: string;      // .vibe-images/xxx.png
  original_name: string;
  mime_type?: string;
  size_bytes: number;
  hash: string;
  created_at: DateTime;
  updated_at: DateTime;
}

interface ImageMetadata {
  exists: boolean;
  file_name?: string;
  path?: string;
  size_bytes?: number;
  format?: string;
  proxy_url?: string;  // /api/images/{id}/file
}
```

---

## POST /images/upload

### 描述

上传图片文件。

### 输入

**Content-Type**: `multipart/form-data`

```typescript
interface UploadRequest {
  image: File;  // 图片文件，最大 20MB
}
```

### 输出

```typescript
interface ImageResponse { /* ... */ }
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/images.rs:74-125

pub async fn upload_image(
    State(deployment): State<DeploymentImpl>,
    multipart: Multipart,
) -> Result<ResponseJson<ApiResponse<ImageResponse>>, ApiError> {
    let image_response = process_image_upload(&deployment, multipart, None).await?;
    Ok(ResponseJson(ApiResponse::success(image_response)))
}

async fn process_image_upload(
    deployment: &DeploymentImpl,
    mut multipart: Multipart,
    link_task_id: Option<Uuid>,
) -> Result<ImageResponse, ApiError> {
    let image_service = deployment.image();

    while let Some(field) = multipart.next_field().await? {
        if field.name() == Some("image") {
            let filename = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "image.png".to_string());

            let data = field.bytes().await?;
            let image = image_service.store_image(&data, &filename).await?;

            // 关联任务
            if let Some(task_id) = link_task_id {
                TaskImage::associate_many_dedup(
                    &deployment.db().pool,
                    task_id,
                    std::slice::from_ref(&image.id),
                )
                .await?;
            }

            // 统计追踪
            deployment
                .track_if_analytics_allowed("image_uploaded", serde_json::json!({
                    "image_id": image.id.to_string(),
                    "size_bytes": image.size_bytes,
                    "mime_type": image.mime_type,
                    "task_id": link_task_id.map(|id| id.to_string()),
                }))
                .await;

            return Ok(ImageResponse::from_image(image));
        }
    }

    Err(ApiError::Image(ImageError::NotFound))
}
```

---

## GET /images/{id}/file

### 描述

获取图片文件内容。

### 输出

图片二进制数据，带有正确的 Content-Type 和缓存头。

### vibe-kanban 实现

```rust
// crates/server/src/routes/images.rs:141-172

pub async fn serve_image(
    Path(image_id): Path<Uuid>,
    State(deployment): State<DeploymentImpl>,
) -> Result<Response, ApiError> {
    let image_service = deployment.image();
    let image = image_service
        .get_image(image_id)
        .await?
        .ok_or_else(|| ApiError::Image(ImageError::NotFound))?;

    let file_path = image_service.get_absolute_path(&image);
    let file = File::open(&file_path).await?;
    let metadata = file.metadata().await?;

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let content_type = image
        .mime_type
        .as_deref()
        .unwrap_or("application/octet-stream");

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, metadata.len())
        .header(header::CACHE_CONTROL, "public, max-age=31536000") // 缓存 1 年
        .body(body)?;

    Ok(response)
}
```

---

## GET /images/task/{task_id}/metadata

### 描述

获取图片元数据，用于 WYSIWYG 编辑器渲染。

### 输入

**Query 参数:**

```typescript
interface ImageMetadataQuery {
  path: string;  // 如 ".vibe-images/screenshot.png"
}
```

### 输出

```typescript
interface ImageMetadata { /* ... */ }
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/images.rs:194-253

pub async fn get_task_image_metadata(
    Path(task_id): Path<Uuid>,
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ImageMetadataQuery>,
) -> Result<ResponseJson<ApiResponse<ImageMetadata>>, ApiError> {
    let not_found_response = || ImageMetadata {
        exists: false,
        file_name: None,
        path: Some(query.path.clone()),
        size_bytes: None,
        format: None,
        proxy_url: None,
    };

    // 验证路径格式
    let vibe_images_prefix = format!("{}/", utils::path::VIBE_IMAGES_DIR);
    if !query.path.starts_with(&vibe_images_prefix) {
        return Ok(ResponseJson(ApiResponse::success(not_found_response())));
    }

    // 防止路径遍历攻击
    if query.path.contains("..") {
        return Ok(ResponseJson(ApiResponse::success(not_found_response())));
    }

    // 提取文件名
    let file_name = match query.path.strip_prefix(&vibe_images_prefix) {
        Some(name) if !name.is_empty() => name,
        _ => return Ok(ResponseJson(ApiResponse::success(not_found_response()))),
    };

    // 查找图片
    let image = match Image::find_by_file_path(&deployment.db().pool, file_name).await? {
        Some(img) => img,
        None => return Ok(ResponseJson(ApiResponse::success(not_found_response()))),
    };

    // 验证图片是否关联到此任务
    let is_associated = TaskImage::is_associated(&deployment.db().pool, task_id, image.id).await?;
    if !is_associated {
        return Ok(ResponseJson(ApiResponse::success(not_found_response())));
    }

    // 构建响应
    let format = StdPath::new(file_name)
        .extension()
        .map(|ext| ext.to_string_lossy().to_lowercase());
    let proxy_url = format!("/api/images/{}/file", image.id);

    Ok(ResponseJson(ApiResponse::success(ImageMetadata {
        exists: true,
        file_name: Some(image.original_name),
        path: Some(query.path),
        size_bytes: Some(image.size_bytes),
        format,
        proxy_url: Some(proxy_url),
    })))
}
```

---

## 路由配置

```rust
// crates/server/src/routes/images.rs:255-269

pub fn routes() -> Router<DeploymentImpl> {
    Router::new()
        .route(
            "/upload",
            post(upload_image).layer(DefaultBodyLimit::max(20 * 1024 * 1024)), // 20MB
        )
        .route("/{id}/file", get(serve_image))
        .route("/{id}", delete(delete_image))
        .route("/task/{task_id}", get(get_task_images))
        .route("/task/{task_id}/metadata", get(get_task_image_metadata))
        .route(
            "/task/{task_id}/upload",
            post(upload_task_image).layer(DefaultBodyLimit::max(20 * 1024 * 1024)),
        )
}
```

---

## 关键依赖

```rust
// ImageService
struct ImageService {
    images_dir: PathBuf,
    db: Pool,
}

impl ImageService {
    async fn store_image(&self, data: &[u8], filename: &str) -> Result<Image>;
    async fn get_image(&self, id: Uuid) -> Result<Option<Image>>;
    fn get_absolute_path(&self, image: &Image) -> PathBuf;
    async fn delete_image(&self, id: Uuid) -> Result<()>;
}

// Image model
struct Image {
    id: Uuid,
    file_path: String,
    original_name: String,
    mime_type: Option<String>,
    size_bytes: i64,
    hash: String,
    created_at: DateTime,
    updated_at: DateTime,
}

// TaskImage (关联表)
struct TaskImage {
    task_id: Uuid,
    image_id: Uuid,
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P3)

### 功能特点

1. **图片上传** - 支持多种格式
2. **内容寻址** - 使用 hash 防止重复存储
3. **任务关联** - 图片与任务多对多关系
4. **元数据查询** - 支持 WYSIWYG 编辑器

### 迁移步骤

1. 创建 Image 和 TaskImage 模型
2. 实现 ImageService
3. 创建 `images.rs` 路由模块
4. 配置图片存储目录

### 适配要点

- 图片存储在 `~/.viben/images/` 或类似目录
- 文件名使用 hash 防止冲突
- 需要处理大文件上传 (multipart)
- 缓存头设置对性能很重要
