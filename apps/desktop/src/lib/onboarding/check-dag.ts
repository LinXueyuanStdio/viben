/**
 * DAG Engine for Environment Check
 *
 * 统一环境检查页面的 DAG 引擎，管理检查项之间的依赖关系。
 *
 * DAG 结构:
 * ```
 * Node.js  ──→  CLI  ──→  Gateway  ──→  Connection  ──→  AI Clients
 *                                            ↑
 * Python (独立，可并行) ─────────────────────┘ (可选)
 * ```
 */

import i18next from "i18next";

// ============================================================================
// Types
// ============================================================================

export type CheckNodeStatus =
  | "pending" // 等待执行
  | "blocked" // 被依赖阻塞
  | "checking" // 正在检查
  | "success" // 检查通过
  | "warning" // 检查通过但有警告
  | "error" // 检查失败
  | "skipped"; // 跳过（可选项未执行）

export interface CheckNode {
  id: string;
  label: string;
  tooltip?: string;
  dependsOn: string[];
  optional?: boolean;
  contentType: "simple" | "nodejs-selector" | "python-selector" | "client-list";
}

export interface CheckNodeState {
  status: CheckNodeStatus;
  error?: string;
  data?: unknown;
  /** Operation logs during checking (e.g., commands being executed) */
  logs?: string[];
}

export interface DAGState {
  nodeStates: Record<string, CheckNodeState>;
}

// ============================================================================
// Node Configuration
// ============================================================================

export const ENV_CHECK_NODES: CheckNode[] = [
  {
    id: "nodejs",
    label: "Node.js",
    get tooltip() { return i18next.t("onboarding.checkDag.tooltips.nodejs", "Node.js 是运行 Viben CLI 所需的 JavaScript 运行时环境"); },
    dependsOn: [],
    contentType: "nodejs-selector",
  },
  {
    id: "cli",
    label: "Viben CLI",
    get tooltip() { return i18next.t("onboarding.checkDag.tooltips.cli", "Viben CLI 是核心命令行工具，提供 Gateway 服务和 AI 交互功能"); },
    dependsOn: ["nodejs"],
    contentType: "simple",
  },
  {
    id: "gateway",
    label: "Gateway",
    get tooltip() { return i18next.t("onboarding.checkDag.tooltips.gateway", "Gateway 是 Viben 的本地后端服务，负责与智能体执行器通信"); },
    dependsOn: ["cli"],
    contentType: "simple",
  },
  {
    id: "connection",
    get label() { return i18next.t("onboarding.checkDag.labels.connection", "连接验证"); },
    get tooltip() { return i18next.t("onboarding.checkDag.tooltips.connection", "验证桌面应用与 Gateway 的通信连接"); },
    dependsOn: ["gateway"],
    contentType: "simple",
  },
  {
    id: "python",
    label: "Python",
    get tooltip() { return i18next.t("onboarding.checkDag.tooltips.python", "Python 环境用于运行部分 AI 工具和脚本"); },
    dependsOn: [],
    optional: true,
    contentType: "python-selector",
  },
  {
    id: "executors",
    get label() { return i18next.t("onboarding.checkDag.labels.executors", "智能体执行器"); },
    get tooltip() { return i18next.t("onboarding.checkDag.tooltips.executors", "配置和管理 Claude Code、Codex 等智能体执行器"); },
    dependsOn: ["connection"],
    optional: true,
    contentType: "client-list",
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 拓扑排序，返回可并行执行的层
 *
 * 每一层内的节点可以并行执行，层与层之间需要顺序执行
 */
export function getExecutionLayers(nodes: CheckNode[]): CheckNode[][] {
  console.log("[check-dag] getExecutionLayers: starting topological sort");

  const nodeMap = new Map<string, CheckNode>();
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, node.dependsOn.length);
    adjList.set(node.id, []);
  }

  // Build adjacency list (reverse direction for dependents)
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      const deps = adjList.get(dep);
      if (deps) {
        deps.push(node.id);
      }
    }
  }

  const layers: CheckNode[][] = [];
  let remaining = new Set(nodes.map((n) => n.id));

  while (remaining.size > 0) {
    // Find all nodes with in-degree 0 (no unprocessed dependencies)
    const currentLayer: CheckNode[] = [];

    for (const nodeId of remaining) {
      const degree = inDegree.get(nodeId) ?? 0;
      if (degree === 0) {
        const node = nodeMap.get(nodeId);
        if (node) {
          currentLayer.push(node);
        }
      }
    }

    if (currentLayer.length === 0) {
      console.log("[check-dag] getExecutionLayers: cycle detected in DAG");
      break;
    }

    layers.push(currentLayer);
    console.log(
      `[check-dag] getExecutionLayers: layer ${layers.length} = [${currentLayer.map((n) => n.id).join(", ")}]`
    );

    // Remove processed nodes and update in-degrees
    for (const node of currentLayer) {
      remaining.delete(node.id);
      const dependents = adjList.get(node.id) ?? [];
      for (const depId of dependents) {
        const currentDegree = inDegree.get(depId) ?? 0;
        inDegree.set(depId, currentDegree - 1);
      }
    }
  }

  console.log(`[check-dag] getExecutionLayers: total ${layers.length} layers`);
  return layers;
}

/**
 * 检查节点是否可以开始执行
 *
 * 条件：所有依赖都已成功或警告完成
 */
export function canNodeStart(nodeId: string, state: DAGState, nodes: CheckNode[]): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    console.log(`[check-dag] canNodeStart: node ${nodeId} not found`);
    return false;
  }

  const currentStatus = state.nodeStates[nodeId]?.status;

  // Already running or completed
  if (currentStatus && currentStatus !== "pending" && currentStatus !== "blocked") {
    console.log(`[check-dag] canNodeStart: node ${nodeId} already in status ${currentStatus}`);
    return false;
  }

  // Check all dependencies
  for (const depId of node.dependsOn) {
    const depStatus = state.nodeStates[depId]?.status;
    if (depStatus !== "success" && depStatus !== "warning") {
      console.log(
        `[check-dag] canNodeStart: node ${nodeId} blocked by dependency ${depId} (status: ${depStatus})`
      );
      return false;
    }
  }

  console.log(`[check-dag] canNodeStart: node ${nodeId} can start`);
  return true;
}

/**
 * 计算总进度 (0-100)
 *
 * 只计算必需节点的进度
 */
export function calculateOverallProgress(state: DAGState, nodes: CheckNode[]): number {
  const requiredNodes = nodes.filter((n) => !n.optional);
  if (requiredNodes.length === 0) {
    return 100;
  }

  let completedCount = 0;
  let inProgressCount = 0;

  for (const node of requiredNodes) {
    const status = state.nodeStates[node.id]?.status;
    if (status === "success" || status === "warning") {
      completedCount++;
    } else if (status === "checking") {
      inProgressCount += 0.5; // Count checking as half complete
    }
  }

  const progress = Math.round(((completedCount + inProgressCount) / requiredNodes.length) * 100);
  console.log(
    `[check-dag] calculateOverallProgress: ${progress}% (${completedCount}/${requiredNodes.length} required nodes complete)`
  );
  return progress;
}

/**
 * 获取初始 DAG 状态
 *
 * 没有依赖的节点设为 pending，有依赖的节点设为 blocked
 */
export function getInitialDAGState(nodes: CheckNode[]): DAGState {
  console.log("[check-dag] getInitialDAGState: initializing state");

  const nodeStates: Record<string, CheckNodeState> = {};

  for (const node of nodes) {
    const status: CheckNodeStatus = node.dependsOn.length === 0 ? "pending" : "blocked";
    nodeStates[node.id] = { status };
    console.log(`[check-dag] getInitialDAGState: node ${node.id} = ${status}`);
  }

  return { nodeStates };
}

/**
 * 检查所有必需项是否完成
 *
 * 必需节点需要 success 或 warning 状态
 */
export function allRequiredComplete(state: DAGState, nodes: CheckNode[]): boolean {
  const requiredNodes = nodes.filter((n) => !n.optional);

  for (const node of requiredNodes) {
    const status = state.nodeStates[node.id]?.status;
    if (status !== "success" && status !== "warning") {
      console.log(
        `[check-dag] allRequiredComplete: false (node ${node.id} status: ${status})`
      );
      return false;
    }
  }

  console.log("[check-dag] allRequiredComplete: true");
  return true;
}

/**
 * 更新节点状态并自动解除后续节点的阻塞
 */
export function updateNodeStatus(
  state: DAGState,
  nodeId: string,
  newStatus: CheckNodeStatus,
  nodes: CheckNode[],
  error?: string,
  data?: unknown
): DAGState {
  console.log(`[check-dag] updateNodeStatus: node ${nodeId} -> ${newStatus}`);

  const newState: DAGState = {
    nodeStates: {
      ...state.nodeStates,
      [nodeId]: {
        status: newStatus,
        error,
        data,
      },
    },
  };

  // If the node completed (success/warning), check if dependent nodes can be unblocked
  if (newStatus === "success" || newStatus === "warning") {
    for (const node of nodes) {
      if (node.dependsOn.includes(nodeId)) {
        const currentStatus = newState.nodeStates[node.id]?.status;
        if (currentStatus === "blocked" && canNodeStart(node.id, newState, nodes)) {
          console.log(`[check-dag] updateNodeStatus: unblocking node ${node.id}`);
          newState.nodeStates[node.id] = { status: "pending" };
        }
      }
    }
  }

  // If the node failed (error), mark dependent nodes as blocked (they stay blocked)
  if (newStatus === "error") {
    console.log(`[check-dag] updateNodeStatus: node ${nodeId} failed, dependents remain blocked`);
  }

  return newState;
}

/**
 * 获取所有可以立即开始的节点
 */
export function getReadyNodes(state: DAGState, nodes: CheckNode[]): CheckNode[] {
  const readyNodes: CheckNode[] = [];

  for (const node of nodes) {
    const status = state.nodeStates[node.id]?.status;
    if (status === "pending" && canNodeStart(node.id, state, nodes)) {
      readyNodes.push(node);
    }
  }

  console.log(
    `[check-dag] getReadyNodes: [${readyNodes.map((n) => n.id).join(", ")}]`
  );
  return readyNodes;
}

/**
 * 检查是否有任何必需节点处于错误状态
 */
export function hasRequiredError(state: DAGState, nodes: CheckNode[]): boolean {
  const requiredNodes = nodes.filter((n) => !n.optional);

  for (const node of requiredNodes) {
    const status = state.nodeStates[node.id]?.status;
    if (status === "error") {
      console.log(`[check-dag] hasRequiredError: true (node ${node.id})`);
      return true;
    }
  }

  return false;
}

/**
 * 获取节点信息
 */
export function getNodeById(nodeId: string, nodes: CheckNode[]): CheckNode | undefined {
  return nodes.find((n) => n.id === nodeId);
}
