# Viben Desktop

Viben 桌面应用程序，基于 Tauri 2 + React 19 + TypeScript 构建，提供跨平台的 AI 智能体管理和对话体验。

## 技术栈

- **框架**: [Tauri 2](https://tauri.app/) - 跨平台桌面应用框架
- **前端**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite 7](https://vitejs.dev/)
- **路由**: [React Router 7](https://reactrouter.com/)
- **状态管理**: [Zustand](https://zustand.docs.pmnd.rs/)
- **数据获取**: [TanStack Query](https://tanstack.com/query/)
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI 组件**: [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/)
- **国际化**: [i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/)

## 功能模块

### MCP 服务管理

| 页面 | 路径 | 说明 |
|------|------|------|
| 仪表盘 | `/mcp-services/dashboard` | MCP 服务概览和状态监控 |
| 数据源 | `/mcp-services/data-sources` | Provider 配置和管理 |
| 搜索服务 | `/mcp-services/search-service` | 搜索服务配置 |
| 日志 | `/mcp-services/logs` | 系统和调试日志 |
| Inspector | `/inspector` | MCP 协议调试工具 |
| MCP 市场 | `/mcp-marketplace` | 浏览和安装 MCP 服务 |

### 工作区 (Workspace)

| 页面 | 路径 | 说明 |
|------|------|------|
| 工作区详情 | `/workspace/:id` | 工作区概览 |
| 对话 | `/workspace/:id/chat` | AI 对话界面 |
| 看板 | `/workspace/:id/kanban` | 任务管理看板 |
| 文件 | `/workspace/:id/files` | 文件浏览器 |
| 定时任务 | `/workspace/:id/cron` | Cron 任务管理 |
| 智能体 | `/workspace/:id/agents` | 工作区智能体配置 |

### 智能体和技能

| 页面 | 路径 | 说明 |
|------|------|------|
| 智能体详情 | `/agent/:agentId` | 智能体配置和编辑 |
| 技能详情 | `/skill/:skillId` | 技能详情和配置 |
| 技能市场 | `/skills-market` | 浏览和安装技能 |
| 子智能体详情 | `/subagent/:configId` | 子智能体配置 |

### 创作者中心

| 页面 | 路径 | 说明 |
|------|------|------|
| 发布 | `/publish` | 发布 MCP 服务或技能 |
| 我的包 | `/my-packages` | 管理已发布的包 |
| 分析 | `/analytics` | 下载和使用统计 |

### 系统设置

| 页面 | 路径 | 说明 |
|------|------|------|
| 设置 | `/settings` | 通用设置 |
| 网关设置 | `/settings/gateway` | Gateway API 配置 |
| 渠道设置 | `/settings/channels` | 通知渠道配置 |
| 模型设置 | `/settings/model` | AI 模型配置 |
| 执行器设置 | `/settings/executors` | 代码执行器配置 |
| 沙箱设置 | `/settings/sandbox` | 沙箱环境配置 |
| 关于 | `/about` | 应用版本信息 |

### 其他

| 页面 | 路径 | 说明 |
|------|------|------|
| 对话监控 | `/chat-monitor` | 实时对话监控 |
| 文档 | `/documents` | 内置文档 |
| 系统托盘弹窗 | `/tray-popup` | 托盘状态弹窗 |
| 新手引导 | `/onboarding` | 首次启动引导 |

## 开发

### 环境要求

在开始开发之前,请确保你的系统满足以下要求:

- **Node.js**: >= 20.0.0 ([下载安装](https://nodejs.org/))
- **pnpm**: 9.15.0+ ([安装指南](https://pnpm.io/installation))
- **Rust**: 最新稳定版本 (用于 Tauri 构建)
  - 推荐使用 [rustup](https://rustup.rs/) 安装和管理 Rust 工具链
  - 安装命令:
    ```bash
    # macOS / Linux
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

    # Windows
    # 下载并运行 rustup-init.exe from https://rustup.rs/
    ```
  - 验证安装:
    ```bash
    rustc --version
    cargo --version
    ```

#### 系统特定依赖

**macOS**:
- Xcode Command Line Tools: `xcode-select --install`

**Linux (Debian/Ubuntu)**:
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Windows**:
- Microsoft Visual Studio C++ Build Tools
- WebView2 (通常 Windows 11 自带)

### 安装依赖

```bash
# 在项目根目录
pnpm install
```

### 启动开发服务器

```bash
# 在项目根目录
pnpm desktop:dev

# 或在 apps/desktop 目录
pnpm tauri-dev
```

开发服务器将在 `http://localhost:1420` 启动。

### 重启应用

如果应用挂起或端口被占用：

```bash
# 在项目根目录
pnpm desktop:restart
```

### 调试技巧

#### 浏览器 DevTools

Tauri 应用使用 WebView 渲染前端界面，你可以像调试 Web 应用一样使用浏览器开发者工具：

**macOS**:
- 快捷键: `Cmd + Option + I`
- 或在应用内右键点击 → 选择 "检查元素"

**Windows/Linux**:
- 快捷键: `Ctrl + Shift + I` 或 `F12`
- 或在应用内右键点击 → 选择 "检查元素"

**开发者工具功能**:
- **Console**: 查看 JavaScript 日志、错误和警告
- **Elements**: 检查 DOM 结构和 CSS 样式
- **Network**: 监控 API 请求和响应
- **Sources**: 设置断点调试 TypeScript/JavaScript 代码
- **Performance**: 分析应用性能瓶颈
- **Application**: 查看 LocalStorage、SessionStorage 和 IndexedDB

#### Tauri 日志

Tauri 会输出前端和后端的运行日志到终端：

**开发模式日志**:
```bash
# 启动开发服务器时，日志会直接输出到终端
pnpm desktop:dev

# 日志类型：
# - [Vite] 前端构建和 HMR 日志
# - [Tauri] 后端 Rust 进程日志
# - [WebView] 浏览器控制台输出
```

**日志级别**:
- `INFO`: 一般信息（蓝色）
- `WARN`: 警告信息（黄色）
- `ERROR`: 错误信息（红色）
- `DEBUG`: 调试信息（灰色）

**过滤日志**:
```bash
# 只查看 Tauri 后端日志
pnpm desktop:dev 2>&1 | grep -i tauri

# 只查看错误日志
pnpm desktop:dev 2>&1 | grep -i error
```

#### Rust 日志

Tauri 后端使用 Rust 编写，你可以通过以下方式查看 Rust 日志：

**1. 添加日志输出**:

在 `apps/desktop/src-tauri/src/lib.rs` 或其他 Rust 文件中：

```rust
// 在 Cargo.toml 中添加依赖
// [dependencies]
// log = "0.4"
// env_logger = "0.10"

use log::{debug, info, warn, error};

#[tauri::command]
fn my_command() {
    info!("这是一条信息日志");
    debug!("这是一条调试日志");
    warn!("这是一条警告日志");
    error!("这是一条错误日志");
}
```

**2. 设置日志级别**:

通过环境变量控制日志详细程度：

```bash
# 显示所有日志（包括 DEBUG）
RUST_LOG=debug pnpm desktop:dev

# 只显示 INFO 及以上级别
RUST_LOG=info pnpm desktop:dev

# 只显示特定模块的日志
RUST_LOG=viben_desktop=debug pnpm desktop:dev

# 显示 Tauri 内部日志
RUST_LOG=tauri=debug pnpm desktop:dev
```

**3. 查看编译日志**:

```bash
# 详细编译日志
pnpm tauri-build --verbose

# 查看 Cargo 构建日志
cd apps/desktop/src-tauri
cargo build --verbose
```

**4. 日志文件位置**:

生产环境的日志文件通常存储在：

- **macOS**: `~/Library/Logs/com.viben.desktop/`
- **Windows**: `%APPDATA%\com.viben.desktop\logs\`
- **Linux**: `~/.local/share/com.viben.desktop/logs/`

**调试技巧**:
- 使用 `dbg!()` 宏快速输出变量值: `dbg!(&my_variable);`
- 使用 `println!()` 输出到标准输出（仅开发模式可见）
- 在 `tauri.conf.json` 中启用 `devPath` 和 `beforeDevCommand` 查看详细启动日志

#### Gateway 通信调试

桌面应用通过 Viben Gateway (基于 `packages/core`) 与后端服务通信。Gateway 运行在独立的 Node.js 进程中，提供 RESTful API 接口。

**Gateway 配置**:
- **端口**: `18790` (默认)
- **基础 URL**: `http://127.0.0.1:18790`
- **配置文件**: `~/.viben/gateway.yaml`

**API 端点**:

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查，返回 Gateway 状态 |
| `/api/agents` | GET/POST | 智能体管理（列表、创建、更新） |
| `/api/agents/:id` | GET/PUT/DELETE | 单个智能体操作 |
| `/api/cron` | GET/POST | Cron 任务管理 |
| `/api/cron/:id` | GET/PUT/DELETE | 单个 Cron 任务操作 |
| `/api/sessions` | GET/POST | 会话管理 |
| `/api/sessions/:id` | GET/PUT/DELETE | 单个会话操作 |

**重启 Gateway**:

如果 Gateway 服务异常或需要应用配置更改：

```bash
# 在项目根目录
pnpm gateway:restart
```

重启脚本会自动执行：
1. 杀死端口 18790 上的进程
2. 清理所有 Gateway 相关进程
3. 验证端口已释放
4. 重新启动 Gateway 服务

脚本位置: `scripts/restart-gateway.sh`

**测试 Gateway 连接**:

```bash
# 1. 检查 Gateway 健康状态
curl http://127.0.0.1:18790/health

# 2. 列出所有智能体
curl http://127.0.0.1:18790/api/agents

# 3. 列出所有 Cron 任务
curl http://127.0.0.1:18790/api/cron

# 4. 列出所有会话
curl http://127.0.0.1:18790/api/sessions
```

**查看 Gateway 日志**:

```bash
# 运行时日志
tail -f ~/.viben/logs/gateway.log

# 重启日志
tail -f ~/.viben/logs/gateway-restart.log
```

**常见问题**:

1. **Gateway 未启动**:
   ```bash
   # 检查 Gateway 进程
   lsof -i:18790

   # 如果没有输出，启动 Gateway
   pnpm gateway:restart
   ```

2. **API 请求失败**:
   - 检查 Gateway 日志: `~/.viben/logs/gateway.log`
   - 确认端口 18790 未被其他应用占用
   - 验证 Gateway 配置: `~/.viben/gateway.yaml`

3. **Query 参数格式**:
   - ✅ 使用 **snake_case**: `workspace_path`, `include_global`, `session_id`
   - ❌ 不要使用 camelCase: `workspacePath`, `includeGlobal`, `sessionId`

### 开发工作流

#### 配置文件位置

Viben 桌面应用使用文件系统存储配置，遵循 **file-native** 范式（YAML 格式）。所有配置文件默认存储在 `~/.viben/` 目录中。

**配置目录结构**:

```
~/.viben/                          # Viben 全局状态目录
├── config.yaml                    # 全局配置文件
├── gateway.yaml                   # Gateway 配置
├── agents/                        # 全局智能体配置
│   ├── main.yaml                  # 主智能体配置
│   └── *.yaml                     # 其他智能体配置
├── logs/                          # 日志文件目录
│   ├── gateway.log                # Gateway 运行日志
│   └── gateway-restart.log        # Gateway 重启日志
└── cache/                         # 缓存目录

<project>/.viben/                  # 工作区配置目录
├── config.yaml                    # 工作区配置文件
└── agents/                        # 工作区智能体配置
    └── *.yaml                     # 工作区特定智能体
```

**配置优先级** (从高到低):
1. 工作区配置: `<project>/.viben/config.yaml`
2. 全局配置: `~/.viben/config.yaml`
3. 默认值 (内置)

**查看配置**:

```bash
# 使用 CLI 查看配置
viben config list                    # 列出所有配置
viben config list --show-origin      # 显示配置来源
viben config get <key>               # 获取特定配置项

# 直接查看配置文件
cat ~/.viben/config.yaml             # 全局配置
cat .viben/config.yaml               # 工作区配置
```

**编辑配置**:

```bash
# 使用 CLI 编辑
viben config edit                    # 在编辑器中打开配置
viben config set <key> <value>       # 设置配置项

# 或直接编辑 YAML 文件
code ~/.viben/config.yaml            # 使用 VS Code 编辑
vim ~/.viben/config.yaml             # 使用 vim 编辑
```

#### 环境变量

使用环境变量可以覆盖默认配置和行为：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `VIBEN_STATE_DIR` | 全局状态目录路径 | `~/.viben` |
| `VIBEN_AGENT` | 当前激活的智能体 ID | (无) |
| `VIBEN_SCOPE` | 默认配置作用域 | `workspace` |
| `RUST_LOG` | Rust 日志级别 | `info` |
| `NODE_ENV` | Node.js 运行环境 | `development` |

**使用示例**:

```bash
# 使用自定义状态目录启动应用
VIBEN_STATE_DIR=/custom/path pnpm desktop:dev

# 启用详细的 Rust 日志
RUST_LOG=debug pnpm desktop:dev

# 指定默认智能体
VIBEN_AGENT=my-agent pnpm desktop:dev

# 设置全局作用域
VIBEN_SCOPE=global pnpm desktop:dev

# 组合使用多个环境变量
RUST_LOG=debug VIBEN_STATE_DIR=~/viben-dev pnpm desktop:dev
```

**持久化环境变量** (可选):

```bash
# 在 shell 配置文件中设置 (bash: ~/.bashrc, zsh: ~/.zshrc)
export VIBEN_STATE_DIR=~/viben-dev
export RUST_LOG=info

# 或创建 .env 文件 (在项目根目录)
echo "VIBEN_STATE_DIR=~/viben-dev" > .env
echo "RUST_LOG=info" >> .env
```

#### 常见调试场景

##### 场景 1: 调试 Gateway API 调用

**问题**: 前端请求 Gateway API 失败或返回异常数据。

**调试步骤**:

1. **确认 Gateway 正在运行**:
   ```bash
   curl http://127.0.0.1:18790/health
   # 预期返回: {"status":"ok"}
   ```

2. **查看 Gateway 日志**:
   ```bash
   tail -f ~/.viben/logs/gateway.log
   ```

3. **使用 curl 测试 API**:
   ```bash
   # 测试智能体 API
   curl -X GET "http://127.0.0.1:18790/api/agents?workspace_path=/path/to/workspace"

   # 测试会话 API
   curl -X GET "http://127.0.0.1:18790/api/sessions?include_global=true"
   ```

4. **在前端检查网络请求**:
   - 打开 DevTools (Cmd+Option+I / Ctrl+Shift+I)
   - 切换到 Network 标签页
   - 筛选 "Fetch/XHR" 请求
   - 检查请求 URL、Headers、Payload 和 Response

5. **检查 API 参数格式**:
   - ✅ 正确: `workspace_path`, `include_global`, `session_id` (snake_case)
   - ❌ 错误: `workspacePath`, `includeGlobal`, `sessionId` (camelCase)

##### 场景 2: 调试智能体配置问题

**问题**: 智能体无法加载、配置不生效或运行异常。

**调试步骤**:

1. **检查智能体配置文件**:
   ```bash
   # 列出所有智能体
   viben agent list

   # 查看特定智能体配置
   viben agent show -n <agent-id>
   cat ~/.viben/agents/<agent-id>.yaml
   ```

2. **验证 YAML 语法**:
   ```bash
   # 使用 yamllint 检查语法（需先安装）
   yamllint ~/.viben/agents/<agent-id>.yaml

   # 或使用在线工具: https://www.yamllint.com/
   ```

3. **检查配置作用域**:
   ```bash
   # 查看配置来源
   viben config list --show-origin

   # 区分全局和工作区配置
   ls -la ~/.viben/agents/           # 全局智能体
   ls -la .viben/agents/              # 工作区智能体
   ```

4. **使用 JSON 输出模式调试**:
   ```bash
   # 获取结构化输出
   viben --json agent list
   viben --json agent show -n <agent-id>
   ```

##### 场景 3: 调试前端渲染问题

**问题**: UI 组件显示异常、样式错误或交互失败。

**调试步骤**:

1. **打开 React DevTools**:
   - 安装 React DevTools 浏览器扩展
   - 在 Tauri 应用中打开 DevTools (Cmd+Option+I / Ctrl+Shift+I)
   - 切换到 Components 标签页
   - 检查组件层级、Props 和 State

2. **检查控制台错误**:
   - Console 标签页查看 JavaScript 错误
   - 注意红色错误和黄色警告
   - 检查是否有 React 错误边界捕获的错误

3. **检查样式问题**:
   - Elements 标签页选中问题元素
   - 查看 Computed 样式
   - 检查 Tailwind CSS 类名是否正确应用
   - 使用 DevTools 实时修改样式调试

4. **检查状态管理**:
   ```typescript
   // 在浏览器控制台中访问 Zustand store
   // (需要在开发模式下安装 zustand devtools middleware)
   window.__ZUSTAND_DEVTOOLS_STORE__
   ```

5. **检查路由问题**:
   - 确认当前 URL 路径
   - 检查 React Router 配置 (`src/App.tsx`)
   - 使用 React Router DevTools

##### 场景 4: 调试 Rust 后端问题

**问题**: Tauri 命令失败、后端逻辑错误或崩溃。

**调试步骤**:

1. **添加 Rust 日志输出**:
   ```rust
   use log::{info, error, debug};

   #[tauri::command]
   fn my_command(param: String) -> Result<String, String> {
       info!("收到命令调用: param={}", param);
       // ... 业务逻辑
       Ok("success".to_string())
   }
   ```

2. **启用详细日志**:
   ```bash
   RUST_LOG=debug pnpm desktop:dev
   ```

3. **使用 Rust 调试宏**:
   ```rust
   // 快速打印变量
   dbg!(&my_variable);

   // 标准输出（仅开发模式）
   println!("Debug: {:?}", my_variable);
   ```

4. **查看 Rust 编译错误**:
   ```bash
   cd apps/desktop/src-tauri
   cargo build --verbose
   ```

5. **使用 Rust 调试器**:
   - 安装 rust-analyzer VS Code 扩展
   - 在 `.rs` 文件中设置断点
   - 使用 VS Code 调试面板启动调试

##### 场景 5: 调试构建失败

**问题**: `pnpm build` 或 `pnpm tauri-build` 失败。

**调试步骤**:

1. **检查 TypeScript 类型错误**:
   ```bash
   pnpm typecheck
   ```

2. **检查所有包的构建**:
   ```bash
   # 在项目根目录
   pnpm build
   ```

3. **逐个检查包**:
   ```bash
   cd packages/core && pnpm build
   cd apps/web && pnpm build
   cd apps/desktop && pnpm build
   ```

4. **清理缓存重新构建**:
   ```bash
   # 清理所有构建产物
   pnpm clean

   # 重新安装依赖
   rm -rf node_modules pnpm-lock.yaml
   pnpm install

   # 重新构建
   pnpm build
   ```

5. **查看详细错误信息**:
   ```bash
   pnpm build --verbose
   pnpm tauri-build --verbose
   ```

##### 场景 6: 调试国际化 (i18n) 问题

**问题**: 翻译文本未显示、语言切换失败或翻译缺失。

**调试步骤**:

1. **检查翻译文件**:
   ```bash
   # 查看英文翻译
   cat apps/desktop/src/i18n/locales/en.json

   # 查看中文翻译
   cat apps/desktop/src/i18n/locales/zh-CN.json
   ```

2. **验证翻译键值**:
   - 确认键名正确: `t('workspace.title')`
   - 检查是否拼写错误
   - 确认命名空间是否正确

3. **检查当前语言设置**:
   ```typescript
   // 在浏览器控制台
   import { useTranslation } from 'react-i18next';
   const { i18n } = useTranslation();
   console.log(i18n.language); // 当前语言
   console.log(i18n.options.resources); // 所有翻译资源
   ```

4. **测试语言切换**:
   ```typescript
   // 在浏览器控制台
   i18n.changeLanguage('zh-CN');
   i18n.changeLanguage('en');
   ```

5. **启用 i18next 调试模式**:
   ```typescript
   // 在 src/i18n/index.ts 中
   i18next.init({
     debug: true, // 启用调试模式
     // ... 其他配置
   });
   ```

## 故障排除

### 端口 1420 被占用

**问题**: 启动开发服务器时提示端口 1420 已被占用。

**原因**: Vite 开发服务器使用端口 1420，如果上次运行的进程没有正确关闭，端口会保持占用状态。

**解决方案**:

1. **使用重启脚本（推荐）**:
   ```bash
   pnpm desktop:restart
   ```

   脚本会自动执行以下操作：
   - 杀死端口 1420 上的所有进程
   - 清理 Tauri、Vite 和 viben-desktop 相关进程
   - 验证端口已释放
   - 重新启动开发服务器

2. **手动释放端口**:
   ```bash
   # macOS / Linux
   lsof -ti:1420 | xargs kill -9

   # Windows (PowerShell)
   netstat -ano | findstr :1420
   taskkill /PID <PID> /F
   ```

3. **验证端口状态**:
   ```bash
   # macOS / Linux
   lsof -i:1420

   # Windows (PowerShell)
   netstat -ano | findstr :1420
   ```

### 应用挂起或无响应

**问题**: 应用界面卡死、无法交互或关闭。

**可能原因**:
- Rust 后端进程阻塞
- Vite HMR (热模块替换) 连接中断
- 进程间通信异常
- 资源泄漏或内存不足

**解决方案**:

1. **强制重启应用**:
   ```bash
   pnpm desktop:restart
   ```

2. **手动清理进程**:
   ```bash
   # macOS / Linux
   pkill -9 -f "tauri"
   pkill -9 -f "vite"
   pkill -9 -f "viben-desktop"

   # Windows (PowerShell)
   taskkill /IM "viben-desktop.exe" /F
   taskkill /IM "tauri.exe" /F
   ```

3. **检查进程状态**:
   ```bash
   # macOS / Linux
   ps aux | grep -E "tauri|vite|viben-desktop"

   # Windows (PowerShell)
   Get-Process | Where-Object {$_.Name -like "*tauri*" -or $_.Name -like "*vite*" -or $_.Name -like "*viben-desktop*"}
   ```

### 重启流程说明

`pnpm desktop:restart` 脚本会按照以下流程执行：

1. **清理端口**: 杀死占用端口 1420 的进程
2. **清理 Tauri 进程**: 终止所有 Tauri 相关进程
3. **清理 Vite 进程**: 终止所有 Vite 相关进程
4. **清理应用进程**: 终止所有 viben-desktop 进程
5. **等待终止**: 等待 2 秒确保进程完全终止
6. **验证端口**: 确认端口 1420 已释放
7. **启动开发服务器**: 执行 `pnpm tauri dev`

脚本位置: `scripts/restart-desktop.sh`

### 开发服务器启动失败

**问题**: `pnpm desktop:dev` 或 `pnpm tauri-dev` 启动失败。

**常见原因和解决方案**:

1. **Rust 工具链未安装或版本过旧**:
   ```bash
   # 检查 Rust 版本
   rustc --version
   cargo --version

   # 更新 Rust
   rustup update stable
   ```

2. **依赖未安装或版本不匹配**:
   ```bash
   # 重新安装依赖
   pnpm install

   # 清理并重新安装
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

3. **Tauri 配置错误**:
   - 检查 `src-tauri/tauri.conf.json` 配置
   - 确认 `devUrl` 设置为 `http://localhost:1420`

4. **系统依赖缺失** (Linux):
   ```bash
   sudo apt update
   sudo apt install libwebkit2gtk-4.1-dev \
     build-essential \
     curl \
     wget \
     file \
     libssl-dev \
     libayatana-appindicator3-dev \
     librsvg2-dev
   ```

### 热更新 (HMR) 不工作

**问题**: 修改代码后，浏览器或应用未自动刷新。

**解决方案**:

1. **检查 Vite 服务器状态**:
   - 确认终端中是否有错误信息
   - 查看是否有编译错误

2. **重启开发服务器**:
   ```bash
   pnpm desktop:restart
   ```

3. **清理缓存**:
   ```bash
   # 清理 Vite 缓存
   rm -rf apps/desktop/.vite
   rm -rf apps/desktop/node_modules/.vite
   ```

### 获取更多帮助

如果以上方法无法解决问题，请：

1. 查看开发服务器输出的错误信息
2. 检查 Tauri 日志: `src-tauri/target/debug/` 或 `src-tauri/target/release/`
3. 提交 Issue 到项目仓库，附带：
   - 错误信息截图或日志
   - 操作系统和版本
   - Node.js、Rust 版本信息
   - 复现步骤

## 构建

### 构建前端

```bash
pnpm build
```

### 构建桌面应用

```bash
pnpm tauri-build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录。

## 项目结构

```
apps/desktop/
├── src/
│   ├── components/     # React 组件
│   │   ├── ui/        # 基础 UI 组件
│   │   ├── layout/    # 布局组件
│   │   ├── chat/      # 对话相关组件
│   │   ├── workspace/ # 工作区组件
│   │   └── ...
│   ├── pages/         # 页面组件
│   ├── hooks/         # 自定义 Hooks
│   ├── stores/        # Zustand 状态管理
│   ├── i18n/          # 国际化配置
│   │   └── locales/   # 翻译文件 (en.json, zh-CN.json)
│   ├── lib/           # 工具函数
│   ├── App.tsx        # 应用入口和路由配置
│   └── main.tsx       # React 入口
├── src-tauri/         # Tauri Rust 后端
│   ├── src/
│   │   └── lib.rs     # Rust 命令和插件
│   ├── tauri.conf.json
│   └── Cargo.toml
└── package.json
```

## IDE 设置

推荐使用以下 VS Code 扩展：

- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 相关文档

- [Tauri 文档](https://tauri.app/v2/guide/)
- [React 文档](https://react.dev/)
- [Vite 文档](https://vitejs.dev/)
