/**
 * EnvCheck Page Component
 *
 * Separated environment check page for Node.js and CLI
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EnvCheckStepItem, type EnvCheckStepStatus } from "./env-check-step-item";
import { useNodeInstaller } from "@/hooks/use-node-installer";
import { useCliInstaller } from "@/hooks/use-cli-installer";
import { LoadingScreen } from "./loading-screen";
import {
  ENV_CHECK_UI_POLICY,
  ENV_CHECK_STEP_TOOLTIPS,
  getEnvCheckSupportActionsForIssueKind,
} from "@/lib/onboarding/env-check-policy";
import {
  CancellationRegistry,
  isCancellationError,
} from "@/lib/onboarding/cancellation";

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

  // Hooks
  const {
    state: nodeState,
    issue: nodeIssue,
    currentVersion: nodeVersion,
    checkNode,
    installNode,
  } = useNodeInstaller();

  const {
    state: cliState,
    issue: cliIssue,
    currentVersion: cliVersion,
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
    return () => {
      cancellationRef.current.dispose();
    };
  }, []);

  // ============================================================================
  // Environment Check Flow
  // ============================================================================

  const runEnvCheck = React.useCallback(async () => {
    if (checkRunRef.current) return;
    checkRunRef.current = true;

    const registry = cancellationRef.current;
    registry.cancelAll("superseded");

    setProgress(10);

    // Phase 1: Check Node.js
    setPhase("node-check");
    setEnvState((s) => ({ ...s, node: { status: "checking" } }));

    try {
      const nodeController = registry.getOrCreate("node-check");
      const nodeResult = await nodeController.race(checkNode());

      if (nodeResult.installed) {
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
        setPhase("node-install");
        setEnvState((s) => ({ ...s, node: { status: "checking" } }));

        const installController = registry.getOrCreate("node-install");
        await installController.race(installNode());

        // Re-check after install
        const recheck = await checkNode();
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
      if (isCancellationError(err)) {
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
            details: error.details,
          },
        },
      }));
      setPhase("error");
      checkRunRef.current = false;
      return;
    }

    // Phase 2: Check CLI
    setPhase("cli-check");
    setEnvState((s) => ({ ...s, cli: { status: "checking" } }));
    setProgress(50);

    try {
      const cliController = registry.getOrCreate("cli-check");
      const cliResult = await cliController.race(checkCli());

      if (cliResult.installed) {
        setEnvState((s) => ({
          ...s,
          cli: {
            status: "success",
            version: cliResult.version,
            path: cliResult.path,
          },
        }));
        setProgress(100);
        setPhase("done");
      } else {
        // Need to install CLI
        setPhase("cli-install");
        setProgress(70);

        const installController = registry.getOrCreate("cli-install");
        await installController.race(installCli());

        // Re-check after install
        const recheck = await checkCli();
        if (recheck.installed) {
          setEnvState((s) => ({
            ...s,
            cli: {
              status: "success",
              version: recheck.version,
              path: recheck.path,
            },
          }));
          setProgress(100);
          setPhase("done");
        } else {
          throw new Error("CLI installation failed");
        }
      }
    } catch (err) {
      if (isCancellationError(err)) {
        setEnvState((s) => ({ ...s, cli: { status: "pending" } }));
        checkRunRef.current = false;
        return;
      }

      const error = cliIssue || {
        title: "Viben CLI 检查失败",
        message: err instanceof Error ? err.message : String(err),
      };

      setEnvState((s) => ({
        ...s,
        cli: {
          status: "error",
          error: {
            title: error.title || "错误",
            message: error.message || "未知错误",
            details: error.details,
          },
        },
      }));
      setPhase("error");
    }

    checkRunRef.current = false;
  }, [checkNode, installNode, checkCli, installCli, nodeIssue, cliIssue]);

  // Auto-start check on mount
  React.useEffect(() => {
    if (phase === "initial") {
      runEnvCheck();
    }
  }, [phase, runEnvCheck]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRetry = () => {
    if (retryCount >= maxRetries) return;
    setRetryCount((c) => c + 1);
    setEnvState({
      node: { status: "pending" },
      cli: { status: "pending" },
    });
    setPhase("initial");
    checkRunRef.current = false;
    runEnvCheck();
  };

  const handleCancel = (domain: "node-check" | "node-install" | "cli-check" | "cli-install") => {
    cancellationRef.current.cancel(domain, "user-requested");
  };

  const handleContinue = () => {
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
