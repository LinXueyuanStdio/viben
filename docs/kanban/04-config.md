# Config 配置管理

## 源码位置

- **vibe-kanban**: `crates/server/src/routes/config.rs`
- **viben-core**: 无对应 (待迁移)

## 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/info` | 获取用户系统信息 |
| PUT | `/config` | 更新配置 |
| GET | `/sounds/{sound}` | 获取音效文件 |
| GET | `/mcp-config` | 获取 MCP 服务器配置 |
| POST | `/mcp-config` | 更新 MCP 服务器配置 |
| GET | `/profiles` | 获取执行器配置 |
| PUT | `/profiles` | 更新执行器配置 |
| GET | `/editors/check-availability` | 检查编辑器可用性 |
| GET | `/agents/check-availability` | 检查智能体可用性 |
| GET | `/agents/slash-commands/ws` | 智能体斜杠命令流 (WebSocket) |

---

## GET /info

### 描述

获取用户系统信息，包括配置、登录状态、执行器配置、环境信息和智能体能力。

### 输入

无

### 输出

```typescript
interface UserSystemInfo {
  config: Config;
  analytics_user_id: string;
  login_status: LoginStatus;
  executors: ExecutorConfigs;    // flattened
  environment: Environment;
  capabilities: Record<string, BaseAgentCapability[]>;
}

interface Environment {
  os_type: string;
  os_version: string;
  os_architecture: string;
  bitness: string;
}

type LoginStatus = "LoggedOut" | { LoggedIn: { profile: UserProfile } };

interface Config {
  disclaimer_acknowledged: boolean;
  onboarding_acknowledged: boolean;
  analytics_enabled: boolean;
  git_branch_prefix: string;
  executor_profile: string;
  editor: EditorConfig;
  // ... 其他配置
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/config.rs:58-128

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct Environment {
    pub os_type: String,
    pub os_version: String,
    pub os_architecture: String,
    pub bitness: String,
}

impl Environment {
    pub fn new() -> Self {
        let info = os_info::get();
        Environment {
            os_type: info.os_type().to_string(),
            os_version: info.version().to_string(),
            os_architecture: info.architecture().unwrap_or("unknown").to_string(),
            bitness: info.bitness().to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct UserSystemInfo {
    pub config: Config,
    pub analytics_user_id: String,
    pub login_status: LoginStatus,
    #[serde(flatten)]
    pub profiles: ExecutorConfigs,
    pub environment: Environment,
    pub capabilities: HashMap<String, Vec<BaseAgentCapability>>,
}

async fn get_user_system_info(
    State(deployment): State<DeploymentImpl>,
) -> ResponseJson<ApiResponse<UserSystemInfo>> {
    let config = deployment.config().read().await;
    let login_status = tokio::time::timeout(
        std::time::Duration::from_secs(2),
        deployment.get_login_status(),
    )
    .await
    .unwrap_or(LoginStatus::LoggedOut);

    let user_system_info = UserSystemInfo {
        config: config.clone(),
        analytics_user_id: deployment.user_id().to_string(),
        login_status,
        profiles: ExecutorConfigs::get_cached(),
        environment: Environment::new(),
        capabilities: {
            let mut caps: HashMap<String, Vec<BaseAgentCapability>> = HashMap::new();
            let profs = ExecutorConfigs::get_cached();
            for key in profs.executors.keys() {
                if let Some(agent) = profs.get_coding_agent(&ExecutorProfileId::new(*key)) {
                    caps.insert(key.to_string(), agent.capabilities());
                }
            }
            caps
        },
    };

    ResponseJson(ApiResponse::success(user_system_info))
}
```

---

## PUT /config

### 描述

更新用户配置。

### 输入

```typescript
interface Config {
  disclaimer_acknowledged?: boolean;
  onboarding_acknowledged?: boolean;
  analytics_enabled?: boolean;
  git_branch_prefix?: string;
  executor_profile?: string;
  editor?: EditorConfig;
  // ...
}
```

### 输出

```typescript
interface Response {
  success: boolean;
  data?: Config;
  error?: string;
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/config.rs:130-159

async fn update_config(
    State(deployment): State<DeploymentImpl>,
    Json(new_config): Json<Config>,
) -> ResponseJson<ApiResponse<Config>> {
    let config_path = config_path();

    // 验证 git 分支前缀
    if !git::is_valid_branch_prefix(&new_config.git_branch_prefix) {
        return ResponseJson(ApiResponse::error(
            "Invalid git branch prefix. Must be a valid git branch name component without slashes.",
        ));
    }

    let old_config = deployment.config().read().await.clone();

    match save_config_to_file(&new_config, &config_path).await {
        Ok(_) => {
            let mut config = deployment.config().write().await;
            *config = new_config.clone();
            drop(config);

            // 跟踪配置事件并执行副作用
            handle_config_events(&deployment, &old_config, &new_config).await;

            ResponseJson(ApiResponse::success(new_config))
        }
        Err(e) => ResponseJson(ApiResponse::error(&format!("Failed to save config: {}", e))),
    }
}
```

---

## GET /mcp-config

### 描述

获取指定执行器的 MCP 服务器配置。

### 输入

**Query 参数:**

```typescript
interface McpServerQuery {
  executor: BaseCodingAgent;  // 执行器类型
}
```

### 输出

```typescript
interface GetMcpServerResponse {
  mcp_config: McpConfig;
  config_path: string;
}

interface McpConfig {
  servers: Record<string, unknown>;
  servers_path: string[];
  // ...
}
```

### vibe-kanban 实现

```rust
// crates/server/src/routes/config.rs:218-269

#[derive(TS, Debug, Deserialize)]
pub struct McpServerQuery {
    executor: BaseCodingAgent,
}

#[derive(TS, Debug, Serialize, Deserialize)]
pub struct GetMcpServerResponse {
    mcp_config: McpConfig,
    config_path: String,
}

async fn get_mcp_servers(
    State(_deployment): State<DeploymentImpl>,
    Query(query): Query<McpServerQuery>,
) -> Result<ResponseJson<ApiResponse<GetMcpServerResponse>>, ApiError> {
    let coding_agent = ExecutorConfigs::get_cached()
        .get_coding_agent(&ExecutorProfileId::new(query.executor))
        .ok_or(ConfigError::ValidationError("Executor not found".to_string()))?;

    if !coding_agent.supports_mcp() {
        return Ok(ResponseJson(ApiResponse::error("MCP not supported by this executor")));
    }

    let config_path = match coding_agent.default_mcp_config_path() {
        Some(path) => path,
        None => {
            return Ok(ResponseJson(ApiResponse::error("Could not determine config file path")));
        }
    };

    let mut mcpc = coding_agent.get_mcp_config();
    let raw_config = read_agent_config(&config_path, &mcpc).await?;
    let servers = get_mcp_servers_from_config_path(&raw_config, &mcpc.servers_path);
    mcpc.set_servers(servers);

    Ok(ResponseJson(ApiResponse::success(GetMcpServerResponse {
        mcp_config: mcpc,
        config_path: config_path.to_string_lossy().to_string(),
    })))
}
```

---

## POST /mcp-config

### 描述

更新指定执行器的 MCP 服务器配置。

### 输入

**Query 参数:**

```typescript
interface McpServerQuery {
  executor: BaseCodingAgent;
}
```

**Body:**

```typescript
interface UpdateMcpServersBody {
  servers: Record<string, unknown>;
}
```

### 输出

```typescript
interface Response {
  success: boolean;
  data?: string;  // 操作结果消息
  error?: string;
}
```

---

## GET /profiles

### 描述

获取执行器配置文件内容。

### 输入

无

### 输出

```typescript
interface ProfilesContent {
  content: string;  // JSON 格式的配置内容
  path: string;     // 配置文件路径
}
```

---

## PUT /profiles

### 描述

更新执行器配置。

### 输入

```typescript
// Body: JSON 字符串格式的 ExecutorConfigs
```

### 输出

```typescript
interface Response {
  success: boolean;
  data?: string;  // "Executor profiles updated successfully"
  error?: string;
}
```

---

## GET /editors/check-availability

### 描述

检查指定编辑器是否可用。

### 输入

**Query 参数:**

```typescript
interface CheckEditorAvailabilityQuery {
  editor_type: EditorType;
}
```

### 输出

```typescript
interface CheckEditorAvailabilityResponse {
  available: boolean;
}
```

---

## GET /agents/check-availability

### 描述

检查指定智能体是否可用。

### 输入

**Query 参数:**

```typescript
interface CheckAgentAvailabilityQuery {
  executor: BaseCodingAgent;
}
```

### 输出

```typescript
type AvailabilityInfo =
  | "Available"
  | "NotFound"
  | { NotAvailable: { reason: string } }
  | { CheckFailed: { error: string } };
```

---

## GET /agents/slash-commands/ws

### 描述

通过 WebSocket 流式获取智能体的斜杠命令列表。

### 输入

**Query 参数:**

```typescript
interface AgentSlashCommandsStreamQuery {
  executor: BaseCodingAgent;
  workspace_id?: UUID;
  repo_id?: UUID;
}
```

### WebSocket 消息

服务器 -> 客户端:

```typescript
type LogMsg =
  | { type: "json_patch"; patch: JsonPatch }
  | { type: "ready" }
  | { type: "finished" };
```

---

## 关键依赖

```rust
// ExecutorConfigs
struct ExecutorConfigs {
    executors: HashMap<BaseCodingAgent, ExecutorConfig>,
}

impl ExecutorConfigs {
    fn get_cached() -> Self;
    fn get_coding_agent(&self, id: &ExecutorProfileId) -> Option<&dyn CodingAgent>;
    fn reload();
    fn save_overrides() -> Result<()>;
}

// CodingAgent trait
trait CodingAgent {
    fn supports_mcp(&self) -> bool;
    fn default_mcp_config_path(&self) -> Option<PathBuf>;
    fn get_mcp_config(&self) -> McpConfig;
    fn get_availability_info(&self) -> AvailabilityInfo;
    fn capabilities(&self) -> Vec<BaseAgentCapability>;
}
```

---

## 迁移建议

**状态**: 待迁移 (优先级 P1)

### 迁移步骤

1. **创建 config.rs 模块**
   ```
   crates/viben-core/src/gateway/routes/config.rs
   ```

2. **添加依赖**
   - `os_info` crate 用于环境信息
   - 执行器配置管理 (可复用 vibe-kanban 的 executors crate)

3. **实现端点**
   - 优先实现 `/info`, `/agents/check-availability`
   - MCP 配置管理可后续实现

4. **考虑简化**
   - 如果不需要 analytics 和登录状态，可以简化 `/info` 响应
   - MCP 配置可以复用现有的 `mcp.rs` 模块

### 适配要点

- 将 `ApiResponse` 改为直接返回或使用 viben-core 的错误处理
- 执行器配置需要适配 viben-core 的 Agent 模型
