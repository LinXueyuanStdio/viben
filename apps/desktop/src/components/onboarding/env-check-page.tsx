/**
 * EnvCheck Page Component
 *
 * Separated environment check page for Node.js and CLI
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EnvCheckStepItem, type EnvCheckStepStatus } from "./env-check-step-item";
import { useNodeInstaller } from "@/hooks/use-node-installer";
import { useCliInstaller } from "@/hooks/use-cli-installer";
import {
  ENV_CHECK_UI_POLICY,
  ENV_CHECK_STEP_TOOLTIPS,
  getEnvCheckSupportActionsForIssueKind,
} from "@/lib/onboarding/env-check-policy";
import {
  CancellationRegistry,
  isCancellationError,
} from "@/lib/onboarding/cancellation";

// Debug logging helper
const log = (message: string, ...args: unknown[]) => {
  console.log(`[EnvCheckPage] ${message}`, ...args);
};

// ============================================================================
// Types
// ============================================================================

interface EnvCheckPageProps {
  onComplete: () => void;
  onBack?: () => void;
}

type EnvCheckPhase =
  | "initial"
  | "node-check"
  | "node-install"
  | "cli-check"
  | "cli-install"
  | "done"
  | "error";

interface EnvCheckState {
  node: {
    status: EnvCheckStepStatus;
    version?: string;
    path?: string;
    error?: { title: string; message: string; details?: string };
  };
  cli: {
    status: EnvCheckStepStatus;
    version?: string;
    path?: string;
    error?: { title: string; message: string; details?: string };
  };
}

// ============================================================================
// Component
// ============================================================================

export function EnvCheckPage({ onComplete, onBack }: EnvCheckPageProps) {
  const { t } = useTranslation();

  log("Component rendering");

  // Hooks
  const {
    issue: nodeIssue,
    checkNode,
    installNode,
  } = useNodeInstaller();

  const {
    state: cliState,
    issue: cliIssue,
    isInstalled: cliIsInstalled,
    currentVersion: cliCurrentVersion,
    checkCli,
    installCli,
  } = useCliInstaller();

  // Local state
  const [phase, setPhase] = React.useState<EnvCheckPhase>("initial");
  const [progress, setProgress] = React.useState(0);
  const [tipIndex, setTipIndex] = React.useState(0);
  const [envState, setEnvState] = React.useState<EnvCheckState>({
    node: { status: "pending" },
    cli: { status: "pending" },
  });
  const [retryCount, setRetryCount] = React.useState(0);

  const cancellationRef = React.useRef(new CancellationRegistry());
  const checkRunRef = React.useRef(false);

  const maxRetries = 3;
  const isChecking = phase !== "done" && phase !== "error" && phase !== "initial";

  // Log state changes
  log("Current state:", { phase, cliState, cliIsInstalled, cliCurrentVersion, envState });

  // ============================================================================
  // Loading Tips Rotation
  // ============================================================================

  React.useEffect(() => {
    if (!isChecking) return;

    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % ENV_CHECK_UI_POLICY.loadingTips.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isChecking]);

  // ============================================================================
  // Cleanup on unmount
  // ============================================================================

  React.useEffect(() => {
    log("Component mounted");
    return () => {
      log("Component unmounting, disposing cancellation registry");
      cancellationRef.current.dispose();
    };
  }, []);

  // ============================================================================
  // Environment Check Flow
  // ============================================================================

  const runEnvCheck = React.useCallback(async () => {
    log("runEnvCheck called, checkRunRef.current:", checkRunRef.current);
    if (checkRunRef.current) {
      log("runEnvCheck already running, skipping");
      return;
    }
    checkRunRef.current = true;

    const registry = cancellationRef.current;
    registry.cancelAll("superseded");

    setProgress(10);

    // Phase 1: Check Node.js
    log("Phase transition: -> node-check");
    setPhase("node-check");
    setEnvState((s) => ({ ...s, node: { status: "checking" } }));

    try {
      log("Starting Node.js check...");
      const nodeController = registry.getOrCreate("node-check");
      const nodeResult = await nodeController.race(checkNode());
      log("Node check result:", nodeResult);

      if (nodeResult.installed) {
        log("Node.js found, version:", nodeResult.version);
        setEnvState((s) => ({
          ...s,
          node: {
            status: "success",
            version: nodeResult.version,
            path: nodeResult.path,
          },
        }));
        setProgress(30);
      } else {
        // Need to install Node.js
        log("Node.js not found, starting installation...");
        log("Phase transition: node-check -> node-install");
        setPhase("node-install");
        setEnvState((s) => ({ ...s, node: { status: "checking" } }));

        const installController = registry.getOrCreate("node-install");
        await installController.race(installNode());
        log("Node.js installation completed, re-checking...");

        // Re-check after install
        const recheck = await checkNode();
        log("Node recheck result:", recheck);
        if (recheck.installed) {
          setEnvState((s) => ({
            ...s,
            node: {
              status: "success",
              version: recheck.version,
              path: recheck.path,
            },
          }));
          setProgress(30);
        } else {
          throw new Error("Node.js installation failed");
        }
      }
    } catch (err) {
      log("Node check/install error:", err);
      if (isCancellationError(err)) {
        log("Node check cancelled");
        setEnvState((s) => ({ ...s, node: { status: "pending" } }));
        checkRunRef.current = false;
        return;
      }

      const error = nodeIssue || {
        title: "Node.js 检查失败",
        message: err instanceof Error ? err.message : String(err),
      };

      setEnvState((s) => ({
        ...s,
        node: {
          status: "error",
          error: {
            title: error.title || "错误",
            message: error.message || "未知错误",
            details: "details" in error ? error.details : undefined,
          },
        },
      }));
      log("Phase transition: -> error (Node.js failed)");
      setPhase("error");
      checkRunRef.current = false;
      return;
    }

    // Phase 2: Check CLI
    log("Phase transition: -> cli-check");
    setPhase("cli-check");
    setEnvState((s) => ({ ...s, cli: { status: "checking" } }));
    setProgress(50);

    try {
      log("Starting CLI check...");
      const cliController = registry.getOrCreate("cli-check");
      await cliController.race(checkCli());
      log("CLI check completed, hook will update state via useEffect");
      // The CLI hook updates its own state (cliIsInstalled, cliCurrentVersion, cliState)
      // We rely on the useEffect watchers below to handle transitions
    } catch (err) {
      log("CLI check error:", err);
      if (isCancellationError(err)) {
        log("CLI check cancelled");
        setEnvState((s) => ({ ...s, cli: { status: "pending" } }));
        checkRunRef.current = false;
        return;
      }
      // Non-cancellation errors will be caught by the useEffect watcher via cliIssue
    }

    // Reset the check run flag - the useEffect watchers will handle the rest
    checkRunRef.current = false;
    log("runEnvCheck finished, waiting for hook state updates");
  }, [checkNode, installNode, checkCli, nodeIssue]);

  // Watch CLI hook state changes
  React.useEffect(() => {
    log("CLI state watcher triggered:", { phase, cliState, cliIsInstalled, cliCurrentVersion, cliIssue });

    if (phase !== "cli-check" && phase !== "cli-install") {
      log("Not in CLI phase, skipping state update");
      return;
    }

    // Handle successful CLI state
    if (cliState === "success" && cliIsInstalled) {
      log("CLI check successful! Version:", cliCurrentVersion);
      setEnvState((s) => ({
        ...s,
        cli: {
          status: "success",
          version: cliCurrentVersion || undefined,
        },
      }));
      setProgress(100);
      log("Phase transition: -> done");
      setPhase("done");
      return;
    }

    // Handle error state
    if (cliState === "error" && cliIssue) {
      log("CLI check failed:", cliIssue);
      setEnvState((s) => ({
        ...s,
        cli: {
          status: "error",
          error: {
            title: cliIssue.title || "错误",
            message: cliIssue.message || "未知错误",
            details: cliIssue.details,
          },
        },
      }));
      log("Phase transition: -> error (CLI failed)");
      setPhase("error");
      return;
    }

    log("CLI state not yet resolved, waiting...");
  }, [phase, cliState, cliIsInstalled, cliCurrentVersion, cliIssue]);

  // Handle CLI not installed - trigger install
  React.useEffect(() => {
    log("CLI install trigger check:", { phase, cliState, cliIsInstalled, cliIssue, envCliStatus: envState.cli.status });

    // Only trigger install when:
    // 1. We're in cli-check phase
    // 2. CLI hook finished checking and found it's not installed (cliState === "error" with missing-cli issue)
    // 3. We haven't already started installing
    if (
      phase === "cli-check" &&
      cliState === "error" &&
      !cliIsInstalled &&
      cliIssue?.kind === "missing-cli"
    ) {
      log("CLI not installed, triggering installation...");
      const doInstall = async () => {
        log("Phase transition: cli-check -> cli-install");
        setPhase("cli-install");
        setEnvState((s) => ({ ...s, cli: { status: "checking" } }));
        setProgress(70);
        try {
          log("Starting CLI installation...");
          await installCli();
          log("CLI installation call completed");
        } catch (err) {
          log("CLI install error:", err);
        }
      };
      // Small delay to allow hook state to settle
      const timer = setTimeout(doInstall, 100);
      return () => clearTimeout(timer);
    }
  }, [phase, cliState, cliIsInstalled, cliIssue, installCli, envState.cli.status]);

  // Auto-start check on mount
  React.useEffect(() => {
    log("Auto-start check, phase:", phase);
    if (phase === "initial") {
      log("Phase is initial, starting env check");
      runEnvCheck();
    }
  }, [phase, runEnvCheck]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRetry = () => {
    log("handleRetry called, retryCount:", retryCount, "maxRetries:", maxRetries);
    if (retryCount >= maxRetries) {
      log("Max retries reached, ignoring");
      return;
    }
    setRetryCount((c) => c + 1);
    setEnvState({
      node: { status: "pending" },
      cli: { status: "pending" },
    });
    log("Resetting to initial phase for retry");
    setPhase("initial");
    checkRunRef.current = false;
    runEnvCheck();
  };

  const handleCancel = (domain: "node-check" | "node-install" | "cli-check" | "cli-install") => {
    log("handleCancel called for domain:", domain);
    cancellationRef.current.cancel(domain, "user-requested");
  };

  const handleContinue = () => {
    log("handleContinue called, proceeding to onComplete");
    onComplete();
  };

  const canContinue = phase === "done";
  const canRetry = phase === "error" && retryCount < maxRetries;

  // Get support actions for current error
  const supportActions = phase === "error"
    ? getEnvCheckSupportActionsForIssueKind(nodeIssue?.kind || cliIssue?.kind)
    : [];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("onboarding.envCheck.title")}</h2>
        <p className="mt-2 text-muted-foreground">
          {t("onboarding.envCheck.description")}
        </p>
      </div>

      {/* Progress Bar */}
      {isChecking && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-sm text-muted-foreground animate-fade-in">
            {ENV_CHECK_UI_POLICY.loadingTips[tipIndex]}
          </p>
        </div>
      )}

      {/* Step Items */}
      <div className="space-y-3">
        <EnvCheckStepItem
          title="Node.js"
          status={envState.node.status}
          tooltip={ENV_CHECK_STEP_TOOLTIPS.node}
          version={envState.node.version}
          path={envState.node.path}
          error={envState.node.error}
          onRetry={envState.node.status === "error" ? handleRetry : undefined}
          onCancel={
            phase === "node-check" || phase === "node-install"
              ? () => handleCancel(phase as "node-check" | "node-install")
              : undefined
          }
        />

        <EnvCheckStepItem
          title="Viben CLI"
          status={envState.cli.status}
          tooltip={ENV_CHECK_STEP_TOOLTIPS.viben}
          version={envState.cli.version}
          path={envState.cli.path}
          error={envState.cli.error}
          onRetry={envState.cli.status === "error" ? handleRetry : undefined}
          onCancel={
            phase === "cli-check" || phase === "cli-install"
              ? () => handleCancel(phase as "cli-check" | "cli-install")
              : undefined
          }
        />
      </div>

      {/* Support Actions */}
      {supportActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {supportActions.map((action, i) => (
            <a
              key={i}
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {action.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div>
          {onBack && (
            <Button variant="ghost" onClick={onBack} disabled={isChecking}>
              {t("common.back")}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {canRetry && (
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common.retry")} ({maxRetries - retryCount})
            </Button>
          )}
          <Button onClick={handleContinue} disabled={!canContinue}>
            {t("common.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
