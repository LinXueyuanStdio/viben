# Health 健康检查

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/health.rs`
- **viben-core**: `crates/viben-core/src/gateway/routes/health.rs`

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |

---

## GET /health

### 描述

返回服务健康状态。

### 输入

无

### 输出

```typescript
// vibe-kanban
interface Response {
  success: boolean;
  data: string; // "OK"
}

// viben-core
interface Response {
  status: string;      // "ok"
  service: string;     // "viben-gateway"
  version: string;     // 版本号
  timestamp: string;   // ISO 8601 时间戳
  uptime: string;      // "running"
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/health.rs:1-7
use axum::response::Json;
use utils::response::ApiResponse;

pub async fn health_check() -> Json<ApiResponse<String>> {
    Json(ApiResponse::success("OK".to_string()))
}
```

### viben-core 实现

```rust
// crates/viben-core/src/gateway/routes/health.rs:1-22
use axum::Json;
use chrono::Utc;
use serde_json::{json, Value};

pub async fn health_check() -> Json<Value> {
    let response = json!({
        "status": "ok",
        "service": "viben-gateway",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": Utc::now().to_rfc3339(),
        "uptime": "running"
    });
    Json(response)
}
```

### 差异分析

| 方面 | vibe-kanban | viben-core |
|------|-------------|------------|
| 响应格式 | ApiResponse 包装 | 直接 JSON |
| 响应内容 | 简单 "OK" | 详细状态信息 |
| 版本信息 | 无 | 包含版本号 |
| 时间戳 | 无 | 包含时间戳 |

### 迁移建议

**状态**: 已有对应实现，无需迁移。

viben-core 的实现更丰富，包含版本和时间戳信息。如果需要兼容 vibe-kanban 前端，可以添加 `ApiResponse` 包装。
