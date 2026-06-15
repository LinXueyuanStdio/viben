# Python MCP Server 设计

## 概述

在 Gateway 内实现 Python MCP Server，通过 Jupyter Server REST + WebSocket 协议连接远程 Jupyter Server，为 AI Agent 提供 Python 代码执行和 Skill 加载能力。同时提供 Desktop 管理页面用于配置、调试和监控。

## 架构

整体架构

```
┌─────────────────────────────────────────────────────────┐
│  Desktop App (python-mcp.tsx)                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 配置区: Jupyter URL + Token                      │   │
│  │ 映射表: ACP Session → Kernel ID + 历史代码       │   │
│  │ Skill 编辑器: 创建/编辑 markdown skill 文件      │   │
│  │ Debug 执行器: 手动执行代码 + Rich/JSON 结果显示  │   │
│  │ MCP 配置: 一键复制 JSON（同 client-mcp.tsx）     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │ HTTP (配置/查询/执行)
         ▼
┌─────────────────────────────────────────────────────────┐
│  Gateway (packages/core)                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Route: /api/mcp-server/python                    │   │
│  │   StreamableHTTPServerTransport (MCP 协议)       │   │
│  │   读取 header: X-Jupyter-Url, X-Jupyter-Token    │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ Route: /api/python-mcp/...  (管理 API)          │   │
│  │   GET  /sessions     → 列出 session-kernel 映射  │   │
│  │   GET  /sessions/:id/history → 执行历史          │   │
│  │   POST /execute      → 手动执行代码(debug 用)    │   │
│  │   GET  /skills       → 列出 skills              │   │
│  │   POST /skills       → 创建 skill               │   │
│  │   PUT  /skills/:name → 更新 skill               │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ MCP Server: python_mcp                           │   │
│  │   Tool: execute_code(code, description)          │   │
│  │   Tool: load_skill(skill_name)                   │   │
│  │   Session → Kernel 自动绑定                      │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ JupyterClient (内部模块)                         │   │
│  │   REST: POST /api/kernels (创建)                 │   │
│  │   REST: GET /api/kernels (列表)                  │   │
│  │   WS:   /api/kernels/{id}/channels (执行)        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │ REST + WebSocket
         ▼
┌─────────────────────────────────────────────────────────┐
│  Jupyter Server (用户自行运行)                           │
│  jupyter server --port 8888 --token=xxx                 │
└─────────────────────────────────────────────────────────┘
```

核心数据流：
1. AI Agent → MCP 协议 → Gateway python-mcp route → 解析 ACP session id
2. 首次 execute → JupyterClient 通过 REST 创建 kernel → 绑定 session↔kernel
3. 后续 execute → 通过已绑定的 kernel id → WebSocket 执行代码
4. Desktop 页面 → 管理 API → 查看映射/历史/debug 执行

简化视图：

```
Desktop App (python-mcp.tsx)
    │ HTTP (管理 API)
    ▼
Gateway (packages/core)
    ├─ Route: /api/mcp-server/python        (MCP 协议端点)
    ├─ Route: /api/python-mcp/...           (管理 API)
    ├─ MCP Server: python_mcp               (execute_code + load_skill)
    ├─ SessionManager                       (session↔kernel 绑定 + 持久化)
    ├─ SkillRegistry                        (skill 文件读写)
    └─ JupyterClient                        (REST + WebSocket)
    │ REST + WebSocket
    ▼
Jupyter Server (用户自行运行)
```

## 持久化目录结构

```
~/.viben/python-mcp/
├── config.yaml                                    # Jupyter 默认连接配置
├── skills/
│   ├── skill_pandas.md
│   └── skill_plotly.md
└── sessions/
    └── <acp-session-id>/
        ├── <create-timestamp>-<kernel-id>.jsonl   # kernel 执行历史
        └── <create-timestamp>-<kernel-id>.jsonl   # 同 session 重连后的新 kernel
```

一个 session 中 kernel 可能挂掉，重启后新的 kernel 绑定到原来的 acp session id，所以同一 session 目录下可能有多个 kernel 历史文件。但同一时刻只有一个 kernel 和 acp session 绑定。利用 create-timestamp（number）来拿最新的 kernel id，拿到后检查 kernel 是否存活，不存活则连接到新的 kernel，后续代码执行日志存到新的 jsonl 文件。

### config.yaml

```yaml
jupyter_url: "http://localhost:8888"
jupyter_token: "your-token-here"
```

### Skill 文件格式

存储为 `~/.viben/python-mcp/skills/skill_{name}.md`：

```markdown
---
name: pandas
description: 使用 Pandas 进行数据分析
---

## Code for Agent
```python
import pandas as pd
df = pd.read_csv("data.csv")
```

## Code for Interpreter
```python
import pandas as pd
import numpy as np
print("Pandas initialized")
```
```

### JSONL 执行历史格式

代码和结果分为两条记录，通过 `code_id` 关联。因为代码可能执行很长时间、执行失败或断连，虽然缺失结果日志，但要保留代码日志。

```jsonl
{"type":"code","code_id":"c_001","timestamp":1718438401000,"code":"import pandas as pd\nprint('hello')","description":"导入pandas"}
{"type":"result","code_id":"c_001","timestamp":1718438402000,"status":"ok","outputs":[{"type":"stream","stream_name":"stdout","text":"hello\n"}]}
{"type":"code","code_id":"c_002","timestamp":1718438405000,"code":"df = pd.DataFrame({'a':[1,2,3]})\ndf","description":"创建df"}
{"type":"result","code_id":"c_002","timestamp":1718438406000,"status":"ok","outputs":[{"type":"execute_result","data":{"text/plain":"   a\n0  1\n1  2\n2  3","text/html":"<table>...</table>"}}]}
{"type":"code","code_id":"c_003","timestamp":1718438410000,"code":"import time; time.sleep(9999)","description":"长时间运行"}
{"type":"code","code_id":"c_004","timestamp":1718438500000,"code":"1/0","description":"测试错误"}
{"type":"result","code_id":"c_004","timestamp":1718438500500,"status":"error","error":{"name":"ZeroDivisionError","value":"division by zero","traceback":["Traceback...","ZeroDivisionError: division by zero"]}}
```

**规则**：
- `code_id` 格式：`c_` + 递增序号（文件内局部唯一，从最后一条 code 记录递增）
- 执行时先写 `type: "code"` 行落盘，确保代码记录不丢
- 执行完成后追加 `type: "result"` 行（同 `code_id`）
- 若执行失败/断连/超时，`result` 行缺失，页面显示为"未完成"（⏳ 或 ❌）

## Gateway 侧模块设计

### 文件结构

```
packages/core/src/mcp/server/python-mcp/
├── mcp-server.ts          # createPythonMcpServer() — 注册 execute_code + load_skill 工具
├── jupyter-client.ts      # JupyterClient 类 — REST API + WebSocket 代码执行
├── session-manager.ts     # SessionManager — ACP session ↔ kernel 映射 + 执行历史
├── skill-registry.ts      # SkillRegistry — 读写 ~/.viben/python-mcp/skills/*.md
├── types.ts               # Zod schema + TypeScript 类型
└── __tests__/

packages/core/src/gateway/routes/mcp-server/
└── python-mcp-server.ts   # registerPythonMcpServerRoutes() — MCP 端点 + 管理 API
```

### JupyterClient

```typescript
class JupyterClient {
  constructor(baseUrl: string, token: string)

  // REST API
  async createKernel(name?: string): Promise<string>     // 返回 kernel_id
  async listKernels(): Promise<KernelInfo[]>
  async getKernelStatus(kernelId: string): Promise<"alive" | "dead">
  async deleteKernel(kernelId: string): Promise<void>
  async interruptKernel(kernelId: string): Promise<void>

  // WebSocket 执行
  async executeCode(kernelId: string, code: string, timeout?: number): Promise<ExecutionResult>
  // 内部: 连接 ws://<base>/api/kernels/{id}/channels?token=xxx
  // 发送 execute_request → 收集 iopub 消息 → 返回结构化结果
}
```

WebSocket 连接：`ws://<base>/api/kernels/{id}/channels?token=xxx`
策略：按需建立，60s 空闲断开。不复用长连接，避免 gateway 重启场景下的僵尸连接。

### SessionManager

```typescript
class SessionManager {
  private baseDir = path.join(os.homedir(), ".viben", "python-mcp", "sessions")

  async getActiveKernel(acpSessionId: string, client: JupyterClient): Promise<string> {
    // 1. 扫描 sessions/<acpSessionId>/ 目录
    // 2. 按文件名中的 create-timestamp 排序，取最新
    // 3. 从文件名解析 kernel-id
    // 4. 调用 Jupyter REST API 检查 kernel 是否存活
    // 5. 存活 → 返回 kernel id
    // 6. 不存活 → 创建新 kernel → 新建 jsonl 文件 → 返回新 kernel id
  }

  async recordCode(acpSessionId: string, kernelId: string, entry: CodeEntry): Promise<string>  // 返回 code_id
  async recordResult(acpSessionId: string, kernelId: string, codeId: string, result: ResultEntry): Promise<void>

  async getHistory(acpSessionId: string): Promise<KernelHistory[]> {
    // 返回该 session 下所有 kernel 的历史（按时间排序）
  }

  async getAllSessions(): Promise<SessionInfo[]> {
    // 扫描所有 session 目录，返回映射列表
  }
}
```

### ExecutionResult 结构

```typescript
interface ExecutionResult {
  status: "ok" | "error"
  outputs: OutputItem[]   // 有序输出列表
  error?: { name: string; value: string; traceback: string[] }
}

interface OutputItem {
  type: "stream" | "execute_result" | "display_data" | "error"
  // stream
  stream_name?: "stdout" | "stderr"
  text?: string
  // rich output (execute_result / display_data)
  data?: Record<string, any>  // MIME type → content
  // 常见: text/plain, image/png(base64), text/html, application/json,
  //       application/vnd.plotly.v1+json, text/latex
}
```

### SkillRegistry

```typescript
class SkillRegistry {
  private skillDir = path.join(os.homedir(), ".viben", "python-mcp", "skills")

  async listSkills(): Promise<SkillMeta[]>
  async getSkill(name: string): Promise<SkillConfig>
  async createSkill(config: SkillConfig): Promise<void>  // 写入 skill_{name}.md
  async updateSkill(name: string, config: Partial<SkillConfig>): Promise<void>
  async deleteSkill(name: string): Promise<void>
}

interface SkillConfig {
  name: string
  description: string
  code_for_interpreter?: string  // 在 kernel 中执行的初始化代码
  code_for_agent?: string        // 嵌入给 agent 的代码示例
}
```

### Kernel 重连流程

```
execute_code 被调用
    ↓
SessionManager.getActiveKernel(acpSessionId, client)
    ↓
扫描 ~/.viben/python-mcp/sessions/<acpSessionId>/
    ↓ 有文件?
    ├─ 有 → 取最新 timestamp 的文件 → 解析 kernel-id
    │       ↓
    │   client.getKernelStatus(kernelId)
    │       ↓ 存活?
    │       ├─ 是 → 使用该 kernel
    │       └─ 否 → 创建新 kernel → 新建 jsonl 文件
    │
    └─ 无 → 创建新 kernel → 创建目录 + 新建 jsonl 文件
    ↓
执行代码 → recordCode() → executeCode() → recordResult()
```

## MCP 工具定义

### MCP Server 信息

- 名称：`python_mcp`
- 路径：`/api/mcp-server/python`
- 传输：StreamableHTTPServerTransport

### Header 协议

| Header | 必需 | 说明 |
|--------|------|------|
| `X-Viben-Session-Id` | 是 | ACP session id，用于绑定 kernel |
| `X-Jupyter-Url` | 否 | 覆盖默认 Jupyter base URL |
| `X-Jupyter-Token` | 否 | 覆盖默认 Jupyter token |

优先级：Header > `~/.viben/python-mcp/config.yaml`

### Tool: execute_code

**输入 schema**：
```typescript
{
  code: z.string().describe("要执行的 Python 代码"),
  description: z.string().describe("描述此次执行的目的"),
}
```

**执行流程**：
1. 从 MCP 会话 context 获取 `acpSessionId`（通过 `X-Viben-Session-Id`）
2. 解析 Jupyter 连接信息（header 优先，fallback config.yaml）
3. `sessionManager.getActiveKernel(acpSessionId, client)` → kernel id
4. 生成 `code_id`，写入 `type: "code"` 到 jsonl（先落盘保证不丢）
5. `client.executeCode(kernelId, code, timeout=60s)` → ExecutionResult
6. 写入 `type: "result"` 到 jsonl
7. 返回 MCP CallToolResult

**输出格式**：
```typescript
{
  // content: 多模态 MCP ContentBlock[]，从 OutputItem[] 转换
  // agent 通过 content（message_content）拿到可直接消费的多模态结果
  content: [
    { type: "text", text: "hello\n" },                            // stream stdout
    { type: "text", text: "   a\n0  1\n1  2\n2  3" },            // text/plain
    { type: "image", mimeType: "image/png", data: "base64..." },  // 图片
    // ...每个 output 转换为对应的 ContentBlock
  ],
  // debug 页面/高级场景通过 structuredContent.block_list 拿到完整原始数据
  structuredContent: {
    code_id: "c_001",
    kernel_id: "k-abc123",
    status: "ok",
    block_list: [
      // 带类型的完整块（保留 plotly JSON、HTML、table 等原始数据）
      { type: "stream", stream_name: "stdout", text: "hello\n" },
      { type: "execute_result", data: { "text/plain": "...", "text/html": "<table>...", "application/vnd.plotly.v1+json": {...} } },
      { type: "display_data", data: { "image/png": "base64...", "text/plain": "<Figure>" } },
    ]
  },
  isError: false  // status == "error" 时为 true
}
```

**转换规则**（OutputItem → ContentBlock）：
- `stream` → `{ type: "text", text }`
- `text/plain` → `{ type: "text", text }`
- `image/png` / `image/jpeg` → `{ type: "image", mimeType, data }`
- `text/html` / `application/vnd.plotly.v1+json` 等 → `{ type: "text", text: 文本摘要 }`（rich 数据只在 `structuredContent.block_list` 中完整保留）

### Tool: load_skill

**输入 schema**：
```typescript
{
  skill_name: z.string().describe("Skill 名称"),
}
```

**执行流程**：
1. `skillRegistry.getSkill(skillName)` → SkillConfig
2. 若有 `code_for_interpreter`：
   - 获取当前 kernel（同 execute_code 流程）
   - 在 kernel 中执行初始化代码
   - 记录到 jsonl（description 标记为 `[skill:pandas] initialization`）
3. 组装返回文本：skill description + code_for_agent + 执行结果

**输出格式**：
```typescript
{
  content: [
    { type: "text", text: "<system-reminder>Loaded skill 'pandas'</system-reminder>\n\n## Code for Agent\n```python\n...\n```\n\n<executed-result>\n...\n</executed-result>" }
  ],
  structuredContent: {
    skill_name: "pandas",
    status: "success",
    initialization_result: { ... }  // code_for_interpreter 执行结果（若有）
  }
}
```

## 管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/python-mcp/config` | 获取 Jupyter 默认配置 |
| PUT | `/api/python-mcp/config` | 更新 Jupyter 默认配置 |
| GET | `/api/python-mcp/sessions` | 列出所有 session→kernel 映射 |
| GET | `/api/python-mcp/sessions/:id/history` | 获取 session 执行历史（所有 kernel） |
| POST | `/api/python-mcp/execute` | Debug 执行代码（body: `{kernel_id, code, description}`） |
| GET | `/api/python-mcp/skills` | 列出所有 skills |
| POST | `/api/python-mcp/skills` | 创建 skill |
| PUT | `/api/python-mcp/skills/:name` | 更新 skill |
| DELETE | `/api/python-mcp/skills/:name` | 删除 skill |

## WebSocket 执行协议

Gateway 连接 Jupyter kernel channels 的消息流：

```
→ shell channel (发送):
{
  "header": { "msg_id": "<uuid>", "msg_type": "execute_request", "session": "<uuid>", "username": "", "version": "5.3" },
  "parent_header": {},
  "metadata": {},
  "content": { "code": "...", "silent": false, "store_history": true, "allow_stdin": false }
}

← iopub channel (接收, 过滤 parent_header.msg_id == 我们的 msg_id):
  msg_type: "status"         → execution_state: "busy" | "idle"
  msg_type: "stream"         → name: "stdout"|"stderr", text: "..."
  msg_type: "execute_result" → data: { "text/plain": ..., "image/png": ..., ... }
  msg_type: "display_data"   → data: { ... }（同 execute_result）
  msg_type: "error"          → ename, evalue, traceback[]
```

**超时**：60s 无 idle → 发送 interrupt_request → 返回超时错误。

## Desktop 页面设计

### 基本信息

- 文件：`apps/desktop/src/pages/mcp/python-mcp.tsx`
- 路由：`/mcp-services/python-mcp`
- 在 McpServicesLayout 侧边栏添加导航项
- 在 route-registry.ts 注册

### 页面布局（5 个区块）

```
┌─────────────────────────────────────────────────────────┐
│ ① Jupyter 连接配置                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Base URL: [http://localhost:8888    ] [保存]         │ │
│ │ Token:    [••••••••••••••••••••••••] [保存]         │ │
│ │ 状态: 已连接 / 未连接               [测试连接]     │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ② Session → Kernel 映射表                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ACP Session       │ Kernel (当前) │ 历史Kernels│创建│ │
│ │ session_abc123... │ k-def456 活跃 │ 2 个       │10:30│
│ │   └─ [展开]                                         │ │
│ │      ├─ k-abc123 (已结束) - 5 条执行记录            │ │
│ │      └─ k-def456 (活跃)   - 3 条执行记录            │ │
│ │ session_def456... │ k-xyz789 活跃 │ 1 个       │11:15│
│ └─────────────────────────────────────────────────────┘ │
│ 展开 kernel 显示 code 条目，有 result 配对显示，         │
│ 无 result 的标记"未完成"                                │
├─────────────────────────────────────────────────────────┤
│ ③ Debug 执行器                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Kernel: [下拉选择已有 kernel id]                    │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ # 代码编辑器 (textarea/code editor)           │   │ │
│ │ │ import pandas as pd                           │   │ │
│ │ │ df = pd.DataFrame({"a": [1,2,3]})            │   │ │
│ │ │ df.describe()                                 │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ │ [执行]  显示模式: (Rich) (JSON)                     │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ 执行结果区域                                   │   │ │
│ │ │ Rich: 渲染图片/文本/HTML/plotly                │   │ │
│ │ │ JSON: vanilla-jsoneditor 显示原始结构          │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ④ Skills 管理                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [+ 新建 Skill]                                      │ │
│ │ ┌─────────────────────────────────────────────┐     │ │
│ │ │ Name: [pandas_helper    ]                   │     │ │
│ │ │ Description: [数据分析辅助    ]              │     │ │
│ │ │ Code for Interpreter: [代码编辑器]           │     │ │
│ │ │ Code for Agent: [代码编辑器]                 │     │ │
│ │ │ [保存] [删除]                               │     │ │
│ │ └─────────────────────────────────────────────┘     │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ⑤ MCP Server 配置信息（同 client-mcp.tsx 模式）          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Endpoint: http://127.0.0.1:18790/api/mcp-server/python│
│ │ Transport: streamable-http                          │ │
│ │ 必需 Headers:                                       │ │
│ │   X-Viben-Session-Id: <session_id>                  │ │
│ │   X-Jupyter-Url: <jupyter_base_url> (可选,覆盖默认) │ │
│ │   X-Jupyter-Token: <token> (可选,覆盖默认)          │ │
│ │                                                     │ │
│ │ 方式1 (Query Param):  [JSON] [复制]                 │ │
│ │ 方式2 (Header):       [JSON] [复制]                 │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 状态管理

- Jupyter 配置：通过管理 API `GET/PUT /api/python-mcp/config` 读写
- Session 映射：`GET /api/python-mcp/sessions`（手动刷新按钮）
- 执行历史：点击展开时按需加载 `GET /api/python-mcp/sessions/:id/history`
- Debug 执行：`POST /api/python-mcp/execute` 返回 ExecutionResult
- Skills CRUD：通过管理 API `/api/python-mcp/skills`
- MCP 配置 JSON：与 client-mcp.tsx 相同模式，从 `useAcpSessionStore` + `getGatewayUrl()` 拼装

### 执行结果显示

**Rich 模式**（完整 MIME 支持）：
- `text/plain` → `<pre>` 代码块
- `image/png` / `image/jpeg` → `<img src="data:...;base64,...">`
- `text/html` → `dangerouslySetInnerHTML`（sandbox iframe 内）
- `application/vnd.plotly.v1+json` → 动态加载 plotly.js 渲染
- `text/latex` → KaTeX 渲染
- `stream/stdout|stderr` → 带颜色区分的文本块
- `error` → 红色 traceback

**JSON 模式**：
- 使用 `vanilla-jsoneditor` + dark theme（`jse-theme-dark.css`）
- 显示完整 ExecutionResult 结构（含 block_list 所有原始数据）
- 只读模式，支持展开/折叠/搜索

```typescript
import {
  createJSONEditor,
  Mode,
  type JSONEditorPropsOptional,
  type Content,
  type JSONContent,
} from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";
```

## 不在范围内

- Kernel 生命周期管理（关闭/重启 kernel）— 后续迭代
- 多 kernel 类型（R、Julia）— 仅 Python
- Skill 的 env 变量替换和 mcp_servers 配置 — 简化版不实现
- 后台执行（background=True）— 当前版本同步执行
