/**
 * Service Command Tests
 *
 * Tests for service CLI commands:
 * - service status: Show all service status or specific service
 * - service start: Start a service
 * - service stop: Stop a service
 * - service restart: Restart a service
 * - service logs: Show/follow service logs
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerServiceCommand } from "./service";
import type { ServiceInfo } from "../../services";

// Mock serviceManager
vi.mock("../../services", () => ({
  serviceManager: {
    listServices: vi.fn(),
    getServiceStatus: vi.fn(),
    startService: vi.fn(),
    stopService: vi.fn(),
    restartService: vi.fn(),
    getServiceLogs: vi.fn(),
    clearLogs: vi.fn(),
    getLogPath: vi.fn(),
    watchLogs: vi.fn(),
  },
}));

// Import the mocked module
import { serviceManager } from "../../services";

// Mock chalk to avoid color codes in test output
vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
  },
}));

describe("service command", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;
  let logOutput: string[];
  let errorOutput: string[];

  beforeEach(() => {
    // Create a fresh program
    program = new Command();
    program.option("--json", "Output JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register the service command
    registerServiceCommand(program);

    // Capture console output
    logOutput = [];
    errorOutput = [];
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logOutput.push(args.map(String).join(" "));
    });
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation((...args) => {
        errorOutput.push(args.map(String).join(" "));
      });

    // Mock process.exit to throw instead of exiting
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(((code: number) => {
      throw new Error(`process.exit(${code})`);
    }) as () => never);

    // Reset all mocks
    vi.mocked(serviceManager.listServices).mockReset();
    vi.mocked(serviceManager.getServiceStatus).mockReset();
    vi.mocked(serviceManager.startService).mockReset();
    vi.mocked(serviceManager.stopService).mockReset();
    vi.mocked(serviceManager.restartService).mockReset();
    vi.mocked(serviceManager.getServiceLogs).mockReset();
    vi.mocked(serviceManager.clearLogs).mockReset();
    vi.mocked(serviceManager.getLogPath).mockReset();
    vi.mocked(serviceManager.watchLogs).mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ============================================================================
  // service status Tests
  // ============================================================================

  describe("service status", () => {
    it("should show all services status", async () => {
      const mockServices: ServiceInfo[] = [
        {
          name: "mcp:filesystem",
          type: "mcp",
          status: "running",
          pid: 12345,
          uptime: "2h",
        },
        {
          name: "mcp:git",
          type: "mcp",
          status: "running",
          pid: 12346,
          uptime: "2h",
        },
        {
          name: "viben:sync",
          type: "viben",
          status: "stopped",
        },
      ];

      vi.mocked(serviceManager.listServices).mockResolvedValue(mockServices);

      await program.parseAsync(["node", "viben", "service", "status"]);

      expect(serviceManager.listServices).toHaveBeenCalled();
      const output = logOutput.join("\n");
      expect(output).toContain("Services:");
      expect(output).toContain("mcp:filesystem");
      expect(output).toContain("mcp:git");
      expect(output).toContain("viben:sync");
    });

    it("should show single service status when name is provided", async () => {
      const mockService: ServiceInfo = {
        name: "mcp:filesystem",
        type: "mcp",
        status: "running",
        pid: 12345,
        uptime: "2h 30m",
        command: "npx",
        args: ["-y", "@anthropic-ai/mcp-server-filesystem"],
      };

      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue(mockService);

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "status",
        "mcp:filesystem",
      ]);

      expect(serviceManager.getServiceStatus).toHaveBeenCalledWith(
        "mcp:filesystem"
      );
      const output = logOutput.join("\n");
      expect(output).toContain("Service: mcp:filesystem");
      expect(output).toContain("mcp");
      expect(output).toContain("running");
      expect(output).toContain("12345");
      expect(output).toContain("2h 30m");
    });

    it("should output JSON format with --json flag for all services", async () => {
      const mockServices: ServiceInfo[] = [
        {
          name: "mcp:filesystem",
          type: "mcp",
          status: "running",
          pid: 12345,
          uptime: "2h",
        },
      ];

      vi.mocked(serviceManager.listServices).mockResolvedValue(mockServices);

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "service",
        "status",
      ]);

      expect(logOutput.length).toBeGreaterThan(0);
      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.data.services).toHaveLength(1);
      expect(jsonOutput.data.services[0].name).toBe("mcp:filesystem");
      expect(jsonOutput.data.services[0].status).toBe("running");
      expect(jsonOutput.data.count).toBe(1);
    });

    it("should output JSON format for single service status", async () => {
      const mockService: ServiceInfo = {
        name: "gateway",
        type: "gateway",
        status: "running",
        pid: 9999,
        uptime: "1d 2h",
      };

      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue(mockService);

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "service",
        "status",
        "gateway",
      ]);

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.data.name).toBe("gateway");
      expect(jsonOutput.data.type).toBe("gateway");
      expect(jsonOutput.data.status).toBe("running");
      expect(jsonOutput.data.pid).toBe(9999);
    });

    it("should show hint when no services are tracked", async () => {
      vi.mocked(serviceManager.listServices).mockResolvedValue([]);

      await program.parseAsync(["node", "viben", "service", "status"]);

      const output = logOutput.join("\n");
      expect(output).toContain("No services tracked.");
    });

    it("should show error field when service has failed status", async () => {
      const mockService: ServiceInfo = {
        name: "mcp:failing",
        type: "mcp",
        status: "failed",
        error: "Process crashed unexpectedly",
      };

      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue(mockService);

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "status",
        "mcp:failing",
      ]);

      const output = logOutput.join("\n");
      expect(output).toContain("Error:");
      expect(output).toContain("Process crashed unexpectedly");
    });

    it("should handle error during status retrieval", async () => {
      vi.mocked(serviceManager.listServices).mockRejectedValue(
        new Error("Failed to read service state")
      );

      await expect(
        program.parseAsync(["node", "viben", "service", "status"])
      ).rejects.toThrow("process.exit(1)");

      const errOutput = errorOutput.join("\n");
      expect(errOutput).toContain("Failed to read service state");
    });
  });

  // ============================================================================
  // service start Tests
  // ============================================================================

  describe("service start", () => {
    it("should start a service by name", async () => {
      const mockService: ServiceInfo = {
        name: "mcp:filesystem",
        type: "mcp",
        status: "running",
        pid: 12345,
        command: "npx",
        args: ["-y", "@anthropic-ai/mcp-server-filesystem"],
      };

      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "mcp:filesystem",
        type: "mcp",
        status: "stopped",
      });
      vi.mocked(serviceManager.startService).mockResolvedValue(mockService);

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "start",
        "mcp:filesystem",
      ]);

      expect(serviceManager.startService).toHaveBeenCalledWith(
        "mcp:filesystem",
        undefined,
        undefined
      );
      const output = logOutput.join("\n");
      expect(output).toContain("Started service mcp:filesystem");
      expect(output).toContain("PID: 12345");
    });

    it("should start a service with custom command", async () => {
      const mockService: ServiceInfo = {
        name: "custom:myservice",
        type: "custom",
        status: "running",
        pid: 12345,
        command: "/usr/local/bin/myservice",
        args: ["/home/user/data", "config.yaml"],
      };

      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "custom:myservice",
        type: "custom",
        status: "stopped",
      });
      vi.mocked(serviceManager.startService).mockResolvedValue(mockService);

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "start",
        "custom:myservice",
        "-c",
        "/usr/local/bin/myservice",
        "/home/user/data",
        "config.yaml",
      ]);

      expect(serviceManager.startService).toHaveBeenCalledWith(
        "custom:myservice",
        "/usr/local/bin/myservice",
        ["/home/user/data", "config.yaml"]
      );
    });

    it("should output JSON format for start command", async () => {
      const mockService: ServiceInfo = {
        name: "gateway",
        type: "gateway",
        status: "running",
        pid: 5678,
        command: "viben",
        args: ["gateway", "start"],
      };

      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "gateway",
        type: "gateway",
        status: "stopped",
      });
      vi.mocked(serviceManager.startService).mockResolvedValue(mockService);

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "service",
        "start",
        "gateway",
      ]);

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.data.name).toBe("gateway");
      expect(jsonOutput.data.status).toBe("running");
      expect(jsonOutput.data.pid).toBe(5678);
    });

    it("should show message when service is already running", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "mcp:filesystem",
        type: "mcp",
        status: "running",
        pid: 12345,
        uptime: "1h",
      });

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "start",
        "mcp:filesystem",
      ]);

      // startService should not be called when already running
      expect(serviceManager.startService).not.toHaveBeenCalled();
      const output = logOutput.join("\n");
      expect(output).toContain("already running");
    });

    it("should show error when service fails to start", async () => {
      const mockService: ServiceInfo = {
        name: "mcp:failing",
        type: "mcp",
        status: "failed",
        error: "Command not found",
      };

      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "mcp:failing",
        type: "mcp",
        status: "stopped",
      });
      vi.mocked(serviceManager.startService).mockResolvedValue(mockService);

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "start",
        "mcp:failing",
      ]);

      const output = errorOutput.join("\n");
      expect(output).toContain("Failed to start service mcp:failing");
    });

    it("should handle error during start", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "gateway",
        type: "gateway",
        status: "stopped",
      });
      vi.mocked(serviceManager.startService).mockRejectedValue(
        new Error("No command specified")
      );

      await expect(
        program.parseAsync(["node", "viben", "service", "start", "gateway"])
      ).rejects.toThrow("process.exit(1)");

      const errOutput = errorOutput.join("\n");
      expect(errOutput).toContain("No command specified");
    });
  });

  // ============================================================================
  // service stop Tests
  // ============================================================================

  describe("service stop", () => {
    it("should stop a running service", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "mcp:filesystem",
        type: "mcp",
        status: "running",
        pid: 12345,
      });
      vi.mocked(serviceManager.stopService).mockResolvedValue({
        name: "mcp:filesystem",
        type: "mcp",
        status: "stopped",
      });

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "stop",
        "mcp:filesystem",
      ]);

      expect(serviceManager.stopService).toHaveBeenCalledWith("mcp:filesystem");
      const output = logOutput.join("\n");
      expect(output).toContain("Stopped service mcp:filesystem");
      expect(output).toContain("Previous PID: 12345");
    });

    it("should output JSON format for stop command", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "gateway",
        type: "gateway",
        status: "running",
        pid: 5678,
      });
      vi.mocked(serviceManager.stopService).mockResolvedValue({
        name: "gateway",
        type: "gateway",
        status: "stopped",
      });

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "service",
        "stop",
        "gateway",
      ]);

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.data.name).toBe("gateway");
      expect(jsonOutput.data.status).toBe("stopped");
      expect(jsonOutput.data.previousPid).toBe(5678);
    });

    it("should show message when service is not running", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "viben:sync",
        type: "viben",
        status: "stopped",
      });

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "stop",
        "viben:sync",
      ]);

      // stopService should not be called when not running
      expect(serviceManager.stopService).not.toHaveBeenCalled();
      const output = logOutput.join("\n");
      expect(output).toContain("is not running");
    });

    it("should handle error during stop", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "mcp:filesystem",
        type: "mcp",
        status: "running",
        pid: 12345,
      });
      vi.mocked(serviceManager.stopService).mockRejectedValue(
        new Error("Failed to send SIGTERM")
      );

      await expect(
        program.parseAsync([
          "node",
          "viben",
          "service",
          "stop",
          "mcp:filesystem",
        ])
      ).rejects.toThrow("process.exit(1)");

      const errOutput = errorOutput.join("\n");
      expect(errOutput).toContain("Failed to send SIGTERM");
    });
  });

  // ============================================================================
  // service restart Tests
  // ============================================================================

  describe("service restart", () => {
    it("should restart a service", async () => {
      const mockService: ServiceInfo = {
        name: "mcp:filesystem",
        type: "mcp",
        status: "running",
        pid: 12346,
      };

      vi.mocked(serviceManager.restartService).mockResolvedValue(mockService);

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "restart",
        "mcp:filesystem",
      ]);

      expect(serviceManager.restartService).toHaveBeenCalledWith(
        "mcp:filesystem",
        undefined,
        undefined
      );
      const output = logOutput.join("\n");
      expect(output).toContain("Restarted service mcp:filesystem");
      expect(output).toContain("PID: 12346");
    });

    it("should restart a service with custom command", async () => {
      const mockService: ServiceInfo = {
        name: "custom:myservice",
        type: "custom",
        status: "running",
        pid: 12347,
        command: "/new/path/myservice",
        args: ["/data/dir", "production"],
      };

      vi.mocked(serviceManager.restartService).mockResolvedValue(mockService);

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "restart",
        "custom:myservice",
        "-c",
        "/new/path/myservice",
        "/data/dir",
        "production",
      ]);

      expect(serviceManager.restartService).toHaveBeenCalledWith(
        "custom:myservice",
        "/new/path/myservice",
        ["/data/dir", "production"]
      );
    });

    it("should output JSON format for restart command", async () => {
      vi.mocked(serviceManager.restartService).mockResolvedValue({
        name: "gateway",
        type: "gateway",
        status: "running",
        pid: 9999,
      });

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "service",
        "restart",
        "gateway",
      ]);

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.data.name).toBe("gateway");
      expect(jsonOutput.data.status).toBe("running");
      expect(jsonOutput.data.pid).toBe(9999);
    });

    it("should show error when restart fails", async () => {
      vi.mocked(serviceManager.restartService).mockResolvedValue({
        name: "viben:sync",
        type: "viben",
        status: "failed",
        error: "No previous command found",
      });

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "restart",
        "viben:sync",
      ]);

      const output = logOutput.join("\n");
      expect(output).toContain("viben:sync status:");
      expect(output).toContain("Error:");
    });

    it("should handle error during restart", async () => {
      vi.mocked(serviceManager.restartService).mockRejectedValue(
        new Error("Service restart failed")
      );

      await expect(
        program.parseAsync([
          "node",
          "viben",
          "service",
          "restart",
          "mcp:filesystem",
        ])
      ).rejects.toThrow("process.exit(1)");

      const errOutput = errorOutput.join("\n");
      expect(errOutput).toContain("Service restart failed");
    });
  });

  // ============================================================================
  // service logs Tests
  // ============================================================================

  describe("service logs", () => {
    it("should show service logs", async () => {
      const mockLogs = [
        "2024-01-15T10:00:00Z Starting service...",
        "2024-01-15T10:00:01Z Service ready",
        "2024-01-15T10:00:02Z Handling request",
      ];

      vi.mocked(serviceManager.getServiceLogs).mockResolvedValue(mockLogs);
      vi.mocked(serviceManager.getLogPath).mockReturnValue(
        "/home/user/.viben/logs/mcp-filesystem.log"
      );

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "logs",
        "mcp:filesystem",
      ]);

      expect(serviceManager.getServiceLogs).toHaveBeenCalledWith(
        "mcp:filesystem",
        100
      );
      const output = logOutput.join("\n");
      expect(output).toContain("Logs for mcp:filesystem");
      expect(output).toContain("Starting service...");
      expect(output).toContain("Service ready");
      expect(output).toContain("Handling request");
    });

    it("should limit log lines with --lines option", async () => {
      const mockLogs = [
        "Line 1",
        "Line 2",
        "Line 3",
      ];

      vi.mocked(serviceManager.getServiceLogs).mockResolvedValue(mockLogs);
      vi.mocked(serviceManager.getLogPath).mockReturnValue(
        "/home/user/.viben/logs/gateway.log"
      );

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "logs",
        "gateway",
        "--lines",
        "50",
      ]);

      expect(serviceManager.getServiceLogs).toHaveBeenCalledWith("gateway", 50);
    });

    it("should output JSON format for logs command", async () => {
      const mockLogs = ["Log line 1", "Log line 2"];

      vi.mocked(serviceManager.getServiceLogs).mockResolvedValue(mockLogs);
      vi.mocked(serviceManager.getLogPath).mockReturnValue(
        "/home/user/.viben/logs/mcp-filesystem.log"
      );

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "service",
        "logs",
        "mcp:filesystem",
      ]);

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.data.name).toBe("mcp:filesystem");
      expect(jsonOutput.data.lines).toEqual(mockLogs);
      expect(jsonOutput.data.count).toBe(2);
      expect(jsonOutput.data.logPath).toBe(
        "/home/user/.viben/logs/mcp-filesystem.log"
      );
    });

    it("should show message when no logs available", async () => {
      vi.mocked(serviceManager.getServiceLogs).mockResolvedValue([]);
      vi.mocked(serviceManager.getLogPath).mockReturnValue(
        "/home/user/.viben/logs/viben-sync.log"
      );

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "logs",
        "viben:sync",
      ]);

      const output = logOutput.join("\n");
      expect(output).toContain("No logs available.");
    });

    it("should clear logs with --clear flag", async () => {
      vi.mocked(serviceManager.clearLogs).mockResolvedValue(undefined);

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "logs",
        "mcp:filesystem",
        "--clear",
      ]);

      expect(serviceManager.clearLogs).toHaveBeenCalledWith("mcp:filesystem");
      const output = logOutput.join("\n");
      expect(output).toContain("Cleared logs for service mcp:filesystem");
    });

    it("should output JSON format when clearing logs", async () => {
      vi.mocked(serviceManager.clearLogs).mockResolvedValue(undefined);

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "service",
        "logs",
        "mcp:filesystem",
        "--clear",
      ]);

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.data.name).toBe("mcp:filesystem");
      expect(jsonOutput.data.cleared).toBe(true);
    });

    it("should note follow mode not supported in JSON output", async () => {
      const mockLogs = ["Line 1"];

      vi.mocked(serviceManager.getServiceLogs).mockResolvedValue(mockLogs);
      vi.mocked(serviceManager.getLogPath).mockReturnValue(
        "/home/user/.viben/logs/gateway.log"
      );

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "service",
        "logs",
        "gateway",
        "-f",
      ]);

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.data.note).toContain(
        "Follow mode not supported in JSON output"
      );
    });

    it("should handle error during log retrieval", async () => {
      vi.mocked(serviceManager.getServiceLogs).mockRejectedValue(
        new Error("Failed to read log file")
      );
      vi.mocked(serviceManager.getLogPath).mockReturnValue(
        "/home/user/.viben/logs/mcp-filesystem.log"
      );

      await expect(
        program.parseAsync([
          "node",
          "viben",
          "service",
          "logs",
          "mcp:filesystem",
        ])
      ).rejects.toThrow("process.exit(1)");

      const errOutput = errorOutput.join("\n");
      expect(errOutput).toContain("Failed to read log file");
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should output JSON error when service not found with --json", async () => {
      const error = new Error("Service not found");
      vi.mocked(serviceManager.getServiceStatus).mockRejectedValue(error);

      await expect(
        program.parseAsync([
          "node",
          "viben",
          "--json",
          "service",
          "status",
          "nonexistent",
        ])
      ).rejects.toThrow("process.exit(1)");

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(false);
      expect(jsonOutput.error).toBeDefined();
      expect(jsonOutput.error.message).toContain("Service not found");
    });

    it("should show human-readable error for service operations", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "gateway",
        type: "gateway",
        status: "running",
        pid: 1234,
      });
      vi.mocked(serviceManager.stopService).mockRejectedValue(
        new Error("Permission denied: cannot stop process")
      );

      await expect(
        program.parseAsync(["node", "viben", "service", "stop", "gateway"])
      ).rejects.toThrow("process.exit(1)");

      const errOutput = errorOutput.join("\n");
      expect(errOutput).toContain("Permission denied");
    });
  });

  // ============================================================================
  // Service Type Display Tests
  // ============================================================================

  describe("service type display", () => {
    it("should display correct type for mcp services", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "mcp:filesystem",
        type: "mcp",
        status: "running",
        pid: 12345,
      });

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "status",
        "mcp:filesystem",
      ]);

      const output = logOutput.join("\n");
      expect(output).toContain("Type:");
      expect(output).toContain("mcp");
    });

    it("should display correct type for gateway service", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "gateway",
        type: "gateway",
        status: "running",
        pid: 12345,
      });

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "status",
        "gateway",
      ]);

      const output = logOutput.join("\n");
      expect(output).toContain("Type:");
      expect(output).toContain("gateway");
    });

    it("should display correct type for viben services", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "viben:sync",
        type: "viben",
        status: "stopped",
      });

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "status",
        "viben:sync",
      ]);

      const output = logOutput.join("\n");
      expect(output).toContain("Type:");
      expect(output).toContain("viben");
    });

    it("should display correct type for custom services", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "custom:myservice",
        type: "custom",
        status: "running",
        pid: 12345,
      });

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "status",
        "custom:myservice",
      ]);

      const output = logOutput.join("\n");
      expect(output).toContain("Type:");
      expect(output).toContain("custom");
    });
  });

  // ============================================================================
  // Command with full command output Tests
  // ============================================================================

  describe("command display in status", () => {
    it("should display full command with arguments", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "mcp:filesystem",
        type: "mcp",
        status: "running",
        pid: 12345,
        command: "npx",
        args: ["-y", "@anthropic-ai/mcp-server-filesystem", "/home/user"],
      });

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "status",
        "mcp:filesystem",
      ]);

      const output = logOutput.join("\n");
      expect(output).toContain("Command:");
      expect(output).toContain("npx");
      expect(output).toContain("-y");
      expect(output).toContain("@anthropic-ai/mcp-server-filesystem");
      expect(output).toContain("/home/user");
    });

    it("should display command without arguments", async () => {
      vi.mocked(serviceManager.getServiceStatus).mockResolvedValue({
        name: "gateway",
        type: "gateway",
        status: "running",
        pid: 12345,
        command: "viben-gateway",
      });

      await program.parseAsync([
        "node",
        "viben",
        "service",
        "status",
        "gateway",
      ]);

      const output = logOutput.join("\n");
      expect(output).toContain("Command:");
      expect(output).toContain("viben-gateway");
    });
  });
});
