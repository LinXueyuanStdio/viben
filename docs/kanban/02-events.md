# Events SSE 事件流

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/events.rs`
- **viben-core**: `crates/viben-core/src/gateway/routes/events.rs`

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/events` | SSE 事件流 |

---

## GET /events

### 描述

建立 Server-Sent Events (SSE) 连接，实时推送系统事件。

### 输入

无

### 输出

SSE 流，事件格式取决于实现。

### vibe-kanban 实现

```rust
// crates/server/src/routes/events.rs:1-29
use axum::{
    BoxError, Router,
    extract::State,
    response::{
        Sse,
        sse::{Event, KeepAlive},
    },
    routing::get,
};
use deployment::Deployment;
use futures_util::TryStreamExt;

use crate::DeploymentImpl;

pub async fn events(
    State(deployment): State<DeploymentImpl>,
) -> Result<Sse<impl futures_util::Stream<Item = Result<Event, BoxError>>>, axum::http::StatusCode>
{
    // Ask the container service for a combined "history + live" stream
    let stream = deployment.stream_events().await;
    Ok(Sse::new(stream.map_err(|e| -> BoxError { e.into() })).keep_alive(KeepAlive::default()))
}

pub fn router(_: &DeploymentImpl) -> Router<DeploymentImpl> {
    let events_router = Router::new().route("/", get(events));
    Router::new().nest("/events", events_router)
}
```

### 关键依赖

```rust
// deployment trait
trait Deployment {
    async fn stream_events(&self) -> impl Stream<Item = Result<Event, Error>>;
}
```

### viben-core 实现

viben-core 有 `events.rs` 但实现方式不同，主要通过 `EventService` 广播事件。

### 差异分析

| 方面 | vibe-kanban | viben-core |
|------|-------------|------------|
| 事件来源 | Deployment.stream_events() | EventService.subscribe() |
| 事件类型 | 历史 + 实时合并流 | 仅实时事件 |
| 保活 | KeepAlive::default() | - |

### 迁移建议

**状态**: 已有对应实现，可能需要增强。

如果需要 vibe-kanban 的"历史 + 实时"合并流功能，需要：
1. 在 `EventService` 中添加历史事件缓存
2. 实现 `stream_events()` 方法合并历史和实时流
