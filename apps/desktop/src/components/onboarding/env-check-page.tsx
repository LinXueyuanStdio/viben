/**
 * EnvCheck Page Component
 *
 * Environment check page using DAG orchestration.
 * Displays all check items with their dependencies and status.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, ExternalLink } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EnvCheckStepItem } from "./env-check-step-item";
import { CommandDetails, type DetailItem } from "./command-details";
import { NodejsSection, PythonSection, AiClientsSection } from "./env-check-sections";
import { useEnvOrchestrator } from "@/hooks/use-env-orchestrator";
import { useAppStore } from "@/stores";
import {
  ENV_CHECK_UI_POLICY,
  getEnvCheckSupportActionsForIssueKind,
} from "@/lib/onboarding/env-check-policy";
import type { CheckNode, CheckNodeState } from "@/lib/onboarding/check-dag";

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

// ============================================================================
// Component
// ============================================================================

export function EnvCheckPage({ onComplete, onBack }: EnvCheckPageProps) {
  const { t } = useTranslation();
  const orchestrator = useEnvOrchestrator();
  const { pythonPath, setPythonPath } = useAppStore();

  log("Component rendering", {
    isRunning: orchestrator.isRunning,
    isComplete: orchestrator.isComplete,
    hasError: orchestrator.hasError,
    progress: orchestrator.progress,
  });

  // State for Python section
  const [customPythonPath, setCustomPythonPath] = React.useState("");
  // State for Node.js section
  const [customNodejsPath, setCustomNodejsPath] = React.useState("");
  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>({});
  const [tipIndex, setTipIndex] = React.useState(0);

  // Track whether we've started checks
  const hasStartedRef = React.useRef(false);

  // ============================================================================
  // Loading Tips Rotation
  // ============================================================================

  React.useEffect(() => {
    if (!orchestrator.isRunning) return;

    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % ENV_CHECK_UI_POLICY.loadingTips.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [orchestrator.isRunning]);

  // ============================================================================
  // Auto-start on mount
  // ============================================================================

  React.useEffect(() => {
    if (!hasStartedRef.current) {
      log("Auto-starting environment checks");
      hasStartedRef.current = true;
      orchestrator.startChecks();
    }
  }, [orchestrator.startChecks]);

  // ============================================================================
  // Auto-expand nodes with selector content types when check completes
  // ============================================================================

  // Track which nodes we've already auto-expanded to avoid repeated expansions
  const autoExpandedRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    // Auto-expand nodejs-selector or python-selector nodes when check completes
    // so users can see the logs and selection options
    for (const node of orchestrator.nodes) {
      const isCompletedStatus = node.nodeState.status === "error" ||
                                node.nodeState.status === "success" ||
                                node.nodeState.status === "warning";
      const isSelectorType = node.contentType === "nodejs-selector" ||
                             node.contentType === "python-selector";

      if (isSelectorType && isCompletedStatus && !autoExpandedRef.current.has(node.id)) {
        log(`Auto-expanding ${node.id} due to ${node.nodeState.status} state`);
        autoExpandedRef.current.add(node.id);
        setExpandedNodes((prev) => ({ ...prev, [node.id]: true }));
      }
    }
  }, [orchestrator.nodes]); // Remove expandedNodes from deps to avoid loop

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleBrowsePython = async () => {
    try {
      const result = await openDialog({
        title: t("onboarding.python.selectPython"),
        filters: [{ name: "Python", extensions: ["*"] }],
      });
      if (result) {
        // result can be string (single file) or string[] (multiple files) or null
        const path = typeof result === "string" ? result : Array.isArray(result) ? result[0] : null;
        if (path) {
          setCustomPythonPath(path);
          setPythonPath(path);
        }
      }
    } catch (err) {
      console.error("Failed to browse for Python:", err);
    }
  };

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
          // Check the custom path
          orchestrator.checkNodeAtPath(path);
        }
      }
    } catch (err) {
      console.error("Failed to browse for Node.js:", err);
    }
  };

  const handleCheckCustomNodejsPath = async () => {
    if (customNodejsPath.trim()) {
      await orchestrator.checkNodeAtPath(customNodejsPath.trim());
    }
  };

  const handleRetry = () => {
    log("Retrying all checks");
    hasStartedRef.current = false;
    orchestrator.startChecks();
  };

  const handleContinue = () => {
    log("Continuing to next step");
    onComplete();
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Build version/summary/detailItems from node state data
   */
  const getNodeDisplayInfo = (
    nodeId: string,
    nodeState: CheckNodeState
  ): { version?: string; summary?: string; detailItems?: DetailItem[] } => {
    const data = nodeState.data as Record<string, unknown> | undefined;

    switch (nodeId) {
      case "nodejs": {
        const nodejsData = data as { version?: string; path?: string } | undefined;
        const items: DetailItem[] = [];
        if (nodejsData?.path) {
          items.push({ label: t("common.path"), value: nodejsData.path, copyable: true });
        }
        return {
          version: nodejsData?.version,
          detailItems: items.length > 0 ? items : undefined,
        };
      }
      case "cli": {
        const cliData = data as { version?: string; path?: string } | undefined;
        const items: DetailItem[] = [];
        if (cliData?.path) {
          items.push({ label: t("common.path"), value: cliData.path, copyable: true });
        }
        return {
          version: cliData?.version,
          detailItems: items.length > 0 ? items : undefined,
        };
      }
      case "gateway": {
        const gatewayData = data as { url?: string; pid?: number; running?: boolean; command?: string; binary_path?: string } | undefined;
        const items: DetailItem[] = [];
        if (gatewayData?.running) {
          items.push({ label: t("onboarding.envCheck.labels.url", "URL"), value: gatewayData.url || "http://127.0.0.1:18790", copyable: true });
          if (gatewayData.pid) {
            items.push({ label: t("common.pid", "PID"), value: String(gatewayData.pid), copyable: false });
          }
          if (gatewayData.binary_path) {
            items.push({ label: t("onboarding.envCheck.labels.binary", "Binary"), value: gatewayData.binary_path, copyable: true });
          }
          if (gatewayData.command) {
            items.push({ label: t("onboarding.envCheck.labels.command", "Command"), value: gatewayData.command, copyable: true });
          }
        }
        return {
          summary: nodeState.status === "success" ? t("onboarding.envCheck.gatewayRunning") : undefined,
          detailItems: items.length > 0 ? items : undefined,
        };
      }
      case "connection": {
        return {
          summary: nodeState.status === "success" ? t("onboarding.envCheck.connected") : undefined,
          detailItems: nodeState.status === "success"
            ? [{ label: t("common.status"), value: t("onboarding.envCheck.connectionDetails"), copyable: false }]
            : undefined,
        };
      }
      case "python": {
        const pythonData = data as { version?: string; path?: string; source?: string } | undefined;
        const items: DetailItem[] = [];
        if (pythonData?.path) {
          items.push({ label: t("common.path"), value: pythonData.path, copyable: true });
        }
        if (pythonData?.source) {
          items.push({ label: t("onboarding.python.source"), value: pythonData.source, copyable: false });
        }
        return {
          version: pythonData?.version,
          summary:
            nodeState.status === "warning"
              ? t("onboarding.python.notFound")
              : undefined,
          detailItems: items.length > 0 ? items : undefined,
        };
      }
      case "executors": {
        const executorData = data as unknown[] | undefined;
        const count = Array.isArray(executorData) ? executorData.length : 0;
        return {
          summary:
            nodeState.status === "success"
              ? t("onboarding.claude.clientsFound", { count })
              : nodeState.status === "warning"
                ? t("onboarding.claude.noClients")
                : undefined,
        };
      }
      default:
        return {};
    }
  };

  /**
   * Parse error into short message and details
   * Long errors (>100 chars or multi-line) should show brief message with details in expandable section
   */
  const parseError = (error: string | undefined): { title: string; message: string; details?: string } | undefined => {
    if (!error) return undefined;

    const isLongError = error.length > 100 || error.includes("\n");

    if (isLongError) {
      // Extract first line or first 80 chars as the brief message
      const firstLine = error.split("\n")[0];
      const briefMessage = firstLine.length > 80
        ? firstLine.slice(0, 80) + "..."
        : firstLine;

      return {
        title: t("common.error"),
        message: briefMessage,
        details: error, // Full error in details
      };
    }

    return {
      title: t("common.error"),
      message: error,
    };
  };

  /**
   * Get checking message for each node
   */
  const getCheckingMessage = (nodeId: string): string => {
    switch (nodeId) {
      case "nodejs":
        return t("onboarding.envCheck.checkingNodejs");
      case "cli":
        return t("onboarding.envCheck.checkingCli");
      case "gateway":
        return t("onboarding.envCheck.startingGateway");
      case "connection":
        return t("onboarding.envCheck.verifyingConnection");
      case "python":
        return t("onboarding.envCheck.detectingPython");
      case "executors":
        return t("onboarding.envCheck.detectingClients");
      default:
        return t("common.checking");
    }
  };

  /**
   * Render a single node
   */
  const renderNode = (node: CheckNode & { nodeState: CheckNodeState }) => {
    const { nodeState, id, label, tooltip, optional, contentType } = node;
    const { version, summary, detailItems } = getNodeDisplayInfo(id, nodeState);
    const errorInfo = parseError(nodeState.error);
    const checkingMessage = getCheckingMessage(id);

    // Get progress for nodejs node
    const nodeProgress =
      id === "nodejs" && nodeState.status === "checking"
        ? orchestrator.nodeInstallerProgress
        : undefined;

    return (
      <EnvCheckStepItem
        key={id}
        title={label}
        status={nodeState.status}
        tooltip={tooltip}
        optional={optional}
        version={version}
        summary={summary}
        checkingMessage={checkingMessage}
        error={errorInfo}
        expanded={expandedNodes[id]}
        onExpandedChange={(exp) =>
          setExpandedNodes((prev) => ({ ...prev, [id]: exp }))
        }
        onRetry={
          // Don't show retry button for nodejs-selector when there's an error
          // (user should select a different Node.js version instead)
          nodeState.status === "error" && contentType !== "nodejs-selector"
            ? () => orchestrator.retryNode(id)
            : undefined
        }
        onSkip={optional ? () => orchestrator.skipNode(id) : undefined}
        contentType={contentType}
        progress={nodeProgress ?? undefined}
      >
        {/* Operation logs - show during checking or when there are logs */}
        {nodeState.logs && nodeState.logs.length > 0 && (
          <div className="mb-3 rounded bg-muted/50 p-2 font-mono text-xs">
            {nodeState.logs.map((logLine, idx) => (
              <div key={idx} className={logLine.startsWith("$") ? "text-primary" : "text-muted-foreground"}>
                {logLine}
              </div>
            ))}
          </div>
        )}
        {/* Detail items for simple content types */}
        {detailItems && detailItems.length > 0 && contentType === "simple" && (
          <CommandDetails items={detailItems} />
        )}
        {contentType === "nodejs-selector" && (nodeState.status === "error" || nodeState.status === "success" || nodeState.status === "warning") && (
          <>
            {detailItems && detailItems.length > 0 && (
              <CommandDetails items={detailItems} className="mb-3" />
            )}
            <NodejsSection
              nodeVersions={orchestrator.nodejsData.nodes}
              selectedPath={orchestrator.nodejsData.selectedPath}
              onSelect={orchestrator.selectNodePath}
              customPath={customNodejsPath}
              onCustomPathChange={(path) => {
                setCustomNodejsPath(path);
                orchestrator.setNodeCustomPathError(null);
              }}
              onBrowse={handleBrowseNodejs}
              isCheckingCustomPath={orchestrator.nodejsData.checkingCustomPath}
              customPathError={orchestrator.nodejsData.customPathError}
              onCheckCustomPath={handleCheckCustomNodejsPath}
              isLoading={orchestrator.nodejsData.loading}
              onRefresh={() => orchestrator.scanNodeInstallations()}
              requiredVersion={orchestrator.nodejsData.requiredVersion}
            />
          </>
        )}
        {contentType === "python-selector" && (
          <>
            {detailItems && detailItems.length > 0 && (
              <CommandDetails items={detailItems} className="mb-3" />
            )}
            <PythonSection
              pythonVersions={orchestrator.pythonData.pythons}
              selectedPath={pythonPath}
              onSelect={setPythonPath}
              customPath={customPythonPath}
              onCustomPathChange={setCustomPythonPath}
              onBrowse={handleBrowsePython}
              isLoading={orchestrator.pythonData.loading}
              onRefresh={() => orchestrator.retryNode("python")}
            />
          </>
        )}
        {contentType === "client-list" && (
          <AiClientsSection
            executors={orchestrator.executorsData.executors}
            isLoading={orchestrator.executorsData.loading}
            error={orchestrator.executorsData.error}
            onRefresh={() => orchestrator.retryNode("executors")}
          />
        )}
      </EnvCheckStepItem>
    );
  };

  // Get support actions for any error state
  const supportActions = orchestrator.hasError
    ? getEnvCheckSupportActionsForIssueKind(undefined)
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
      {orchestrator.isRunning && (
        <div className="space-y-2">
          <Progress value={orchestrator.progress} className="h-2" />
          <p className="text-center text-sm text-muted-foreground animate-fade-in">
            {ENV_CHECK_UI_POLICY.loadingTips[tipIndex]}
          </p>
        </div>
      )}

      {/* Nodes */}
      <div className="space-y-3">{orchestrator.nodes.map(renderNode)}</div>

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
            <Button variant="ghost" onClick={onBack} disabled={orchestrator.isRunning}>
              {t("common.back")}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {orchestrator.hasError && !orchestrator.isRunning && (
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common.retry")}
            </Button>
          )}
          <Button onClick={handleContinue} disabled={!orchestrator.isComplete}>
            {t("common.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
