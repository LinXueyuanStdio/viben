/**
 * Gateway Bootstrap Step Component
 *
 * Qclaw reference: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/GatewayBootstrapGate.tsx
 *
 * This component handles:
 * 1. CLI availability check
 * 2. CLI installation (with npm mirror fallback)
 * 3. Gateway process startup
 * 4. Connection verification with exponential backoff
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  AlertCircle,
  RefreshCw,
  Copy,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGateway } from "@/hooks/use-gateway";
import { useGatewayStatus } from "@/hooks/use-gateway-status";
import { useCliInstaller } from "@/hooks/use-cli-installer";
import { Button } from "@/components/ui/button";
import { FailureView } from "./failure-view";
import { LoadingScreen } from "./loading-screen";
import { StartupIssueDialog } from "./startup-issue-dialog";
import { UI_RUNTIME_DEFAULTS } from "@/lib/onboarding/runtime-policies";
import { createGatewayFailureView, createInstallerFailureView } from "@/lib/onboarding/bootstrap-diagnostics";
import type { FailureView as FailureViewType } from "@/lib/onboarding/bootstrap-diagnostics";
import type { CliInstallerIssueKind } from "@/lib/onboarding/installer-issues";

// ============================================================================
// Types
// ============================================================================

interface StepGatewayProps {
  onComplete: () => void;
  onBack?: () => void;
}

type BootstrapPhase =
  | "cli-check"
  | "cli-install"
  | "gateway-start"
  | "connection-check"
  | "done"
  | "error";

type TaskKey = "cli" | "gateway" | "connection";
type TaskStatus = "pending" | "active" | "done" | "error";

interface TaskState {
  cli: TaskStatus;
  gateway: TaskStatus;
  connection: TaskStatus;
}

// ============================================================================
// Weighted Progress Calculation
// Qclaw reference: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/dashboard-entry-bootstrap.ts
// ============================================================================

const TASK_WEIGHTS: Record<TaskKey, number> = {
  cli: 0.3, // 30%
  gateway: 0.4, // 40%
  connection: 0.3, // 30%
};

function resolveProgressUnit(status: TaskStatus): number {
  if (status === "done") return 1;
  if (status === "active") return 0.45;
  if (status === "error") return 0.2;
  return 0; // pending
}

function calculateProgress(tasks: TaskState): number {
  const baseline = UI_RUNTIME_DEFAULTS.gatewayBootstrap.baselineProgress; // 8%
  let progress = baseline;

  for (const [key, status] of Object.entries(tasks) as [TaskKey, TaskStatus][]) {
    const weight = TASK_WEIGHTS[key];
    const unit = resolveProgressUnit(status);
    progress += (100 - baseline) * weight * unit;
  }

  return Math.min(100, Math.round(progress));
}

// ============================================================================
// Component
// ============================================================================

export function StepGateway({ onComplete, onBack }: StepGatewayProps) {
  const { t } = useTranslation();

  // Hooks
  const {
    status: gatewayProcess,
    isLoading: gatewayLoading,
    isActioning,
    error: gatewayError,
    vibenPath,
    startGateway,
    runtimeState,
    versionCheck,
  } = useGateway();

  const { isConnected, checkConnectionWithBackoff } = useGatewayStatus();

  const {
    state: cliState,
    issue: cliIssue,
    currentVersion,
    checkCli,
    installCli,
  } = useCliInstaller();

  // Local state
  const [phase, setPhase] = React.useState<BootstrapPhase>("cli-check");
  const [tasks, setTasks] = React.useState<TaskState>({
    cli: "pending",
    gateway: "pending",
    connection: "pending",
  });
  const [failure, setFailure] = React.useState<FailureViewType | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [showIssueDialog, setShowIssueDialog] = React.useState(false);
  const [issueDialogKind, setIssueDialogKind] = React.useState<CliInstallerIssueKind | null>(null);
  const bootstrapRunRef = React.useRef(false);

  const maxRetries = 3;
  const progress = calculateProgress(tasks);

  // ============================================================================
  // Bootstrap Flow
  // ============================================================================

  const runBootstrap = React.useCallback(async () => {
    // Prevent double execution
    if (bootstrapRunRef.current) return;
    bootstrapRunRef.current = true;

    setFailure(null);

    // Phase 1: CLI Check
    setPhase("cli-check");
    setTasks((t) => ({ ...t, cli: "active" }));

    try {
      await checkCli();
    } catch (err) {
      console.error("[StepGateway] CLI check failed:", err);
    }

    // Wait a tick for state to update
    await new Promise((r) => setTimeout(r, 100));

    // Get fresh state after checkCli
    const cliCheckResult = await new Promise<boolean>((resolve) => {
      // Check if CLI is installed via vibenPath or through the hook
      if (vibenPath) {
        resolve(true);
      } else {
        // Give it another moment
        setTimeout(() => {
          resolve(!!vibenPath);
        }, 200);
      }
    });

    // If CLI is not available and no vibenPath, we need to handle it
    if (!vibenPath && !cliCheckResult) {
      // Check for special cases like Xcode CLT
      if (cliIssue?.kind === "xcode-clt-pending") {
        setIssueDialogKind("xcode-clt-pending");
        setShowIssueDialog(true);
        setTasks((t) => ({ ...t, cli: "error" }));
        setPhase("error");
        bootstrapRunRef.current = false;
        return;
      }

      // Need to install CLI
      setPhase("cli-install");
      setTasks((t) => ({ ...t, cli: "active" }));

      try {
        await installCli();
      } catch (err) {
        console.error("[StepGateway] CLI install failed:", err);
      }

      // Wait for state update
      await new Promise((r) => setTimeout(r, 100));

      // Check if installation was successful
      if (cliState === "error" && cliIssue) {
        setTasks((t) => ({ ...t, cli: "error" }));
        setFailure(createInstallerFailureView(cliIssue.kind, { error: cliIssue.details }));
        setPhase("error");
        bootstrapRunRef.current = false;
        return;
      }
    }

    setTasks((t) => ({ ...t, cli: "done" }));

    // Phase 2: Start Gateway
    setPhase("gateway-start");
    setTasks((t) => ({ ...t, gateway: "active" }));

    // Check if already connected
    if (isConnected) {
      setTasks((t) => ({ ...t, gateway: "done", connection: "done" }));
      setPhase("done");
      bootstrapRunRef.current = false;
      return;
    }

    // Check if gateway process is already running
    if (gatewayProcess?.running) {
      setTasks((t) => ({ ...t, gateway: "done" }));
    } else {
      // Start the gateway
      try {
        await startGateway();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[StepGateway] Gateway start failed:", errorMsg);
        setTasks((t) => ({ ...t, gateway: "error" }));
        setFailure(createGatewayFailureView(runtimeState, { error: errorMsg }));
        setPhase("error");
        bootstrapRunRef.current = false;
        return;
      }

      setTasks((t) => ({ ...t, gateway: "done" }));
    }

    // Phase 3: Verify Connection
    setPhase("connection-check");
    setTasks((t) => ({ ...t, connection: "active" }));

    const connected = await checkConnectionWithBackoff();

    if (connected) {
      setTasks((t) => ({ ...t, connection: "done" }));
      setPhase("done");
    } else {
      setTasks((t) => ({ ...t, connection: "error" }));
      setFailure(createGatewayFailureView("connection_timeout"));
      setPhase("error");
    }

    bootstrapRunRef.current = false;
  }, [
    checkCli,
    vibenPath,
    cliIssue,
    cliState,
    installCli,
    isConnected,
    gatewayProcess?.running,
    startGateway,
    runtimeState,
    checkConnectionWithBackoff,
  ]);

  // Auto-start bootstrap on mount
  React.useEffect(() => {
    // Wait for initial loading to complete
    if (gatewayLoading) return;

    // If already connected, skip to done
    if (isConnected) {
      setTasks({ cli: "done", gateway: "done", connection: "done" });
      setPhase("done");
      return;
    }

    runBootstrap();
  }, [gatewayLoading, isConnected, runBootstrap]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRetry = async () => {
    if (retryCount >= maxRetries) return;
    setRetryCount((c) => c + 1);
    setTasks({ cli: "pending", gateway: "pending", connection: "pending" });
    bootstrapRunRef.current = false;
    await runBootstrap();
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleContinue = () => {
    onComplete();
  };

  const canContinue = phase === "done";
  const canRetry = phase === "error" && retryCount < maxRetries;
  const isBootstrapping = phase !== "done" && phase !== "error";

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("onboarding.gateway.title")}</h2>
        <p className="mt-2 text-muted-foreground">
          {t("onboarding.gateway.description")}
        </p>
      </div>

      {/* Loading state */}
      {isBootstrapping && (
        <div className="space-y-4">
          <LoadingScreen
            progress={progress}
            status={getPhaseStatus(phase, t)}
            showTips={true}
          />
          {/* Show viben path being used */}
          {vibenPath && (phase === "gateway-start" || phase === "connection-check") && (
            <CommandDetails
              binaryPath={vibenPath}
              command={`${vibenPath} gateway serve --port 18790 --host 127.0.0.1`}
            />
          )}
        </div>
      )}

      {/* Success state */}
      {phase === "done" && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500">
              <Check className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-green-700 dark:text-green-400">
                {t("onboarding.gateway.connected")}
              </div>
              {gatewayProcess?.port && (
                <div className="text-sm text-muted-foreground">
                  {t("onboarding.gateway.port")}: {gatewayProcess.port}
                </div>
              )}
              {currentVersion && (
                <div className="text-sm text-muted-foreground">
                  {t("common.version")}: {currentVersion}
                </div>
              )}
            </div>
          </div>
          {/* Command details */}
          {(gatewayProcess?.binary_path || gatewayProcess?.command || vibenPath) && (
            <CommandDetails
              binaryPath={gatewayProcess?.binary_path || vibenPath}
              command={gatewayProcess?.command}
            />
          )}
        </div>
      )}

      {/* Error state */}
      {phase === "error" && failure && (
        <FailureView
          failure={failure}
          onRetry={canRetry ? handleRetry : undefined}
          onSkip={handleSkip}
          isRetrying={isBootstrapping}
        />
      )}

      {/* Version warning */}
      {versionCheck?.enforcement === "optional_upgrade" && (
        <div className="flex items-center gap-2 rounded bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertCircle className="h-4 w-4" />
          <span>{versionCheck.message}</span>
        </div>
      )}

      {/* Gateway error from hook (fallback) */}
      {gatewayError && phase !== "done" && phase !== "error" && (
        <div className="flex items-center gap-2 rounded bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{gatewayError}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          {onBack && (
            <Button variant="ghost" onClick={onBack} disabled={isBootstrapping}>
              {t("common.back")}
            </Button>
          )}
          {phase === "error" && (
            <Button variant="ghost" onClick={handleSkip}>
              {t("onboarding.gateway.skip")}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {canRetry && (
            <Button variant="outline" onClick={handleRetry} disabled={isBootstrapping || isActioning}>
              <RefreshCw className={cn("mr-2 h-4 w-4", (isBootstrapping || isActioning) && "animate-spin")} />
              {t("onboarding.gateway.retry")} ({maxRetries - retryCount} left)
            </Button>
          )}
          <Button onClick={handleContinue} disabled={!canContinue}>
            {t("common.next")}
          </Button>
        </div>
      </div>

      {/* Skip warning */}
      {phase === "error" && (
        <p className="text-center text-sm text-muted-foreground">
          {t("onboarding.gateway.skipWarning")}
        </p>
      )}

      {/* Startup issue dialog */}
      {issueDialogKind && (
        <StartupIssueDialog
          open={showIssueDialog}
          onOpenChange={setShowIssueDialog}
          issueKind={issueDialogKind}
          onRetry={() => {
            setShowIssueDialog(false);
            handleRetry();
          }}
          isRetrying={isBootstrapping}
        />
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPhaseStatus(phase: BootstrapPhase, t: (key: string) => string): string {
  switch (phase) {
    case "cli-check":
      return t("onboarding.gateway.checking");
    case "cli-install":
      return t("onboarding.gateway.installingCli");
    case "gateway-start":
      return t("onboarding.gateway.starting");
    case "connection-check":
      return t("onboarding.gateway.verifyingConnection");
    default:
      return "";
  }
}

// ============================================================================
// CommandDetails Component
// ============================================================================

interface CommandDetailsProps {
  binaryPath?: string | null;
  command?: string | null;
}

function CommandDetails({ binaryPath, command }: CommandDetailsProps) {
  const [copiedField, setCopiedField] = React.useState<"binary" | "command" | null>(null);

  const handleCopy = async (text: string, field: "binary" | "command") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!binaryPath && !command) return null;

  return (
    <div className="mt-4 space-y-2 rounded bg-muted/50 p-3 font-mono text-xs">
      {binaryPath && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground shrink-0 pt-0.5">Binary:</span>
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
            <code className="whitespace-nowrap">{binaryPath}</code>
          </div>
          <button
            onClick={() => handleCopy(binaryPath, "binary")}
            className="shrink-0 p-1 rounded hover:bg-muted-foreground/10 transition-colors"
            title="Copy binary path"
          >
            {copiedField === "binary" ? (
              <CheckCheck className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      )}
      {command && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground shrink-0 pt-0.5">Command:</span>
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
            <code className="whitespace-nowrap">{command}</code>
          </div>
          <button
            onClick={() => handleCopy(command, "command")}
            className="shrink-0 p-1 rounded hover:bg-muted-foreground/10 transition-colors"
            title="Copy command"
          >
            {copiedField === "command" ? (
              <CheckCheck className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
