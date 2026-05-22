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
import { useGatewaySetup } from "@/hooks/use-gateway-setup";
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
  const handleStepRetry = (_stepId: string) => {
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
