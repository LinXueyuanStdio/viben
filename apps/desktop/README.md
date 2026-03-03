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
