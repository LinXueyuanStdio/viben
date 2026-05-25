# Onboarding Step 2: Streaming Gateway Setup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the complex DAG-based environment check with a streamlined, connection-first gateway setup that shows steps progressively as needed.

**Architecture:** Gateway connectivity is the only hard requirement. Fast path: if gateway is already running, skip everything. If not, try bundled CLI restart. If that fails, fall back to manual Node.js/CLI installation with step-by-step UI. Auto-retry on failures (max 3, every 5s).

**Tech Stack:** React, TypeScript, Tauri (Rust backend), Tailwind CSS

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `apps/desktop/src/hooks/use-gateway-setup.ts` | Core orchestration: health check → bundled CLI → manual install flow, auto-retry logic |
| `apps/desktop/src/components/onboarding/gateway-setup-page.tsx` | Streaming UI: shows steps progressively, error states with countdown |
| `apps/desktop/src/components/onboarding/setup-step-row.tsx` | Single step row component (success/running/error states) |

### Modified Files
| File | Changes |
|------|---------|
| `apps/desktop/src-tauri/src/commands/gateway.rs` | Add `restart_gateway_with_path` with force kill |
| `apps/desktop/src-tauri/src/lib.rs` | Register new command |
| `apps/desktop/src/hooks/use-gateway.ts` | Add `restartGatewayForce` method |
| `apps/desktop/src/components/onboarding/onboarding-wizard.tsx` | Replace `EnvCheckPage` with `GatewaySetupPage` |

### Preserved (not deleted yet)
- `apps/desktop/src/components/onboarding/env-check-page.tsx`
- `apps/desktop/src/hooks/use-env-orchestrator.ts`
- `apps/desktop/src/lib/onboarding/check-dag.ts`

---

## Task 1: Add `restart_gateway_with_path` Rust Command

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands/gateway.rs:548-560`
- Modify: `apps/desktop/src-tauri/src/lib.rs:227`

- [ ] **Step 1.1: Add the new command to gateway.rs**

Add after line 559 (`restart_gateway` function):

```rust
/// Restart gateway with a specific viben path and force option
///
/// This command:
/// 1. Stops any tracked gateway process via stop_gateway
/// 2. Kills any external process on the target port (force)
/// 3. Starts the gateway with the specified viben binary
/// 4. Waits for health check
#[tauri::command]
pub async fn restart_gateway_with_path<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, GatewayState>,
    viben_path: String,
    port: Option<u16>,
    host: Option<String>,
    force: Option<bool>,
) -> Result<GatewayStatus, String> {
    // Validate input - empty path is not allowed
    if viben_path.is_empty() {
        return Err("viben_path must not be empty".to_string());
    }

    let config = state.config.read().await.clone();
    let target_port = port.unwrap_or(config.port);
    let target_host = host.clone().unwrap_or_else(|| config.host.clone());

    // If force is true, kill any process on the target port first
    if force.unwrap_or(false) {
        eprintln!("[gateway] Force restart: killing processes on port {}", target_port);
        
        // Use existing stop_gateway to cleanly stop tracked process
        // This follows the established pattern and avoids lock management issues
        let _ = stop_gateway(state.clone()).await;

        // Also try to kill any external process on the port
        // Use direct command execution (no shell) to avoid injection risks
        #[cfg(target_os = "windows")]
        {
            // On Windows, use netstat + taskkill
            if let Ok(output) = tokio::process::Command::new("netstat")
                .args(["-aon"])
                .output()
                .await
            {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    if line.contains(&format!(":{}", target_port)) && line.contains("LISTENING") {
                        // Extract PID (last column)
                        if let Some(pid_str) = line.split_whitespace().last() {
                            if let Ok(pid) = pid_str.parse::<u32>() {
                                let _ = tokio::process::Command::new("taskkill")
                                    .args(["/F", "/PID", &pid.to_string()])
                                    .output()
                                    .await;
                                eprintln!("[gateway] Killed external process PID: {}", pid);
                            }
                        }
                    }
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            // On Unix, use lsof to find PIDs then kill directly (no shell pipeline)
            if let Ok(output) = tokio::process::Command::new("lsof")
                .args(["-ti", &format!(":{}", target_port)])
                .output()
                .await
            {
                let pids = String::from_utf8_lossy(&output.stdout);
                for pid_str in pids.split_whitespace() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        let _ = tokio::process::Command::new("kill")
                            .args(["-9", &pid.to_string()])
                            .output()
                            .await;
                        eprintln!("[gateway] Killed external process PID: {}", pid);
                    }
                }
            }
        }

        // Wait for port to be released
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    // Now start with the specified path
    ensure_gateway_running(
        &state,
        StartGatewayOptions {
            viben_path: Some(std::path::PathBuf::from(viben_path)),
            port: Some(target_port),
            host: Some(target_host),
            verbose: true,
            ..Default::default()
        },
    )
    .await
}
```

- [ ] **Step 1.2: Register the command in lib.rs**

Find the `invoke_handler` block and add the new command. In `apps/desktop/src-tauri/src/lib.rs`, find line ~227:

```rust
commands::gateway::restart_gateway,
```

Add after it:

```rust
commands::gateway::restart_gateway_with_path,
```

- [ ] **Step 1.3: Build and verify Rust compiles**

Run:
```bash
cd /root/viben/apps/desktop && cargo build --release 2>&1 | head -50
```

Expected: Build succeeds with no errors related to gateway commands.

- [ ] **Step 1.4: Commit**

```bash
git add apps/desktop/src-tauri/src/commands/gateway.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "$(cat <<'EOF'
feat(desktop): add restart_gateway_with_path command with force kill

Adds a new Tauri command that:
- Kills any process on target port when force=true
- Handles both tracked processes and external processes
- Works on macOS/Linux (lsof) and Windows (netstat)

This enables the onboarding flow to handle port conflicts gracefully.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `restartGatewayForce` to Frontend Hook

**Files:**
- Modify: `apps/desktop/src/hooks/use-gateway.ts:60-67`
- Modify: `apps/desktop/src/hooks/use-gateway.ts:240-256`

- [ ] **Step 2.1: Add return type for the new method**

In `apps/desktop/src/hooks/use-gateway.ts`, find the `UseGatewayReturn` interface (around line 38) and add after `restartGateway`:

```typescript
  /** Restart gateway with force kill (handles port conflicts) */
  restartGatewayForce: (vibenPath?: string) => Promise<GatewayStatus | null>;
```

- [ ] **Step 2.2: Implement the method**

Find the `restartGateway` function (around line 240) and add after it:

```typescript
  // Restart gateway with force kill
  const restartGatewayForce = useCallback(async (vibenPath?: string): Promise<GatewayStatus | null> => {
    console.log("[useGateway] restartGatewayForce called with path:", vibenPath);
    setIsActioning(true);
    setError(null);
    try {
      const pathToUse = vibenPath || vibenPathRef.current;
      const result = await invoke<GatewayStatus>("restart_gateway_with_path", {
        vibenPath: pathToUse,
        port: config?.port,
        host: config?.host,
        force: true,
      });
      setStatus(result);
      if (result.error) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[useGateway] restartGatewayForce error:", errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsActioning(false);
    }
  }, [config?.port, config?.host]);
```

- [ ] **Step 2.3: Add to return object**

Find the return statement (around line 273) and add `restartGatewayForce`:

```typescript
  return {
    status,
    config,
    isLoading,
    isActioning,
    error,
    binaryPath,
    discoveredUrl,
    vibenPath,
    versionCheck,
    runtimeState,
    startGateway,
    stopGateway,
    restartGateway,
    restartGatewayForce,  // Add this line
    refreshStatus,
    updateConfig,
    discoverGateway,
  };
```

- [ ] **Step 2.4: Verify TypeScript compiles**

Run:
```bash
cd /root/viben && pnpm typecheck --filter=desktop 2>&1 | tail -20
```

Expected: No errors related to use-gateway.ts

- [ ] **Step 2.5: Commit**

```bash
git add apps/desktop/src/hooks/use-gateway.ts
git commit -m "$(cat <<'EOF'
feat(desktop): add restartGatewayForce method to useGateway hook

Adds frontend binding for the new restart_gateway_with_path command
with force=true to handle port conflict scenarios during onboarding.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create SetupStepRow Component

**Files:**
- Create: `apps/desktop/src/components/onboarding/setup-step-row.tsx`

- [ ] **Step 3.1: Create the component file**

```tsx
/**
 * Setup Step Row Component
 *
 * A minimal, single-line step indicator for the gateway setup flow.
 * Shows: icon + label + optional detail/countdown on the right.
 *
 * Accessibility: Uses aria-live for screen reader announcements on state changes.
 */

import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type StepState = "idle" | "running" | "success" | "error" | "retrying";

export interface SetupStepRowProps {
  label: string;
  state: StepState;
  /** Error message (shown when state is error) */
  error?: string;
  /** Suggestion for how to fix the error */
  suggestion?: string;
  /** Countdown seconds until next retry (shown when state is retrying) */
  retryCountdown?: number;
  /** Retry attempt info like "2/3" */
  retryInfo?: string;
  /** Manual retry callback */
  onRetry?: () => void;
  /** Additional detail shown on success (e.g., "PID: 1234") */
  detail?: string;
  className?: string;
}

export function SetupStepRow({
  label,
  state,
  error,
  suggestion,
  retryCountdown,
  retryInfo,
  onRetry,
  detail,
  className,
}: SetupStepRowProps) {
  const { t } = useTranslation();

  // Get status text for screen readers
  const getStatusText = (): string => {
    switch (state) {
      case "idle": return t("common.pending");
      case "running": return t("common.checking");
      case "success": return t("common.success");
      case "error": return t("common.error");
      case "retrying": return t("common.retrying");
      default: return "";
    }
  };

  return (
    <div
      className={cn("space-y-1", className)}
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${getStatusText()}`}
    >
      {/* Screen reader only status */}
      <span className="sr-only">{getStatusText()}</span>

      {/* Main row */}
      <div className="flex items-center gap-2">
        {/* Icon */}
        {state === "idle" && (
          <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        )}
        {state === "running" && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
        )}
        {state === "success" && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 animate-in zoom-in-50 duration-300" />
        )}
        {state === "error" && (
          <XCircle className="h-4 w-4 shrink-0 text-red-500 animate-in zoom-in-50 duration-300" />
        )}
        {state === "retrying" && (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        )}

        {/* Label */}
        <span
          className={cn(
            "text-sm",
            state === "idle" && "text-muted-foreground",
            state === "running" && "text-blue-600 dark:text-blue-400",
            state === "success" && "text-emerald-600 dark:text-emerald-400",
            state === "error" && "text-red-600 dark:text-red-400",
            state === "retrying" && "text-amber-600 dark:text-amber-400"
          )}
        >
          {label}
        </span>

        {/* Right side info */}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {state === "success" && detail && <span>{detail}</span>}
          {state === "retrying" && retryCountdown !== undefined && (
            <span>{t("onboarding.gatewaySetup.retryInSeconds", "{{count}}s 后重试", { count: retryCountdown })}</span>
          )}
          {state === "retrying" && retryInfo && <span>({retryInfo})</span>}
          {state === "error" && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={onRetry}
              aria-label={t("common.retryStep", "重试 {{step}}", { step: label })}
            >
              {t("common.retry")}
            </Button>
          )}
        </div>
      </div>

      {/* Error details (expandable) */}
      {(state === "error" || state === "retrying") && error && (
        <div className="ml-6 space-y-0.5">
          <p className="text-xs text-muted-foreground">{error}</p>
          {suggestion && (
            <p className="text-xs text-muted-foreground/70">{suggestion}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3.2: Verify file compiles**

Run:
```bash
cd /root/viben && pnpm typecheck --filter=desktop 2>&1 | grep -E "(setup-step-row|error)" | head -10
```

Expected: No errors related to setup-step-row.tsx

- [ ] **Step 3.3: Commit**

```bash
git add apps/desktop/src/components/onboarding/setup-step-row.tsx
git commit -m "$(cat <<'EOF'
feat(desktop): add SetupStepRow component for streaming onboarding

Minimal single-line step indicator with states:
- running (blue spinner)
- success (green check + optional detail)
- error (red X + error message + retry button)
- retrying (amber warning + countdown)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create useGatewaySetup Hook

**Files:**
- Create: `apps/desktop/src/hooks/use-gateway-setup.ts`

- [ ] **Step 4.1: Create the hook file**

```typescript
/**
 * Gateway Setup Hook
 *
 * Simplified orchestration for onboarding step 2:
 * 1. Check gateway health (fast path: if running, done!)
 * 2. Try bundled CLI restart (medium path)
 * 3. Fall back to manual install (slow path: Node.js → CLI → Gateway)
 *
 * Features:
 * - Progressive step display (only show what's needed)
 * - Auto-retry with countdown (max 3 attempts, 5s interval)
 * - Rich error messages with suggestions
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { checkBundledCli } from "@/lib/onboarding/bundled-cli";
import { useGateway } from "./use-gateway";
import { useNodeInstaller } from "./use-node-installer";
import { useCliInstaller } from "./use-cli-installer";
import type { NodeInfo } from "./use-node-installer";

// Debug logging
const log = (msg: string, ...args: unknown[]) => {
  console.log(`[useGatewaySetup] ${msg}`, ...args);
};

// ============================================================================
// Types
// ============================================================================

export type StepId = "gateway" | "nodejs" | "cli" | "gateway-start" | "verify";
export type StepState = "idle" | "running" | "success" | "error" | "retrying";

export interface SetupStep {
  id: StepId;
  label: string;
  state: StepState;
  error?: string;
  suggestion?: string;
  retryCount: number;
  retryCountdown?: number;
  detail?: string;
}

export interface UseGatewaySetupReturn {
  /** Steps to display (only includes visible steps) */
  steps: SetupStep[];
  /** Whether setup is complete */
  isComplete: boolean;
  /** Whether we're in manual install mode */
  inManualMode: boolean;
  /** Start the setup process */
  startSetup: () => void;
  /** Manually retry from current error */
  retry: () => void;
  /** Node.js versions for manual selection */
  nodejsVersions: NodeInfo[];
  /** Currently selected Node.js path */
  selectedNodePath: string | null;
  /** Select a Node.js path */
  selectNodePath: (path: string) => void;
  /** Whether Node.js selector should be shown */
  showNodeSelector: boolean;
  /** Whether Node.js scan is loading */
  isNodeScanLoading: boolean;
  /** Max retries constant for UI display */
  maxRetries: number;
  /** Rescan Node.js installations */
  scanNodeInstallations: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

export const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 5000;

// ============================================================================
// Hook
// ============================================================================

export function useGatewaySetup(): UseGatewaySetupReturn {
  const { t } = useTranslation();

  // Destructure to avoid object reference issues in dependency arrays
  const { restartGatewayForce, error: gatewayError } = useGateway();
  const { checkNode, scanNodeInstallations } = useNodeInstaller();
  const { checkCli, installCli } = useCliInstaller();

  // State
  const [steps, setSteps] = useState<SetupStep[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [inManualMode, setInManualMode] = useState(false);
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  const [nodejsVersions, setNodejsVersions] = useState<NodeInfo[]>([]);
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(null);
  const [isNodeScanLoading, setIsNodeScanLoading] = useState(false);

  // Refs - use correct types for timer refs
  const isRunningRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // ============================================================================
  // Step Management
  // ============================================================================

  const updateStep = useCallback((id: StepId, updates: Partial<SetupStep>) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const newSteps = [...prev];
      newSteps[idx] = { ...newSteps[idx], ...updates };
      return newSteps;
    });
  }, []);

  const addStep = useCallback((step: SetupStep) => {
    setSteps((prev) => {
      // Don't add if already exists
      if (prev.some((s) => s.id === step.id)) return prev;
      return [...prev, step];
    });
  }, []);

  // ============================================================================
  // Auto-retry Logic
  // ============================================================================

  const startRetryCountdown = useCallback(
    (stepId: StepId, onRetry: () => void) => {
      // Clear any existing countdown timer to prevent leaks
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }

      let countdown = RETRY_INTERVAL_MS / 1000;

      updateStep(stepId, { state: "retrying", retryCountdown: countdown });

      countdownTimerRef.current = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          onRetry();
        } else {
          updateStep(stepId, { retryCountdown: countdown });
        }
      }, 1000);
    },
    [updateStep]
  );

  // ============================================================================
  // Core Setup Logic
  // ============================================================================

  const checkGatewayHealth = useCallback(async (): Promise<boolean> => {
    log("Checking gateway health...");
    try {
      const response = await fetch("http://127.0.0.1:18790/health", {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  const runSetup = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    log("Starting setup...");

    // Clear any existing timers
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    // Reset state
    setSteps([]);
    setIsComplete(false);
    setInManualMode(false);
    setShowNodeSelector(false);
    setSelectedNodePath(null);

    // ========================================
    // Step 1: Check if gateway is already running
    // ========================================
    addStep({
      id: "gateway",
      label: t("onboarding.gatewaySetup.checkingConnection", "正在检查 Gateway 连接..."),
      state: "running",
      retryCount: 0,
    });

    const isHealthy = await checkGatewayHealth();
    if (isHealthy) {
      log("Gateway already running!");
      updateStep("gateway", {
        label: t("onboarding.gatewaySetup.connected", "Gateway 连接成功"),
        state: "success",
        detail: "http://127.0.0.1:18790",
      });
      setIsComplete(true);
      isRunningRef.current = false;
      return;
    }

    // ========================================
    // Step 2: Try bundled CLI
    // ========================================
    updateStep("gateway", {
      label: t("onboarding.gatewaySetup.startingGateway", "正在启动 Gateway..."),
    });

    const bundledCli = await checkBundledCli();
    log("Bundled CLI check:", bundledCli);

    if (bundledCli.available && bundledCli.path) {
      log("Trying bundled CLI at:", bundledCli.path);

      const result = await restartGatewayForce(bundledCli.path);

      if (result?.running) {
        log("Bundled CLI started gateway successfully!");
        updateStep("gateway", {
          label: t("onboarding.gatewaySetup.connected", "Gateway 连接成功"),
          state: "success",
          detail: `PID: ${result.pid}`,
        });
        setIsComplete(true);
        isRunningRef.current = false;
        return;
      }

      log("Bundled CLI failed:", result?.error || gatewayError);
      // Fall through to manual mode
    }

    // ========================================
    // Step 3: Manual install mode
    // ========================================
    log("Entering manual install mode...");
    setInManualMode(true);

    updateStep("gateway", {
      label: bundledCli.available
        ? t("onboarding.gatewaySetup.bundledCliFailed", "Bundled CLI 启动失败，进入手动安装模式")
        : t("onboarding.gatewaySetup.noBundledCli", "未检测到 Bundled CLI，进入手动安装模式"),
      state: "error",
      error: gatewayError || undefined,
      suggestion: t("onboarding.gatewaySetup.manualInstallSuggestion", "将检测 Node.js 并安装 Viben CLI"),
    });

    // Wait a moment for UI to update
    await new Promise((r) => setTimeout(r, 500));

    // Check Node.js
    addStep({
      id: "nodejs",
      label: t("onboarding.gatewaySetup.checkingNodejs", "正在检测 Node.js..."),
      state: "running",
      retryCount: 0,
    });

    const nodeResult = await checkNode();
    log("Node.js check:", nodeResult);

    if (nodeResult.installed && !nodeResult.needsUpgrade) {
      updateStep("nodejs", {
        label: `Node.js ${nodeResult.version}`,
        state: "success",
        detail: nodeResult.path || undefined,
      });

      // Continue to CLI install
      await runCliInstall(nodeResult.path || undefined);
    } else {
      // Need user to select Node.js
      log("Node.js not found or needs upgrade, scanning installations...");
      setIsNodeScanLoading(true);
      const scanResult = await scanNodeInstallations();
      setNodejsVersions(scanResult.nodes);
      setIsNodeScanLoading(false);
      setShowNodeSelector(true);

      updateStep("nodejs", {
        label: nodeResult.installed
          ? t("onboarding.gatewaySetup.nodejsUpgradeNeeded", "Node.js 版本过低")
          : t("onboarding.gatewaySetup.nodejsNotFound", "未找到 Node.js"),
        state: "error",
        error: nodeResult.installed
          ? t("onboarding.gatewaySetup.nodejsVersionLow", "当前版本 {{version}}，需要 v22.16.0+", { version: nodeResult.version })
          : t("onboarding.gatewaySetup.pleaseSelectNodejs", "请从下方选择或安装 Node.js"),
      });

      isRunningRef.current = false;
    }
  }, [t, addStep, updateStep, checkGatewayHealth, restartGatewayForce, gatewayError, checkNode, scanNodeInstallations]);

  // ============================================================================
  // CLI Install
  // ============================================================================

  const runCliInstall = useCallback(
    async (nodePath?: string) => {
      addStep({
        id: "cli",
        label: t("onboarding.gatewaySetup.installingCli", "正在安装 Viben CLI..."),
        state: "running",
        retryCount: 0,
      });

      const cliResult = await checkCli(nodePath);
      log("CLI check:", cliResult);

      let effectiveCliResult = cliResult;

      if (!cliResult.installed || cliResult.error) {
        log("Installing CLI...");
        updateStep("cli", {
          label: t("onboarding.gatewaySetup.installingCliNpm", "npm install -g viben@latest"),
        });

        await installCli(nodePath);

        // Re-check and use the recheck result
        const recheckResult = await checkCli(nodePath);
        effectiveCliResult = recheckResult;

        if (!recheckResult.installed || recheckResult.error) {
          updateStep("cli", {
            label: t("onboarding.gatewaySetup.cliInstallFailed", "CLI 安装失败"),
            state: "error",
            error: recheckResult.error || "Installation failed",
          });
          isRunningRef.current = false;
          return;
        }
      }

      // Use effectiveCliResult (post-install version)
      updateStep("cli", {
        label: `Viben CLI ${effectiveCliResult.version || "installed"}`,
        state: "success",
        detail: effectiveCliResult.path || undefined,
      });

      // Continue to gateway start
      await runGatewayStart(nodePath);
    },
    [t, addStep, updateStep, checkCli, installCli]
  );

  // ============================================================================
  // Gateway Start (manual mode)
  // ============================================================================

  const runGatewayStart = useCallback(
    async (nodePath?: string, retryCount = 0) => {
      addStep({
        id: "gateway-start",
        label: t("onboarding.gatewaySetup.startingGatewayManual", "正在启动 Gateway..."),
        state: "running",
        retryCount,
      });

      const result = await restartGatewayForce();

      if (result?.running) {
        updateStep("gateway-start", {
          label: t("onboarding.gatewaySetup.gatewayStarted", "Gateway 已启动"),
          state: "success",
          detail: `PID: ${result.pid}`,
        });

        // Verify connection
        await runVerifyConnection(retryCount);
      } else {
        const errorMsg = result?.error || gatewayError || "Failed to start";

        if (retryCount < MAX_RETRIES) {
          updateStep("gateway-start", {
            label: t("onboarding.gatewaySetup.gatewayStartFailed", "Gateway 启动失败"),
            state: "retrying",
            error: errorMsg,
            retryCount: retryCount + 1,
            retryCountdown: RETRY_INTERVAL_MS / 1000,
          });

          startRetryCountdown("gateway-start", () => {
            runGatewayStart(nodePath, retryCount + 1);
          });
        } else {
          updateStep("gateway-start", {
            label: t("onboarding.gatewaySetup.gatewayStartFailed", "Gateway 启动失败"),
            state: "error",
            error: errorMsg,
            suggestion: t("onboarding.gatewaySetup.maxRetriesReached", "已达最大重试次数"),
            retryCount,
          });
          isRunningRef.current = false;
        }
      }
    },
    [t, addStep, updateStep, restartGatewayForce, gatewayError, startRetryCountdown]
  );

  // ============================================================================
  // Verify Connection
  // ============================================================================

  const runVerifyConnection = useCallback(
    async (retryCount = 0) => {
      addStep({
        id: "verify",
        label: t("onboarding.gatewaySetup.verifyingConnection", "正在验证连接..."),
        state: "running",
        retryCount,
      });

      const isHealthy = await checkGatewayHealth();

      if (isHealthy) {
        updateStep("verify", {
          label: t("onboarding.gatewaySetup.connectionVerified", "连接验证成功"),
          state: "success",
        });
        setIsComplete(true);
        isRunningRef.current = false;
      } else {
        if (retryCount < MAX_RETRIES) {
          updateStep("verify", {
            state: "retrying",
            retryCount: retryCount + 1,
            retryCountdown: RETRY_INTERVAL_MS / 1000,
          });

          startRetryCountdown("verify", () => {
            runVerifyConnection(retryCount + 1);
          });
        } else {
          updateStep("verify", {
            label: t("onboarding.gatewaySetup.connectionFailed", "连接验证失败"),
            state: "error",
            error: t("onboarding.gatewaySetup.gatewayNotResponding", "Gateway 无响应"),
            retryCount,
          });
          isRunningRef.current = false;
        }
      }
    },
    [t, addStep, updateStep, checkGatewayHealth, startRetryCountdown]
  );

  // ============================================================================
  // User Actions
  // ============================================================================

  const startSetup = useCallback(() => {
    runSetup();
  }, [runSetup]);

  const retry = useCallback(() => {
    // Clear timers
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    isRunningRef.current = false;

    // Restart from beginning
    runSetup();
  }, [runSetup]);

  const selectNodePath = useCallback(
    async (path: string) => {
      // Guard against double-click race condition
      if (isRunningRef.current) {
        log("selectNodePath: already running, ignoring");
        return;
      }

      log("User selected Node.js path:", path);
      setSelectedNodePath(path);
      setShowNodeSelector(false);

      // Update UI
      updateStep("nodejs", {
        label: t("onboarding.gatewaySetup.nodejsSelected", "Node.js 已选择"),
        state: "success",
        detail: path,
      });

      // Continue with CLI install
      isRunningRef.current = true;
      await runCliInstall(path);
    },
    [t, updateStep, runCliInstall]
  );

  // Wrap scanNodeInstallations to update local state
  const handleScanNodeInstallations = useCallback(async () => {
    setIsNodeScanLoading(true);
    const result = await scanNodeInstallations();
    setNodejsVersions(result.nodes);
    setIsNodeScanLoading(false);
  }, [scanNodeInstallations]);

  return {
    steps,
    isComplete,
    inManualMode,
    startSetup,
    retry,
    nodejsVersions,
    selectedNodePath,
    selectNodePath,
    showNodeSelector,
    isNodeScanLoading,
    maxRetries: MAX_RETRIES,
    scanNodeInstallations: handleScanNodeInstallations,
  };
}
```

- [ ] **Step 4.2: Verify TypeScript compiles**

Run:
```bash
cd /root/viben && pnpm typecheck --filter=desktop 2>&1 | grep -E "(use-gateway-setup|error)" | head -20
```

Expected: No errors related to use-gateway-setup.ts

- [ ] **Step 4.3: Commit**

```bash
git add apps/desktop/src/hooks/use-gateway-setup.ts
git commit -m "$(cat <<'EOF'
feat(desktop): add useGatewaySetup hook for streaming onboarding

Simplified orchestration with three paths:
1. Fast: Gateway already running → done
2. Medium: Bundled CLI restart → done
3. Slow: Manual Node.js → CLI → Gateway install

Features:
- Progressive step display (only shows needed steps)
- Auto-retry with countdown (max 3, 5s interval)
- Rich error messages with suggestions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create GatewaySetupPage Component

**Files:**
- Create: `apps/desktop/src/components/onboarding/gateway-setup-page.tsx`

- [ ] **Step 5.1: Create the page component**

```tsx
/**
 * Gateway Setup Page
 *
 * Simplified onboarding step 2: streaming gateway connection check.
 * Shows steps progressively as they execute.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { SetupStepRow } from "./setup-step-row";
import { useGatewaySetup, MAX_RETRIES } from "@/hooks/use-gateway-setup";
import { NodejsSection } from "./env-check-sections";

interface GatewaySetupPageProps {
  onComplete: () => void;
  onBack?: () => void;
}

export function GatewaySetupPage({ onComplete, onBack }: GatewaySetupPageProps) {
  const { t } = useTranslation();
  const {
    steps,
    isComplete,
    inManualMode,
    startSetup,
    retry,
    nodejsVersions,
    selectedNodePath,
    selectNodePath,
    showNodeSelector,
    isNodeScanLoading,
    maxRetries,
    scanNodeInstallations,
  } = useGatewaySetup();

  // State for custom Node.js path input
  const [customNodejsPath, setCustomNodejsPath] = useState("");

  // Track if we've started
  const hasStartedRef = useRef(false);

  // Auto-start on mount
  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startSetup();
    }
  }, [startSetup]);

  // Check if any step has error (for showing retry button)
  const hasError = steps.some((s) => s.state === "error");
  const isRunning = steps.some((s) => s.state === "running" || s.state === "retrying");

  // Handler for browsing Node.js path
  const handleBrowseNodejs = async () => {
    try {
      const result = await openDialog({
        title: t("onboarding.nodejs.selectNode"),
        filters: [{ name: "Node.js", extensions: ["*"] }],
      });
      if (result) {
        const path = typeof result === "string" ? result : Array.isArray(result) ? result[0] : null;
        if (path) {
          setCustomNodejsPath(path);
          selectNodePath(path);
        }
      }
    } catch (err) {
      console.error("Failed to browse for Node.js:", err);
    }
  };

  // Handler for retrying a specific step
  const handleStepRetry = (stepId: string) => {
    // For now, retry from beginning - could be enhanced to retry specific step
    retry();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">
          {t("onboarding.gatewaySetup.title", "连接 Gateway")}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t("onboarding.gatewaySetup.description", "正在配置本地服务...")}
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3 min-h-[120px]">
        {steps.map((step) => (
          <SetupStepRow
            key={step.id}
            label={step.label}
            state={step.state}
            error={step.error}
            suggestion={step.suggestion}
            retryCountdown={step.retryCountdown}
            retryInfo={step.retryCount > 0 ? `${step.retryCount}/${maxRetries}` : undefined}
            detail={step.detail}
            onRetry={step.state === "error" ? () => handleStepRetry(step.id) : undefined}
          />
        ))}

        {/* Node.js Selector (shown when needed) */}
        {showNodeSelector && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-4">
            <NodejsSection
              nodeVersions={nodejsVersions}
              selectedPath={selectedNodePath}
              onSelect={selectNodePath}
              customPath={customNodejsPath}
              onCustomPathChange={setCustomNodejsPath}
              onBrowse={handleBrowseNodejs}
              isCheckingCustomPath={false}
              customPathError={null}
              onCheckCustomPath={() => selectNodePath(customNodejsPath)}
              isLoading={isNodeScanLoading}
              onRefresh={scanNodeInstallations}
              requiredVersion="22.16.0"
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div>
          {onBack && (
            <Button variant="ghost" onClick={onBack} disabled={isRunning}>
              {t("common.back")}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {hasError && !isRunning && (
            <Button variant="outline" onClick={retry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common.retry")}
            </Button>
          )}
          <Button onClick={onComplete} disabled={!isComplete}>
            {t("common.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.2: Verify TypeScript compiles**

Run:
```bash
cd /root/viben && pnpm typecheck --filter=desktop 2>&1 | grep -E "(gateway-setup-page|error)" | head -10
```

Expected: No errors

- [ ] **Step 5.3: Commit**

```bash
git add apps/desktop/src/components/onboarding/gateway-setup-page.tsx
git commit -m "$(cat <<'EOF'
feat(desktop): add GatewaySetupPage for streaming onboarding

Replaces the complex DAG-based EnvCheckPage with a minimal
streaming UI that shows steps progressively:
- Fast path: just one "Gateway connected" line
- Slow path: shows Node.js → CLI → Gateway steps

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire Up GatewaySetupPage in Wizard

**Files:**
- Modify: `apps/desktop/src/components/onboarding/onboarding-wizard.tsx:9-10`
- Modify: `apps/desktop/src/components/onboarding/onboarding-wizard.tsx:128-132`

- [ ] **Step 6.1: Update import**

In `apps/desktop/src/components/onboarding/onboarding-wizard.tsx`, change line 9:

```typescript
import { EnvCheckPage } from "./env-check-page";
```

To:

```typescript
import { GatewaySetupPage } from "./gateway-setup-page";
```

- [ ] **Step 6.2: Update component usage**

Find lines 128-132:

```tsx
{currentStep === "envCheck" && (
  <EnvCheckPage
    onComplete={handleEnvCheckComplete}
    onBack={handleEnvCheckBack}
  />
)}
```

Replace with:

```tsx
{currentStep === "envCheck" && (
  <GatewaySetupPage
    onComplete={handleEnvCheckComplete}
    onBack={handleEnvCheckBack}
  />
)}
```

- [ ] **Step 6.3: Verify TypeScript compiles**

Run:
```bash
cd /root/viben && pnpm typecheck --filter=desktop 2>&1 | tail -10
```

Expected: Build succeeds

- [ ] **Step 6.4: Commit**

```bash
git add apps/desktop/src/components/onboarding/onboarding-wizard.tsx
git commit -m "$(cat <<'EOF'
feat(desktop): wire GatewaySetupPage into onboarding wizard

Replace EnvCheckPage with the new streaming GatewaySetupPage
for onboarding step 2 (envCheck).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add i18n Translations

**Files:**
- Modify: `apps/desktop/src/i18n/locales/en.json`
- Modify: `apps/desktop/src/i18n/locales/zh-CN.json`

- [ ] **Step 7.1: Add English translations**

In `apps/desktop/src/i18n/locales/en.json`, find the `onboarding` section and add:

```json
"gatewaySetup": {
  "title": "Connect Gateway",
  "description": "Setting up local service...",
  "checkingConnection": "Checking Gateway connection...",
  "connected": "Gateway connected",
  "startingGateway": "Starting Gateway...",
  "bundledCliFailed": "Bundled CLI failed, entering manual install mode",
  "noBundledCli": "No Bundled CLI detected, entering manual install mode",
  "manualInstallSuggestion": "Will detect Node.js and install Viben CLI",
  "checkingNodejs": "Detecting Node.js...",
  "nodejsUpgradeNeeded": "Node.js version too low",
  "nodejsNotFound": "Node.js not found",
  "nodejsVersionLow": "Current version {{version}}, requires v22.16.0+",
  "pleaseSelectNodejs": "Please select or install Node.js below",
  "nodejsSelected": "Node.js selected",
  "installingCli": "Installing Viben CLI...",
  "installingCliNpm": "npm install -g viben@latest",
  "cliInstallFailed": "CLI installation failed",
  "startingGatewayManual": "Starting Gateway...",
  "gatewayStarted": "Gateway started",
  "gatewayStartFailed": "Gateway start failed",
  "maxRetriesReached": "Max retries reached",
  "verifyingConnection": "Verifying connection...",
  "connectionVerified": "Connection verified",
  "connectionFailed": "Connection verification failed",
  "gatewayNotResponding": "Gateway not responding",
  "retryInSeconds": "Retry in {{count}}s"
}
```

- [ ] **Step 7.2: Add Chinese translations**

In `apps/desktop/src/i18n/locales/zh-CN.json`, find the `onboarding` section and add:

```json
"gatewaySetup": {
  "title": "连接 Gateway",
  "description": "正在配置本地服务...",
  "checkingConnection": "正在检查 Gateway 连接...",
  "connected": "Gateway 连接成功",
  "startingGateway": "正在启动 Gateway...",
  "bundledCliFailed": "Bundled CLI 启动失败，进入手动安装模式",
  "noBundledCli": "未检测到 Bundled CLI，进入手动安装模式",
  "manualInstallSuggestion": "将检测 Node.js 并安装 Viben CLI",
  "checkingNodejs": "正在检测 Node.js...",
  "nodejsUpgradeNeeded": "Node.js 版本过低",
  "nodejsNotFound": "未找到 Node.js",
  "nodejsVersionLow": "当前版本 {{version}}，需要 v22.16.0+",
  "pleaseSelectNodejs": "请从下方选择或安装 Node.js",
  "nodejsSelected": "Node.js 已选择",
  "installingCli": "正在安装 Viben CLI...",
  "installingCliNpm": "npm install -g viben@latest",
  "cliInstallFailed": "CLI 安装失败",
  "startingGatewayManual": "正在启动 Gateway...",
  "gatewayStarted": "Gateway 已启动",
  "gatewayStartFailed": "Gateway 启动失败",
  "maxRetriesReached": "已达最大重试次数",
  "verifyingConnection": "正在验证连接...",
  "connectionVerified": "连接验证成功",
  "connectionFailed": "连接验证失败",
  "gatewayNotResponding": "Gateway 无响应",
  "retryInSeconds": "{{count}}s 后重试"
}
```

- [ ] **Step 7.3: Commit**

```bash
git add apps/desktop/src/i18n/locales/en.json apps/desktop/src/i18n/locales/zh-CN.json
git commit -m "$(cat <<'EOF'
feat(desktop): add i18n translations for gateway setup

Adds English and Chinese translations for the new streaming
gateway setup onboarding page.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Test and Verify

**Files:** None (testing only)

- [ ] **Step 8.1: Build the desktop app**

```bash
cd /root/viben && pnpm build --filter=desktop
```

Expected: Build succeeds

- [ ] **Step 8.2: Test fast path (gateway already running)**

1. Start gateway manually: `viben gateway start --port 18790`
2. Launch desktop app
3. Go through onboarding to step 2

Expected: Shows single line "Gateway 连接成功" immediately, Next button enabled

- [ ] **Step 8.3: Test bundled CLI path**

1. Stop gateway: `viben gateway stop`
2. Reset onboarding (delete app data or use dev tools)
3. Launch desktop app with bundled CLI
4. Go through onboarding to step 2

Expected: Shows "正在启动 Gateway..." then "Gateway 连接成功"

- [ ] **Step 8.4: Test port conflict recovery**

1. Start another process on 18790: `nc -l 18790` (or any server)
2. Launch desktop app
3. Go through onboarding to step 2

Expected: Gateway restart with --force should kill the blocking process and succeed

- [ ] **Step 8.5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(desktop): address issues found during testing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This plan implements a streaming gateway setup flow that:

1. **Prioritizes speed**: If gateway is already running, done in one line
2. **Uses bundled CLI first**: No dependency on Node.js in most cases
3. **Falls back gracefully**: Manual install with progressive UI
4. **Auto-retries on failure**: Max 3 attempts, 5s interval, with countdown
5. **Shows clear errors**: Messages with actionable suggestions

The old DAG-based system is preserved but not used, allowing easy rollback if needed.
