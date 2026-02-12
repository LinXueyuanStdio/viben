# Scratch 草稿存储

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/scratch.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/scratch` | 列出所有草稿 |
| GET | `/scratch/{scratch_type}/{id}` | 获取草稿 |
| POST | `/scratch/{scratch_type}/{id}` | 创建草稿 |
| PUT | `/scratch/{scratch_type}/{id}` | 更新草稿 |
| DELETE | `/scratch/{scratch_type}/{id}` | 删除草稿 |
| GET | `/scratch/{scratch_type}/{id}/stream/ws` | 草稿流 (WebSocket) |

---

## 说明

Scratch 是一个通用的草稿存储系统，用于保存用户正在编辑但尚未提交的内容。使用复合主键 (type + id) 来标识不同类型的草稿。

---

## 核心类型

```typescript
interface Scratch {
  id: UUID;
  scratch_type: ScratchType;
  payload: ScratchPayload;
  created_at: DateTime;
  updated_at: DateTime;
}

type ScratchType =
  | "draft_follow_up"   // 后续消息草稿
  | "draft_task"        // 任务草稿
  | "draft_pr";         // PR 描述草稿

type ScratchPayload =
  | { type: "draft_follow_up"; content: string; executor_profile_id?: ExecutorProfileId }
  | { type: "draft_task"; title: string; description?: string }
  | { type: "draft_pr"; title: string; body?: string };

interface CreateScratch {
  payload: ScratchPayload;
}

interface UpdateScratch {
  payload: ScratchPayload;
}
```

---

## GET /scratch/{scratch_type}/{id}

### 描述

获取指定类型和 ID 的草稿。

### 输入

**Path 参数:**

```typescript
interface ScratchPath {
  scratch_type: ScratchType;
  id: UUID;
}
```

### 输出

```typescript
interface Scratch { /* ... */ }
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/scratch.rs:33-41

pub async fn get_scratch(
    State(deployment): State<DeploymentImpl>,
    Path(ScratchPath { scratch_type, id }): Path<ScratchPath>,
) -> Result<ResponseJson<ApiResponse<Scratch>>, ApiError> {
    let scratch = Scratch::find_by_id(&deployment.db().pool, id, &scratch_type)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Scratch not found".to_string()))?;
    Ok(ResponseJson(ApiResponse::success(scratch)))
}
```

---

## POST /scratch/{scratch_type}/{id}

### 描述

创建草稿。如果正在运行的进程有排队消息，则拒绝编辑 draft_follow_up。

### 输入

```typescript
interface CreateScratch {
  payload: ScratchPayload;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/scratch.rs:43-65

pub async fn create_scratch(
    State(deployment): State<DeploymentImpl>,
    Path(ScratchPath { scratch_type, id }): Path<ScratchPath>,
    Json(payload): Json<CreateScratch>,
) -> Result<ResponseJson<ApiResponse<Scratch>>, ApiError> {
    // 检查是否有排队消息阻止编辑
    if matches!(scratch_type, ScratchType::DraftFollowUp)
        && deployment.queued_message_service().has_queued(id)
    {
        return Err(ApiError::BadRequest(
            "Cannot edit scratch while a message is queued".to_string(),
        ));
    }

    // 验证 payload 类型与 URL 类型匹配
    payload
        .payload
        .validate_type(scratch_type)
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let scratch = Scratch::create(&deployment.db().pool, id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(scratch)))
}
```

---

## PUT /scratch/{scratch_type}/{id}

### 描述

更新草稿 (upsert - 不存在则创建)。

### vibe-kanban 实现

```rust
// crates/server/src/routes/scratch.rs:67-90

pub async fn update_scratch(
    State(deployment): State<DeploymentImpl>,
    Path(ScratchPath { scratch_type, id }): Path<ScratchPath>,
    Json(payload): Json<UpdateScratch>,
) -> Result<ResponseJson<ApiResponse<Scratch>>, ApiError> {
    // 检查是否有排队消息阻止编辑
    if matches!(scratch_type, ScratchType::DraftFollowUp)
        && deployment.queued_message_service().has_queued(id)
    {
        return Err(ApiError::BadRequest(
            "Cannot edit scratch while a message is queued".to_string(),
        ));
    }

    // 验证 payload 类型
    payload
        .payload
        .validate_type(scratch_type)
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    // Upsert: 存在则更新，不存在则创建
    let scratch = Scratch::update(&deployment.db().pool, id, &scratch_type, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(scratch)))
}
```

---

## GET /scratch/{scratch_type}/{id}/stream/ws

### 描述

通过 WebSocket 实时流式推送草稿变更。

### vibe-kanban 实现

```rust
// crates/server/src/routes/scratch.rs:103-145

pub async fn stream_scratch_ws(
    ws: WebSocketUpgrade,
    State(deployment): State<DeploymentImpl>,
    Path(ScratchPath { scratch_type, id }): Path<ScratchPath>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_scratch_ws(socket, deployment, id, scratch_type).await {
            tracing::warn!("scratch WS closed: {}", e);
        }
    })
}

async fn handle_scratch_ws(
    socket: WebSocket,
    deployment: DeploymentImpl,
    id: Uuid,
    scratch_type: ScratchType,
) -> anyhow::Result<()> {
    let mut stream = deployment
        .events()
        .stream_scratch_raw(id, &scratch_type)
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
                tracing::error!("scratch stream error: {}", e);
                break;
            }
        }
    }
    Ok(())
}
```

---

## 路由配置

```rust
// crates/server/src/routes/scratch.rs:147-161

pub fn router(_deployment: &DeploymentImpl) -> Router<DeploymentImpl> {
    Router::new()
        .route("/scratch", get(list_scratch))
        .route(
            "/scratch/{scratch_type}/{id}",
            get(get_scratch)
                .post(create_scratch)
                .put(update_scratch)
                .delete(delete_scratch),
        )
        .route(
            "/scratch/{scratch_type}/{id}/stream/ws",
            get(stream_scratch_ws),
        )
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P3)

### 功能特点

1. **通用草稿存储** - 支持多种草稿类型
2. **复合主键** - type + id 唯一标识
3. **Upsert 语义** - 更新时自动创建
4. **实时流** - WebSocket 推送变更
5. **队列保护** - 防止与排队消息冲突

### 迁移步骤

1. 创建 Scratch 模型
2. 实现 ScratchPayload 类型验证
3. 创建 `scratch.rs` 路由模块
4. 实现 WebSocket 流

### 适配要点

- 草稿与特定 ID 关联 (如 workspace_id)
- 需要与消息队列系统集成
- WebSocket 流需要事件服务支持
