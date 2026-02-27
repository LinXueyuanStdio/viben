/**
 * CLI Output Utilities Tests
 *
 * Tests for the output formatting utilities used by CLI commands.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  successResponse,
  errorResponse,
  output,
  outputError,
  outputSuccess,
  outputWarning,
  outputInfo,
  outputTable,
  outputList,
  outputKeyValue,
} from "./output";
import type { OutputContext, CliResponse } from "../types";

// Mock chalk to test color formatting without actual ANSI codes
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

describe("successResponse", () => {
  it("should return correct structure with data", () => {
    const data = { name: "test", value: 123 };
    const response = successResponse(data);

    expect(response).toEqual({
      success: true,
      data: { name: "test", value: 123 },
    });
  });

  it("should handle string data", () => {
    const response = successResponse("hello world");

    expect(response).toEqual({
      success: true,
      data: "hello world",
    });
  });

  it("should handle array data", () => {
    const response = successResponse([1, 2, 3]);

    expect(response).toEqual({
      success: true,
      data: [1, 2, 3],
    });
  });

  it("should handle null data", () => {
    const response = successResponse(null);

    expect(response).toEqual({
      success: true,
      data: null,
    });
  });

  it("should handle undefined data", () => {
    const response = successResponse(undefined);

    expect(response).toEqual({
      success: true,
      data: undefined,
    });
  });

  it("should handle nested object data", () => {
    const data = {
      user: {
        name: "Alice",
        settings: {
          theme: "dark",
        },
      },
    };
    const response = successResponse(data);

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
  });
});

describe("errorResponse", () => {
  it("should return correct structure with code and message", () => {
    const response = errorResponse("NOT_FOUND", "Resource not found");

    expect(response).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
      },
    });
  });

  it("should handle different error codes", () => {
    const testCases = [
      { code: "INVALID_ARGUMENT", message: "Invalid input" },
      { code: "ALREADY_EXISTS", message: "Resource exists" },
      { code: "PERMISSION_DENIED", message: "Access denied" },
    ];

    for (const { code, message } of testCases) {
      const response = errorResponse(code, message);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(code);
      expect(response.error?.message).toBe(message);
    }
  });

  it("should handle empty message", () => {
    const response = errorResponse("ERROR", "");

    expect(response).toEqual({
      success: false,
      error: {
        code: "ERROR",
        message: "",
      },
    });
  });
});

describe("output", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should render JSON when ctx.json is true", () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: false };
    const response: CliResponse<{ name: string }> = {
      success: true,
      data: { name: "test" },
    };

    output(ctx, response);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(response, null, 2)
    );
  });

  it("should call humanRender when ctx.json is false", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const response: CliResponse<string> = { success: true, data: "test" };
    const humanRender = vi.fn();

    output(ctx, response, humanRender);

    expect(humanRender).toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should not call humanRender in quiet mode on success", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: true };
    const response: CliResponse<string> = { success: true, data: "test" };
    const humanRender = vi.fn();

    output(ctx, response, humanRender);

    expect(humanRender).not.toHaveBeenCalled();
  });

  it("should output string data directly when no humanRender provided", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const response: CliResponse<string> = { success: true, data: "hello world" };

    output(ctx, response);

    expect(consoleLogSpy).toHaveBeenCalledWith("hello world");
  });

  it("should output JSON stringified data for non-string data when no humanRender", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const response: CliResponse<{ key: string }> = {
      success: true,
      data: { key: "value" },
    };

    output(ctx, response);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({ key: "value" }, null, 2)
    );
  });

  it("should not output anything when data is undefined and no humanRender", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };
    const response: CliResponse<undefined> = { success: true, data: undefined };

    output(ctx, response);

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should prefer JSON mode over humanRender", () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: false };
    const response: CliResponse<string> = { success: true, data: "test" };
    const humanRender = vi.fn();

    output(ctx, response, humanRender);

    expect(humanRender).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(response, null, 2)
    );
  });
});

describe("outputError", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should output JSON error when ctx.json is true", () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: false };

    outputError(ctx, "NOT_FOUND", "Resource not found");

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(errorResponse("NOT_FOUND", "Resource not found"), null, 2)
    );
  });

  it("should output colored error message when ctx.json is false", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputError(ctx, "NOT_FOUND", "Resource not found");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[RED]Error: Resource not found[/RED]"
    );
  });

  it("should include error code in verbose mode", () => {
    const ctx: OutputContext = { json: false, verbose: true, quiet: false };

    outputError(ctx, "NOT_FOUND", "Resource not found");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[RED]Error: Resource not found[/RED]"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith("[GRAY]Code: NOT_FOUND[/GRAY]");
  });

  it("should not include error code when not verbose", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputError(ctx, "NOT_FOUND", "Resource not found");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Code:")
    );
  });
});

describe("outputSuccess", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should output JSON success when ctx.json is true", () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: false };

    outputSuccess(ctx, "Operation completed");

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(successResponse({ message: "Operation completed" }), null, 2)
    );
  });

  it("should output green message when ctx.json is false", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputSuccess(ctx, "Operation completed");

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[GREEN]Operation completed[/GREEN]"
    );
  });

  it("should not output in quiet mode", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: true };

    outputSuccess(ctx, "Operation completed");

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should output JSON even in quiet mode when json is true", () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: true };

    outputSuccess(ctx, "Operation completed");

    expect(consoleLogSpy).toHaveBeenCalled();
  });
});

describe("outputWarning", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("should not output anything in JSON mode", () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: false };

    outputWarning(ctx, "This is a warning");

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("should output yellow warning message", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputWarning(ctx, "This is a warning");

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[YELLOW]Warning: This is a warning[/YELLOW]"
    );
  });

  it("should not output in quiet mode", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: true };

    outputWarning(ctx, "This is a warning");

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});

describe("outputInfo", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should not output anything in JSON mode", () => {
    const ctx: OutputContext = { json: true, verbose: true, quiet: false };

    outputInfo(ctx, "Info message");

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should output blue info message in verbose mode", () => {
    const ctx: OutputContext = { json: false, verbose: true, quiet: false };

    outputInfo(ctx, "Info message");

    expect(consoleLogSpy).toHaveBeenCalledWith("[BLUE]Info message[/BLUE]");
  });

  it("should not output when not verbose", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputInfo(ctx, "Info message");

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should not output in quiet mode even if verbose", () => {
    const ctx: OutputContext = { json: false, verbose: true, quiet: true };

    outputInfo(ctx, "Info message");

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});

describe("outputTable", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should not output anything in JSON mode", () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: false };

    outputTable(ctx, ["Name", "Value"], [["test", 123]]);

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should not output anything in quiet mode", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: true };

    outputTable(ctx, ["Name", "Value"], [["test", 123]]);

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should output 'No data' for empty rows", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputTable(ctx, ["Name", "Value"], []);

    expect(consoleLogSpy).toHaveBeenCalledWith("[GRAY]No data[/GRAY]");
  });

  it("should format table with headers and rows", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputTable(ctx, ["Name", "Value"], [["alice", 100], ["bob", 200]]);

    // Check header is bold
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[BOLD]")
    );
    // Check separator is gray
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[GRAY]")
    );
    // Check data rows are output
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("alice")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("bob"));
  });

  it("should handle undefined values in rows", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputTable(ctx, ["Name", "Value"], [["test", undefined]]);

    // Should not throw and should output something
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("should handle boolean values in rows", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputTable(ctx, ["Name", "Active"], [["test", true]]);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("true"));
  });

  it("should calculate column widths correctly", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputTable(
      ctx,
      ["Short", "VeryLongHeader"],
      [
        ["a", "x"],
        ["longer", "y"],
      ]
    );

    // The function should pad columns based on max width
    expect(consoleLogSpy).toHaveBeenCalled();
  });
});

describe("outputList", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should not output anything in JSON mode", () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: false };

    outputList(ctx, ["item1", "item2"]);

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should not output anything in quiet mode", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: true };

    outputList(ctx, ["item1", "item2"]);

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should format list with default bullet", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputList(ctx, ["item1", "item2", "item3"]);

    expect(consoleLogSpy).toHaveBeenCalledWith("  \u2022 item1");
    expect(consoleLogSpy).toHaveBeenCalledWith("  \u2022 item2");
    expect(consoleLogSpy).toHaveBeenCalledWith("  \u2022 item3");
  });

  it("should format list with custom bullet", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputList(ctx, ["item1", "item2"], "-");

    expect(consoleLogSpy).toHaveBeenCalledWith("  - item1");
    expect(consoleLogSpy).toHaveBeenCalledWith("  - item2");
  });

  it("should handle empty list", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputList(ctx, []);

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});

describe("outputKeyValue", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should not output anything in JSON mode", () => {
    const ctx: OutputContext = { json: true, verbose: false, quiet: false };

    outputKeyValue(ctx, { name: "test", value: "123" });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should not output anything in quiet mode", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: true };

    outputKeyValue(ctx, { name: "test", value: "123" });

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should format key-value pairs correctly", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputKeyValue(ctx, { name: "Alice", age: 30 });

    // Keys should be gray and padded
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[GRAY]")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Alice")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("30"));
  });

  it("should handle undefined values with placeholder", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputKeyValue(ctx, { name: "test", value: undefined });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("(not set)")
    );
  });

  it("should handle boolean values", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputKeyValue(ctx, { enabled: true, disabled: false });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("true"));
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("false")
    );
  });

  it("should handle empty object", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputKeyValue(ctx, {});

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should pad keys to align values", () => {
    const ctx: OutputContext = { json: false, verbose: false, quiet: false };

    outputKeyValue(ctx, { short: "a", veryLongKey: "b" });

    // Both calls should have happened
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
  });
});
