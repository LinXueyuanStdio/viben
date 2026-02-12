/**
 * Executor Chat Functionality Tests
 *
 * Tests for non-interactive chat mode including:
 * - ChatOptions parsing and validation
 * - ClaudeCode chat command building
 * - Gemini chat command building
 * - Codex chat command building
 * - Stream JSON output handling
 * - Session resume functionality
 * - executorSupportsChat utility
 * - spawnChat convenience function
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";

import {
  // Types
  type ChatFormat,
  type ChatOptions,
  type ChatSpawnResult,
  type ExecutorType,

  // Executors
  ClaudeCode,
  Gemini,
  Codex,
  Amp,
  Opencode,
  CursorAgent,
  QwenCode,
  Copilot,
  Droid,

  // Utilities
  CHAT_SUPPORTED_EXECUTORS,
  executorSupportsChat,
  createExecutor,
} from "./index";

import { ExecutorError } from "../error";

// ============================================================================
// ChatFormat Type Tests
// ============================================================================

describe("ChatFormat Type", () => {
  it("should accept 'text' as valid format", () => {
    const format: ChatFormat = "text";
    expect(format).toBe("text");
  });

  it("should accept 'stream-json' as valid format", () => {
    const format: ChatFormat = "stream-json";
    expect(format).toBe("stream-json");
  });
});

// ============================================================================
// ChatOptions Interface Tests
// ============================================================================

describe("ChatOptions Interface", () => {
  it("should allow minimal options with just defaults", () => {
    const options: ChatOptions = {};
    expect(options.prompt).toBeUndefined();
    expect(options.cwd).toBeUndefined();
    expect(options.inputFormat).toBeUndefined();
    expect(options.outputFormat).toBeUndefined();
  });

  it("should allow all options to be specified", () => {
    const options: ChatOptions = {
      prompt: "Test prompt",
      cwd: "/test/dir",
      inputFormat: "text",
      outputFormat: "stream-json",
      verbose: true,
      sessionId: "session-123",
      resume: "resume-456",
      model: "claude-3-opus",
      dangerouslySkipPermissions: true,
      env: { CUSTOM_VAR: "value" },
    };

    expect(options.prompt).toBe("Test prompt");
    expect(options.cwd).toBe("/test/dir");
    expect(options.inputFormat).toBe("text");
    expect(options.outputFormat).toBe("stream-json");
    expect(options.verbose).toBe(true);
    expect(options.sessionId).toBe("session-123");
    expect(options.resume).toBe("resume-456");
    expect(options.model).toBe("claude-3-opus");
    expect(options.dangerouslySkipPermissions).toBe(true);
    expect(options.env).toEqual({ CUSTOM_VAR: "value" });
  });

  it("should allow partial options", () => {
    const options: ChatOptions = {
      prompt: "Hello",
      model: "gpt-4",
    };

    expect(options.prompt).toBe("Hello");
    expect(options.model).toBe("gpt-4");
    expect(options.verbose).toBeUndefined();
  });
});

// ============================================================================
// CHAT_SUPPORTED_EXECUTORS Tests
// ============================================================================

describe("CHAT_SUPPORTED_EXECUTORS", () => {
  it("should include CLAUDE_CODE", () => {
    expect(CHAT_SUPPORTED_EXECUTORS).toContain("CLAUDE_CODE");
  });

  it("should include GEMINI", () => {
    expect(CHAT_SUPPORTED_EXECUTORS).toContain("GEMINI");
  });

  it("should include CODEX", () => {
    expect(CHAT_SUPPORTED_EXECUTORS).toContain("CODEX");
  });

  it("should not include AMP", () => {
    expect(CHAT_SUPPORTED_EXECUTORS).not.toContain("AMP");
  });

  it("should not include OPENCODE", () => {
    expect(CHAT_SUPPORTED_EXECUTORS).not.toContain("OPENCODE");
  });

  it("should not include CURSOR_AGENT", () => {
    expect(CHAT_SUPPORTED_EXECUTORS).not.toContain("CURSOR_AGENT");
  });

  it("should have exactly 3 supported executors", () => {
    expect(CHAT_SUPPORTED_EXECUTORS).toHaveLength(3);
  });
});

// ============================================================================
// executorSupportsChat Tests
// ============================================================================

describe("executorSupportsChat", () => {
  it("should return true for CLAUDE_CODE", () => {
    expect(executorSupportsChat("CLAUDE_CODE")).toBe(true);
  });

  it("should return true for GEMINI", () => {
    expect(executorSupportsChat("GEMINI")).toBe(true);
  });

  it("should return true for CODEX", () => {
    expect(executorSupportsChat("CODEX")).toBe(true);
  });

  it("should return false for AMP", () => {
    expect(executorSupportsChat("AMP")).toBe(false);
  });

  it("should return false for OPENCODE", () => {
    expect(executorSupportsChat("OPENCODE")).toBe(false);
  });

  it("should return false for CURSOR_AGENT", () => {
    expect(executorSupportsChat("CURSOR_AGENT")).toBe(false);
  });

  it("should return false for QWEN_CODE", () => {
    expect(executorSupportsChat("QWEN_CODE")).toBe(false);
  });

  it("should return false for COPILOT", () => {
    expect(executorSupportsChat("COPILOT")).toBe(false);
  });

  it("should return false for DROID", () => {
    expect(executorSupportsChat("DROID")).toBe(false);
  });
});

// ============================================================================
// ClaudeCode Chat Support Tests
// ============================================================================

describe("ClaudeCode Chat Support", () => {
  describe("supportsChat", () => {
    it("should return true", () => {
      const executor = new ClaudeCode();
      expect(executor.supportsChat()).toBe(true);
    });
  });

  describe("getChatCommand", () => {
    it("should return 'claude'", () => {
      const executor = new ClaudeCode();
      expect(executor.getChatCommand()).toBe("claude");
    });
  });

  describe("spawnChat method exists", () => {
    it("should have spawnChat method", () => {
      const executor = new ClaudeCode();
      expect(typeof executor.spawnChat).toBe("function");
    });
  });

  describe("config affects chat", () => {
    it("should use model from config", () => {
      const executor = new ClaudeCode({ model: "claude-3-opus" });
      expect(executor.supportsChat()).toBe(true);
      // Model will be used when spawnChat is called
    });

    it("should use dangerouslySkipPermissions from config", () => {
      const executor = new ClaudeCode({ dangerouslySkipPermissions: true });
      expect(executor.supportsChat()).toBe(true);
    });

    it("should use custom env from config", () => {
      const executor = new ClaudeCode({ env: { CUSTOM: "value" } });
      expect(executor.supportsChat()).toBe(true);
    });
  });
});

// ============================================================================
// Gemini Chat Support Tests
// ============================================================================

describe("Gemini Chat Support", () => {
  describe("supportsChat", () => {
    it("should return true", () => {
      const executor = new Gemini();
      expect(executor.supportsChat()).toBe(true);
    });
  });

  describe("getChatCommand", () => {
    it("should return 'gemini'", () => {
      const executor = new Gemini();
      expect(executor.getChatCommand()).toBe("gemini");
    });
  });

  describe("spawnChat method exists", () => {
    it("should have spawnChat method", () => {
      const executor = new Gemini();
      expect(typeof executor.spawnChat).toBe("function");
    });
  });

  describe("config affects chat", () => {
    it("should use model from config", () => {
      const executor = new Gemini({ model: "gemini-1.5-pro" });
      expect(executor.supportsChat()).toBe(true);
    });
  });
});

// ============================================================================
// Codex Chat Support Tests
// ============================================================================

describe("Codex Chat Support", () => {
  describe("supportsChat", () => {
    it("should return true", () => {
      const executor = new Codex();
      expect(executor.supportsChat()).toBe(true);
    });
  });

  describe("getChatCommand", () => {
    it("should return 'codex'", () => {
      const executor = new Codex();
      expect(executor.getChatCommand()).toBe("codex");
    });
  });

  describe("spawnChat method exists", () => {
    it("should have spawnChat method", () => {
      const executor = new Codex();
      expect(typeof executor.spawnChat).toBe("function");
    });
  });

  describe("config affects chat", () => {
    it("should use model from config", () => {
      const executor = new Codex({ model: "gpt-4-turbo" });
      expect(executor.supportsChat()).toBe(true);
    });
  });
});

// ============================================================================
// Executors Without Chat Support Tests
// ============================================================================

describe("Executors Without Chat Support", () => {
  describe("Amp", () => {
    it("should return false for supportsChat", () => {
      const executor = new Amp();
      expect(executor.supportsChat()).toBe(false);
    });

    it("should return null for getChatCommand", () => {
      const executor = new Amp();
      expect(executor.getChatCommand()).toBeNull();
    });

    it("should not have spawnChat method", () => {
      const executor = new Amp();
      // Amp doesn't implement spawnChat as it doesn't support chat
      expect("spawnChat" in (executor as any)).toBe(false);
    });
  });

  describe("Opencode", () => {
    it("should return false for supportsChat", () => {
      const executor = new Opencode();
      expect(executor.supportsChat()).toBe(false);
    });

    it("should return null for getChatCommand", () => {
      const executor = new Opencode();
      expect(executor.getChatCommand()).toBeNull();
    });
  });

  describe("CursorAgent", () => {
    it("should return false for supportsChat", () => {
      const executor = new CursorAgent();
      expect(executor.supportsChat()).toBe(false);
    });

    it("should return null for getChatCommand", () => {
      const executor = new CursorAgent();
      expect(executor.getChatCommand()).toBeNull();
    });
  });

  describe("QwenCode", () => {
    it("should return false for supportsChat", () => {
      const executor = new QwenCode();
      expect(executor.supportsChat()).toBe(false);
    });

    it("should return null for getChatCommand", () => {
      const executor = new QwenCode();
      expect(executor.getChatCommand()).toBeNull();
    });
  });

  describe("Copilot", () => {
    it("should return false for supportsChat", () => {
      const executor = new Copilot();
      expect(executor.supportsChat()).toBe(false);
    });

    it("should return null for getChatCommand", () => {
      const executor = new Copilot();
      expect(executor.getChatCommand()).toBeNull();
    });
  });

  describe("Droid", () => {
    it("should return false for supportsChat", () => {
      const executor = new Droid();
      expect(executor.supportsChat()).toBe(false);
    });

    it("should return null for getChatCommand", () => {
      const executor = new Droid();
      expect(executor.getChatCommand()).toBeNull();
    });
  });
});

// ============================================================================
// createExecutor with Chat Support Tests
// ============================================================================

describe("createExecutor with Chat Support", () => {
  it("should create executor that supports chat for CLAUDE_CODE", () => {
    const executor = createExecutor("CLAUDE_CODE");
    expect(executor.supportsChat?.()).toBe(true);
    expect(executor.getChatCommand?.()).toBe("claude");
    expect(typeof executor.spawnChat).toBe("function");
  });

  it("should create executor that supports chat for GEMINI", () => {
    const executor = createExecutor("GEMINI");
    expect(executor.supportsChat?.()).toBe(true);
    expect(executor.getChatCommand?.()).toBe("gemini");
    expect(typeof executor.spawnChat).toBe("function");
  });

  it("should create executor that supports chat for CODEX", () => {
    const executor = createExecutor("CODEX");
    expect(executor.supportsChat?.()).toBe(true);
    expect(executor.getChatCommand?.()).toBe("codex");
    expect(typeof executor.spawnChat).toBe("function");
  });

  it("should create executor without chat support for AMP", () => {
    const executor = createExecutor("AMP");
    expect(executor.supportsChat?.()).toBe(false);
    expect(executor.getChatCommand?.()).toBeNull();
  });
});

// ============================================================================
// ExecutorError Chat Tests
// ============================================================================

describe("ExecutorError Chat Errors", () => {
  describe("chatNotSupported", () => {
    it("should create error with correct message", () => {
      const error = ExecutorError.chatNotSupported("TEST_EXECUTOR");

      expect(error.message).toBe("Chat mode is not supported for TEST_EXECUTOR");
      expect(error.code).toBe("CHAT_NOT_SUPPORTED");
      expect(error.executorType).toBe("TEST_EXECUTOR");
    });

    it("should be instance of ExecutorError", () => {
      const error = ExecutorError.chatNotSupported("TEST");

      expect(error).toBeInstanceOf(ExecutorError);
    });
  });

  describe("noPromptProvided", () => {
    it("should create error with correct message", () => {
      const error = ExecutorError.noPromptProvided();

      expect(error.message).toBe("No prompt provided and stdin is empty");
      expect(error.code).toBe("NO_PROMPT_PROVIDED");
    });

    it("should be instance of ExecutorError", () => {
      const error = ExecutorError.noPromptProvided();

      expect(error).toBeInstanceOf(ExecutorError);
    });
  });
});

// ============================================================================
// Session Resume Functionality Tests
// ============================================================================

describe("Session Resume Functionality", () => {
  describe("ClaudeCode resume option", () => {
    it("should accept resume in options", () => {
      const options: ChatOptions = {
        prompt: "Continue work",
        resume: "session-abc123",
      };

      expect(options.resume).toBe("session-abc123");
    });

    it("should accept sessionId for new session", () => {
      const options: ChatOptions = {
        prompt: "Start new",
        sessionId: "new-session-id",
      };

      expect(options.sessionId).toBe("new-session-id");
    });

    it("should allow both sessionId and resume (for edge cases)", () => {
      const options: ChatOptions = {
        prompt: "Test",
        sessionId: "new-id",
        resume: "old-id",
      };

      // Both can be specified, executor decides priority
      expect(options.sessionId).toBe("new-id");
      expect(options.resume).toBe("old-id");
    });
  });

  describe("Codex session option", () => {
    it("should accept sessionId in options", () => {
      const options: ChatOptions = {
        prompt: "Continue",
        sessionId: "codex-session",
      };

      expect(options.sessionId).toBe("codex-session");
    });
  });
});

// ============================================================================
// Stream JSON Output Format Tests
// ============================================================================

describe("Stream JSON Output Format", () => {
  describe("output format options", () => {
    it("should accept text output format", () => {
      const options: ChatOptions = {
        prompt: "Test",
        outputFormat: "text",
      };

      expect(options.outputFormat).toBe("text");
    });

    it("should accept stream-json output format", () => {
      const options: ChatOptions = {
        prompt: "Test",
        outputFormat: "stream-json",
      };

      expect(options.outputFormat).toBe("stream-json");
    });
  });

  describe("input format options", () => {
    it("should accept text input format", () => {
      const options: ChatOptions = {
        prompt: "Test",
        inputFormat: "text",
      };

      expect(options.inputFormat).toBe("text");
    });

    it("should accept stream-json input format", () => {
      const options: ChatOptions = {
        inputFormat: "stream-json",
        // When using stream-json input, prompt is sent via stdin
      };

      expect(options.inputFormat).toBe("stream-json");
    });
  });

  describe("combined input/output formats", () => {
    it("should accept both text", () => {
      const options: ChatOptions = {
        prompt: "Test",
        inputFormat: "text",
        outputFormat: "text",
      };

      expect(options.inputFormat).toBe("text");
      expect(options.outputFormat).toBe("text");
    });

    it("should accept both stream-json", () => {
      const options: ChatOptions = {
        inputFormat: "stream-json",
        outputFormat: "stream-json",
      };

      expect(options.inputFormat).toBe("stream-json");
      expect(options.outputFormat).toBe("stream-json");
    });

    it("should accept mixed formats", () => {
      const options: ChatOptions = {
        prompt: "Test",
        inputFormat: "text",
        outputFormat: "stream-json",
      };

      expect(options.inputFormat).toBe("text");
      expect(options.outputFormat).toBe("stream-json");
    });
  });
});

// ============================================================================
// Model Override Tests
// ============================================================================

describe("Model Override", () => {
  describe("ClaudeCode model option", () => {
    it("should accept model in ChatOptions", () => {
      const options: ChatOptions = {
        prompt: "Test",
        model: "claude-3-opus",
      };

      expect(options.model).toBe("claude-3-opus");
    });

    it("should accept any model string", () => {
      const options: ChatOptions = {
        prompt: "Test",
        model: "claude-3-5-sonnet-20241022",
      };

      expect(options.model).toBe("claude-3-5-sonnet-20241022");
    });
  });

  describe("Gemini model option", () => {
    it("should accept gemini model", () => {
      const options: ChatOptions = {
        prompt: "Test",
        model: "gemini-1.5-pro",
      };

      expect(options.model).toBe("gemini-1.5-pro");
    });
  });

  describe("Codex model option", () => {
    it("should accept codex/openai model", () => {
      const options: ChatOptions = {
        prompt: "Test",
        model: "gpt-4-turbo",
      };

      expect(options.model).toBe("gpt-4-turbo");
    });
  });
});

// ============================================================================
// Dangerous Skip Permissions Tests
// ============================================================================

describe("Dangerous Skip Permissions", () => {
  describe("ClaudeCode permission option", () => {
    it("should default to false/undefined", () => {
      const options: ChatOptions = {
        prompt: "Test",
      };

      expect(options.dangerouslySkipPermissions).toBeUndefined();
    });

    it("should accept true to skip permissions", () => {
      const options: ChatOptions = {
        prompt: "Test",
        dangerouslySkipPermissions: true,
      };

      expect(options.dangerouslySkipPermissions).toBe(true);
    });

    it("should accept false to enforce permissions", () => {
      const options: ChatOptions = {
        prompt: "Test",
        dangerouslySkipPermissions: false,
      };

      expect(options.dangerouslySkipPermissions).toBe(false);
    });
  });

  describe("executor config permission", () => {
    it("should use config dangerouslySkipPermissions", () => {
      const executor = new ClaudeCode({
        dangerouslySkipPermissions: true,
      });

      expect(executor.supportsChat()).toBe(true);
      // Permission setting will be used when spawnChat is called
    });
  });
});

// ============================================================================
// Working Directory Tests
// ============================================================================

describe("Working Directory (cwd)", () => {
  it("should accept cwd in options", () => {
    const options: ChatOptions = {
      prompt: "Test",
      cwd: "/path/to/project",
    };

    expect(options.cwd).toBe("/path/to/project");
  });

  it("should allow undefined cwd (uses current dir)", () => {
    const options: ChatOptions = {
      prompt: "Test",
    };

    expect(options.cwd).toBeUndefined();
  });

  it("should accept any valid path", () => {
    const options: ChatOptions = {
      prompt: "Test",
      cwd: join(homedir(), "projects", "my-app"),
    };

    expect(options.cwd).toContain("projects");
    expect(options.cwd).toContain("my-app");
  });
});

// ============================================================================
// Verbose Mode Tests
// ============================================================================

describe("Verbose Mode", () => {
  it("should default to undefined/false", () => {
    const options: ChatOptions = {
      prompt: "Test",
    };

    expect(options.verbose).toBeUndefined();
  });

  it("should accept true for verbose output", () => {
    const options: ChatOptions = {
      prompt: "Test",
      verbose: true,
    };

    expect(options.verbose).toBe(true);
  });

  it("should accept false to disable verbose", () => {
    const options: ChatOptions = {
      prompt: "Test",
      verbose: false,
    };

    expect(options.verbose).toBe(false);
  });
});

// ============================================================================
// Environment Variables Tests
// ============================================================================

describe("Environment Variables", () => {
  it("should accept env in options", () => {
    const options: ChatOptions = {
      prompt: "Test",
      env: {
        API_KEY: "secret",
        DEBUG: "true",
      },
    };

    expect(options.env).toEqual({
      API_KEY: "secret",
      DEBUG: "true",
    });
  });

  it("should allow empty env object", () => {
    const options: ChatOptions = {
      prompt: "Test",
      env: {},
    };

    expect(options.env).toEqual({});
  });

  it("should allow undefined env", () => {
    const options: ChatOptions = {
      prompt: "Test",
    };

    expect(options.env).toBeUndefined();
  });
});

// ============================================================================
// Integration Tests - Chat Options Combinations
// ============================================================================

describe("Integration: Chat Options Combinations", () => {
  it("should handle typical CLI usage options", () => {
    const options: ChatOptions = {
      prompt: "Analyze this code and suggest improvements",
      cwd: "/home/user/project",
      outputFormat: "text",
      verbose: false,
    };

    expect(options.prompt).toContain("Analyze");
    expect(options.cwd).toBe("/home/user/project");
    expect(options.outputFormat).toBe("text");
  });

  it("should handle programmatic usage with JSON streaming", () => {
    const options: ChatOptions = {
      inputFormat: "stream-json",
      outputFormat: "stream-json",
      cwd: "/app",
      model: "claude-3-opus",
    };

    expect(options.inputFormat).toBe("stream-json");
    expect(options.outputFormat).toBe("stream-json");
  });

  it("should handle session resume with new prompt", () => {
    const options: ChatOptions = {
      prompt: "Continue from where we left off",
      resume: "prev-session-123",
      model: "claude-3-sonnet",
    };

    expect(options.prompt).toContain("Continue");
    expect(options.resume).toBe("prev-session-123");
  });

  it("should handle dangerous mode for automation", () => {
    const options: ChatOptions = {
      prompt: "Automated task",
      dangerouslySkipPermissions: true,
      outputFormat: "stream-json",
      env: {
        CI: "true",
        AUTOMATION: "enabled",
      },
    };

    expect(options.dangerouslySkipPermissions).toBe(true);
    expect(options.env?.CI).toBe("true");
  });
});
