# Browse MCP Desktop App - 设计文档

## 概述

设计并实现 Browse MCP 的跨平台桌面应用，提供学术论文搜索、MCP 服务管理、智能体配置等功能。

---

## 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Tauri 2.x | Rust 后端，体积小，性能好 |
| 前端框架 | React 19 + TypeScript | 现代 React，类型安全 |
| UI 库 | shadcn/ui + Tailwind CSS | 可定制组件，现代设计 |
| 状态管理 | Zustand | 轻量级状态管理 |
| MCP Server | Python (现有) | 复用 `backend/browse-mcp/` |
| 构建工具 | Vite | 快速开发体验 |

### Python 集成策略

**方案**: 桌面应用依赖用户已安装的 Python 环境

- **不打包 Python runtime** - 保持应用体积小
- **检测用户 Python 环境** - 自动发现或手动配置
- **通过 Tauri (Rust) spawn Python 进程** - 启动 MCP Server
- **提供安装指引** - 如果未安装 browse-mcp 包

```
用户 Python 环境要求:
- Python >= 3.10
- pip install browse-mcp (或 uv/pipx)
```

---

## 功能模块

### 1. 仪表盘 (Dashboard)
- 搜索统计（今日/本周/总计）
- 最近搜索记录
- 已配置智能体状态
- 快速操作入口

### 2. 提供商管理 (Providers)
- **搜索引擎分类**:
  - 知识库（arXiv, PubMed, Semantic Scholar 等）
  - 商业搜索引擎
  - 本地 MCP Server
  - URL2Searcher（自定义 URL 模板）
- 启用/禁用提供商
- 配置 API 密钥
- 测试连接

### 3. 搜索服务配置 (Search Service)
- 配置搜索服务为 MCP Server
- 选择传输协议（stdio/sse/http）
- 设置并发限制
- 配置下载路径

### 4. 智能体管理 (Agents)
- 自动检测已安装智能体:
  - Claude Desktop
  - Cursor
  - Windsurf
  - Continue
  - VS Code + Copilot
- 一键配置 MCP Server
- 查看/编辑配置文件
- 配置状态指示

### 5. API 密钥 (API Keys)
- 生成 API 密钥
- 设置权限和配额
- 查看使用统计
- 撤销密钥

### 6. 日志 (Logs)
- 实时请求日志
- 按时间/类型筛选
- 详情查看
- 导出日志

### 7. 设置 (Settings)
- **Python 环境配置** (新增)
  - 自动检测 Python 路径
  - 手动指定 Python 路径
  - 检测 browse-mcp 包安装状态
  - 一键安装指引
- 外观（主题、语言）
- 网络（代理设置）
- 存储（下载路径、缓存）
- 快捷键

### 8. 关于 (About)
- 版本信息
- 自动更新
- 开源协议
- 反馈链接

---

## 项目结构

```
browse-mcp/
├── apps/
│   └── desktop/                    # Tauri 桌面应用
│       ├── src/                    # React 前端
│       │   ├── components/         # UI 组件
│       │   │   ├── ui/             # shadcn/ui 组件
│       │   │   └── layout/         # 布局组件
│       │   ├── pages/              # 页面组件
│       │   │   ├── dashboard/
│       │   │   ├── providers/
│       │   │   ├── agents/
│       │   │   ├── settings/
│       │   │   └── ...
│       │   ├── stores/             # Zustand stores
│       │   ├── hooks/              # 自定义 hooks
│       │   ├── lib/                # 工具函数
│       │   └── types/              # TypeScript 类型
│       ├── src-tauri/              # Rust 后端
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   ├── commands/       # Tauri 命令
│       │   │   │   ├── python.rs   # Python 环境检测
│       │   │   │   ├── mcp.rs      # MCP Server 管理
│       │   │   │   └── agents.rs   # 智能体检测与配置
│       │   │   └── lib.rs
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       ├── package.json
│       └── vite.config.ts
│
├── backend/
│   └── browse-mcp/                 # Python MCP Server (现有)
│       ├── browse_mcp/
│       │   ├── __main__.py         # 入口
│       │   ├── types.py            # 数据类型
│       │   └── sources/            # 学术源实现
│       └── pyproject.toml
│
├── pnpm-workspace.yaml
├── package.json
└── turbo.json
```

---

## Rust 后端功能 (src-tauri)

### Python 环境管理

```rust
// commands/python.rs

/// 检测系统中可用的 Python 解释器
#[tauri::command]
async fn detect_python() -> Result<Vec<PythonInfo>, String>

/// 检测 browse-mcp 包是否已安装
#[tauri::command]
async fn check_browse_mcp_installed(python_path: &str) -> Result<PackageInfo, String>

/// 获取安装命令
#[tauri::command]
fn get_install_command(python_path: &str) -> String
```

### MCP Server 进程管理

```rust
// commands/mcp.rs

/// 启动 MCP Server 进程
#[tauri::command]
async fn start_mcp_server(config: McpConfig) -> Result<ProcessHandle, String>

/// 停止 MCP Server 进程
#[tauri::command]
async fn stop_mcp_server(handle: ProcessHandle) -> Result<(), String>

/// 获取 MCP Server 状态
#[tauri::command]
async fn get_mcp_status() -> Result<McpStatus, String>
```

### 智能体检测与配置

```rust
// commands/agents.rs

/// 检测已安装的 AI 智能体
#[tauri::command]
async fn detect_agents() -> Result<Vec<AgentInfo>, String>

/// 读取智能体 MCP 配置
#[tauri::command]
async fn read_agent_config(agent: &str) -> Result<McpConfig, String>

/// 写入智能体 MCP 配置
#[tauri::command]
async fn write_agent_config(agent: &str, config: McpConfig) -> Result<(), String>
```

---

## 智能体配置文件路径

| 智能体 | 平台 | 配置文件路径 |
|--------|------|--------------|
| Claude Desktop | macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop | Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | macOS | `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json` |
| Cursor | Windows | `%APPDATA%\Cursor\User\globalStorage\cursor.mcp\mcp.json` |
| VS Code | macOS | `~/.vscode/mcp.json` |
| VS Code | Windows | `%USERPROFILE%\.vscode\mcp.json` |

---

## 开发阶段

### Phase 1: 基础架构
1. 初始化 Tauri + React 项目
2. 配置 monorepo (pnpm workspace + turbo)
3. 设置 shadcn/ui + Tailwind
4. 创建基础布局（侧边栏导航）

### Phase 2: Python 集成
1. Rust 端 Python 环境检测
2. browse-mcp 包检测
3. MCP Server 进程 spawn/管理
4. 前端 Python 配置页面

### Phase 3: 核心功能
1. 仪表盘页面
2. 提供商管理
3. 搜索服务配置
4. 本地测试搜索功能

### Phase 4: 智能体集成
1. 智能体检测器
2. 配置文件读写
3. 一键配置 UI
4. 状态监控

### Phase 5: 高级功能
1. API 密钥管理
2. 日志系统
3. 设置页面
4. 自动更新

### Phase 6: 打包发布
1. 多平台构建配置
2. 代码签名
3. 自动更新服务
4. 发布流程

---

## 验收标准

- [ ] 跨平台构建（Windows, macOS, Linux）
- [ ] 正确检测用户 Python 环境
- [ ] browse-mcp 包安装检测与指引
- [ ] MCP Server 进程正常启动/停止
- [ ] 所有 18 个学术源正常工作
- [ ] 可检测并配置主流 AI 智能体
- [ ] 应用体积 < 15MB (不含 Python)
- [ ] 启动时间 < 3 秒
- [ ] 中英文支持

---

## 参考资料

- [Tauri 2.0 文档](https://v2.tauri.app/)
- [Tauri Command API](https://v2.tauri.app/develop/calling-rust/)
- [shadcn/ui](https://ui.shadcn.com/)
- Python MCP Server: `backend/browse-mcp/`
