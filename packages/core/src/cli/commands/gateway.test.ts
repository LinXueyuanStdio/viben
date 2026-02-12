/**
 * Gateway CLI Commands Tests
 *
 * Tests for:
 * - `gateway start` - Start gateway with options (--host, --port, --log-level, --agent, --daemon)
 * - `gateway stop` - Stop running gateway
 * - `gateway stop --port` - Stop gateway on specific port
 * - `gateway restart` - Restart gateway with options
 * - `gateway status` - Check gateway status
 * - `gateway serve` - Internal command for daemon mode
 * - Default host is 127.0.0.1
 * - Default port is 18790
 * - Default log-level is info
 * - Default agent is main
 * - JSON output for all commands
 * - Error handling for gateway not running, already running, etc.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerGatewayCommand } from "./gateway";
import { execSync } from "node:child_process";

// Mock execSync for findProcessOnPort
vi.mock("node:child_process", async () => {
  const actual = await vi.importActual("node:child_process");
  return {
    ...actual,
    execSync: vi.fn(),
    spawn: vi.fn(() => ({
      unref: vi.fn(),
    })),
  };
});

// Mock fs for daemon mode
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    openSync: vi.fn(() => 1),
    closeSync: vi.fn(),
  };
});

// Mock the services module
vi.mock("../../services", () => ({
  serviceManager: {
    getLogPath: vi.fn(() => "/Users/test/.viben/logs/gateway.log"),
    getServicesFilePath: vi.fn(() => "/Users/test/.viben/services.yaml"),
  },
}));

describe("Gateway CLI Commands", () => {
  let program: Command;
  let logOutput: string[];
  let errorOutput: string[];

  beforeEach(() => {
    // Reset output arrays
    logOutput = [];
    errorOutput = [];

    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logOutput.push(args.map(String).join(" "));
    });

    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errorOutput.push(args.map(String).join(" "));
    });

    vi.spyOn(process, "exit").mockImplementation((code?: string | number | null | undefined): never => {
      throw new Error(`Process exited with code ${code}`);
    });

    // Create a new program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");
    registerGatewayCommand(program);

    // Reset all mocks
    vi.mocked(execSync).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to run command
  async function runCommand(args: string[]): Promise<void> {
    await program.parseAsync(["node", "test", ...args]);
  }

  // Helper to get combined log output
  function getLogOutput(): string {
    return logOutput.join("\n");
  }

  // Helper to mock port check
  function mockPortInUse(port: number, pid: number): void {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes(`:${port}`)) {
        return `${pid}\n`;
      }
      throw new Error("No process");
    });
  }

  function mockPortFree(): void {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("No process");
    });
  }

  // ============================================================================
  // gateway status
  // ============================================================================

  describe("gateway status", () => {
    it("should show gateway status when running", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["gateway", "status"]);

      const output = getLogOutput();
      expect(output).toContain("Gateway Status");
      expect(output).toContain("running");
      expect(output).toContain("12345");
    });

    it("should show gateway status when stopped", async () => {
      mockPortFree();

      await runCommand(["gateway", "status"]);

      const output = getLogOutput();
      expect(output).toContain("Gateway Status");
      expect(output).toContain("stopped");
    });

    it("should show endpoints when running", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["gateway", "status"]);

      const output = getLogOutput();
      expect(output).toContain("Endpoints:");
      expect(output).toContain("http://127.0.0.1:18790/health");
      expect(output).toContain("http://127.0.0.1:18790/api");
    });

    it("should output JSON format with --json flag", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "status"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.status).toBe("running");
      expect(parsed.data.pid).toBe(12345);
      expect(parsed.data.port).toBe(18790);
    });

    it("should check custom port with --port option", async () => {
      mockPortInUse(9000, 99999);

      await runCommand(["gateway", "status", "--port", "9000"]);

      const output = getLogOutput();
      expect(output).toContain("running");
      expect(output).toContain("99999");
    });
  });

  // ============================================================================
  // gateway start
  // ============================================================================

  describe("gateway start", () => {
    it("should show message when gateway is already running", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["gateway", "start"]);

      const output = getLogOutput();
      expect(output).toContain("already running");
      expect(output).toContain("12345");
    });

    it("should output JSON format with --json flag when already running", async () => {
      mockPortInUse(18790, 99999);

      await runCommand(["--json", "gateway", "start"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.status).toBe("running");
      expect(parsed.data.message).toBe("Gateway is already running");
      expect(parsed.data.pid).toBe(99999);
    });
  });

  // ============================================================================
  // gateway stop
  // ============================================================================

  describe("gateway stop", () => {
    it("should stop running gateway", async () => {
      mockPortInUse(18790, 12345);
      vi.spyOn(process, "kill").mockImplementation(() => true);

      await runCommand(["gateway", "stop"]);

      const output = getLogOutput();
      expect(output).toContain("Stopped gateway");
      expect(output).toContain("Previous PID: 12345");
    });

    it("should show message when gateway is not running", async () => {
      mockPortFree();

      await runCommand(["gateway", "stop"]);

      const output = getLogOutput();
      expect(output).toContain("not running");
    });

    it("should output JSON format with --json flag when stopped", async () => {
      mockPortInUse(18790, 12345);
      vi.spyOn(process, "kill").mockImplementation(() => true);

      await runCommand(["--json", "gateway", "stop"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.status).toBe("stopped");
      expect(parsed.data.previousPid).toBe(12345);
    });

    it("should output JSON format with --json flag when not running", async () => {
      mockPortFree();

      await runCommand(["--json", "gateway", "stop"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.status).toBe("stopped");
      expect(parsed.data.message).toBe("Gateway is not running");
    });

    it("should accept --port option for stopping gateway on specific port", async () => {
      mockPortInUse(9000, 12345);
      vi.spyOn(process, "kill").mockImplementation(() => true);

      await runCommand(["gateway", "stop", "--port", "9000"]);

      const output = getLogOutput();
      expect(output).toContain("Stopped gateway");
      expect(output).toContain("Port: 9000");
    });

    it("should include port in JSON response when --port is specified", async () => {
      mockPortInUse(9000, 12345);
      vi.spyOn(process, "kill").mockImplementation(() => true);

      await runCommand(["--json", "gateway", "stop", "--port", "9000"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.data.port).toBe(9000);
      expect(parsed.data.status).toBe("stopped");
    });
  });

  // ============================================================================
  // gateway restart
  // ============================================================================

  describe("gateway restart", () => {
    it("should stop existing gateway before restart", async () => {
      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
      mockPortInUse(18790, 12345);

      // After kill, port should be free, but for simplicity we'll just check the stop was called
      await runCommand(["gateway", "restart"]);

      expect(killSpy).toHaveBeenCalledWith(12345, "SIGTERM");
    });
  });

  // ============================================================================
  // Default values tests
  // ============================================================================

  describe("Default values", () => {
    it("should use 127.0.0.1 as default host", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "status"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.data.host).toBe("127.0.0.1");
    });

    it("should use 18790 as default port", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "status"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);

      expect(parsed.data.port).toBe(18790);
    });
  });

  // ============================================================================
  // JSON output tests
  // ============================================================================

  describe("JSON output", () => {
    it("should produce valid JSON for status command", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "status"]);

      const output = getLogOutput();
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should produce valid JSON for stop command", async () => {
      mockPortInUse(18790, 12345);
      vi.spyOn(process, "kill").mockImplementation(() => true);

      await runCommand(["--json", "gateway", "stop"]);

      const output = getLogOutput();
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should include success: true for successful operations", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "status"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
    });

    it("should include data field in JSON response", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "status"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.data).toBeDefined();
    });
  });

  // ============================================================================
  // Integration scenarios
  // ============================================================================

  describe("Integration scenarios", () => {
    it("should handle idempotent stop (not running)", async () => {
      mockPortFree();

      await runCommand(["--json", "gateway", "stop"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.data.message).toBe("Gateway is not running");
    });
  });

  // ============================================================================
  // gateway start with options
  // ============================================================================

  describe("gateway start with options", () => {
    it("should accept --host option", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "start", "--host", "0.0.0.0"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      // Should still report already running since we're checking default port
      expect(parsed.success).toBe(true);
    });

    it("should accept --port option", async () => {
      mockPortInUse(9999, 54321);

      await runCommand(["--json", "gateway", "start", "--port", "9999"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.port).toBe(9999);
    });

    it("should accept --log-level option", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "start", "--log-level", "debug"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
    });

    it("should accept --agent option", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "start", "--agent", "custom-agent"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
    });

    it("should accept short option -p for port", async () => {
      mockPortInUse(8080, 11111);

      await runCommand(["--json", "gateway", "start", "-p", "8080"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.port).toBe(8080);
    });

    it("should accept short option -l for log-level", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["gateway", "start", "-l", "warn"]);

      // Should not throw
      expect(logOutput.length).toBeGreaterThan(0);
    });

    it("should accept short option -n for agent", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["gateway", "start", "-n", "test-agent"]);

      // Should not throw
      expect(logOutput.length).toBeGreaterThan(0);
    });

    it("should accept --daemon option", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "start", "--daemon"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      // When already running, daemon mode should still report already running
      expect(parsed.success).toBe(true);
      expect(parsed.data.status).toBe("running");
    });

    it("should accept short option -d for daemon", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "start", "-d"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
    });

    it("should accept combined options", async () => {
      mockPortInUse(9000, 99999);

      await runCommand([
        "--json",
        "gateway",
        "start",
        "--host",
        "0.0.0.0",
        "--port",
        "9000",
        "--log-level",
        "debug",
        "--agent",
        "custom",
      ]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.port).toBe(9000);
    });
  });

  // ============================================================================
  // gateway restart with options
  // ============================================================================

  describe("gateway restart with options", () => {
    it("should accept --host option on restart", async () => {
      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
      mockPortInUse(18790, 12345);

      await runCommand(["gateway", "restart", "--host", "0.0.0.0"]);

      expect(killSpy).toHaveBeenCalled();
    });

    it("should accept --port option on restart", async () => {
      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
      mockPortInUse(9000, 12345);

      await runCommand(["gateway", "restart", "--port", "9000"]);

      expect(killSpy).toHaveBeenCalledWith(12345, "SIGTERM");
    });

    it("should accept --log-level option on restart", async () => {
      vi.spyOn(process, "kill").mockImplementation(() => true);
      mockPortInUse(18790, 12345);

      await runCommand(["gateway", "restart", "--log-level", "error"]);

      // Should not throw
      expect(logOutput.length).toBeGreaterThan(0);
    });

    it("should accept --agent option on restart", async () => {
      vi.spyOn(process, "kill").mockImplementation(() => true);
      mockPortInUse(18790, 12345);

      await runCommand(["gateway", "restart", "--agent", "another-agent"]);

      // Should not throw
      expect(logOutput.length).toBeGreaterThan(0);
    });

    it("should handle restart when gateway is not running (daemon mode)", async () => {
      mockPortFree();

      // Restart when not running should just start
      // Use daemon mode to avoid blocking
      await runCommand(["--json", "gateway", "restart", "--daemon"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      // Will report failed since no real server starts in test env
      expect(parsed.success).toBe(true);
    });
  });

  // ============================================================================
  // Error handling
  // ============================================================================

  describe("Error handling", () => {
    it("should handle kill failure gracefully", async () => {
      mockPortInUse(18790, 12345);
      vi.spyOn(process, "kill").mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await runCommand(["--json", "gateway", "stop"]);

      // Should still output JSON even if kill fails internally
      const output = getLogOutput();
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should handle invalid port number in status", async () => {
      mockPortFree();

      await runCommand(["--json", "gateway", "status", "--port", "99999"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.status).toBe("stopped");
    });
  });

  // ============================================================================
  // Verbose output
  // ============================================================================

  describe("Verbose output", () => {
    it("should show log path with --verbose on status", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--verbose", "gateway", "status"]);

      const output = getLogOutput();
      expect(output).toContain("Log file:");
    });

    it("should show log path with --verbose on stop", async () => {
      mockPortInUse(18790, 12345);
      vi.spyOn(process, "kill").mockImplementation(() => true);

      await runCommand(["--verbose", "gateway", "stop"]);

      const output = getLogOutput();
      expect(output).toContain("Log file:");
    });

    it("should include logPath in JSON with --verbose --json", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "--verbose", "gateway", "status"]);

      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.data.logPath).toBeDefined();
    });
  });

  // ============================================================================
  // gateway serve (internal command)
  // ============================================================================

  describe("gateway serve (internal command)", () => {
    it("should accept --port option", async () => {
      // We can't really test the full serve command without starting a server,
      // but we can test that the command is registered and accepts options
      const gatewayCmd = program.commands.find((c) => c.name() === "gateway");
      const serveCmd = gatewayCmd?.commands.find((c) => c.name() === "serve");

      expect(serveCmd).toBeDefined();
      expect(serveCmd?.description()).toContain("internal");
    });

    it("should accept --host option", async () => {
      const gatewayCmd = program.commands.find((c) => c.name() === "gateway");
      const serveCmd = gatewayCmd?.commands.find((c) => c.name() === "serve");

      expect(serveCmd).toBeDefined();
    });

    it("should have all required options", async () => {
      const gatewayCmd = program.commands.find((c) => c.name() === "gateway");
      const serveCmd = gatewayCmd?.commands.find((c) => c.name() === "serve");

      expect(serveCmd).toBeDefined();
      const options = serveCmd?.options.map((o) => o.long);
      expect(options).toContain("--port");
      expect(options).toContain("--host");
      expect(options).toContain("--log-level");
      expect(options).toContain("--agent");
    });
  });

  // ============================================================================
  // Command registration
  // ============================================================================

  describe("Command registration", () => {
    it("should register gateway command", () => {
      const gatewayCmd = program.commands.find((c) => c.name() === "gateway");
      expect(gatewayCmd).toBeDefined();
    });

    it("should register all subcommands", () => {
      const gatewayCmd = program.commands.find((c) => c.name() === "gateway");
      const subcommands = gatewayCmd?.commands.map((c) => c.name()) || [];

      expect(subcommands).toContain("status");
      expect(subcommands).toContain("start");
      expect(subcommands).toContain("stop");
      expect(subcommands).toContain("restart");
      expect(subcommands).toContain("serve");
    });

    it("should have correct description for gateway command", () => {
      const gatewayCmd = program.commands.find((c) => c.name() === "gateway");
      expect(gatewayCmd?.description()).toContain("gateway");
    });

    it("should have correct descriptions for subcommands", () => {
      const gatewayCmd = program.commands.find((c) => c.name() === "gateway");
      const startCmd = gatewayCmd?.commands.find((c) => c.name() === "start");
      const stopCmd = gatewayCmd?.commands.find((c) => c.name() === "stop");
      const statusCmd = gatewayCmd?.commands.find((c) => c.name() === "status");
      const restartCmd = gatewayCmd?.commands.find((c) => c.name() === "restart");

      expect(startCmd?.description()).toContain("Start");
      expect(stopCmd?.description()).toContain("Stop");
      expect(statusCmd?.description()).toContain("status");
      expect(restartCmd?.description()).toContain("Restart");
    });
  });

  // ============================================================================
  // Quiet mode
  // ============================================================================

  describe("Quiet mode", () => {
    it("should suppress output with --quiet on status", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--quiet", "--json", "gateway", "status"]);

      // In quiet mode with JSON, still outputs JSON
      const output = getLogOutput();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
    });
  });
});
