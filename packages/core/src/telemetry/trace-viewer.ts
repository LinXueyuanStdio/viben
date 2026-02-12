/**
 * Trace 可视化工具
 *
 * 从 JSONL 文件加载 trace 数据并构建树形结构
 */
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import type { TraceSpan, TraceSpanNode, TraceTree } from "./types";

/**
 * 从 JSONL 文件加载 trace spans
 */
export async function loadTrace(filePath: string): Promise<TraceSpan[]> {
  const spans: TraceSpan[] = [];

  if (!fs.existsSync(filePath)) {
    throw new Error(`Trace file not found: ${filePath}`);
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        spans.push(JSON.parse(line));
      } catch {
        console.warn(`[TraceViewer] Failed to parse line: ${line}`);
      }
    }
  }

  return spans;
}

/**
 * 同步加载 trace spans
 */
export function loadTraceSync(filePath: string): TraceSpan[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Trace file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  return lines.map((line) => JSON.parse(line));
}

/**
 * 构建 trace 树
 */
export function buildTraceTree(spans: TraceSpan[]): TraceTree | null {
  if (spans.length === 0) return null;

  // 创建 span 节点映射
  const spanMap = new Map<string, TraceSpanNode>();
  spans.forEach((span) => {
    const node: TraceSpanNode = { ...span, children: [] };
    spanMap.set(span.spanId, node);
  });

  // 构建父子关系
  let root: TraceSpanNode | null = null;
  const orphans: TraceSpanNode[] = [];

  for (const span of spans) {
    const node = spanMap.get(span.spanId)!;

    if (span.parentSpanId) {
      const parent = spanMap.get(span.parentSpanId);
      if (parent) {
        parent.children.push(node);
      } else {
        // 父节点不存在，可能是采样丢失
        orphans.push(node);
      }
    } else {
      if (root) {
        // 多个根节点，取最早的
        if (span.startTime < root.startTime) {
          orphans.push(root);
          root = node;
        } else {
          orphans.push(node);
        }
      } else {
        root = node;
      }
    }
  }

  // 如果没有明确的根节点，取最早开始的
  if (!root && orphans.length > 0) {
    orphans.sort((a, b) => a.startTime - b.startTime);
    root = orphans.shift()!;
  }

  // 将孤立节点挂到根节点下
  if (root && orphans.length > 0) {
    root.children.push(...orphans);
  }

  if (!root) return null;

  // 递归排序子节点（按开始时间）
  const sortChildren = (node: TraceSpanNode) => {
    node.children.sort((a, b) => a.startTime - b.startTime);
    node.children.forEach(sortChildren);
  };
  sortChildren(root);

  // 计算总时间
  const allTimes = spans.flatMap((s) => [s.startTime, s.endTime]);
  const startTime = Math.min(...allTimes);
  const endTime = Math.max(...allTimes);

  // 提取 traceId
  const filePath = "";
  const traceId = filePath
    ? path.basename(filePath).replace(".jsonl", "")
    : spans[0]?.spanId?.slice(0, 16) || "unknown";

  return {
    traceId,
    startTime,
    endTime,
    totalDuration: Math.round((endTime - startTime) * 100) / 100,
    root,
    metadata: {
      serviceName: root.resource?.["service.name"] as string | undefined,
      serviceVersion: root.resource?.["service.version"] as string | undefined,
    },
  };
}

/**
 * 打印 trace 树为文本格式
 */
export function printTraceTree(tree: TraceTree): string {
  const lines: string[] = [];

  lines.push(`Trace: ${tree.traceId}`);
  if (tree.metadata?.serviceName) {
    lines.push(`服务: ${tree.metadata.serviceName}`);
  }
  lines.push(`总耗时: ${tree.totalDuration}ms`);
  lines.push(`开始时间: ${new Date(tree.startTime).toISOString()}`);
  lines.push("");

  const printSpan = (span: TraceSpanNode, prefix: string, isLast: boolean) => {
    const connector = isLast ? "└── " : "├── ";
    const statusIcon =
      span.status.code === 1 ? "✓" : span.status.code === 2 ? "✗" : "○";
    const durationStr =
      span.duration >= 1000
        ? `${(span.duration / 1000).toFixed(2)}s`
        : `${span.duration.toFixed(2)}ms`;

    lines.push(`${prefix}${connector}${statusIcon} ${span.displayName} (${durationStr})`);

    const childPrefix = prefix + (isLast ? "    " : "│   ");
    span.children.forEach((child, i) => {
      printSpan(child, childPrefix, i === span.children.length - 1);
    });
  };

  printSpan(tree.root, "", true);

  return lines.join("\n");
}

/**
 * 将 trace 树转换为 JSON 格式
 */
export function traceTreeToJson(tree: TraceTree): string {
  return JSON.stringify(tree, null, 2);
}

/**
 * 获取 trace 的统计信息
 */
export function getTraceStats(tree: TraceTree): {
  totalSpans: number;
  successSpans: number;
  errorSpans: number;
  maxDepth: number;
  operations: Map<string, { count: number; totalDuration: number }>;
} {
  let totalSpans = 0;
  let successSpans = 0;
  let errorSpans = 0;
  let maxDepth = 0;
  const operations = new Map<string, { count: number; totalDuration: number }>();

  const traverse = (node: TraceSpanNode, depth: number) => {
    totalSpans++;
    maxDepth = Math.max(maxDepth, depth);

    if (node.status.code === 1) {
      successSpans++;
    } else if (node.status.code === 2) {
      errorSpans++;
    }

    // 统计操作
    const op = operations.get(node.displayName) || { count: 0, totalDuration: 0 };
    op.count++;
    op.totalDuration += node.duration;
    operations.set(node.displayName, op);

    node.children.forEach((child) => traverse(child, depth + 1));
  };

  traverse(tree.root, 1);

  return { totalSpans, successSpans, errorSpans, maxDepth, operations };
}

/**
 * 列出指定日期的所有 traces
 */
export async function listTraces(
  baseDir: string,
  date?: string
): Promise<{ traceId: string; filePath: string; size: number; mtime: Date }[]> {
  const tracesDir = path.join(baseDir, "traces");
  const targetDate = date || new Date().toISOString().split("T")[0];
  const dateDir = path.join(tracesDir, targetDate);

  if (!fs.existsSync(dateDir)) {
    return [];
  }

  const files = fs.readdirSync(dateDir);
  const traces: { traceId: string; filePath: string; size: number; mtime: Date }[] = [];

  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;

    const filePath = path.join(dateDir, file);
    const stat = fs.statSync(filePath);

    traces.push({
      traceId: file.replace(".jsonl", ""),
      filePath,
      size: stat.size,
      mtime: stat.mtime,
    });
  }

  // 按修改时间倒序
  traces.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return traces;
}

/**
 * 列出所有可用日期
 */
export function listTraceDates(baseDir: string): string[] {
  const tracesDir = path.join(baseDir, "traces");

  if (!fs.existsSync(tracesDir)) {
    return [];
  }

  const dirs = fs.readdirSync(tracesDir);
  return dirs
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
}
