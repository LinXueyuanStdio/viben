# Approvals 审批工作流

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/approvals.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/approvals/{id}/respond` | 响应审批请求 |

---

## 说明

Approvals 系统用于处理需要用户确认的操作，如危险的 shell 命令执行。当智能体请求执行可能有风险的操作时，会创建一个审批请求，等待用户响应。

---

## 核心类型

```typescript
interface ApprovalResponse {
  approved: boolean;
  reason?: string;
}

type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

interface ApprovalContext {
  tool_name: string;
  execution_process_id: UUID;
  // ... 其他上下文信息
}
```

---

## POST /approvals/{id}/respond

### 描述

响应审批请求，批准或拒绝操作。

### 输入

**Path 参数:**

```typescript
id: string  // 审批请求 ID
```

**Body:**

```typescript
interface ApprovalResponse {
  approved: boolean;
  reason?: string;  // 可选的拒绝原因
}
```

### 输出

```typescript
interface ApprovalStatus { /* ... */ }
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/approvals.rs:16-44

pub async fn respond_to_approval(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
    ResponseJson(request): ResponseJson<ApprovalResponse>,
) -> Result<ResponseJson<ApiResponse<ApprovalStatus>>, StatusCode> {
    let service = deployment.approvals();

    match service.respond(&deployment.db().pool, &id, request).await {
        Ok((status, context)) => {
            // 追踪审批响应事件
            deployment
                .track_if_analytics_allowed("approval_responded", serde_json::json!({
                    "approval_id": &id,
                    "status": format!("{:?}", status),
                    "tool_name": context.tool_name,
                    "execution_process_id": context.execution_process_id.to_string(),
                }))
                .await;

            Ok(ResponseJson(ApiResponse::success(status)))
        }
        Err(e) => {
            tracing::error!("Failed to respond to approval: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
```

---

## 路由配置

```rust
// crates/server/src/routes/approvals.rs:46-48

pub fn router() -> Router<DeploymentImpl> {
    Router::new().route("/approvals/{id}/respond", post(respond_to_approval))
}
```

---

## 关键依赖

```rust
// ApprovalsService
struct ApprovalsService {
    pending: DashMap<String, PendingApproval>,
}

impl ApprovalsService {
    /// 创建新的审批请求
    async fn request_approval(&self, context: ApprovalContext) -> String;

    /// 等待审批结果
    async fn wait_for_approval(&self, id: &str, timeout: Duration) -> Result<bool>;

    /// 响应审批请求
    async fn respond(
        &self,
        pool: &Pool,
        id: &str,
        response: ApprovalResponse,
    ) -> Result<(ApprovalStatus, ApprovalContext)>;
}

// 审批请求
struct PendingApproval {
    context: ApprovalContext,
    sender: oneshot::Sender<bool>,
    created_at: DateTime,
}
```

---

## 工作流程

```
1. 智能体请求执行危险操作 (如 rm -rf)
2. ContainerService 创建审批请求
3. 前端显示审批对话框
4. 用户点击批准/拒绝
5. POST /approvals/{id}/respond 处理响应
6. ContainerService 收到响应，继续或中止操作
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P3)

### 功能特点

1. **异步审批** - 使用 oneshot channel 等待响应
2. **超时处理** - 审批请求有过期时间
3. **上下文保存** - 记录操作详情用于审计

### 迁移步骤

1. 实现 ApprovalsService
2. 集成到 ContainerService
3. 创建 `approvals.rs` 路由模块
4. 实现前端审批对话框

### 适配要点

- 审批服务需要线程安全 (使用 DashMap)
- 需要处理审批超时
- 审批历史可选择持久化
- 前端需要实时通知机制 (SSE 或 WebSocket)
