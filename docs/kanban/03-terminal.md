# Terminal PTY WebSocket

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/terminal.rs`
- **viben-core**: `crates/viben-core/src/gateway/routes/terminal.rs`

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/terminal/ws` | PTY 终端 WebSocket |

---

## GET /terminal/ws

### 描述

建立 WebSocket 连接，提供 PTY 终端交互。

### 输入

**Query 参数:**

```typescript
interface TerminalQuery {
  workspace_id: UUID;  // 工作空间 ID
  cols?: number;       // 列数，默认 80
  rows?: number;       // 行数，默认 24
}
```

### WebSocket 消息格式

**客户端 -> 服务器:**

```typescript
type TerminalCommand =
  | { type: "input"; data: string }     // Base64 编码的输入
  | { type: "resize"; cols: number; rows: number }  // 调整窗口大小
```

**服务器 -> 客户端:**

```typescript
type TerminalMessage =
  | { type: "output"; data: string }    // Base64 编码的输出
  | { type: "error"; message: string }  // 错误信息
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/terminal.rs:1-174

#[derive(Debug, Deserialize)]
pub struct TerminalQuery {
    pub workspace_id: Uuid,
    #[serde(default = "default_cols")]
    pub cols: u16,
    #[serde(default = "default_rows")]
    pub rows: u16,
}

fn default_cols() -> u16 { 80 }
fn default_rows() -> u16 { 24 }

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum TerminalCommand {
    Input { data: String },
    Resize { cols: u16, rows: u16 },
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum TerminalMessage {
    Output { data: String },
    Error { message: String },
}

pub async fn terminal_ws(
    ws: WebSocketUpgrade,
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<TerminalQuery>,
) -> Result<impl IntoResponse, ApiError> {
    // 1. 查找 workspace
    let attempt = Workspace::find_by_id(&deployment.db().pool, query.workspace_id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Attempt not found".to_string()))?;

    // 2. 获取容器目录
    let container_ref = attempt
        .container_ref
        .ok_or_else(|| ApiError::BadRequest("Attempt has no workspace directory".to_string()))?;

    let base_dir = PathBuf::from(&container_ref);
    if !base_dir.exists() {
        return Err(ApiError::BadRequest("Workspace directory does not exist".to_string()));
    }

    // 3. 解析工作目录 (单仓库时进入仓库目录)
    let mut working_dir = base_dir.clone();
    match WorkspaceRepo::find_repos_for_workspace(&deployment.db().pool, query.workspace_id).await {
        Ok(repos) if repos.len() == 1 => {
            let repo_dir = base_dir.join(&repos[0].name);
            if repo_dir.exists() {
                working_dir = repo_dir;
            }
        }
        _ => {}
    }

    Ok(ws.on_upgrade(move |socket| {
        handle_terminal_ws(socket, deployment, working_dir, query.cols, query.rows)
    }))
}

async fn handle_terminal_ws(
    socket: WebSocket,
    deployment: DeploymentImpl,
    working_dir: PathBuf,
    cols: u16,
    rows: u16,
) {
    // 创建 PTY 会话
    let (session_id, mut output_rx) = match deployment
        .pty()
        .create_session(working_dir, cols, rows)
        .await
    {
        Ok(result) => result,
        Err(e) => {
            let _ = send_error(socket, &e.to_string()).await;
            return;
        }
    };

    let (mut ws_sender, mut ws_receiver) = socket.split();
    let pty_service = deployment.pty().clone();

    // 输出任务: PTY -> WebSocket
    let output_task = tokio::spawn(async move {
        while let Some(data) = output_rx.recv().await {
            let msg = TerminalMessage::Output {
                data: BASE64.encode(&data),
            };
            let json = serde_json::to_string(&msg).unwrap();
            if ws_sender.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
        ws_sender
    });

    // 输入处理: WebSocket -> PTY
    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                if let Ok(cmd) = serde_json::from_str::<TerminalCommand>(&text) {
                    match cmd {
                        TerminalCommand::Input { data } => {
                            if let Ok(bytes) = BASE64.decode(&data) {
                                let _ = pty_service.write(session_id, &bytes).await;
                            }
                        }
                        TerminalCommand::Resize { cols, rows } => {
                            let _ = pty_service.resize(session_id, cols, rows).await;
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    let _ = deployment.pty().close_session(session_id).await;
    output_task.abort();
}
```

### 关键依赖

```rust
// PtyService
trait PtyService {
    async fn create_session(&self, working_dir: PathBuf, cols: u16, rows: u16)
        -> Result<(SessionId, Receiver<Vec<u8>>)>;
    async fn write(&self, session_id: SessionId, data: &[u8]) -> Result<()>;
    async fn resize(&self, session_id: SessionId, cols: u16, rows: u16) -> Result<()>;
    async fn close_session(&self, session_id: SessionId) -> Result<()>;
}
```

### 差异分析

| 方面 | vibe-kanban | viben-core |
|------|-------------|------------|
| 工作目录解析 | 基于 workspace + repo | 待确认 |
| 数据编码 | Base64 | Base64 |
| 会话管理 | PtyService | PtyService |

### 迁移建议

**状态**: 已有对应实现，功能相似。

viben-core 的实现应该已经包含核心功能。主要差异在于：
1. 工作目录解析逻辑 (单仓库 vs 多仓库)
2. 错误处理方式

如果 viben-core 需要支持工作空间概念，可以参考 vibe-kanban 的目录解析逻辑。
