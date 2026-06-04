/**
 * Gateway Setup Hook
 *
 * Simplified orchestration for onboarding step 2:
 * 1. Check gateway health (fast path: if running, done!)
 * 2. Try bundled CLI restart (medium path)
 * 3. Fall back to manual install (slow path: Node.js -> CLI -> Gateway)
 *
 * Features:
 * - Progressive step display (only show what's needed)
 * - Auto-retry with countdown (max 3 attempts, 5s interval)
 * - Rich error messages with suggestions
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { checkBundledCli } from "@/lib/onboarding/bundled-cli";
import { getGatewayClient } from "@/lib/gateway";
import { useGateway } from "./use-gateway";
import { useNodeInstaller } from "./use-node-installer";
import { useCliInstaller } from "./use-cli-installer";
import type { NodeInfo } from "./use-node-installer";

// Debug logging
const log = (msg: string, ...args: unknown[]) => {
  console.log(`[useGatewaySetup] ${msg}`, ...args);
};

// Types
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
  steps: SetupStep[];
  isComplete: boolean;
  inManualMode: boolean;
  startSetup: () => void;
  retry: () => void;
  nodejsVersions: NodeInfo[];
  selectedNodePath: string | null;
  selectNodePath: (path: string) => void;
  showNodeSelector: boolean;
  isNodeScanLoading: boolean;
  maxRetries: number;
  scanNodeInstallations: () => Promise<void>;
}

export const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 5000;

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

  // Step Management
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
      if (prev.some((s) => s.id === step.id)) return prev;
      return [...prev, step];
    });
  }, []);

  // Auto-retry Logic
  const startRetryCountdown = useCallback(
    (stepId: StepId, onRetry: () => void) => {
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

  // Core Setup Logic
  const checkGatewayHealth = useCallback(async (): Promise<boolean> => {
    log("Checking gateway health...");
    try {
      const response = await getGatewayClient().request<Response>("/health", {
        method: "GET",
        signal: AbortSignal.timeout(3000),
        responseType: "response",
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // Forward declarations for mutual recursion
  const runCliInstallRef = useRef<((nodePath?: string) => Promise<void>) | null>(null);
  const runGatewayStartRef = useRef<((nodePath?: string, retryCount?: number) => Promise<void>) | null>(null);
  const runVerifyConnectionRef = useRef<((retryCount?: number) => Promise<void>) | null>(null);

  const runSetup = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    log("Starting setup...");

    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    setSteps([]);
    setIsComplete(false);
    setInManualMode(false);
    setShowNodeSelector(false);
    setSelectedNodePath(null);

    // Step 1: Check if gateway is already running
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

    // Step 2: Try bundled CLI
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
    }

    // Step 3: Manual install mode
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

    await new Promise((r) => setTimeout(r, 500));

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
      await runCliInstallRef.current?.(nodeResult.path || undefined);
    } else {
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

  // CLI Install
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

      updateStep("cli", {
        label: `Viben CLI ${effectiveCliResult.version || "installed"}`,
        state: "success",
        detail: effectiveCliResult.path || undefined,
      });

      await runGatewayStartRef.current?.(nodePath);
    },
    [t, addStep, updateStep, checkCli, installCli]
  );

  // Gateway Start (manual mode)
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
        await runVerifyConnectionRef.current?.(retryCount);
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
            runGatewayStartRef.current?.(nodePath, retryCount + 1);
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

  // Verify Connection
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
            runVerifyConnectionRef.current?.(retryCount + 1);
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

  // Assign refs for mutual recursion
  runCliInstallRef.current = runCliInstall;
  runGatewayStartRef.current = runGatewayStart;
  runVerifyConnectionRef.current = runVerifyConnection;

  // User Actions
  const startSetup = useCallback(() => {
    runSetup();
  }, [runSetup]);

  const retry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    isRunningRef.current = false;
    runSetup();
  }, [runSetup]);

  const selectNodePath = useCallback(
    async (path: string) => {
      if (isRunningRef.current) {
        log("selectNodePath: already running, ignoring");
        return;
      }

      log("User selected Node.js path:", path);
      setSelectedNodePath(path);
      setShowNodeSelector(false);

      updateStep("nodejs", {
        label: t("onboarding.gatewaySetup.nodejsSelected", "Node.js 已选择"),
        state: "success",
        detail: path,
      });

      isRunningRef.current = true;
      await runCliInstall(path);
    },
    [t, updateStep, runCliInstall]
  );

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
