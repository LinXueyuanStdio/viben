# OpenClaw Desktop P0 集成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Desktop App 完整支持 OPENCLAW 类型的 agent：基础注册（icon/名称/配置类型）、Gateway 配置面板、连接状态展示。

**Architecture:** 纯前端修改（`apps/desktop/src/`），不涉及后端。OPENCLAW executor 后端已完整实现，Gateway 路由也已就绪。前端需要补齐 OPENCLAW 在 UI 层的识别、配置、状态展示。

**Tech Stack:** React, TypeScript, Tailwind CSS, i18n (react-i18next), shadcn/ui 组件

---

## 文件结构

已有文件（需修改）：
- `apps/desktop/src/lib/model-icons.ts` — 添加 OPENCLAW case
- `apps/desktop/src/lib/executor-constraints.ts` — 添加 OPENCLAW 约束
- `apps/desktop/src/types/agent.ts` — 添加 OpenClawConfig
- `apps/desktop/src/pages/settings/settings-executors.tsx` — 添加 OPENCLAW 到列表
- `apps/desktop/src/i18n/locales/en.json` — 添加翻译 key
- `apps/desktop/src/i18n/locales/zh-CN.json` — 添加中文翻译
- `apps/desktop/src/components/agent/agent-config-panel.tsx` — 添加 OPENCLAW 配置区域

新建文件：
- `apps/desktop/src/components/agent/openclaw-config-section.tsx` — OPENCLAW 专属配置面板组件

---

### Task 1: 基础注册 — Icon、显示名称、渐变色

**Files:**
- Modify: `apps/desktop/src/lib/model-icons.ts`

- [ ] **Step 1: 在 `getExecutorIcon` 的 switch 中添加 OPENCLAW case**

在 `case "DROID":` 之前添加：

```typescript
    case "OPENCLAW":
      return React.createElement(Bot, {
        className: className ? `${className} text-red-500` : "text-red-500",
        style: { width: size, height: size },
      });
```

- [ ] **Step 2: 在 `getExecutorDisplayName` 的 switch 中添加 OPENCLAW case**

在 `case "DROID":` 之前添加：

```typescript
    case "OPENCLAW":
      return i18n.t("executor.displayNames.openclaw");
```

- [ ] **Step 3: 在 `getExecutorAvatarGradient` 的 switch 中添加 OPENCLAW case**

在 `case "DROID":` 之前添加：

```typescript
    case "OPENCLAW":
      return "from-red-500 to-orange-400";
```

---

### Task 2: 基础注册 — 配置类型和 Provider 约束

**Files:**
- Modify: `apps/desktop/src/types/agent.ts`
- Modify: `apps/desktop/src/lib/executor-constraints.ts`

- [ ] **Step 1: 在 `types/agent.ts` 中添加 OpenClawConfig 接口**

在 `DroidConfig` 接口之后添加：

```typescript
/**
 * OpenClaw executor configuration
 */
export interface OpenClawConfig {
  /** Gateway host (default: 127.0.0.1) */
  gateway_host?: string;
  /** Gateway port (default: 18789) */
  gateway_port?: number;
  /** Authentication token */
  gateway_token?: string;
  /** Authentication password */
  gateway_password?: string;
}
```

- [ ] **Step 2: 在 `ExecutorConfig` 联合类型中添加 OPENCLAW**

```typescript
export type ExecutorConfig =
  | { type: "CLAUDE_CODE"; config: ClaudeCodeConfig }
  | { type: "AMP"; config: AmpConfig }
  | { type: "GEMINI"; config: GeminiConfig }
  | { type: "CODEX"; config: CodexConfig }
  | { type: "OPENCODE"; config: OpencodeConfig }
  | { type: "CURSOR_AGENT"; config: CursorAgentConfig }
  | { type: "QWEN_CODE"; config: QwenCodeConfig }
  | { type: "COPILOT"; config: CopilotConfig }
  | { type: "DROID"; config: DroidConfig }
  | { type: "OPENCLAW"; config: OpenClawConfig };
```

- [ ] **Step 3: 在 `getDefaultConfig` 中添加 OPENCLAW case**

在 `case "DROID":` 之后添加：

```typescript
    case "OPENCLAW":
      return { type: "OPENCLAW", config: {} };
```

- [ ] **Step 4: 在 `executor-constraints.ts` 中添加 OPENCLAW**

OpenClaw 有自己的 model routing（支持所有 provider），所以留空数组表示不限制：

```typescript
  // OpenClaw has its own model routing, supports all providers
  OPENCLAW: [],
```

---

### Task 3: 基础注册 — Executors 列表页 + i18n

**Files:**
- Modify: `apps/desktop/src/pages/settings/settings-executors.tsx`
- Modify: `apps/desktop/src/i18n/locales/en.json`
- Modify: `apps/desktop/src/i18n/locales/zh-CN.json`

- [ ] **Step 1: 在 `EXECUTORS` 数组中添加 OPENCLAW**

在 DROID 条目之后添加：

```typescript
  {
    id: "OPENCLAW",
    name: "OPENCLAW",
    description: "OPENCLAW",
    website: "https://openclaw.ai",
  },
```

- [ ] **Step 2: 在 `en.json` 的 `settingsExecutors.executorNames` 中添加**

```json
"OPENCLAW": "OpenClaw"
```

- [ ] **Step 3: 在 `en.json` 的 `settingsExecutors.executors` 中添加**

```json
"OPENCLAW": "Personal AI assistant gateway with multi-agent routing"
```

- [ ] **Step 4: 在 `en.json` 的 `executor.displayNames` 中添加**

```json
"openclaw": "OpenClaw"
```

- [ ] **Step 5: 在 `zh-CN.json` 对应位置添加中文翻译**

`settingsExecutors.executorNames`:
```json
"OPENCLAW": "OpenClaw"
```

`settingsExecutors.executors`:
```json
"OPENCLAW": "个人 AI 助手网关，支持多智能体路由"
```

`executor.displayNames`:
```json
"openclaw": "OpenClaw"
```

- [ ] **Step 6: 添加 OPENCLAW 配置面板相关 i18n**

`en.json` 中 `settingsAgents` 部分添加：

```json
"openclawOptions": "OpenClaw Options",
"openclawGatewayHost": "Gateway Host",
"openclawGatewayPort": "Gateway Port",
"openclawGatewayToken": "Auth Token",
"openclawGatewayPassword": "Auth Password",
"openclawTestConnection": "Test Connection",
"openclawConnecting": "Connecting...",
"openclawConnected": "Connected",
"openclawConnectionFailed": "Connection failed"
```

`zh-CN.json` 中 `settingsAgents` 部分添加：

```json
"openclawOptions": "OpenClaw 选项",
"openclawGatewayHost": "网关地址",
"openclawGatewayPort": "网关端口",
"openclawGatewayToken": "认证令牌",
"openclawGatewayPassword": "认证密码",
"openclawTestConnection": "测试连接",
"openclawConnecting": "连接中...",
"openclawConnected": "已连接",
"openclawConnectionFailed": "连接失败"
```

---

### Task 4: OPENCLAW 配置面板组件

**Files:**
- Create: `apps/desktop/src/components/agent/openclaw-config-section.tsx`
- Modify: `apps/desktop/src/components/agent/agent-config-panel.tsx`

- [ ] **Step 1: 创建 OpenClaw 配置面板组件**

```tsx
/**
 * OpenClaw Configuration Section
 *
 * Provides gateway connection settings (host, port, auth)
 * and a "Test Connection" button that checks availability.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, XCircle, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getGatewayClient } from "@/lib/gateway";
import { cn } from "@/lib/utils";

interface OpenClawConfigSectionProps {
  gatewayHost: string;
  gatewayPort: number;
  gatewayToken: string;
  gatewayPassword: string;
  onGatewayHostChange: (value: string) => void;
  onGatewayPortChange: (value: number) => void;
  onGatewayTokenChange: (value: string) => void;
  onGatewayPasswordChange: (value: string) => void;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "failed";

export function OpenClawConfigSection({
  gatewayHost,
  gatewayPort,
  gatewayToken,
  gatewayPassword,
  onGatewayHostChange,
  onGatewayPortChange,
  onGatewayTokenChange,
  onGatewayPasswordChange,
}: OpenClawConfigSectionProps) {
  const { t } = useTranslation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState<string>("");

  const handleTestConnection = async () => {
    setConnectionStatus("connecting");
    setConnectionError("");

    try {
      const client = getGatewayClient();
      const result = await client.checkAvailability("OPENCLAW");

      if (result.type === "LOGIN_DETECTED" || result.type === "INSTALLATION_FOUND") {
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("failed");
        setConnectionError("OpenClaw gateway not detected");
      }
    } catch (err) {
      setConnectionStatus("failed");
      setConnectionError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t("settingsAgents.openclawOptions")}
      </div>

      {/* Gateway Host */}
      <div className="space-y-1">
        <Label className="text-sm font-normal">
          {t("settingsAgents.openclawGatewayHost")}
        </Label>
        <Input
          value={gatewayHost}
          onChange={(e) => onGatewayHostChange(e.target.value)}
          placeholder="127.0.0.1"
          className="h-8 text-sm"
        />
      </div>

      {/* Gateway Port */}
      <div className="space-y-1">
        <Label className="text-sm font-normal">
          {t("settingsAgents.openclawGatewayPort")}
        </Label>
        <Input
          type="number"
          value={gatewayPort}
          onChange={(e) => onGatewayPortChange(Number(e.target.value))}
          placeholder="18789"
          className="h-8 text-sm"
        />
      </div>

      {/* Auth Token */}
      <div className="space-y-1">
        <Label className="text-sm font-normal">
          {t("settingsAgents.openclawGatewayToken")}
        </Label>
        <Input
          type="password"
          value={gatewayToken}
          onChange={(e) => onGatewayTokenChange(e.target.value)}
          placeholder="Optional"
          className="h-8 text-sm"
        />
      </div>

      {/* Auth Password */}
      <div className="space-y-1">
        <Label className="text-sm font-normal">
          {t("settingsAgents.openclawGatewayPassword")}
        </Label>
        <Input
          type="password"
          value={gatewayPassword}
          onChange={(e) => onGatewayPasswordChange(e.target.value)}
          placeholder="Optional"
          className="h-8 text-sm"
        />
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={connectionStatus === "connecting"}
        >
          {connectionStatus === "connecting" ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Wifi className="h-3.5 w-3.5 mr-1.5" />
          )}
          {t("settingsAgents.openclawTestConnection")}
        </Button>

        {connectionStatus === "connected" && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("settingsAgents.openclawConnected")}
          </span>
        )}

        {connectionStatus === "failed" && (
          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5" />
            {connectionError || t("settingsAgents.openclawConnectionFailed")}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 `agent-config-panel.tsx` 中集成 OPENCLAW 配置面板**

在 `{/* Claude Code Options */}` 块之后（约 line 404 之后），添加：

```tsx
              {/* OpenClaw Options */}
              {executorType === "OPENCLAW" && (
                <OpenClawConfigSection
                  gatewayHost={config?.gateway_host ?? ""}
                  gatewayPort={config?.gateway_port ?? 18789}
                  gatewayToken={config?.gateway_token ?? ""}
                  gatewayPassword={config?.gateway_password ?? ""}
                  onGatewayHostChange={(v) => onConfigChange?.({ ...config, gateway_host: v })}
                  onGatewayPortChange={(v) => onConfigChange?.({ ...config, gateway_port: v })}
                  onGatewayTokenChange={(v) => onConfigChange?.({ ...config, gateway_token: v })}
                  onGatewayPasswordChange={(v) => onConfigChange?.({ ...config, gateway_password: v })}
                />
              )}
```

需要：
1. 在文件顶部 import `OpenClawConfigSection`
2. 确认 `agent-config-panel.tsx` 的 props 中有 `config` 和 `onConfigChange` — 如果没有，需要添加

- [ ] **Step 3: 确认 config props 传递**

检查 `AgentConfigPanel` 的 props 类型是否包含 executor config 的读写。如果 config 数据目前只有 claude code 的 plan/approvals 独立 prop，需要添加通用 `executorConfig` prop：

```typescript
// 在 AgentConfigPanelProps 中添加
executorConfig?: Record<string, unknown>;
onExecutorConfigChange?: (config: Record<string, unknown>) => void;
```

---

### Task 5: 聊天时的连接状态展示

**Files:**
- Modify: `apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts`

- [ ] **Step 1: 确认现有 SSE 消息处理中 OPENCLAW 状态事件的映射**

OPENCLAW 后端通过 `executeOpenClawAgent()` 发送标准 SSEMessage 格式（`text`, `tool_use`, `tool_result`, `result`, `error`, `sdk_session`），所以现有 `handleSSEMessage` 已经能处理 OPENCLAW 的流式响应。

验证方法：在 Desktop App 中创建一个 OPENCLAW agent，尝试发送消息，确认消息正常流转。

- [ ] **Step 2: 在聊天 header 或 send box 区域显示 OPENCLAW 连接状态**

当 executor_type === "OPENCLAW" 时，在聊天界面展示连接状态指示器。

检查 `use-agent-conversation.ts` 中的 `availability` 检测逻辑，确认 OPENCLAW 通过 `checkAvailability("OPENCLAW")` 返回正确状态。如果返回 `LOGIN_DETECTED`，则显示绿色状态；否则显示黄色/红色。

这步可能需要在 conversation header 组件中添加一个小的状态点：

```tsx
{executorType === "OPENCLAW" && (
  <div className={cn(
    "h-2 w-2 rounded-full",
    availability === "LOGIN_DETECTED" ? "bg-green-500" : "bg-yellow-500"
  )} />
)}
```

具体位置取决于 conversation header 组件的结构，需要适配。

---

## 验证清单

- [ ] `pnpm --filter viben-desktop typecheck` 无错误
- [ ] 设置页 Executors 列表显示 OpenClaw 并能检测状态
- [ ] Agent 创建时能选择 OPENCLAW executor
- [ ] 选择 OPENCLAW 后显示 Gateway 配置面板（host/port/token）
- [ ] "测试连接" 按钮能正确检测 OpenClaw gateway
- [ ] Agent 对话能正常流式响应（文本 + 工具调用）
