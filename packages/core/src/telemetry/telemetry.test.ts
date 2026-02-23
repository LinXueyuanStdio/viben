/**
 * Telemetry 模块测试
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { initTelemetry, cleanOldTelemetryFiles } from "./index";
import {
  loadTraceSync,
  buildTraceTree,
  printTraceTree,
  getTraceStats,
  listTraceDates,
  listTraces,
} from "./trace-viewer";
import { getRouteName, getSpanName, ROUTE_NAMES, SPAN_NAMES } from "./route-names";
import type { TraceSpan } from "./types";

describe("route-names", () => {
  it("should have Chinese names for all routes", () => {
    // 检查所有路由都有中文名
    for (const [key, value] of Object.entries(ROUTE_NAMES)) {
      expect(value).toBeTruthy();
      // 检查是中文
      expect(/[\u4e00-\u9fa5]/.test(value)).toBe(true);
    }
  });

  it("should return route name for known routes", () => {
    expect(getRouteName("GET", "/api/agents")).toBe("获取智能体列表");
    expect(getRouteName("POST", "/api/agents/:id/run")).toBe("运行智能体");
    expect(getRouteName("GET", "/health")).toBe("健康检查");
  });

  it("should return original for unknown routes", () => {
    expect(getRouteName("GET", "/unknown/route")).toBe("GET /unknown/route");
  });

  it("should have Chinese names for all spans", () => {
    for (const [key, value] of Object.entries(SPAN_NAMES)) {
      expect(value).toBeTruthy();
      expect(/[\u4e00-\u9fa5]/.test(value)).toBe(true);
    }
  });

  it("should return span name for known spans", () => {
    expect(getSpanName("agent.run")).toBe("执行智能体");
    expect(getSpanName("llm.call")).toBe("LLM调用");
  });
});

describe("trace-viewer", () => {
  const testSpans: TraceSpan[] = [
    {
      spanId: "root001",
      name: "POST /api/agents/:id/run",
      displayName: "运行智能体",
      kind: 1,
      startTime: 1000,
      endTime: 5000,
      duration: 4000,
      status: { code: 1 },
      attributes: {},
      events: [],
    },
    {
      spanId: "child001",
      parentSpanId: "root001",
      name: "agent.init",
      displayName: "初始化智能体",
      kind: 0,
      startTime: 1100,
      endTime: 1500,
      duration: 400,
      status: { code: 1 },
      attributes: {},
      events: [],
    },
    {
      spanId: "child002",
      parentSpanId: "root001",
      name: "llm.call",
      displayName: "LLM调用",
      kind: 2,
      startTime: 1500,
      endTime: 4500,
      duration: 3000,
      status: { code: 1 },
      attributes: {},
      events: [],
    },
    {
      spanId: "grandchild001",
      parentSpanId: "child002",
      name: "tool.execute",
      displayName: "执行工具",
      kind: 0,
      startTime: 2000,
      endTime: 3000,
      duration: 1000,
      status: { code: 2, message: "Tool failed" },
      attributes: {},
      events: [],
    },
  ];

  it("should build trace tree", () => {
    const tree = buildTraceTree(testSpans);
    expect(tree).not.toBeNull();
    expect(tree!.root.spanId).toBe("root001");
    expect(tree!.root.children.length).toBe(2);
    expect(tree!.totalDuration).toBe(4000);
  });

  it("should print trace tree", () => {
    const tree = buildTraceTree(testSpans)!;
    const output = printTraceTree(tree);
    expect(output).toContain("运行智能体");
    expect(output).toContain("初始化智能体");
    expect(output).toContain("LLM调用");
    expect(output).toContain("执行工具");
    expect(output).toContain("✓"); // success
    expect(output).toContain("✗"); // error
  });

  it("should get trace stats", () => {
    const tree = buildTraceTree(testSpans)!;
    const stats = getTraceStats(tree);
    expect(stats.totalSpans).toBe(4);
    expect(stats.successSpans).toBe(3);
    expect(stats.errorSpans).toBe(1);
    expect(stats.maxDepth).toBe(3);
    expect(stats.operations.size).toBe(4);
  });
});

describe("telemetry initialization", () => {
  it("should initialize telemetry with disabled flag", async () => {
    const testDir = path.join(os.tmpdir(), `viben-telemetry-test-${Date.now()}`);

    try {
      const instance = initTelemetry({
        serviceName: "test-service",
        serviceVersion: "1.0.0",
        baseDir: testDir,
        enabled: false,
      });

      expect(instance.sdk).toBeNull();
      expect(instance.logger).toBeDefined();
      expect(instance.config.serviceName).toBe("test-service");

      // Flush and close logger before cleanup
      await instance.shutdown();
      // Give async logger time to flush
      await new Promise((r) => setTimeout(r, 100));
    } finally {
      // 清理
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    }
  });

  it("should clean old files", () => {
    const testDir = path.join(os.tmpdir(), `viben-telemetry-clean-${Date.now()}`);

    try {
      // 创建测试文件
      const tracesDir = path.join(testDir, "traces");
      const logsDir = path.join(testDir, "logs");
      fs.mkdirSync(tracesDir, { recursive: true });
      fs.mkdirSync(logsDir, { recursive: true });

      // 创建一个旧的 trace 目录并修改其时间戳
      const oldDateStr = "2020-01-01";
      const oldTraceDir = path.join(tracesDir, oldDateStr);
      fs.mkdirSync(oldTraceDir, { recursive: true });
      const oldFile = path.join(oldTraceDir, "test.jsonl");
      fs.writeFileSync(oldFile, "{}");

      // 修改文件和目录的时间戳为很久以前
      const oldTime = new Date("2020-01-01").getTime() / 1000;
      fs.utimesSync(oldFile, oldTime, oldTime);
      fs.utimesSync(oldTraceDir, oldTime, oldTime);

      // 创建一个新的 log 文件
      const newDate = new Date().toISOString().split("T")[0];
      const newFile = path.join(logsDir, `${newDate}.jsonl`);
      fs.writeFileSync(newFile, "{}");

      // 运行清理（保留 7 天）
      cleanOldTelemetryFiles(testDir, 7);

      // 旧的应该被删除
      expect(fs.existsSync(oldTraceDir)).toBe(false);

      // 新的应该保留
      expect(fs.existsSync(newFile)).toBe(true);
    } finally {
      // 清理
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    }
  });
});
