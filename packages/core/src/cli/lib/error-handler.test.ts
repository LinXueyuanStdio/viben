/**
 * CLI Error Handler Tests
 *
 * Tests for error conversion and handling utilities used by CLI commands.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toCliError, handleCommandError, withErrorHandler } from "./error-handler";
import { CliError, type OutputContext } from "../types";
import {
  VibenError,
  NotFoundError,
  AlreadyExistsError,
  ValidationError,
  ExecutorError,
  ServiceError,
  CronError,
} from "../../error";

// Mock chalk for predictable output
vi.mock("chalk", () => ({
  default: {
    red: (str: string) => `[RED]${str}[/RED]`,
    green: (str: string) => `[GREEN]${str}[/GREEN]`,
    yellow: (str: string) => `[YELLOW]${str}[/YELLOW]`,
    blue: (str: string) => `[BLUE]${str}[/BLUE]`,
    gray: (str: string) => `[GRAY]${str}[/GRAY]`,
    bold: (str: string) => `[BOLD]${str}[/BOLD]`,
  },
}));

describe("toCliError", () => {
  describe("CliError passthrough", () => {
    it("should return CliError unchanged", () => {
      const original = new CliError("Test error", "TEST_CODE", 42);
      const result = toCliError(original);

      expect(result).toBe(original);
      expect(result.message).toBe("Test error");
      expect(result.code).toBe("TEST_CODE");
      expect(result.exitCode).toBe(42);
    });
  });

  describe("NotFoundError conversion", () => {
    it("should convert NotFoundError to CliError with NOT_FOUND code", () => {
      const error = new NotFoundError("Agent", "claude");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("NOT_FOUND");
      expect(result.message).toContain("Agent");
      expect(result.message).toContain("claude");
      expect(result.message).toContain("not found");
    });
  });

  describe("AlreadyExistsError conversion", () => {
    it("should convert AlreadyExistsError to CliError with ALREADY_EXISTS code", () => {
      const error = new AlreadyExistsError("Workspace", "my-project");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("ALREADY_EXISTS");
      expect(result.message).toContain("Workspace");
      expect(result.message).toContain("my-project");
      expect(result.message).toContain("already exists");
    });
  });

  describe("ValidationError conversion", () => {
    it("should convert ValidationError with field to CliError", () => {
      const error = new ValidationError("Name cannot be empty", "name");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("INVALID_ARGUMENT");
      expect(result.message).toContain("name");
      expect(result.message).toContain("Name cannot be empty");
    });

    it("should convert ValidationError without field to CliError", () => {
      const error = new ValidationError("Invalid input format");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("INVALID_ARGUMENT");
      expect(result.message).toContain("input");
      expect(result.message).toContain("Invalid input format");
    });
  });

  describe("ExecutorError conversion", () => {
    it("should convert ExecutorError to CliError", () => {
      const error = new ExecutorError("Spawn failed", "claude", "SPAWN_ERROR");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("SPAWN_ERROR");
      expect(result.message).toBe("Spawn failed");
      expect(result.exitCode).toBe(1);
    });

    it("should convert ExecutorError from static method", () => {
      const error = ExecutorError.executableNotFound("node");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("EXECUTABLE_NOT_FOUND");
      expect(result.message).toContain("node");
    });
  });

  describe("ServiceError conversion", () => {
    it("should convert ServiceError to CliError", () => {
      const error = new ServiceError("Service failed", "gateway", "SERVICE_ERROR");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("SERVICE_ERROR");
      expect(result.message).toBe("Service failed");
      expect(result.exitCode).toBe(1);
    });

    it("should convert ServiceError from static method", () => {
      const error = ServiceError.notFound("gateway");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("SERVICE_NOT_FOUND");
      expect(result.message).toContain("gateway");
    });
  });

  describe("CronError conversion", () => {
    it("should convert CronError to CliError", () => {
      const error = new CronError("Cron job failed", "CRON_ERROR");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("CRON_ERROR");
      expect(result.message).toBe("Cron job failed");
      expect(result.exitCode).toBe(1);
    });

    it("should convert CronError from static method", () => {
      const error = CronError.notFound("job-123");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("JOB_NOT_FOUND");
      expect(result.message).toContain("job-123");
    });
  });

  describe("Generic VibenError conversion", () => {
    it("should convert VibenError to CliError", () => {
      const error = new VibenError("Generic Viben error", "VIBEN_ERROR");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("VIBEN_ERROR");
      expect(result.message).toBe("Generic Viben error");
      expect(result.exitCode).toBe(1);
    });
  });

  describe("Standard Error conversion", () => {
    it("should convert generic Error to CliError with UNKNOWN_ERROR code", () => {
      const error = new Error("Something went wrong");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("Something went wrong");
      expect(result.exitCode).toBe(1);
    });

    it("should convert TypeError to CliError", () => {
      const error = new TypeError("Cannot read property of undefined");
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("Cannot read property of undefined");
    });
  });

  describe("Non-Error value conversion", () => {
    it("should convert string to CliError", () => {
      const result = toCliError("String error");

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("String error");
      expect(result.exitCode).toBe(1);
    });

    it("should convert number to CliError", () => {
      const result = toCliError(404);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("404");
    });

    it("should convert object to CliError", () => {
      const result = toCliError({ error: true });

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("[object Object]");
    });

    it("should convert null to CliError", () => {
      const result = toCliError(null);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("null");
    });

    it("should convert undefined to CliError", () => {
      const result = toCliError(undefined);

      expect(result).toBeInstanceOf(CliError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("undefined");
    });
  });
});

describe("handleCommandError", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;
  let exitCode: number | undefined;

  beforeEach(() => {
    exitCode = undefined;
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(((code: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as () => never);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("should output error in JSON format when ctx.json is true", () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: false };
    const error = new CliError("Test error", "TEST_CODE", 1);

    expect(() => handleCommandError(ctx, error)).toThrow(/process\.exit/);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"success": false')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"code": "TEST_CODE"')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"message": "Test error"')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should output human-readable error when ctx.json is false", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const error = new CliError("Test error", "TEST_CODE", 1);

    expect(() => handleCommandError(ctx, error)).toThrow(/process\.exit/);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[RED]Error: Test error[/RED]"
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should include error code in verbose mode", () => {
    const ctx: OutputContext = { json: false, verbose: true, quiet: false };
    const error = new CliError("Test error", "TEST_CODE", 1);

    expect(() => handleCommandError(ctx, error)).toThrow(/process\.exit/);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[RED]Error: Test error[/RED]"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[GRAY]Code: TEST_CODE[/GRAY]"
    );
  });

  it("should convert non-CliError before handling", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const error = new NotFoundError("Agent", "claude");

    expect(() => handleCommandError(ctx, error)).toThrow(/process\.exit/);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("not found")
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should use correct exit code from CliError", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const error = new CliError("Critical error", "CRITICAL", 2);

    expect(() => handleCommandError(ctx, error)).toThrow(/process\.exit/);

    expect(processExitSpy).toHaveBeenCalledWith(2);
  });

  it("should handle generic Error", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const error = new Error("Generic error");

    expect(() => handleCommandError(ctx, error)).toThrow(/process\.exit/);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[RED]Error: Generic error[/RED]"
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

describe("withErrorHandler", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;
  let exitCode: number | undefined;

  beforeEach(() => {
    exitCode = undefined;
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(((code: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as () => never);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("should wrap handler and execute successfully", async () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const handler = vi.fn().mockResolvedValue(undefined);

    const wrapped = withErrorHandler(ctx, handler);
    await wrapped("arg1", "arg2");

    expect(handler).toHaveBeenCalledWith("arg1", "arg2");
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("should catch errors and call handleCommandError", async () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const error = new CliError("Handler failed", "HANDLER_ERROR", 1);
    const handler = vi.fn().mockRejectedValue(error);

    const wrapped = withErrorHandler(ctx, handler);

    await expect(wrapped()).rejects.toThrow(/process\.exit/);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[RED]Error: Handler failed[/RED]"
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should handle sync errors thrown in handler", async () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const handler = vi.fn().mockImplementation(() => {
      throw new Error("Sync error");
    });

    const wrapped = withErrorHandler(ctx, handler);

    await expect(wrapped()).rejects.toThrow(/process\.exit/);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[RED]Error: Sync error[/RED]"
    );
  });

  it("should preserve handler arguments", async () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const handler = vi.fn().mockResolvedValue(undefined);

    const wrapped = withErrorHandler(ctx, handler);
    await wrapped("test", 42, true);

    expect(handler).toHaveBeenCalledWith("test", 42, true);
  });

  it("should handle errors in JSON mode", async () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: false };
    const error = new NotFoundError("Config", "settings.json");
    const handler = vi.fn().mockRejectedValue(error);

    const wrapped = withErrorHandler(ctx, handler);

    await expect(wrapped()).rejects.toThrow(/process\.exit/);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"success": false')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"code": "NOT_FOUND"')
    );
  });

  it("should work with no arguments", async () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const handler = vi.fn().mockResolvedValue(undefined);

    const wrapped = withErrorHandler(ctx, handler);
    await wrapped();

    expect(handler).toHaveBeenCalled();
  });

  it("should handle handler returning a value (though typically void)", async () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    // Even though the type says Promise<void>, we can test it doesn't break
    const handler = vi.fn().mockResolvedValue("result");

    const wrapped = withErrorHandler(ctx, handler);
    await wrapped();

    expect(handler).toHaveBeenCalled();
    // No errors should be thrown
    expect(processExitSpy).not.toHaveBeenCalled();
  });
});
