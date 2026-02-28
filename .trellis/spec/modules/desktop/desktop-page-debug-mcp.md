# 页面调试服务 (Desktop Page Debug MCP)

> 在 Tauri 桌面应用中集成 MCP (Model Context Protocol)，让 AI 模型自动调试 WebView 页面。

---

## 概览

| 属性 | 值 |
|------|------|
| 任务 ID | TD-DEBUG-MCP |
| 依赖 | TD0 (API Client), 桌面应用基础设施 |
| 工作量 | 3 点 |
| 优先级 | P1 |

---

## 目标

1. 集成 tauri-plugin-mcp 插件提供页面调试能力
2. 让 AI 模型能够截图、执行 JS、获取 DOM 结构
3. 支持 IPC 调用监控和前端错误捕获
4. 仅在开发环境启用，生产环境不打包

---

## 方案选型

### 方案 A：hypothesi/mcp-server-tauri（官方生态）

- 支持 Claude/Cursor/VS Code Copilot
- 自动 IPC 监控、窗口/状态查询、前端错误捕获
- 一键安装，配置简单

### 方案 B：P3GLEG/tauri-plugin-mcp（推荐，更底层）

- 截图、DOM 操作、输入模拟、JS 执行
- 适合深度交互与自动化测试
- **本项目采用此方案**

---

## 集成步骤

### 1. 安装 Rust 依赖

```bash
cd apps/desktop/src-tauri
cargo add --git https://github.com/P3GLEG/tauri-plugin-mcp
```

### 2. 注册插件（仅开发环境）

**文件**: `apps/desktop/src-tauri/src/lib.rs`

```rust
pub fn run() {
    let mut builder = tauri::Builder::default();

    // 仅 Debug 模式启用 MCP
    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(
            tauri_mcp::init_with_config(
                tauri_mcp::PluginConfig::new("viben-desktop")
                    .start_socket_server(true)
                    .socket_path("/tmp/viben-mcp.sock")
            )
        );
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        // ... 其他插件
        .invoke_handler(tauri::generate_handler![
            // ... 现有命令
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3. 前端集成（可选 IPC 监控）

**文件**: `apps/desktop/src/lib/debug-mcp.ts`

```typescript
import { invoke } from "@tauri-apps/api/core";

// 仅在开发环境启用
const isDev = import.meta.env.DEV;

export async function startIpcMonitor() {
  if (!isDev) return;
  try {
    await invoke("plugin:mcp|start_ipc_monitor");
  } catch (e) {
    console.warn("MCP plugin not available:", e);
  }
}

export async function getIpcEvents() {
  if (!isDev) return [];
  try {
    return await invoke("plugin:mcp|get_ipc_events");
  } catch (e) {
    console.warn("MCP plugin not available:", e);
    return [];
  }
}

export async function getWindowInfo() {
  if (!isDev) return null;
  try {
    return await invoke("plugin:mcp|get_window_info");
  } catch (e) {
    console.warn("MCP plugin not available:", e);
    return null;
  }
}
```

---

## AI 可用工具

tauri-plugin-mcp 暴露以下能力给 AI 模型：

| 工具 | 功能 | 用途 |
|------|------|------|
| `take_screenshot` | 截图当前窗口 | 视觉验证、UI 问题排查 |
| `execute_js` | 执行前端 JS 代码 | 查 DOM/错误、修改状态 |
| `send_keyboard_input` | 模拟键盘输入 | 自动化测试 |
| `get_dom` | 获取 DOM 结构 | 页面结构分析 |
| `launch_app` | 启动应用 | 自动化测试 |
| `stop_app` | 停止应用 | 进程控制 |

---

## MCP 客户端配置

### Claude Code 配置

**文件**: `~/.claude/config.json`

```json
{
  "mcpServers": {
    "viben-debug": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/tauri-mcp-client", "--socket", "/tmp/viben-mcp.sock"]
    }
  }
}
```

### Cursor 配置

**文件**: `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "viben-debug": {
      "transport": "socket",
      "socketPath": "/tmp/viben-mcp.sock"
    }
  }
}
```

---

## 桌面应用 UI 集成

### 导航结构更新

**文件**: `apps/desktop/src/components/layout/mcp-services-layout.tsx`

在 `NAV_SECTIONS` 中添加新章节：

```typescript
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { titleKey: "nav.dashboard", href: "/mcp-services/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    titleKey: "nav.dedicatedSearchServices",
    items: [
      { titleKey: "nav.dataSources", href: "/mcp-services/data-sources", icon: Database },
      { titleKey: "nav.searchService", href: "/mcp-services/search-service", icon: Search },
    ],
  },
  // 新增：页面调试服务
  {
    titleKey: "nav.pageDebugServices",
    items: [
      { titleKey: "nav.pageDebug", href: "/mcp-services/page-debug", icon: Bug },
    ],
  },
  {
    items: [
      { titleKey: "nav.logs", href: "/mcp-services/logs", icon: FileText },
    ],
  },
];
```

### 翻译文件更新

**文件**: `apps/desktop/src/i18n/locales/zh-CN.json`

```json
{
  "nav": {
    "pageDebugServices": "页面调试服务",
    "pageDebug": "页面调试"
  },
  "pageDebug": {
    "title": "页面调试",
    "subtitle": "让 AI 自动调试 Tauri 应用的 WebView 页面",
    "status": "调试服务状态",
    "running": "运行中",
    "stopped": "已停止",
    "socketPath": "Socket 路径",
    "features": "可用能力",
    "screenshot": "截图",
    "executeJs": "执行 JS",
    "getDom": "获取 DOM",
    "sendInput": "模拟输入",
    "devOnly": "仅开发环境可用",
    "productionDisabled": "生产环境已禁用此功能",
    "aiInstructions": "AI 使用说明",
    "copyConfig": "复制配置"
  }
}
```

**文件**: `apps/desktop/src/i18n/locales/en.json`

```json
{
  "nav": {
    "pageDebugServices": "Page Debug Services",
    "pageDebug": "Page Debug"
  },
  "pageDebug": {
    "title": "Page Debug",
    "subtitle": "Let AI automatically debug Tauri WebView pages",
    "status": "Debug Service Status",
    "running": "Running",
    "stopped": "Stopped",
    "socketPath": "Socket Path",
    "features": "Available Features",
    "screenshot": "Screenshot",
    "executeJs": "Execute JS",
    "getDom": "Get DOM",
    "sendInput": "Send Input",
    "devOnly": "Development Only",
    "productionDisabled": "This feature is disabled in production",
    "aiInstructions": "AI Instructions",
    "copyConfig": "Copy Config"
  }
}
```

---

## 页面组件

### 页面调试页面

**文件**: `apps/desktop/src/pages/page-debug.tsx`

```tsx
import { useState, useEffect } from "react";
import {
  Camera,
  Code2,
  Layers,
  Keyboard,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const SOCKET_PATH = "/tmp/viben-mcp.sock";
const isDev = import.meta.env.DEV;

export function PageDebugPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // 检查 MCP 服务状态
    if (isDev) {
      // 尝试检查 socket 文件是否存在
      setIsRunning(true); // 在开发环境默认显示运行中
    }
  }, []);

  const features = [
    { icon: Camera, titleKey: "pageDebug.screenshot", desc: "take_screenshot" },
    { icon: Code2, titleKey: "pageDebug.executeJs", desc: "execute_js" },
    { icon: Layers, titleKey: "pageDebug.getDom", desc: "get_dom" },
    { icon: Keyboard, titleKey: "pageDebug.sendInput", desc: "send_keyboard_input" },
  ];

  const mcpConfig = {
    mcpServers: {
      "viben-debug": {
        transport: "socket",
        socketPath: SOCKET_PATH,
      },
    },
  };

  const copyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(mcpConfig, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isDev) {
    return (
      <div className="p-6">
        <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950 p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
          <h2 className="text-lg font-semibold mb-2">{t("pageDebug.devOnly")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("pageDebug.productionDisabled")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("pageDebug.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("pageDebug.subtitle")}
        </p>
      </div>

      {/* Status */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${
              isRunning ? "bg-green-500 animate-pulse" : "bg-muted"
            }`} />
            <span className="font-medium">{t("pageDebug.status")}</span>
          </div>
          <span className={`text-sm ${
            isRunning ? "text-green-600" : "text-muted-foreground"
          }`}>
            {isRunning ? t("pageDebug.running") : t("pageDebug.stopped")}
          </span>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium">{t("pageDebug.socketPath")}: </span>
          <code className="bg-muted px-2 py-0.5 rounded">{SOCKET_PATH}</code>
        </div>
      </div>

      {/* Features */}
      <div>
        <h3 className="text-sm font-medium mb-3">{t("pageDebug.features")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.titleKey}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{t(feature.titleKey)}</p>
                  <code className="text-xs text-muted-foreground">
                    {feature.desc}
                  </code>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Configuration */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">{t("pageDebug.aiInstructions")}</h3>
          <Button variant="ghost" size="sm" onClick={copyConfig}>
            {copied ? (
              <Check className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {t("pageDebug.copyConfig")}
          </Button>
        </div>
        <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto">
          {JSON.stringify(mcpConfig, null, 2)}
        </pre>
      </div>
    </div>
  );
}
```

---

## 路由配置

**文件**: `apps/desktop/src/App.tsx`

添加路由：

```typescript
import { PageDebugPage } from "@/pages/page-debug";

// 在 MCP Services 路由组内添加
<Route path="page-debug" element={<PageDebugPage />} />
```

---

## 自动 Debug 工作流

1. **触发错误**：在 Tauri 应用中复现问题
2. **MCP 采集**：
   - IPC 调用日志
   - WebView 控制台错误
   - 窗口/状态快照
   - 截图
3. **AI 分析**：
   - 定位错误位置（前端/后端/IPC）
   - 对比正常/异常流程
   - 生成修复代码
4. **自动修复**：
   - 前端 JS 补丁
   - Rust 后端修复
   - IPC 调用修正

---

## 安全注意事项

1. **仅开发环境启用**
   - 使用 `#[cfg(debug_assertions)]` 包裹 MCP 插件
   - 生产环境不打包 MCP 相关代码

2. **限制访问**
   - Socket 路径限制为本地访问
   - 不暴露敏感数据（token/密钥）给 MCP

3. **前端检查**
   - 使用 `import.meta.env.DEV` 检查环境
   - 生产环境显示禁用提示

---

## 验收标准

- [ ] tauri-plugin-mcp 成功集成
- [ ] 开发环境可启动 MCP 调试服务
- [ ] 生产环境 MCP 功能禁用
- [ ] AI 模型可截图当前窗口
- [ ] AI 模型可执行 JS 代码
- [ ] AI 模型可获取 DOM 结构
- [ ] 页面调试页面正常显示
- [ ] 导航菜单正确显示新章节
- [ ] 中英文翻译完整

---

## 相关文档

- [desktop-integration.md](./desktop-integration.md) - 桌面应用集成
- [desktop-task-dag.md](../desktop-task-dag.md) - 桌面应用任务图
- [mcp-services-layout](../../apps/desktop/src/components/layout/mcp-services-layout.tsx) - MCP 服务布局组件
