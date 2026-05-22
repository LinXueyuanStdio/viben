/**
 * Environment Orchestrator Hook
 *
 * Orchestrates environment checks using DAG-based execution.
 * Composes existing hooks and executes checks in dependency order.
 */

import { useReducer, useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ENV_CHECK_NODES,
  getInitialDAGState,
  updateNodeStatus,
  getReadyNodes,
  calculateOverallProgress,
  allRequiredComplete,
  hasRequiredError,
  type DAGState,
  type CheckNode,
  type CheckNodeState,
  type CheckNodeStatus,
} from "@/lib/onboarding/check-dag";
import {
  CancellationRegistry,
  isCancellationError,
} from "@/lib/onboarding/cancellation";
import {
  checkBundledCli,
  type BundledCliResult,
} from "@/lib/onboarding/bundled-cli";
import { useNodeInstaller, type NodeInfo, type NodeCheckResult } from "./use-node-installer";
import { useCliInstaller } from "./use-cli-installer";
import { useGateway } from "./use-gateway";
import { useGatewayStatus } from "./use-gateway-status";
import { usePython } from "./use-python";
import { useExecutors } from "./use-workspace-resources";
import type { PythonInfo, PythonPackageInfo, ExecutorInfo } from "@/lib/gateway";

// Debug logging helper
const log = (message: string, ...args: unknown[]) => {
  console.log(`[useEnvOrchestrator] ${message}`, ...args);
};

// ============================================================================
// Types
// ============================================================================

export interface UseEnvOrchestratorReturn {
  /** DAG state */
  state: DAGState;
  /** Overall progress 0-100 */
  progress: number;
  /** Whether all required items are complete */
  isComplete: boolean;
  /** Whether any required item has failed */
  hasError: boolean;
  /** Whether checks are currently running */
  isRunning: boolean;
  /** Node list with states */
  nodes: Array<CheckNode & { nodeState: CheckNodeState }>;

  /** Start all checks */
  startChecks: () => void;
  /** Retry a specific node */
  retryNode: (nodeId: string) => void;
  /** Skip an optional node */
  skipNode: (nodeId: string) => void;
  /** Cancel all checks */
  cancelAll: () => void;

  /** Node.js related data (for expanded content) */
  nodejsData: {
    nodes: NodeInfo[];
    selectedPath: string | null;
    loading: boolean;
    requiredVersion: string;
    checkingCustomPath: boolean;
    customPathError: string | null;
  };

  /** Python related data (for expanded content) */
  pythonData: {
    pythons: PythonInfo[];
    selectedPython: PythonInfo | null;
    browseMcpInfo: PythonPackageInfo | null;
    loading: boolean;
  };

  /** AI clients related data (for expanded content) */
  executorsData: {
    executors: ExecutorInfo[];
    loading: boolean;
    error: string | null;
  };

  /** Node.js installer progress (for progress bar) */
  nodeInstallerProgress: {
    percent: number;
    message: string;
  } | null;

  /** Scan Node.js installations */
  scanNodeInstallations: () => Promise<void>;

  /** Check Node.js at custom path */
  checkNodeAtPath: (path: string) => Promise<NodeCheckResult>;

  /** Select a Node.js installation */
  selectNodePath: (path: string) => void;

  /** Set custom path error */
  setNodeCustomPathError: (error: string | null) => void;
}

// ============================================================================
// Reducer
// ============================================================================

type OrchestratorAction =
  | { type: "RESET" }
  | { type: "START" }
  | { type: "UPDATE_NODE"; nodeId: string; status: CheckNodeStatus; error?: string; data?: unknown }
  | { type: "APPEND_LOG"; nodeId: string; log: string }
  | { type: "SET_RUNNING"; running: boolean };

interface OrchestratorState {
  dagState: DAGState;
  isRunning: boolean;
}

function orchestratorReducer(state: OrchestratorState, action: OrchestratorAction): OrchestratorState {
  switch (action.type) {
    case "RESET":
      return {
        dagState: getInitialDAGState(ENV_CHECK_NODES),
        isRunning: false,
      };

    case "START":
      return {
        ...state,
        isRunning: true,
      };

    case "UPDATE_NODE": {
      const newDagState = updateNodeStatus(
        state.dagState,
        action.nodeId,
        action.status,
        ENV_CHECK_NODES,
        action.error,
        action.data
      );
      return {
        ...state,
        dagState: newDagState,
      };
    }

    case "APPEND_LOG": {
      const currentNode = state.dagState.nodeStates[action.nodeId];
      const currentLogs = currentNode?.logs || [];
      return {
        ...state,
        dagState: {
          ...state.dagState,
          nodeStates: {
            ...state.dagState.nodeStates,
            [action.nodeId]: {
              ...currentNode,
              logs: [...currentLogs, action.log],
            },
          },
        },
      };
    }

    case "SET_RUNNING":
      return {
        ...state,
        isRunning: action.running,
      };

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useEnvOrchestrator(): UseEnvOrchestratorReturn {
  const { t } = useTranslation();

  // Initialize state
  const [state, dispatch] = useReducer(orchestratorReducer, {
    dagState: getInitialDAGState(ENV_CHECK_NODES),
    isRunning: false,
  });

  // Cancellation registry
  const cancellationRef = useRef(new CancellationRegistry());

  // Track running nodes to prevent duplicate execution
  const runningNodesRef = useRef(new Set<string>());

  // Compose hooks
  const nodeInstaller = useNodeInstaller();
  const cliInstaller = useCliInstaller();
  const gateway = useGateway();
  const gatewayStatus = useGatewayStatus();
  const python = usePython();
  const executors = useExecutors({ includeGlobal: true });

  // Bundled CLI state
  const [bundledCli, setBundledCli] = useState<BundledCliResult | null>(null);
  const bundledCliCheckedRef = useRef(false);

  // Node.js data state
  const [nodejsNodes, setNodejsNodes] = useState<NodeInfo[]>([]);
  const [nodejsSelectedPath, setNodejsSelectedPath] = useState<string | null>(null);
  const [nodejsLoading, setNodejsLoading] = useState(false);
  const [nodejsRequiredVersion, setNodejsRequiredVersion] = useState("22.16.0");
  const [nodejsCheckingCustomPath, setNodejsCheckingCustomPath] = useState(false);
  const [nodejsCustomPathError, setNodejsCustomPathError] = useState<string | null>(null);

  // Use ref to track the selected Node.js path synchronously
  // This avoids race conditions where CLI check starts before React state updates
  const nodejsSelectedPathRef = useRef<string | null>(null);

  // Helper to update Node.js selected path (both state and ref)
  const updateNodejsSelectedPath = useCallback((path: string | null) => {
    log(`updateNodejsSelectedPath: ${path}`);
    nodejsSelectedPathRef.current = path;
    setNodejsSelectedPath(path);
  }, []);

  // Update node status helper
  const updateNode = useCallback(
    (nodeId: string, status: CheckNodeStatus, error?: string, data?: unknown) => {
      log(`updateNode: ${nodeId} -> ${status}`, error ? `error: ${error}` : "");
      dispatch({ type: "UPDATE_NODE", nodeId, status, error, data });
      runningNodesRef.current.delete(nodeId);
    },
    []
  );

  // Append log to node
  const appendLog = useCallback((nodeId: string, logMsg: string) => {
    log(`appendLog: ${nodeId} - ${logMsg}`);
    dispatch({ type: "APPEND_LOG", nodeId, log: logMsg });
  }, []);

  // Execute a single node check
  const executeNode = useCallback(
    async (nodeId: string) => {
      // Prevent duplicate execution
      if (runningNodesRef.current.has(nodeId)) {
        log(`executeNode: ${nodeId} already running, skipping`);
        return;
      }

      runningNodesRef.current.add(nodeId);
      log(`executeNode: starting ${nodeId}`);
      updateNode(nodeId, "checking");

      try {
        switch (nodeId) {
          case "nodejs": {
            // macOS: First check Git/Xcode CLT (参考 Qclaw)
            const isMacOS = navigator.platform.toLowerCase().includes("mac");
            if (isMacOS) {
              appendLog(nodeId, "$ git --version (checking Xcode CLT)");
              const macGitResult = await nodeInstaller.prepareMacGitTools();
              if (!macGitResult.ok) {
                if (macGitResult.error_code === "xcode_clt_pending") {
                  appendLog(
                    nodeId,
                    `⚠ ${t("onboarding.orchestrator.xcodeCltInstalling", "Xcode Command Line Tools 安装中，请完成后重试")}`
                  );
                  updateNode(
                    nodeId,
                    "error",
                    t("onboarding.orchestrator.xcodeCltRetry", "请先完成 Xcode Command Line Tools 安装，再点击「重试」")
                  );
                  break;
                } else {
                  appendLog(
                    nodeId,
                    `✗ ${t("onboarding.orchestrator.gitToolsFailed", "Git 工具准备失败")}: ${macGitResult.stderr}`
                  );
                  updateNode(
                    nodeId,
                    "error",
                    macGitResult.stderr || "Git tools preparation failed"
                  );
                  break;
                }
              }
              appendLog(nodeId, "✓ Git/Xcode CLT available");
            }

            // Check Node.js (find_executable: which + known paths + nvm/fnm/volta)
            appendLog(nodeId, "$ which node  (+ known paths, nvm/fnm/volta)");
            appendLog(nodeId, "$ node --version");
            const result = await nodeInstaller.checkNode();

            if (result.installed && !result.needsUpgrade) {
              appendLog(nodeId, `✓ Node.js ${result.version} found at ${result.path}`);
              // Scan all Node.js installations for user reference
              appendLog(nodeId, "Scanning all Node.js installations...");
              try {
                const scanResult = await nodeInstaller.scanNodeInstallations();
                let nodes = scanResult.nodes;

                // Ensure the currently found node is in the list
                if (result.path && !nodes.some((n) => n.path === result.path)) {
                  nodes = [
                    {
                      path: result.path,
                      version: result.version,
                      is_valid: true,
                      source: "current",
                    },
                    ...nodes,
                  ];
                }

                setNodejsNodes(nodes);
                setNodejsRequiredVersion(scanResult.required_version);
                updateNodejsSelectedPath(result.path || null);
                appendLog(
                  nodeId,
                  `✓ ${t("onboarding.orchestrator.foundNodeInstalls", { defaultValue: "发现 {{count}} 个 Node.js 安装", count: nodes.length })}`
                );
              } catch (scanErr) {
                // Even if scan fails, show the current node
                if (result.path) {
                  setNodejsNodes([
                    {
                      path: result.path,
                      version: result.version,
                      is_valid: true,
                      source: "current",
                    },
                  ]);
                  updateNodejsSelectedPath(result.path);
                }
                appendLog(nodeId, `⚠ ${t("onboarding.orchestrator.scanFailed", "扫描其他安装失败")}: ${scanErr}`);
              }
              updateNode(nodeId, "success", undefined, result);
              break;
            }

            if (result.installed && result.needsUpgrade) {
              appendLog(
                nodeId,
                `⚠ ${t("onboarding.orchestrator.nodeVersionTooLow", { defaultValue: "Node.js {{version}} 版本过低 (at {{path}})，请选择其他版本", version: result.version, path: result.path })}`
              );
              // Scan all Node.js installations for user to select
              appendLog(nodeId, "Scanning all Node.js installations...");
              try {
                const scanResult = await nodeInstaller.scanNodeInstallations();
                let nodes = scanResult.nodes;

                // Ensure the currently found (low version) node is in the list
                if (result.path && !nodes.some((n) => n.path === result.path)) {
                  nodes = [
                    ...nodes,
                    {
                      path: result.path,
                      version: result.version,
                      is_valid: false, // version too low
                      source: "current",
                    },
                  ];
                }

                setNodejsNodes(nodes);
                setNodejsRequiredVersion(scanResult.required_version);
                appendLog(
                  nodeId,
                  `✓ ${t("onboarding.orchestrator.foundNodeInstalls", { defaultValue: "发现 {{count}} 个 Node.js 安装", count: nodes.length })}`
                );
              } catch (scanErr) {
                // Even if scan fails, show the current node
                if (result.path) {
                  setNodejsNodes([
                    {
                      path: result.path,
                      version: result.version,
                      is_valid: false,
                      source: "current",
                    },
                  ]);
                }
                appendLog(nodeId, `⚠ ${t("onboarding.orchestrator.scanFailed", "扫描其他安装失败")}: ${scanErr}`);
              }
              updateNode(
                nodeId,
                "error",
                t("onboarding.orchestrator.nodeVersionTooLowUpgrade", { defaultValue: "Node.js 版本过低 ({{version}})，请升级到 v22.16.0 或更高版本，或从下方列表选择其他版本", version: result.version })
              );
              break;
            }

            // Node.js not installed - start auto-install flow (参考 Qclaw)
            appendLog(nodeId, "✗ Node.js not found, starting auto-install...");

            // Step 1: Get install plan
            appendLog(nodeId, "Getting install plan...");
            const plan = await nodeInstaller.getInstallPlan();
            appendLog(
              nodeId,
              `Install plan: ${plan.version} (${plan.platform}/${plan.installer_arch})`
            );

            // Step 2: Download installer
            appendLog(nodeId, `$ curl -O ${plan.url}`);
            const installerPath = await nodeInstaller.downloadInstaller(plan);
            appendLog(nodeId, `✓ Downloaded to ${installerPath}`);

            // Step 3: Inspect installer (macOS only)
            if (isMacOS) {
              appendLog(nodeId, "$ pkgutil --check-signature && spctl --assess");
              const inspection =
                await nodeInstaller.inspectInstaller(installerPath);
              if (!inspection.ok) {
                appendLog(
                  nodeId,
                  `✗ Installer verification failed: ${inspection.message}`
                );
                updateNode(
                  nodeId,
                  "error",
                  inspection.message || "Installer verification failed"
                );
                break;
              }
              appendLog(nodeId, "✓ Installer signature verified");
            }

            // Step 4: Execute installation
            appendLog(nodeId, "$ sudo installer -pkg ... -target /");
            const installResult = await nodeInstaller.installEnv({
              need_node: true,
              node_installer_path: installerPath,
            });

            if (!installResult.ok) {
              appendLog(
                nodeId,
                `✗ Installation failed: ${installResult.stderr || installResult.stage}`
              );
              updateNode(
                nodeId,
                "error",
                installResult.stderr || "Installation failed"
              );
              break;
            }
            appendLog(nodeId, "✓ Node.js installed");

            // Step 5: Refresh environment
            appendLog(nodeId, "Refreshing environment variables...");
            await nodeInstaller.refreshEnvironment();

            // Step 6: Verify installation
            appendLog(nodeId, "$ node --version (verify)");
            const recheck = await nodeInstaller.checkNode();
            if (recheck.installed) {
              appendLog(nodeId, `✓ Node.js ${recheck.version} verified`);
              updateNode(nodeId, "success", undefined, recheck);
            } else {
              appendLog(
                nodeId,
                "✗ Node.js still not found after installation"
              );
              updateNode(
                nodeId,
                "error",
                "Node.js installation verification failed"
              );
            }
            break;
          }

          case "cli": {
            // Use ref to get the most current Node.js path synchronously
            // (React state may not have updated yet when this runs)
            const currentNodePath = nodejsSelectedPathRef.current;
            log(`CLI check: using nodePath from ref: ${currentNodePath}`);

            // Log the Node.js path being used for debugging
            if (currentNodePath) {
              appendLog(nodeId, `Using Node.js: ${currentNodePath}`);
            } else {
              appendLog(nodeId, "⚠ Warning: No Node.js path selected, using system PATH");
            }

            appendLog(nodeId, "$ viben --version");
            // Pass the selected Node.js path so viben can be found in the same directory
            const cliResult = await cliInstaller.checkCli(currentNodePath);

            if (cliResult.installed && !cliResult.error) {
              appendLog(nodeId, `✓ viben ${cliResult.version} found at ${cliResult.path}`);
              updateNode(nodeId, "success", undefined, {
                version: cliResult.version,
                path: cliResult.path,
              });
            } else if (!cliResult.installed) {
              appendLog(nodeId, "✗ viben not found");

              // Resolve npm path first and display it
              const npmResult = await cliInstaller.resolveNpmPath(currentNodePath);
              if ("error" in npmResult) {
                appendLog(nodeId, `✗ ${npmResult.error}`);
                updateNode(nodeId, "error", npmResult.error);
                break;
              }
              appendLog(nodeId, `$ ${npmResult.path} install -g --force viben@latest`);

              // Pass the selected Node.js path so npm can be found in the same directory
              await cliInstaller.installCli(currentNodePath);
              // Re-check after install
              appendLog(nodeId, "$ viben --version (verify)");
              const recheckResult = await cliInstaller.checkCli(currentNodePath);
              if (recheckResult.installed && !recheckResult.error) {
                appendLog(nodeId, `✓ viben ${recheckResult.version} installed`);
                updateNode(nodeId, "success", undefined, {
                  version: recheckResult.version,
                  path: recheckResult.path,
                });
              } else {
                appendLog(nodeId, `✗ Installation failed: ${recheckResult.error}`);
                updateNode(nodeId, "error", recheckResult.error || "CLI installation failed");
              }
            } else {
              // installed but has error (version issue)
              appendLog(nodeId, `⚠ Version issue: ${cliResult.error}`);
              updateNode(nodeId, "error", cliResult.error || "CLI version issue");
            }
            break;
          }

          case "gateway": {
            const vibenPath = gateway.vibenPath;

            // First check if gateway is already running
            appendLog(nodeId, "$ curl http://127.0.0.1:18790/health (checking if already running)");
            await gateway.refreshStatus();

            if (gateway.status?.running) {
              appendLog(nodeId, `✓ Gateway already running at ${gateway.status.url} (PID: ${gateway.status.pid || "unknown"})`);
              updateNode(nodeId, "success", undefined, gateway.status);
              break;
            }

            // Gateway not running, try to start it
            appendLog(nodeId, `$ ${vibenPath || "viben"} gateway start --port 18790`);
            const gatewayResult = await gateway.startGateway();

            if (gatewayResult?.running) {
              appendLog(nodeId, `✓ Gateway running at ${gatewayResult.url} (PID: ${gatewayResult.pid})`);
              updateNode(nodeId, "success", undefined, gatewayResult);
            } else {
              // Show detailed error
              const errorDetail = gatewayResult?.error || gateway.error || "Gateway failed to start";
              appendLog(nodeId, `✗ Gateway failed to start`);
              appendLog(nodeId, `Error: ${errorDetail}`);
              if (gatewayResult?.binary_path) {
                appendLog(nodeId, `Binary: ${gatewayResult.binary_path}`);
              }
              if (gatewayResult?.command) {
                appendLog(nodeId, `Command: ${gatewayResult.command}`);
              }
              updateNode(nodeId, "error", errorDetail);
            }
            break;
          }

          case "connection": {
            appendLog(nodeId, "$ curl http://127.0.0.1:18790/health");
            const connected = await gatewayStatus.checkConnectionWithBackoff();
            if (connected) {
              appendLog(nodeId, "✓ Gateway API accessible");
              updateNode(nodeId, "success");
            } else {
              appendLog(nodeId, `✗ Connection failed: ${gatewayStatus.error}`);
              updateNode(nodeId, "error", gatewayStatus.error || "Connection failed");
            }
            break;
          }

          case "python": {
            appendLog(nodeId, "$ python3 --version");
            appendLog(nodeId, "Scanning: /usr/bin, /usr/local/bin, ~/.pyenv, ...");
            // Use the returned value directly — python.selectedPython would be stale
            // because React has not re-rendered yet when we check it after detectPython().
            const freshPythonInfo = await python.detectPython(true);

            if (freshPythonInfo?.found && freshPythonInfo.path) {
              const freshPython = {
                path: freshPythonInfo.path,
                version: freshPythonInfo.version ?? null,
                is_valid: true,
              };
              appendLog(nodeId, `✓ Python ${freshPython.version} found at ${freshPython.path}`);
              updateNode(nodeId, "success", undefined, freshPython);
            } else {
              appendLog(nodeId, "⚠ No Python installation found");
              // Python is optional, so we use warning instead of error
              updateNode(nodeId, "warning", "Python not found");
            }
            break;
          }

          case "executors": {
            appendLog(nodeId, "Scanning: ~/.claude, ~/.cursor, ~/.codex, ...");
            await executors.refresh();

            const availableExecutors = executors.getAvailableExecutors();
            if (availableExecutors.length > 0) {
              for (const executor of availableExecutors) {
                appendLog(nodeId, `✓ Found: ${executor.name}`);
              }
              updateNode(nodeId, "success", undefined, availableExecutors);
            } else {
              appendLog(nodeId, "⚠ No AI clients detected");
              // AI clients are optional
              updateNode(nodeId, "warning", "No AI clients configured");
            }
            break;
          }

          default:
            log(`Unknown node: ${nodeId}`);
            updateNode(nodeId, "error", `Unknown node: ${nodeId}`);
        }
      } catch (error) {
        if (isCancellationError(error)) {
          log(`executeNode: ${nodeId} cancelled`);
          appendLog(nodeId, "⊘ Cancelled");
          updateNode(nodeId, "pending");
        } else {
          const errorMsg = error instanceof Error ? error.message : String(error);
          log(`executeNode: ${nodeId} error`, errorMsg);
          appendLog(nodeId, `✗ Error: ${errorMsg}`);
          updateNode(nodeId, "error", errorMsg);
        }
      }
    },
    // Note: nodejsSelectedPathRef is used instead of nodejsSelectedPath state
    // to avoid race conditions where CLI check starts before React state updates
    [nodeInstaller, cliInstaller, gateway, gatewayStatus, python, executors, updateNode, appendLog, updateNodejsSelectedPath]
  );

  // Process ready nodes
  const processReadyNodes = useCallback(() => {
    const readyNodes = getReadyNodes(state.dagState, ENV_CHECK_NODES);
    log(`processReadyNodes: found ${readyNodes.length} ready nodes`, readyNodes.map((n) => n.id));

    for (const node of readyNodes) {
      if (!runningNodesRef.current.has(node.id)) {
        executeNode(node.id);
      }
    }
  }, [state.dagState, executeNode]);

  // Start all checks
  const startChecks = useCallback(async () => {
    log("startChecks: starting");
    dispatch({ type: "RESET" });
    runningNodesRef.current.clear();
    cancellationRef.current.dispose();
    cancellationRef.current = new CancellationRegistry();

    // Check for bundled CLI first (only once per session)
    if (!bundledCliCheckedRef.current) {
      bundledCliCheckedRef.current = true;
      log("startChecks: checking for bundled CLI...");

      try {
        const bundledResult = await checkBundledCli();
        setBundledCli(bundledResult);

        if (bundledResult.available) {
          log("startChecks: bundled CLI available, skipping nodejs and cli checks");
          // Mark nodejs and cli as success (skipped because bundled CLI is available)
          dispatch({
            type: "UPDATE_NODE",
            nodeId: "nodejs",
            status: "success",
            data: {
              version: "N/A (bundled CLI)",
              path: "bundled",
              skipped: true,
              reason: "Bundled CLI available",
            },
          });
          dispatch({
            type: "UPDATE_NODE",
            nodeId: "cli",
            status: "success",
            data: {
              version: bundledResult.version,
              path: bundledResult.path,
              bundled: true,
            },
          });
        } else {
          log("startChecks: no bundled CLI available, will check nodejs and cli");
        }
      } catch (err) {
        log("startChecks: bundled CLI check failed, continuing with normal flow", err);
      }
    } else if (bundledCli?.available) {
      // Already checked and bundled CLI is available
      log("startChecks: using cached bundled CLI result, skipping nodejs and cli checks");
      dispatch({
        type: "UPDATE_NODE",
        nodeId: "nodejs",
        status: "success",
        data: {
          version: "N/A (bundled CLI)",
          path: "bundled",
          skipped: true,
          reason: "Bundled CLI available",
        },
      });
      dispatch({
        type: "UPDATE_NODE",
        nodeId: "cli",
        status: "success",
        data: {
          version: bundledCli.version,
          path: bundledCli.path,
          bundled: true,
        },
      });
    }

    dispatch({ type: "START" });
  }, [bundledCli]);

  // Retry a specific node
  const retryNode = useCallback(
    (nodeId: string) => {
      log(`retryNode: ${nodeId}`);
      // Clear the node from running set in case it's stuck
      runningNodesRef.current.delete(nodeId);
      // Reset node status to pending
      updateNode(nodeId, "pending");
      // Set isRunning to true to trigger the effect that processes ready nodes
      dispatch({ type: "SET_RUNNING", running: true });
    },
    [updateNode]
  );

  // Skip an optional node
  const skipNode = useCallback(
    (nodeId: string) => {
      const node = ENV_CHECK_NODES.find((n) => n.id === nodeId);
      if (node?.optional) {
        log(`skipNode: ${nodeId}`);
        updateNode(nodeId, "skipped");
      } else {
        log(`skipNode: ${nodeId} is not optional, cannot skip`);
      }
    },
    [updateNode]
  );

  // Cancel all checks
  const cancelAll = useCallback(() => {
    log("cancelAll");
    cancellationRef.current.cancelAll("user-requested");
    dispatch({ type: "SET_RUNNING", running: false });
    runningNodesRef.current.clear();
  }, []);

  // ============================================================================
  // Node.js Selection Methods
  // ============================================================================

  // Scan all Node.js installations
  const scanNodeInstallations = useCallback(async () => {
    log("scanNodeInstallations: scanning...");
    setNodejsLoading(true);
    setNodejsCustomPathError(null);

    try {
      const result = await nodeInstaller.scanNodeInstallations();
      log("scanNodeInstallations: found", result.nodes.length, "installations");
      setNodejsNodes(result.nodes);
      setNodejsRequiredVersion(result.required_version);

      // Auto-select the first valid node if available and no selection yet
      if (!nodejsSelectedPathRef.current && result.nodes.length > 0) {
        const firstValid = result.nodes.find((n) => n.is_valid);
        if (firstValid) {
          updateNodejsSelectedPath(firstValid.path);
        }
      }
    } catch (err) {
      log("scanNodeInstallations: error", err);
    } finally {
      setNodejsLoading(false);
    }
  }, [nodeInstaller, updateNodejsSelectedPath]);

  // Check Node.js at a specific path
  const checkNodeAtPath = useCallback(
    async (path: string): Promise<NodeCheckResult> => {
      log("checkNodeAtPath:", path);
      setNodejsCheckingCustomPath(true);
      setNodejsCustomPathError(null);

      try {
        const result = await nodeInstaller.checkNodeAtPath(path);

        if (result.installed && !result.needsUpgrade) {
          // Valid Node.js found at path
          log("checkNodeAtPath: valid node found", result.version);

          // Add to list if not already present
          setNodejsNodes((prev) => {
            const exists = prev.some((n) => n.path === path);
            if (!exists) {
              return [
                ...prev,
                {
                  path,
                  version: result.version,
                  is_valid: true,
                  source: "custom",
                },
              ];
            }
            return prev;
          });

          // Auto-select this path
          updateNodejsSelectedPath(path);

          // Update the nodejs node status to success
          updateNode("nodejs", "success", undefined, result);
        } else if (result.installed && result.needsUpgrade) {
          // Node.js found but version too low
          setNodejsCustomPathError(
            t("onboarding.orchestrator.nodeVersionTooLowCustom", {
              defaultValue: "Node.js {{version}} 版本过低，需要 v{{required}} 或更高",
              version: result.version,
              required: nodejsRequiredVersion,
            })
          );
        } else {
          // Not a valid Node.js
          setNodejsCustomPathError(result.error || t("onboarding.orchestrator.invalidNodePath", "无效的 Node.js 路径"));
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log("checkNodeAtPath: error", errorMsg);
        setNodejsCustomPathError(errorMsg);
        return { installed: false, error: errorMsg };
      } finally {
        setNodejsCheckingCustomPath(false);
      }
    },
    [nodeInstaller, nodejsRequiredVersion, updateNode]
  );

  // Select a Node.js installation (from the list)
  const selectNodePath = useCallback(
    (path: string) => {
      log("selectNodePath:", path);
      updateNodejsSelectedPath(path);
      setNodejsCustomPathError(null);

      // Find the selected node info
      const nodeInfo = nodejsNodes.find((n) => n.path === path);
      if (nodeInfo?.is_valid) {
        // Update the nodejs node status to success
        updateNode("nodejs", "success", undefined, {
          version: nodeInfo.version,
          path: nodeInfo.path,
        });
        // Set isRunning to true to trigger the effect that processes ready nodes
        dispatch({ type: "SET_RUNNING", running: true });
      }
    },
    [nodejsNodes, updateNode, updateNodejsSelectedPath]
  );

  // Set custom path error
  const setNodeCustomPathError = useCallback((error: string | null) => {
    setNodejsCustomPathError(error);
  }, []);

  // Effect: Process ready nodes when state changes and running
  useEffect(() => {
    if (state.isRunning) {
      processReadyNodes();

      // Check if all done
      const complete = allRequiredComplete(state.dagState, ENV_CHECK_NODES);
      const hasErr = hasRequiredError(state.dagState, ENV_CHECK_NODES);

      if (complete || hasErr) {
        log("All required nodes processed, stopping");
        dispatch({ type: "SET_RUNNING", running: false });
      }
    }
  }, [state.isRunning, state.dagState, processReadyNodes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancellationRef.current.dispose();
    };
  }, []);

  // Computed values
  const progress = useMemo(
    () => calculateOverallProgress(state.dagState, ENV_CHECK_NODES),
    [state.dagState]
  );

  const isComplete = useMemo(
    () => allRequiredComplete(state.dagState, ENV_CHECK_NODES),
    [state.dagState]
  );

  const hasError = useMemo(
    () => hasRequiredError(state.dagState, ENV_CHECK_NODES),
    [state.dagState]
  );

  const nodes = useMemo(
    () =>
      ENV_CHECK_NODES.map((node) => ({
        ...node,
        nodeState: state.dagState.nodeStates[node.id] || { status: "pending" as const },
      })),
    [state.dagState]
  );

  // Prepared data for expanded content
  const nodejsData = useMemo(
    () => ({
      nodes: nodejsNodes,
      selectedPath: nodejsSelectedPath,
      loading: nodejsLoading,
      requiredVersion: nodejsRequiredVersion,
      checkingCustomPath: nodejsCheckingCustomPath,
      customPathError: nodejsCustomPathError,
    }),
    [
      nodejsNodes,
      nodejsSelectedPath,
      nodejsLoading,
      nodejsRequiredVersion,
      nodejsCheckingCustomPath,
      nodejsCustomPathError,
    ]
  );

  const pythonData = useMemo(
    () => ({
      pythons: python.pythons,
      selectedPython: python.selectedPython,
      browseMcpInfo: python.browseMcpInfo,
      loading: python.loading,
    }),
    [python.pythons, python.selectedPython, python.browseMcpInfo, python.loading]
  );

  const executorsData = useMemo(
    () => ({
      executors: executors.executors,
      loading: executors.loading,
      error: executors.error,
    }),
    [executors.executors, executors.loading, executors.error]
  );

  // Node.js installer progress
  const nodeInstallerProgress = useMemo(
    () =>
      nodeInstaller.progress
        ? {
            percent: nodeInstaller.progress.percent,
            message: nodeInstaller.progress.message,
          }
        : null,
    [nodeInstaller.progress]
  );

  return {
    state: state.dagState,
    progress,
    isComplete,
    hasError,
    isRunning: state.isRunning,
    nodes,
    startChecks,
    retryNode,
    skipNode,
    cancelAll,
    nodejsData,
    pythonData,
    executorsData,
    nodeInstallerProgress,
    scanNodeInstallations,
    checkNodeAtPath,
    selectNodePath,
    setNodeCustomPathError,
  };
}
