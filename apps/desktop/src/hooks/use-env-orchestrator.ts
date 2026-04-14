/**
 * Environment Orchestrator Hook
 *
 * Orchestrates environment checks using DAG-based execution.
 * Composes existing hooks and executes checks in dependency order.
 */

import { useReducer, useCallback, useEffect, useRef, useMemo } from "react";
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
import { useNodeInstaller } from "./use-node-installer";
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
            appendLog(nodeId, "$ node --version");
            const result = await nodeInstaller.checkNode();
            if (result.installed) {
              appendLog(nodeId, `✓ Node.js ${result.version} found`);
              updateNode(nodeId, "success", undefined, result);
            } else {
              appendLog(nodeId, "✗ Node.js not found, attempting install...");
              await nodeInstaller.installNode();
              // Re-check after install
              const recheck = await nodeInstaller.checkNode();
              if (recheck.installed) {
                appendLog(nodeId, `✓ Node.js ${recheck.version} installed`);
                updateNode(nodeId, "success", undefined, recheck);
              } else {
                appendLog(nodeId, "✗ Installation failed");
                updateNode(nodeId, "error", "Node.js installation failed");
              }
            }
            break;
          }

          case "cli": {
            appendLog(nodeId, "$ viben --version");
            const cliResult = await cliInstaller.checkCli();

            if (cliResult.installed && !cliResult.error) {
              appendLog(nodeId, `✓ viben ${cliResult.version} found at ${cliResult.path}`);
              updateNode(nodeId, "success", undefined, {
                version: cliResult.version,
                path: cliResult.path,
              });
            } else if (!cliResult.installed) {
              appendLog(nodeId, "✗ viben not found");
              appendLog(nodeId, "$ npm install -g --force viben@latest");
              await cliInstaller.installCli();
              // Re-check after install
              appendLog(nodeId, "$ viben --version (verify)");
              const recheckResult = await cliInstaller.checkCli();
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
            appendLog(nodeId, `$ ${vibenPath || "viben"} gateway start --port 18790`);
            const gatewayResult = await gateway.startGateway();

            if (gatewayResult?.running) {
              appendLog(nodeId, `✓ Gateway running at ${gatewayResult.url} (PID: ${gatewayResult.pid})`);
              updateNode(nodeId, "success", undefined, gatewayResult);
            } else {
              appendLog(nodeId, `✗ Gateway failed: ${gatewayResult?.error || gateway.error}`);
              updateNode(nodeId, "error", gatewayResult?.error || gateway.error || "Gateway failed to start");
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
            await python.detectPython(true);

            if (python.selectedPython) {
              appendLog(nodeId, `✓ Python ${python.selectedPython.version} found at ${python.selectedPython.path}`);
              updateNode(nodeId, "success", undefined, python.selectedPython);
            } else {
              appendLog(nodeId, "⚠ No Python installation found");
              // Python is optional, so we use warning instead of error
              updateNode(nodeId, "warning", "Python not found");
            }
            break;
          }

          case "ai-clients": {
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
    [nodeInstaller, cliInstaller, gateway, gatewayStatus, python, executors, updateNode, appendLog]
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
  const startChecks = useCallback(() => {
    log("startChecks: starting");
    dispatch({ type: "RESET" });
    dispatch({ type: "START" });
    runningNodesRef.current.clear();
    cancellationRef.current.dispose();
    cancellationRef.current = new CancellationRegistry();
  }, []);

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
    pythonData,
    executorsData,
  };
}
