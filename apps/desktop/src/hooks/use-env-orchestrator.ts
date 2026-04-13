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
            log("nodejs: calling checkNode");
            const result = await nodeInstaller.checkNode();
            if (result.installed) {
              log("nodejs: installed", result.version);
              updateNode(nodeId, "success", undefined, result);
            } else {
              log("nodejs: not installed, attempting install");
              await nodeInstaller.installNode();
              // Re-check after install
              const recheck = await nodeInstaller.checkNode();
              if (recheck.installed) {
                log("nodejs: installed after installation", recheck.version);
                updateNode(nodeId, "success", undefined, recheck);
              } else {
                log("nodejs: installation failed");
                updateNode(nodeId, "error", "Node.js installation failed");
              }
            }
            break;
          }

          case "cli": {
            log("cli: calling checkCli");
            await cliInstaller.checkCli();

            if (cliInstaller.isInstalled && cliInstaller.state === "success") {
              log("cli: installed", cliInstaller.currentVersion);
              updateNode(nodeId, "success", undefined, {
                version: cliInstaller.currentVersion,
              });
            } else if (cliInstaller.issue) {
              log("cli: has issue, attempting install");
              await cliInstaller.installCli();
              // Re-check after install
              await cliInstaller.checkCli();
              if (cliInstaller.isInstalled && cliInstaller.state === "success") {
                log("cli: installed after installation");
                updateNode(nodeId, "success", undefined, {
                  version: cliInstaller.currentVersion,
                });
              } else {
                log("cli: installation failed", cliInstaller.issue?.message);
                updateNode(nodeId, "error", cliInstaller.issue?.message || "CLI installation failed");
              }
            } else {
              log("cli: check failed");
              updateNode(nodeId, "error", "CLI check failed");
            }
            break;
          }

          case "gateway": {
            log("gateway: calling startGateway");
            await gateway.startGateway();

            // Wait a moment for gateway to start
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Refresh status
            await gateway.refreshStatus();

            if (gateway.status?.running) {
              log("gateway: running", gateway.status.url);
              updateNode(nodeId, "success", undefined, gateway.status);
            } else {
              log("gateway: not running", gateway.error);
              updateNode(nodeId, "error", gateway.error || "Gateway failed to start");
            }
            break;
          }

          case "connection": {
            log("connection: calling checkConnectionWithBackoff");
            const connected = await gatewayStatus.checkConnectionWithBackoff();
            if (connected) {
              log("connection: connected");
              updateNode(nodeId, "success");
            } else {
              log("connection: failed", gatewayStatus.error);
              updateNode(nodeId, "error", gatewayStatus.error || "Connection failed");
            }
            break;
          }

          case "python": {
            log("python: calling detectPython");
            await python.detectPython(true);

            if (python.selectedPython) {
              log("python: found", python.selectedPython.version);
              updateNode(nodeId, "success", undefined, python.selectedPython);
            } else {
              log("python: not found");
              // Python is optional, so we use warning instead of error
              updateNode(nodeId, "warning", "Python not found");
            }
            break;
          }

          case "ai-clients": {
            log("ai-clients: refreshing executors");
            await executors.refresh();

            const availableExecutors = executors.getAvailableExecutors();
            log("ai-clients: found", availableExecutors.length, "available");

            if (availableExecutors.length > 0) {
              updateNode(nodeId, "success", undefined, availableExecutors);
            } else {
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
          updateNode(nodeId, "pending");
        } else {
          const errorMsg = error instanceof Error ? error.message : String(error);
          log(`executeNode: ${nodeId} error`, errorMsg);
          updateNode(nodeId, "error", errorMsg);
        }
      }
    },
    [nodeInstaller, cliInstaller, gateway, gatewayStatus, python, executors, updateNode]
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
      updateNode(nodeId, "pending");
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
