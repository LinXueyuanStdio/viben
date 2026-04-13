# Desktop Onboarding Gateway Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Gateway Bootstrap stage to the desktop onboarding flow that ensures the Gateway is running before proceeding with environment detection steps.

**Architecture:** Inspired by Qclaw's 5-stage onboarding (welcome→env-check→setup→gateway-bootstrap→dashboard), we'll add a "gateway" step as the first step of viben's onboarding. This step will automatically attempt to start the Gateway, show progress, handle errors gracefully, and allow retry. The existing python/claude/login steps remain unchanged but will now only be accessible after Gateway is confirmed running.

**Tech Stack:** React, TypeScript, Tauri commands, existing `useGateway` hook, i18n translations

---

## Qclaw Reference Files (设计参考)

以下是 Qclaw 项目中相关的 UI 组件和逻辑文件，供实现时参考：

### 核心 Onboarding 页面
| File | Description |
|------|-------------|
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/GatewayBootstrapGate.tsx` | **Gateway 启动门控页面** - 核心参考，包含任务加权进度、多阶段检查 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx` | **环境检查页面** - Node.js/CLI 检测和安装流程 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/pages/Welcome.tsx` | **欢迎页面** - 安全警告和权限说明 |

### 状态管理和逻辑
| File | Description |
|------|-------------|
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/dashboard-gateway-gate.ts` | Gateway 门控阶段状态解析逻辑 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/dashboard-entry-bootstrap.ts` | Dashboard 进入引导状态定义 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-runtime-state.ts` | Gateway 运行时状态类型定义 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/openclaw-phase1.ts` | CLI 发现和安装决策逻辑 |
| `/Users/lxy/Documents/GitHub/others/Qclaw/src/shared/env-check-policy.ts` | 环境检查策略 |

### 关键设计模式

**1. 加权任务进度系统 (from GatewayBootstrapGate.tsx)**
```typescript
const weights: Record<TaskKey, number> = {
  gateway: 0.5,  // Gateway 状态检查 50%
  config: 0.3,   // 配置读取 30%
  pairing: 0.2,  // 配对状态 20%
}
// 基线进度 8%，确保用户看到即时反馈
```

**2. 任务状态类型 (from dashboard-gateway-gate.ts)**
```typescript
type TaskStatus = 'pending' | 'active' | 'done' | 'warning' | 'error';
```

**3. 错误处理分层**
- 致命错误：阻塞流程，提供明确修复建议
- 软警告：不阻塞流程，后台继续处理

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/desktop/src/components/onboarding/step-gateway.tsx` | Gateway bootstrap step UI component |
| Modify | `apps/desktop/src/components/onboarding/onboarding-progress.tsx:5-13` | Add "gateway" step type and update STEPS array |
| Modify | `apps/desktop/src/components/onboarding/onboarding-wizard.tsx:32-64` | Add gateway step state management and navigation |
| Modify | `apps/desktop/src/components/onboarding/index.ts` | Export new StepGateway component |
| Modify | `apps/desktop/src/i18n/locales/en.json` | Add English translations for gateway step |
| Modify | `apps/desktop/src/i18n/locales/zh-CN.json` | Add Chinese translations for gateway step |

---

### Task 1: Update OnboardingStep Type and Progress Component

**Files:**
- Modify: `apps/desktop/src/components/onboarding/onboarding-progress.tsx:5-13`

- [ ] **Step 1: Update the OnboardingStep type to include "gateway"**

Open `apps/desktop/src/components/onboarding/onboarding-progress.tsx` and update lines 5-13:

```tsx
export type OnboardingStep = "gateway" | "python" | "claude" | "login";

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
}

const STEPS: OnboardingStep[] = ["gateway", "python", "claude", "login"];
```

- [ ] **Step 2: Update the stepLabels object to include gateway**

In the same file, update the stepLabels inside the component (around line 17-21):

```tsx
const stepLabels: Record<OnboardingStep, string> = {
  gateway: t("onboarding.steps.gateway"),
  python: t("onboarding.steps.python"),
  claude: t("onboarding.steps.claude"),
  login: t("onboarding.steps.login"),
};
```

- [ ] **Step 3: Save the file and verify no TypeScript errors**

Run: `cd apps/desktop && pnpm typecheck`
Expected: Should show type errors in `onboarding-wizard.tsx` (expected, will fix in Task 3)

---

### Task 2: Add i18n Translations for Gateway Step

**Files:**
- Modify: `apps/desktop/src/i18n/locales/en.json`
- Modify: `apps/desktop/src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Add English translations**

Open `apps/desktop/src/i18n/locales/en.json` and add under the `onboarding` section:

In `onboarding.steps`, add:
```json
"gateway": "Gateway"
```

Add a new `onboarding.gateway` section:
```json
"gateway": {
  "title": "Starting Viben Gateway",
  "description": "The gateway service provides the backend for all Viben features.",
  "starting": "Starting gateway...",
  "checking": "Checking gateway status...",
  "connected": "Gateway is running",
  "failed": "Failed to start gateway",
  "retry": "Retry",
  "skip": "Continue without gateway",
  "skipWarning": "Some features may not work without the gateway.",
  "port": "Port",
  "status": "Status",
  "running": "Running",
  "stopped": "Stopped",
  "error": "Error",
  "autoStartHint": "Gateway will start automatically on app launch.",
  "manualStart": "Start Gateway",
  "vibenNotFound": "Viben CLI not found. Please install it first.",
  "installViben": "Install Viben CLI"
}
```

- [ ] **Step 2: Add Chinese translations**

Open `apps/desktop/src/i18n/locales/zh-CN.json` and add under the `onboarding` section:

In `onboarding.steps`, add:
```json
"gateway": "网关"
```

Add a new `onboarding.gateway` section:
```json
"gateway": {
  "title": "启动 Viben 网关",
  "description": "网关服务为所有 Viben 功能提供后端支持。",
  "starting": "正在启动网关...",
  "checking": "正在检查网关状态...",
  "connected": "网关已运行",
  "failed": "网关启动失败",
  "retry": "重试",
  "skip": "跳过继续",
  "skipWarning": "部分功能可能无法使用。",
  "port": "端口",
  "status": "状态",
  "running": "运行中",
  "stopped": "已停止",
  "error": "错误",
  "autoStartHint": "网关将在应用启动时自动运行。",
  "manualStart": "启动网关",
  "vibenNotFound": "未找到 Viben CLI，请先安装。",
  "installViben": "安装 Viben CLI"
}
```

- [ ] **Step 3: Save the files**

---

### Task 3: Create StepGateway Component

**Files:**
- Create: `apps/desktop/src/components/onboarding/step-gateway.tsx`

- [ ] **Step 1: Create the StepGateway component file**

Create `apps/desktop/src/components/onboarding/step-gateway.tsx`:

```tsx
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  AlertCircle,
  Loader2,
  Server,
  RefreshCw,
  Play,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGateway } from "@/hooks/use-gateway";
import { useGatewayStatus } from "@/hooks/use-gateway-status";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface StepGatewayProps {
  onComplete: () => void;
}

type GatewayBootstrapState =
  | "checking"
  | "starting"
  | "connected"
  | "failed"
  | "no-cli";

export function StepGateway({ onComplete }: StepGatewayProps) {
  const { t } = useTranslation();
  const {
    status: gatewayProcess,
    isLoading,
    isActioning,
    error: gatewayError,
    vibenPath,
    startGateway,
    refreshStatus,
  } = useGateway();

  const { isConnected, checkConnection } = useGatewayStatus();

  const [state, setState] = React.useState<GatewayBootstrapState>("checking");
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);

  const maxRetries = 3;

  // Auto-start gateway on mount
  React.useEffect(() => {
    const bootstrap = async () => {
      // Check if viben CLI is available
      if (!vibenPath && !isLoading) {
        setState("no-cli");
        return;
      }

      if (isLoading) {
        setState("checking");
        setProgress(10);
        return;
      }

      // If already connected, complete immediately
      if (isConnected) {
        setState("connected");
        setProgress(100);
        return;
      }

      // Check if gateway process is running
      if (gatewayProcess?.running) {
        setState("checking");
        setProgress(50);
        // Wait a bit for HTTP server to be ready
        const connected = await checkConnection();
        if (connected) {
          setState("connected");
          setProgress(100);
        } else {
          setState("failed");
          setError(t("onboarding.gateway.failed"));
        }
        return;
      }

      // Start gateway
      setState("starting");
      setProgress(20);

      try {
        await startGateway();
        setProgress(60);

        // Poll for connection with timeout
        let attempts = 0;
        const maxAttempts = 10;
        const pollInterval = 1000;

        const pollConnection = async (): Promise<boolean> => {
          while (attempts < maxAttempts) {
            attempts++;
            setProgress(60 + (attempts / maxAttempts) * 30);

            const connected = await checkConnection();
            if (connected) {
              return true;
            }

            await new Promise((r) => setTimeout(r, pollInterval));
          }
          return false;
        };

        const connected = await pollConnection();

        if (connected) {
          setState("connected");
          setProgress(100);
        } else {
          setState("failed");
          setError(t("onboarding.gateway.failed"));
        }
      } catch (err) {
        setState("failed");
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    bootstrap();
  }, [
    vibenPath,
    isLoading,
    isConnected,
    gatewayProcess?.running,
    startGateway,
    checkConnection,
    t,
  ]);

  const handleRetry = async () => {
    if (retryCount >= maxRetries) return;

    setRetryCount((c) => c + 1);
    setError(null);
    setState("starting");
    setProgress(20);

    try {
      await startGateway();
      setProgress(60);

      // Poll for connection
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        attempts++;
        setProgress(60 + (attempts / maxAttempts) * 30);

        const connected = await checkConnection();
        if (connected) {
          setState("connected");
          setProgress(100);
          return;
        }

        await new Promise((r) => setTimeout(r, 1000));
      }

      setState("failed");
      setError(t("onboarding.gateway.failed"));
    } catch (err) {
      setState("failed");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleContinue = () => {
    onComplete();
  };

  const handleSkip = () => {
    // Allow skipping but warn user
    onComplete();
  };

  const canContinue = state === "connected";
  const canRetry = state === "failed" && retryCount < maxRetries;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("onboarding.gateway.title")}</h2>
        <p className="mt-2 text-muted-foreground">
          {t("onboarding.gateway.description")}
        </p>
      </div>

      {/* Status Card */}
      <div className="rounded-lg border p-6 space-y-4">
        {/* Icon and Status */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full",
              state === "connected" && "bg-green-500/10 text-green-500",
              state === "checking" && "bg-blue-500/10 text-blue-500",
              state === "starting" && "bg-blue-500/10 text-blue-500",
              state === "failed" && "bg-destructive/10 text-destructive",
              state === "no-cli" && "bg-yellow-500/10 text-yellow-500"
            )}
          >
            {state === "connected" && <Check className="h-6 w-6" />}
            {state === "checking" && <Loader2 className="h-6 w-6 animate-spin" />}
            {state === "starting" && <Loader2 className="h-6 w-6 animate-spin" />}
            {state === "failed" && <AlertCircle className="h-6 w-6" />}
            {state === "no-cli" && <Server className="h-6 w-6" />}
          </div>

          <div className="flex-1">
            <div className="font-medium">
              {state === "connected" && t("onboarding.gateway.connected")}
              {state === "checking" && t("onboarding.gateway.checking")}
              {state === "starting" && t("onboarding.gateway.starting")}
              {state === "failed" && t("onboarding.gateway.failed")}
              {state === "no-cli" && t("onboarding.gateway.vibenNotFound")}
            </div>
            {gatewayProcess && state === "connected" && (
              <div className="text-sm text-muted-foreground">
                {t("onboarding.gateway.port")}: {gatewayProcess.port}
              </div>
            )}
            {error && state === "failed" && (
              <div className="text-sm text-destructive">{error}</div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {(state === "checking" || state === "starting") && (
          <Progress value={progress} className="h-2" />
        )}

        {/* Gateway Error from hook */}
        {gatewayError && state !== "connected" && (
          <div className="flex items-center gap-2 rounded bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{gatewayError}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        {/* Left side - Skip option */}
        <div>
          {state === "failed" && (
            <Button variant="ghost" onClick={handleSkip}>
              {t("onboarding.gateway.skip")}
            </Button>
          )}
        </div>

        {/* Right side - Main action */}
        <div className="flex gap-2">
          {canRetry && (
            <Button variant="outline" onClick={handleRetry} disabled={isActioning}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("onboarding.gateway.retry")} ({maxRetries - retryCount} left)
            </Button>
          )}

          {state === "no-cli" && (
            <Button variant="outline" asChild>
              <a
                href="https://github.com/LinXueyuanStdio/viben"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("onboarding.gateway.installViben")}
              </a>
            </Button>
          )}

          <Button onClick={handleContinue} disabled={!canContinue}>
            {t("common.next")}
          </Button>
        </div>
      </div>

      {/* Skip warning */}
      {state === "failed" && (
        <p className="text-center text-sm text-muted-foreground">
          {t("onboarding.gateway.skipWarning")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Save the file and verify no syntax errors**

Run: `cd apps/desktop && pnpm typecheck`
Expected: May show errors about missing export, will fix in Task 4

---

### Task 4: Export StepGateway from Index

**Files:**
- Modify: `apps/desktop/src/components/onboarding/index.ts`

- [ ] **Step 1: Add StepGateway export**

Open `apps/desktop/src/components/onboarding/index.ts` and add the export:

```ts
export { StepGateway } from "./step-gateway";
```

The file should look like:

```ts
export { OnboardingProgress, type OnboardingStep } from "./onboarding-progress";
export { OnboardingWizard } from "./onboarding-wizard";
export { StepPython } from "./step-python";
export { StepClaude } from "./step-claude";
export { StepLogin } from "./step-login";
export { StepGateway } from "./step-gateway";
```

- [ ] **Step 2: Save the file**

---

### Task 5: Update OnboardingWizard to Include Gateway Step

**Files:**
- Modify: `apps/desktop/src/components/onboarding/onboarding-wizard.tsx`

- [ ] **Step 1: Import StepGateway component**

Add to the imports at the top of the file (around line 9):

```tsx
import { StepGateway } from "./step-gateway";
```

- [ ] **Step 2: Update initial state to start at "gateway"**

Change line 32 from:
```tsx
const [currentStep, setCurrentStep] = React.useState<OnboardingStep>("python");
```

To:
```tsx
const [currentStep, setCurrentStep] = React.useState<OnboardingStep>("gateway");
```

- [ ] **Step 3: Add gateway completion handler**

Add after line 39 (after the `completeStep` function):

```tsx
const handleGatewayComplete = () => {
  completeStep("gateway");
  setCurrentStep("python");
};
```

- [ ] **Step 4: Update handlePythonComplete to allow going back to gateway**

Add a new handler for Python back navigation (after handleGatewayComplete):

```tsx
const handlePythonBack = () => {
  setCurrentStep("gateway");
};
```

- [ ] **Step 5: Add gateway step rendering in the main content**

Update the step content section (around lines 98-107) to include gateway step:

```tsx
{currentStep === "gateway" && (
  <StepGateway onComplete={handleGatewayComplete} />
)}
{currentStep === "python" && (
  <StepPython onComplete={handlePythonComplete} onBack={handlePythonBack} />
)}
{currentStep === "claude" && (
  <StepClaude onComplete={handleClaudeComplete} onBack={handleClaudeBack} />
)}
{currentStep === "login" && (
  <StepLogin onComplete={handleLoginComplete} onBack={handleLoginBack} />
)}
```

- [ ] **Step 6: Save the file**

---

### Task 6: Update StepPython to Accept onBack Prop

**Files:**
- Modify: `apps/desktop/src/components/onboarding/step-python.tsx`

- [ ] **Step 1: Update the props interface**

Change the interface (around line 12-14):

```tsx
interface StepPythonProps {
  onComplete: () => void;
  onBack?: () => void;
}
```

- [ ] **Step 2: Destructure onBack in the component**

Update line 16:

```tsx
export function StepPython({ onComplete, onBack }: StepPythonProps) {
```

- [ ] **Step 3: Add back button to the footer**

Update the footer section (around lines 211-216) to include a back button:

```tsx
{/* Continue button */}
<div className="flex justify-between">
  <div>
    {onBack && (
      <Button variant="ghost" onClick={onBack}>
        {t("common.back")}
      </Button>
    )}
  </div>
  <Button onClick={handleContinue} disabled={!canContinue}>
    {t("common.next")}
  </Button>
</div>
```

- [ ] **Step 4: Save the file**

---

### Task 7: Add "back" Translation Key

**Files:**
- Modify: `apps/desktop/src/i18n/locales/en.json`
- Modify: `apps/desktop/src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Add English translation for "back"**

In `apps/desktop/src/i18n/locales/en.json`, under the `common` section, add:

```json
"back": "Back"
```

- [ ] **Step 2: Add Chinese translation for "back"**

In `apps/desktop/src/i18n/locales/zh-CN.json`, under the `common` section, add:

```json
"back": "返回"
```

- [ ] **Step 3: Save the files**

---

### Task 8: Verify Build and Test

**Files:**
- None (verification only)

- [ ] **Step 1: Run TypeScript type checking**

Run: `cd apps/desktop && pnpm typecheck`
Expected: PASS with no errors

- [ ] **Step 2: Run build**

Run: `cd apps/desktop && pnpm build`
Expected: PASS - builds successfully

- [ ] **Step 3: Test the onboarding flow manually**

Run: `cd apps/desktop && pnpm dev`

Test cases:
1. Fresh start - should show Gateway step first
2. Gateway starts successfully - should auto-proceed or show "Next" button
3. Gateway fails - should show error and retry option
4. Skip option - should allow continuing without gateway
5. Back navigation - should work from Python step back to Gateway step

- [ ] **Step 4: Commit the changes**

```bash
git add apps/desktop/src/components/onboarding/
git add apps/desktop/src/i18n/locales/
git commit -m "feat(desktop): add Gateway bootstrap step to onboarding flow

- Add 'gateway' as the first step in onboarding wizard
- Auto-start gateway on mount with progress indication
- Support retry (up to 3 attempts) on failure
- Allow skip with warning for offline usage
- Add back navigation support to Python step
- Add i18n translations for gateway step (en/zh-CN)"
```

---

## Summary

This plan adds a Gateway Bootstrap step as the first step of the onboarding flow:

1. **Task 1**: Update OnboardingStep type to include "gateway"
2. **Task 2**: Add i18n translations for the new step
3. **Task 3**: Create the StepGateway component with auto-start, retry, and skip functionality
4. **Task 4**: Export the new component
5. **Task 5**: Wire up the wizard to include the gateway step
6. **Task 6**: Add back navigation support to StepPython
7. **Task 7**: Add "back" translation key
8. **Task 8**: Verify and commit

The new flow is: **Gateway → Python → Claude → Login**

Key features borrowed from Qclaw:
- Auto-start with progress indication
- Retry mechanism with attempt counting
- Skip option for offline/degraded usage
- Clear error messages and recovery paths
