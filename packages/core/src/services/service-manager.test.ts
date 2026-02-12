/**
 * Service Manager Tests
 *
 * Comprehensive tests for the ServiceManager class.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ServiceManager, type ServiceInfo } from "./service-manager";
import { ServiceError } from "../error";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("ServiceManager", () => {
  let manager: ServiceManager;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = mkdtempSync(join(tmpdir(), "viben-service-test-"));
    manager = new ServiceManager(tempDir);
    await manager.initialize();
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================
  // Service Name Parsing Tests
  // ============================================================

  describe("parseServiceName", () => {
    it("should parse mcp service names", () => {
      const result = manager.parseServiceName("mcp:filesystem");
      expect(result.type).toBe("mcp");
      expect(result.identifier).toBe("filesystem");
    });

    it("should parse viben service names", () => {
      const result = manager.parseServiceName("viben:sync");
      expect(result.type).toBe("viben");
      expect(result.identifier).toBe("sync");
    });

    it("should parse gateway service name", () => {
      const result = manager.parseServiceName("gateway");
      expect(result.type).toBe("gateway");
      expect(result.identifier).toBe("gateway");
    });

    it("should parse custom service names with prefix", () => {
      const result = manager.parseServiceName("custom:myservice");
      expect(result.type).toBe("custom");
      expect(result.identifier).toBe("myservice");
    });

    it("should default to custom type for unknown prefix", () => {
      const result = manager.parseServiceName("myservice");
      expect(result.type).toBe("custom");
      expect(result.identifier).toBe("myservice");
    });
  });

  // ============================================================
  // Default Command Tests
  // ============================================================

  describe("getDefaultCommand", () => {
    it("should return npx command for mcp services", () => {
      const result = manager.getDefaultCommand("mcp:filesystem");
      expect(result).not.toBeNull();
      expect(result?.command).toBe("npx");
      expect(result?.args).toContain("-y");
      expect(result?.args).toContain("@anthropic-ai/mcp-server-filesystem");
    });

    it("should return viben command for gateway service", () => {
      const result = manager.getDefaultCommand("gateway");
      expect(result).not.toBeNull();
      expect(result?.command).toBe("viben");
      expect(result?.args).toContain("gateway");
      expect(result?.args).toContain("start");
    });

    it("should return viben command for sync service", () => {
      const result = manager.getDefaultCommand("viben:sync");
      expect(result).not.toBeNull();
      expect(result?.command).toBe("viben");
      expect(result?.args).toContain("sync");
      expect(result?.args).toContain("--daemon");
    });

    it("should return viben command for index service", () => {
      const result = manager.getDefaultCommand("viben:index");
      expect(result).not.toBeNull();
      expect(result?.command).toBe("viben");
      expect(result?.args).toContain("index");
      expect(result?.args).toContain("--daemon");
    });

    it("should return null for unknown viben services", () => {
      const result = manager.getDefaultCommand("viben:unknown");
      expect(result).toBeNull();
    });

    it("should return null for custom services", () => {
      const result = manager.getDefaultCommand("custom:myservice");
      expect(result).toBeNull();
    });
  });

  // ============================================================
  // Status Tests
  // ============================================================

  describe("status", () => {
    it("should return stopped status for non-existent service", async () => {
      const info = await manager.status("mcp:test");
      expect(info.name).toBe("mcp:test");
      expect(info.type).toBe("mcp");
      expect(info.status).toBe("stopped");
    });

    it("should return stopped status for gateway when not running", async () => {
      const info = await manager.status("gateway");
      expect(info.name).toBe("gateway");
      expect(info.type).toBe("gateway");
      expect(info.status).toBe("stopped");
    });

    it("should return correct type for different service names", async () => {
      const mcpStatus = await manager.status("mcp:test");
      expect(mcpStatus.type).toBe("mcp");

      const gatewayStatus = await manager.status("gateway");
      expect(gatewayStatus.type).toBe("gateway");

      const vibenStatus = await manager.status("viben:sync");
      expect(vibenStatus.type).toBe("viben");

      const customStatus = await manager.status("myservice");
      expect(customStatus.type).toBe("custom");
    });
  });

  // ============================================================
  // List Tests
  // ============================================================

  describe("list", () => {
    it("should return known services", async () => {
      const services = await manager.list();

      // Should include at least the known services
      const names = services.map((s) => s.name);
      expect(names).toContain("gateway");
      expect(names).toContain("viben:sync");
      expect(names).toContain("viben:index");
    });

    it("should return correct types for known services", async () => {
      const services = await manager.list();

      const gateway = services.find((s) => s.name === "gateway");
      expect(gateway?.type).toBe("gateway");

      const sync = services.find((s) => s.name === "viben:sync");
      expect(sync?.type).toBe("viben");

      const index = services.find((s) => s.name === "viben:index");
      expect(index?.type).toBe("viben");
    });

    it("should show all known services as stopped initially", async () => {
      const services = await manager.list();

      for (const service of services) {
        expect(service.status).toBe("stopped");
      }
    });
  });

  // ============================================================
  // Convenience Method Tests
  // ============================================================

  describe("listServices", () => {
    it("should be an alias for list()", async () => {
      const list = await manager.list();
      const listServices = await manager.listServices();
      expect(listServices).toEqual(list);
    });
  });

  describe("getServiceStatus", () => {
    it("should be an alias for status()", async () => {
      const status = await manager.status("gateway");
      const serviceStatus = await manager.getServiceStatus("gateway");
      expect(serviceStatus).toEqual(status);
    });
  });

  describe("getServiceLogs", () => {
    it("should return empty array for non-existent log", async () => {
      const logs = await manager.getServiceLogs("nonexistent");
      expect(logs).toEqual([]);
    });

    it("should be an alias for readLogs()", async () => {
      // Create a log file
      const logPath = manager.getLogPath("test-service");
      mkdirSync(join(tempDir, "logs"), { recursive: true });
      writeFileSync(logPath, "line1\nline2\nline3\n", "utf-8");

      const readLogs = await manager.readLogs("test-service", 10);
      const serviceLogs = await manager.getServiceLogs("test-service", 10);
      expect(serviceLogs).toEqual(readLogs);
    });
  });

  describe("startService", () => {
    it("should throw ServiceError when no command available", async () => {
      await expect(manager.startService("custom:unknown")).rejects.toThrow(
        ServiceError
      );
    });

    it("should throw ServiceError with correct code", async () => {
      try {
        await manager.startService("custom:unknown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).code).toBe("SERVICE_NO_COMMAND");
      }
    });
  });

  describe("stopService", () => {
    it("should return stopped status for non-running service", async () => {
      const result = await manager.stopService("mcp:test");
      expect(result.status).toBe("stopped");
      expect(result.name).toBe("mcp:test");
    });
  });

  // ============================================================
  // Log Path Tests
  // ============================================================

  describe("getLogPath", () => {
    it("should return correct log path", () => {
      const logPath = manager.getLogPath("mcp:filesystem");
      expect(logPath).toContain("mcp-filesystem.log");
    });

    it("should sanitize service name with colons", () => {
      const logPath = manager.getLogPath("mcp:my:special:name");
      expect(logPath).toContain("mcp-my-special-name.log");
    });

    it("should handle gateway service name", () => {
      const logPath = manager.getLogPath("gateway");
      expect(logPath).toContain("gateway.log");
    });

    it("should sanitize special characters", () => {
      const logPath = manager.getLogPath("service@with#special$chars");
      expect(logPath).toMatch(/service-with-special-chars\.log$/);
    });
  });

  // ============================================================
  // Read Logs Tests
  // ============================================================

  describe("readLogs", () => {
    it("should return empty array for non-existent log", async () => {
      const logs = await manager.readLogs("nonexistent");
      expect(logs).toEqual([]);
    });

    it("should return last N lines", async () => {
      // Create a log file
      const logPath = manager.getLogPath("test-service");
      mkdirSync(join(tempDir, "logs"), { recursive: true });
      writeFileSync(
        logPath,
        "line1\nline2\nline3\nline4\nline5\n",
        "utf-8"
      );

      const logs = await manager.readLogs("test-service", 3);
      expect(logs).toHaveLength(3);
      expect(logs).toEqual(["line3", "line4", "line5"]);
    });

    it("should return all lines if less than requested", async () => {
      const logPath = manager.getLogPath("test-service");
      mkdirSync(join(tempDir, "logs"), { recursive: true });
      writeFileSync(logPath, "line1\nline2\n", "utf-8");

      const logs = await manager.readLogs("test-service", 100);
      expect(logs).toHaveLength(2);
    });
  });

  // ============================================================
  // Clear Logs Tests
  // ============================================================

  describe("clearLogs", () => {
    it("should clear existing log file", async () => {
      // Create a log file
      const logPath = manager.getLogPath("test-service");
      mkdirSync(join(tempDir, "logs"), { recursive: true });
      writeFileSync(logPath, "some log content\n", "utf-8");

      await manager.clearLogs("test-service");

      const content = readFileSync(logPath, "utf-8");
      expect(content).toBe("");
    });

    it("should not throw for non-existent log file", async () => {
      await expect(manager.clearLogs("nonexistent")).resolves.not.toThrow();
    });
  });

  // ============================================================
  // Known Services Tests
  // ============================================================

  describe("getKnownServices", () => {
    it("should return list of known services", () => {
      const known = manager.getKnownServices();
      expect(known).toContain("gateway");
      expect(known).toContain("viben:sync");
      expect(known).toContain("viben:index");
    });
  });

  describe("isKnownService", () => {
    it("should return true for known services", () => {
      expect(manager.isKnownService("gateway")).toBe(true);
      expect(manager.isKnownService("viben:sync")).toBe(true);
      expect(manager.isKnownService("viben:index")).toBe(true);
    });

    it("should return false for unknown services", () => {
      expect(manager.isKnownService("mcp:filesystem")).toBe(false);
      expect(manager.isKnownService("custom:myservice")).toBe(false);
    });
  });

  // ============================================================
  // PID File Tests
  // ============================================================

  describe("getPidFilePath", () => {
    it("should return correct PID file path", () => {
      const pidPath = manager.getPidFilePath("gateway");
      expect(pidPath).toContain("services");
      expect(pidPath).toContain("gateway.pid");
    });

    it("should sanitize service name for PID file", () => {
      const pidPath = manager.getPidFilePath("mcp:filesystem");
      expect(pidPath).toContain("mcp-filesystem.pid");
    });
  });

  describe("writePidFile and readPidFile", () => {
    it("should write and read PID file", async () => {
      await manager.writePidFile("test-service", 12345);
      const pid = await manager.readPidFile("test-service");
      expect(pid).toBe(12345);
    });

    it("should return null for non-existent PID file", async () => {
      const pid = await manager.readPidFile("nonexistent");
      expect(pid).toBeNull();
    });
  });

  describe("removePidFile", () => {
    it("should remove existing PID file", async () => {
      await manager.writePidFile("test-service", 12345);
      await manager.removePidFile("test-service");

      const pid = await manager.readPidFile("test-service");
      expect(pid).toBeNull();
    });

    it("should not throw for non-existent PID file", async () => {
      await expect(manager.removePidFile("nonexistent")).resolves.not.toThrow();
    });
  });

  // ============================================================
  // Service Exists Tests
  // ============================================================

  describe("serviceExists", () => {
    it("should return false for non-existent service", async () => {
      const exists = await manager.serviceExists("nonexistent");
      expect(exists).toBe(false);
    });
  });

  // ============================================================
  // Batch Operation Tests
  // ============================================================

  describe("getRunningServices", () => {
    it("should return empty array when no services are running", async () => {
      const running = await manager.getRunningServices();
      expect(running).toEqual([]);
    });
  });

  describe("hasRunningServices", () => {
    it("should return false when no services are running", async () => {
      const hasRunning = await manager.hasRunningServices();
      expect(hasRunning).toBe(false);
    });
  });

  describe("stopAll", () => {
    it("should return empty array when no services are running", async () => {
      const results = await manager.stopAll();
      expect(results).toEqual([]);
    });
  });

  // ============================================================
  // File Path Tests
  // ============================================================

  describe("getServicesFilePath", () => {
    it("should return services file path", () => {
      const path = manager.getServicesFilePath();
      expect(path).toContain("services.yaml");
    });
  });

  describe("getLogsDir", () => {
    it("should return logs directory path", () => {
      const path = manager.getLogsDir();
      expect(path).toContain("logs");
    });
  });

  // ============================================================
  // Initialize Tests
  // ============================================================

  describe("initialize", () => {
    it("should create logs directory", async () => {
      const newTempDir = mkdtempSync(join(tmpdir(), "viben-init-test-"));
      const newManager = new ServiceManager(newTempDir);

      await newManager.initialize();

      const logsDir = newManager.getLogsDir();
      expect(existsSync(logsDir)).toBe(true);

      // Cleanup
      rmSync(newTempDir, { recursive: true, force: true });
    });
  });

  // ============================================================
  // Remove Service Tests
  // ============================================================

  describe("removeService", () => {
    it("should not throw for non-existent service", async () => {
      await expect(manager.removeService("nonexistent")).resolves.not.toThrow();
    });
  });
});
