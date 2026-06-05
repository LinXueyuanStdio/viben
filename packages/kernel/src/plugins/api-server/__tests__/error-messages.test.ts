import { describe, it, expect } from "vitest";
import { BadRequestError, globalErrorHandler } from "../middleware/error-handler.js";

/**
 * Tests that path-related errors produce clear, actionable messages
 * rather than generic 500 "Internal server error" responses.
 */
describe("globalErrorHandler — workspace path errors", () => {
  function mockReply() {
    let statusCode = 200;
    let body: unknown;
    return {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(b: unknown) {
        body = b;
        return this;
      },
      get statusCode() {
        return statusCode;
      },
      get body() {
        return body as Record<string, { code: string; message: string; statusCode: number }>;
      },
    };
  }

  it("returns 400 with clear message for INVALID_WORKSPACE error", () => {
    const reply = mockReply();
    const err = new BadRequestError(
      "INVALID_WORKSPACE",
      'Workspace path "/Users/lucas/code/accnest" does not exist.',
    );
    globalErrorHandler(err, {} as any, reply as any);

    expect(reply.statusCode).toBe(400);
    expect(reply.body.error.code).toBe("INVALID_WORKSPACE");
    expect(reply.body.error.message).toContain("does not exist");
    expect(reply.body.error.statusCode).toBe(400);
  });

  it("returns 400 with allowExternalWorkspaces guidance when path is outside baseDir", () => {
    const reply = mockReply();
    const err = new BadRequestError(
      "INVALID_WORKSPACE",
      'Workspace path "/some/external" is outside base directory "~/viben-workspace". Set allowExternalWorkspaces: true to allow this.',
    );
    globalErrorHandler(err, {} as any, reply as any);

    expect(reply.statusCode).toBe(400);
    expect(reply.body.error.message).toContain("allowExternalWorkspaces");
  });

  it("returns 400 with message for invalid workspace name", () => {
    const reply = mockReply();
    const err = new BadRequestError(
      "INVALID_WORKSPACE",
      'Invalid workspace name: "my project". Only alphanumeric characters, hyphens, and underscores are allowed.',
    );
    globalErrorHandler(err, {} as any, reply as any);

    expect(reply.statusCode).toBe(400);
    expect(reply.body.error.message).toContain("Invalid workspace name");
  });
});

/**
 * Tests for the extractApiError helper in cli/commands/api.ts.
 * Since the helper is local to the module, we test the logic directly.
 */
describe("API error extraction logic", () => {
  function extractApiError(data: Record<string, unknown>, fallback = "API request failed"): string {
    const err = data.error;
    if (!err) return fallback;
    if (typeof err === "string") return err;
    if (typeof err === "object" && err !== null && "message" in err) {
      return String((err as Record<string, unknown>).message);
    }
    return fallback;
  }

  it("extracts message from structured error object (globalErrorHandler format)", () => {
    const data = {
      error: {
        code: "INVALID_WORKSPACE",
        message: 'Workspace path "/foo" does not exist.',
        statusCode: 400,
      },
    };
    expect(extractApiError(data)).toBe('Workspace path "/foo" does not exist.');
  });

  it("returns plain string error as-is", () => {
    const data = { error: "Max concurrent sessions (20) reached." };
    expect(extractApiError(data)).toBe("Max concurrent sessions (20) reached.");
  });

  it("returns fallback when error is missing", () => {
    expect(extractApiError({})).toBe("API request failed");
    expect(extractApiError({}, "custom fallback")).toBe("custom fallback");
  });

  it("returns fallback instead of [object Object] for unknown shape", () => {
    const data = { error: { someOtherField: "value" } };
    const result = extractApiError(data);
    expect(result).not.toBe("[object Object]");
    expect(result).toBe("API request failed");
  });
});
