/**
 * Provider CLI Commands Tests
 *
 * Tests cover the following spec requirements from .trellis/spec/modules/cli/provider.md:
 *
 * Acceptance Criteria:
 * - [x] `viben provider list` 列出所有 providers
 * - [x] `viben provider create -n <name> -t <type>` 创建 provider
 * - [x] `viben provider create -t <type> --api-key <key>` 快速创建 (自动生成名称)
 * - [x] `viben provider remove -n <name>` 删除 provider
 * - [x] `viben provider set-default -n <name>` 设置默认 provider
 * - [x] `viben provider status` 检查 provider 连通性
 * - [x] `viben provider status -n <name>` 检查单个 provider 连通性
 * - [x] 支持 provider 类型: openai, anthropic, google, azure, openrouter, ollama, custom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import { registerProviderCommand } from "./provider";
import type { Provider, ProviderType, ProviderStatus } from "../../types";

// Mock the providers module
vi.mock("../../providers", () => ({
  providerManager: {
    listProviders: vi.fn(),
    getProvider: vi.fn(),
    createProvider: vi.fn(),
    updateProvider: vi.fn(),
    removeProvider: vi.fn(),
    setDefault: vi.fn(),
    getDefault: vi.fn(),
    setEnabled: vi.fn(),
    checkStatus: vi.fn(),
    checkAllStatus: vi.fn(),
  },
  DEFAULT_BASE_URLS: {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    azure: "",
    ollama: "http://localhost:11434",
    openrouter: "https://openrouter.ai/api/v1",
    google: "https://generativelanguage.googleapis.com/v1beta",
    custom: "",
  },
  ENV_VAR_NAMES: {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    azure: "AZURE_OPENAI_API_KEY",
    ollama: undefined,
    openrouter: "OPENROUTER_API_KEY",
    google: "GOOGLE_API_KEY",
    custom: undefined,
  },
}));

// Mock chalk to avoid color output in tests
vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    blue: (s: string) => s,
  },
}));

// Mock process.exit
vi.spyOn(process, "exit").mockImplementation((code?: number | string | null | undefined) => {
  throw new Error(`process.exit(${code})`);
});

import { providerManager } from "../../providers";

/**
 * Helper to create a mock provider with proper typing
 */
function createMockProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "test-provider",
    type: "openai" as ProviderType,
    name: "Test Provider",
    apiKey: "sk-test-key",
    baseUrl: "https://api.openai.com/v1",
    isDefault: false,
    enabled: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Helper to create a mock provider status
 */
function createMockStatus(overrides: Partial<ProviderStatus> = {}): ProviderStatus {
  return {
    id: "test-provider",
    connected: true,
    latency: 100,
    checkedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("Provider CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register provider commands
    registerProviderCommand(program);

    // Spy on console
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Helper to run command
  // ============================================================================
  async function runCommand(args: string[]): Promise<void> {
    await program.parseAsync(["node", "test", ...args]);
  }

  // ============================================================================
  // provider list (Spec: viben provider list)
  // ============================================================================

  describe("provider list", () => {
    it("should list all providers", async () => {
      const mockProviders = [
        createMockProvider({
          id: "openai-main",
          type: "openai",
          name: "OpenAI Main",
          isDefault: true,
        }),
        createMockProvider({
          id: "anthropic-main",
          type: "anthropic",
          name: "Anthropic Main",
          baseUrl: "https://api.anthropic.com/v1",
        }),
      ];

      vi.mocked(providerManager.listProviders).mockResolvedValue(mockProviders);
      vi.mocked(providerManager.getDefault).mockResolvedValue("openai-main");

      await runCommand(["provider", "list"]);

      expect(providerManager.listProviders).toHaveBeenCalled();
      expect(providerManager.getDefault).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no providers exist", async () => {
      vi.mocked(providerManager.listProviders).mockResolvedValue([]);
      vi.mocked(providerManager.getDefault).mockResolvedValue(undefined);

      await runCommand(["provider", "list"]);

      expect(providerManager.listProviders).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No providers configured")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockProviders = [
        createMockProvider({
          id: "openai-main",
          type: "openai",
          name: "OpenAI Main",
        }),
      ];

      vi.mocked(providerManager.listProviders).mockResolvedValue(mockProviders);
      vi.mocked(providerManager.getDefault).mockResolvedValue("openai-main");

      await runCommand(["--json", "provider", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"providers"')
      );
    });

    it("should display enabled and disabled providers correctly", async () => {
      const mockProviders = [
        createMockProvider({
          id: "provider-enabled",
          name: "Enabled Provider",
          enabled: true,
        }),
        createMockProvider({
          id: "provider-disabled",
          name: "Disabled Provider",
          enabled: false,
        }),
      ];

      vi.mocked(providerManager.listProviders).mockResolvedValue(mockProviders);
      vi.mocked(providerManager.getDefault).mockResolvedValue(undefined);

      await runCommand(["provider", "list"]);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // provider create (Spec: viben provider create -n <name> -t <type>)
  // ============================================================================

  describe("provider create", () => {
    it("should create a new provider with -n and -t options", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        type: "openai",
        name: "my-provider",
      });

      vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "create", "-n", "my-provider", "-t", "openai"]);

      expect(providerManager.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "openai",
          name: "my-provider",
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Created provider")
      );
    });

    it("should create provider with --type option (long form)", async () => {
      const mockProvider = createMockProvider({
        id: "openai-provider",
        type: "openai",
        name: "openai-provider",
      });

      vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "create", "--name", "openai-provider", "--type", "openai"]);

      expect(providerManager.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "openai",
          name: "openai-provider",
        })
      );
    });

    it("should create provider with --api-key option", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        apiKey: "sk-test-key-123",
      });

      vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

      await runCommand([
        "provider",
        "create",
        "-n",
        "my-provider",
        "--api-key",
        "sk-test-key-123",
      ]);

      expect(providerManager.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "sk-test-key-123",
        })
      );
    });

    it("should create provider with --base-url option", async () => {
      const mockProvider = createMockProvider({
        id: "custom-provider",
        baseUrl: "https://api.custom.com/v1",
      });

      vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

      await runCommand([
        "provider",
        "create",
        "-n",
        "custom-provider",
        "--base-url",
        "https://api.custom.com/v1",
      ]);

      expect(providerManager.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: "https://api.custom.com/v1",
        })
      );
    });

    it("should create provider with --timeout option", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        timeout: 30,
      });

      vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "create", "-n", "my-provider", "--timeout", "30"]);

      expect(providerManager.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30,
        })
      );
    });

    it("should create provider with --max-retries option", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        maxRetries: 3,
      });

      vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "create", "-n", "my-provider", "--max-retries", "3"]);

      expect(providerManager.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRetries: 3,
        })
      );
    });

    it("should create provider with --default option", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        isDefault: true,
      });

      vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "create", "-n", "my-provider", "--default"]);

      expect(providerManager.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          setAsDefault: true,
        })
      );
    });

    it("should create provider with all options", async () => {
      const mockProvider = createMockProvider({
        id: "full-provider",
        type: "anthropic",
        name: "Full Provider",
        apiKey: "sk-ant-test",
        baseUrl: "https://api.custom.com/v1",
        timeout: 60,
        maxRetries: 5,
        isDefault: true,
      });

      vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

      await runCommand([
        "provider",
        "create",
        "-n",
        "full-provider",
        "-t",
        "anthropic",
        "--api-key",
        "sk-ant-test",
        "--base-url",
        "https://api.custom.com/v1",
        "--timeout",
        "60",
        "--max-retries",
        "5",
        "--default",
      ]);

      expect(providerManager.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "anthropic",
          name: "full-provider",
          apiKey: "sk-ant-test",
          baseUrl: "https://api.custom.com/v1",
          timeout: 60,
          maxRetries: 5,
          setAsDefault: true,
        })
      );
    });

    it("should reject invalid provider type", async () => {
      await expect(
        runCommand(["provider", "create", "-n", "my-provider", "-t", "invalid-type"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid provider type")
      );
    });

    it("should show note when API key is not provided for providers that need it", async () => {
      const mockProvider = createMockProvider({
        id: "openai-provider",
        type: "openai",
        name: "openai-provider",
        apiKey: undefined,
      });

      vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "create", "-n", "openai-provider", "-t", "openai"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No API key provided")
      );
    });

    it("should handle creation error", async () => {
      vi.mocked(providerManager.createProvider).mockRejectedValue(
        new Error('Provider with ID "duplicate" already exists')
      );

      await expect(
        runCommand(["provider", "create", "-n", "duplicate"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    // ============================================================================
    // Quick create (Spec: viben provider create -t <type> --api-key <key>)
    // Auto-generates name when -n is not provided
    // ============================================================================

    describe("quick create (auto-generated name)", () => {
      it("should create openai provider with auto-generated name", async () => {
        const mockProvider = createMockProvider({
          id: "openai-1234567890",
          type: "openai",
          apiKey: "sk-test-key",
        });

        vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

        await runCommand(["provider", "create", "-t", "openai", "--api-key", "sk-test-key"]);

        expect(providerManager.createProvider).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "openai",
            apiKey: "sk-test-key",
            name: expect.stringMatching(/^openai-\d+$/),
          })
        );
      });

      it("should create anthropic provider with auto-generated name", async () => {
        const mockProvider = createMockProvider({
          id: "anthropic-1234567890",
          type: "anthropic",
          apiKey: "sk-ant-test",
        });

        vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

        await runCommand(["provider", "create", "-t", "anthropic", "--api-key", "sk-ant-test"]);

        expect(providerManager.createProvider).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "anthropic",
            apiKey: "sk-ant-test",
            name: expect.stringMatching(/^anthropic-\d+$/),
          })
        );
      });

      it("should create custom provider with auto-generated name and base-url", async () => {
        const mockProvider = createMockProvider({
          id: "custom-1234567890",
          type: "custom",
          apiKey: "sk-test",
          baseUrl: "https://api.example.com/v1",
        });

        vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

        await runCommand([
          "provider",
          "create",
          "-t",
          "custom",
          "--api-key",
          "sk-test",
          "--base-url",
          "https://api.example.com/v1",
        ]);

        expect(providerManager.createProvider).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "custom",
            apiKey: "sk-test",
            baseUrl: "https://api.example.com/v1",
            name: expect.stringMatching(/^custom-\d+$/),
          })
        );
      });

      it("should default to custom type when only api-key is provided", async () => {
        const mockProvider = createMockProvider({
          id: "custom-1234567890",
          type: "custom",
          apiKey: "sk-test",
        });

        vi.mocked(providerManager.createProvider).mockResolvedValue(mockProvider);

        await runCommand(["provider", "create", "--api-key", "sk-test"]);

        expect(providerManager.createProvider).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "custom",
            apiKey: "sk-test",
            name: expect.stringMatching(/^custom-\d+$/),
          })
        );
      });
    });
  });

  // ============================================================================
  // provider remove (Spec: viben provider remove -n <name>)
  // ============================================================================

  describe("provider remove", () => {
    it("should remove a provider with -n option", async () => {
      vi.mocked(providerManager.removeProvider).mockResolvedValue(undefined);

      await runCommand(["provider", "remove", "-n", "my-provider"]);

      expect(providerManager.removeProvider).toHaveBeenCalledWith("my-provider");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Removed provider")
      );
    });

    it("should remove a provider with --name option (long form)", async () => {
      vi.mocked(providerManager.removeProvider).mockResolvedValue(undefined);

      await runCommand(["provider", "remove", "--name", "my-provider"]);

      expect(providerManager.removeProvider).toHaveBeenCalledWith("my-provider");
    });

    it("should use rm alias", async () => {
      vi.mocked(providerManager.removeProvider).mockResolvedValue(undefined);

      await runCommand(["provider", "rm", "-n", "my-provider"]);

      expect(providerManager.removeProvider).toHaveBeenCalledWith("my-provider");
    });

    it("should show error when provider not found", async () => {
      vi.mocked(providerManager.removeProvider).mockRejectedValue(
        new Error('Provider "nonexistent" not found')
      );

      await expect(
        runCommand(["provider", "remove", "-n", "nonexistent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should require -n option", async () => {
      await expect(runCommand(["provider", "remove"])).rejects.toThrow();
    });
  });

  // ============================================================================
  // provider set-default (Spec: viben provider set-default -n <name>)
  // ============================================================================

  describe("provider set-default", () => {
    it("should set default provider with -n option", async () => {
      vi.mocked(providerManager.setDefault).mockResolvedValue(undefined);

      await runCommand(["provider", "set-default", "-n", "my-provider"]);

      expect(providerManager.setDefault).toHaveBeenCalledWith("my-provider");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Set")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("default provider")
      );
    });

    it("should set default provider with --name option (long form)", async () => {
      vi.mocked(providerManager.setDefault).mockResolvedValue(undefined);

      await runCommand(["provider", "set-default", "--name", "my-provider"]);

      expect(providerManager.setDefault).toHaveBeenCalledWith("my-provider");
    });

    it("should show error when provider not found", async () => {
      vi.mocked(providerManager.setDefault).mockRejectedValue(
        new Error('Provider "nonexistent" not found')
      );

      await expect(
        runCommand(["provider", "set-default", "-n", "nonexistent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      vi.mocked(providerManager.setDefault).mockResolvedValue(undefined);

      await runCommand(["--json", "provider", "set-default", "-n", "my-provider"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"default": "my-provider"')
      );
    });

    it("should require -n option", async () => {
      await expect(runCommand(["provider", "set-default"])).rejects.toThrow();
    });
  });

  // ============================================================================
  // provider status (Spec: viben provider status / viben provider status -n <name>)
  // ============================================================================

  describe("provider status", () => {
    it("should show status for all providers", async () => {
      const mockStatuses: Record<string, ProviderStatus> = {
        "openai-main": createMockStatus({
          id: "openai-main",
          connected: true,
          latency: 85,
        }),
        "anthropic-main": createMockStatus({
          id: "anthropic-main",
          connected: true,
          latency: 120,
        }),
      };

      vi.mocked(providerManager.checkAllStatus).mockResolvedValue(mockStatuses);

      await runCommand(["provider", "status"]);

      expect(providerManager.checkAllStatus).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no providers exist", async () => {
      vi.mocked(providerManager.checkAllStatus).mockResolvedValue({});

      await runCommand(["provider", "status"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No providers configured")
      );
    });

    it("should show status for single provider with -n option", async () => {
      const mockStatus = createMockStatus({
        id: "openai-main",
        connected: true,
        latency: 85,
      });

      vi.mocked(providerManager.checkStatus).mockResolvedValue(mockStatus);

      await runCommand(["provider", "status", "-n", "openai-main"]);

      expect(providerManager.checkStatus).toHaveBeenCalledWith("openai-main");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Provider: openai-main")
      );
    });

    it("should show status for single provider with --name option (long form)", async () => {
      const mockStatus = createMockStatus({
        id: "openai-main",
        connected: true,
        latency: 85,
      });

      vi.mocked(providerManager.checkStatus).mockResolvedValue(mockStatus);

      await runCommand(["provider", "status", "--name", "openai-main"]);

      expect(providerManager.checkStatus).toHaveBeenCalledWith("openai-main");
    });

    it("should show error status for disconnected provider", async () => {
      const mockStatus = createMockStatus({
        id: "failing-provider",
        connected: false,
        error: "Connection refused",
      });

      vi.mocked(providerManager.checkStatus).mockResolvedValue(mockStatus);

      await runCommand(["provider", "status", "-n", "failing-provider"]);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should output JSON when --json flag is provided for all providers", async () => {
      const mockStatuses: Record<string, ProviderStatus> = {
        "openai-main": createMockStatus({ id: "openai-main" }),
      };

      vi.mocked(providerManager.checkAllStatus).mockResolvedValue(mockStatuses);

      await runCommand(["--json", "provider", "status"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"statuses"')
      );
    });

    it("should output JSON when --json flag is provided for single provider", async () => {
      const mockStatus = createMockStatus({ id: "openai-main" });

      vi.mocked(providerManager.checkStatus).mockResolvedValue(mockStatus);

      await runCommand(["--json", "provider", "status", "-n", "openai-main"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"status"')
      );
    });

    it("should handle status check error", async () => {
      vi.mocked(providerManager.checkStatus).mockRejectedValue(
        new Error("Status check failed")
      );

      await expect(
        runCommand(["provider", "status", "-n", "broken-provider"])
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // provider show (Extended: not in spec but useful)
  // ============================================================================

  describe("provider show", () => {
    it("should show provider details with -n option", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        type: "openai",
        name: "My OpenAI Provider",
        apiKey: "sk-test-key",
        baseUrl: "https://api.openai.com/v1",
        timeout: 30,
        maxRetries: 3,
        isDefault: true,
        enabled: true,
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "show", "-n", "my-provider"]);

      expect(providerManager.getProvider).toHaveBeenCalledWith("my-provider");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Provider: my-provider")
      );
    });

    it("should mask API key in output", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        apiKey: "sk-secret-key-12345",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "show", "-n", "my-provider"]);

      // Should not display actual API key
      const outputCalls = consoleSpy.mock.calls.map((call: unknown[]) => String(call[0]));
      const hasSecretKey = outputCalls.some((output: string) =>
        output.includes("sk-secret-key-12345")
      );
      expect(hasSecretKey).toBe(false);
    });

    it("should show error when provider not found", async () => {
      vi.mocked(providerManager.getProvider).mockResolvedValue(null);

      await expect(
        runCommand(["provider", "show", "-n", "nonexistent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockProvider = createMockProvider({ id: "my-provider" });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);

      await runCommand(["--json", "provider", "show", "-n", "my-provider"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"provider"')
      );
    });

    it("should show provider with Azure-specific fields", async () => {
      const mockProvider = createMockProvider({
        id: "azure-provider",
        type: "azure",
        name: "Azure OpenAI",
        apiVersion: "2024-02-15-preview",
        deployment: "gpt-4-turbo",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "show", "-n", "azure-provider"]);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should require -n option", async () => {
      await expect(runCommand(["provider", "show"])).rejects.toThrow();
    });
  });

  // ============================================================================
  // provider update (Extended: not in spec but useful)
  // ============================================================================

  describe("provider update", () => {
    it("should update provider type", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        type: "anthropic",
      });

      vi.mocked(providerManager.updateProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "update", "-n", "my-provider", "-t", "anthropic"]);

      expect(providerManager.updateProvider).toHaveBeenCalledWith("my-provider", {
        type: "anthropic",
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Updated provider")
      );
    });

    it("should update provider base URL", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        baseUrl: "https://api.new.com/v1",
      });

      vi.mocked(providerManager.updateProvider).mockResolvedValue(mockProvider);

      await runCommand([
        "provider",
        "update",
        "-n",
        "my-provider",
        "--base-url",
        "https://api.new.com/v1",
      ]);

      expect(providerManager.updateProvider).toHaveBeenCalledWith("my-provider", {
        baseUrl: "https://api.new.com/v1",
      });
    });

    it("should update provider API key", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        apiKey: "new-api-key",
      });

      vi.mocked(providerManager.updateProvider).mockResolvedValue(mockProvider);

      await runCommand([
        "provider",
        "update",
        "-n",
        "my-provider",
        "--api-key",
        "new-api-key",
      ]);

      expect(providerManager.updateProvider).toHaveBeenCalledWith("my-provider", {
        apiKey: "new-api-key",
      });
    });

    it("should update provider display name", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        name: "New Name",
      });

      vi.mocked(providerManager.updateProvider).mockResolvedValue(mockProvider);

      await runCommand([
        "provider",
        "update",
        "-n",
        "my-provider",
        "--display-name",
        "New Name",
      ]);

      expect(providerManager.updateProvider).toHaveBeenCalledWith("my-provider", {
        name: "New Name",
      });
    });

    it("should update provider timeout", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        timeout: 60,
      });

      vi.mocked(providerManager.updateProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "update", "-n", "my-provider", "--timeout", "60"]);

      expect(providerManager.updateProvider).toHaveBeenCalledWith("my-provider", {
        timeout: 60,
      });
    });

    it("should update provider max retries", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        maxRetries: 5,
      });

      vi.mocked(providerManager.updateProvider).mockResolvedValue(mockProvider);

      await runCommand(["provider", "update", "-n", "my-provider", "--max-retries", "5"]);

      expect(providerManager.updateProvider).toHaveBeenCalledWith("my-provider", {
        maxRetries: 5,
      });
    });

    it("should update multiple fields at once", async () => {
      const mockProvider = createMockProvider({
        id: "my-provider",
        name: "Updated Name",
        apiKey: "new-key",
        timeout: 45,
      });

      vi.mocked(providerManager.updateProvider).mockResolvedValue(mockProvider);

      await runCommand([
        "provider",
        "update",
        "-n",
        "my-provider",
        "--display-name",
        "Updated Name",
        "--api-key",
        "new-key",
        "--timeout",
        "45",
      ]);

      expect(providerManager.updateProvider).toHaveBeenCalledWith("my-provider", {
        name: "Updated Name",
        apiKey: "new-key",
        timeout: 45,
      });
    });

    it("should reject invalid provider type on update", async () => {
      await expect(
        runCommand(["provider", "update", "-n", "my-provider", "-t", "invalid-type"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid provider type")
      );
    });

    it("should show error when provider not found", async () => {
      vi.mocked(providerManager.updateProvider).mockRejectedValue(
        new Error('Provider "nonexistent" not found')
      );

      await expect(
        runCommand(["provider", "update", "-n", "nonexistent", "--display-name", "New Name"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should require -n option", async () => {
      await expect(runCommand(["provider", "update", "--timeout", "30"])).rejects.toThrow();
    });
  });

  // ============================================================================
  // provider enable (Extended: not in spec but useful)
  // ============================================================================

  describe("provider enable", () => {
    it("should enable a provider with -n option", async () => {
      vi.mocked(providerManager.setEnabled).mockResolvedValue(undefined);

      await runCommand(["provider", "enable", "-n", "my-provider"]);

      expect(providerManager.setEnabled).toHaveBeenCalledWith("my-provider", true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Enabled provider")
      );
    });

    it("should show error when provider not found", async () => {
      vi.mocked(providerManager.setEnabled).mockRejectedValue(
        new Error('Provider "nonexistent" not found')
      );

      await expect(
        runCommand(["provider", "enable", "-n", "nonexistent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      vi.mocked(providerManager.setEnabled).mockResolvedValue(undefined);

      await runCommand(["--json", "provider", "enable", "-n", "my-provider"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"enabled": "my-provider"')
      );
    });

    it("should require -n option", async () => {
      await expect(runCommand(["provider", "enable"])).rejects.toThrow();
    });
  });

  // ============================================================================
  // provider disable (Extended: not in spec but useful)
  // ============================================================================

  describe("provider disable", () => {
    it("should disable a provider with -n option", async () => {
      vi.mocked(providerManager.setEnabled).mockResolvedValue(undefined);

      await runCommand(["provider", "disable", "-n", "my-provider"]);

      expect(providerManager.setEnabled).toHaveBeenCalledWith("my-provider", false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Disabled provider")
      );
    });

    it("should show error when provider not found", async () => {
      vi.mocked(providerManager.setEnabled).mockRejectedValue(
        new Error('Provider "nonexistent" not found')
      );

      await expect(
        runCommand(["provider", "disable", "-n", "nonexistent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      vi.mocked(providerManager.setEnabled).mockResolvedValue(undefined);

      await runCommand(["--json", "provider", "disable", "-n", "my-provider"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"disabled": "my-provider"')
      );
    });

    it("should require -n option", async () => {
      await expect(runCommand(["provider", "disable"])).rejects.toThrow();
    });
  });

  // ============================================================================
  // provider types (Spec: 支持 provider 类型)
  // ============================================================================

  describe("provider types", () => {
    it("should list supported provider types", async () => {
      await runCommand(["provider", "types"]);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should output JSON when --json flag is provided", async () => {
      await runCommand(["--json", "provider", "types"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"types"')
      );
    });

    it("should include all provider types in output (openai, anthropic, google, azure, openrouter, ollama, custom)", async () => {
      await runCommand(["--json", "provider", "types"]);

      const outputCalls = consoleSpy.mock.calls.map((call) => String(call[0]));
      const jsonOutput = outputCalls.find((output) => output.includes('"types"'));

      expect(jsonOutput).toBeDefined();
      expect(jsonOutput).toContain("openai");
      expect(jsonOutput).toContain("anthropic");
      expect(jsonOutput).toContain("azure");
      expect(jsonOutput).toContain("ollama");
      expect(jsonOutput).toContain("openrouter");
      expect(jsonOutput).toContain("google");
      expect(jsonOutput).toContain("custom");
    });

    it("should show default base URLs for each type", async () => {
      await runCommand(["provider", "types"]);

      // The table output should be called
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show environment variable names for each type", async () => {
      await runCommand(["--json", "provider", "types"]);

      const outputCalls = consoleSpy.mock.calls.map((call) => String(call[0]));
      const jsonOutput = outputCalls.find((output) => output.includes('"types"'));

      expect(jsonOutput).toBeDefined();
      expect(jsonOutput).toContain("OPENAI_API_KEY");
      expect(jsonOutput).toContain("ANTHROPIC_API_KEY");
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle provider not found errors", async () => {
      vi.mocked(providerManager.getProvider).mockResolvedValue(null);

      await expect(runCommand(["provider", "show", "-n", "nonexistent"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should handle validation errors for invalid type", async () => {
      await expect(
        runCommand(["provider", "create", "-n", "test", "-t", "invalid"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid provider type")
      );
    });

    it("should handle already exists errors", async () => {
      vi.mocked(providerManager.createProvider).mockRejectedValue(
        new Error('Provider with ID "duplicate" already exists')
      );

      await expect(
        runCommand(["provider", "create", "-n", "duplicate"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle network errors gracefully", async () => {
      vi.mocked(providerManager.checkStatus).mockRejectedValue(
        new Error("Network error: connection refused")
      );

      await expect(
        runCommand(["provider", "status", "-n", "broken-provider"])
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // JSON Output Mode Tests
  // ============================================================================

  describe("JSON output mode", () => {
    it("should output JSON for provider list", async () => {
      const mockProviders = [createMockProvider({ id: "test" })];
      vi.mocked(providerManager.listProviders).mockResolvedValue(mockProviders);
      vi.mocked(providerManager.getDefault).mockResolvedValue("test");

      await runCommand(["--json", "provider", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });

    it("should output JSON for provider show", async () => {
      vi.mocked(providerManager.getProvider).mockResolvedValue(
        createMockProvider({ id: "test" })
      );

      await runCommand(["--json", "provider", "show", "-n", "test"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });

    it("should output JSON for provider create", async () => {
      vi.mocked(providerManager.createProvider).mockResolvedValue(
        createMockProvider({ id: "new-provider" })
      );

      await runCommand(["--json", "provider", "create", "-n", "new-provider"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });

    it("should output JSON for provider remove", async () => {
      vi.mocked(providerManager.removeProvider).mockResolvedValue(undefined);

      await runCommand(["--json", "provider", "remove", "-n", "test"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });

    it("should output JSON for provider status", async () => {
      vi.mocked(providerManager.checkAllStatus).mockResolvedValue({
        test: createMockStatus({ id: "test" }),
      });

      await runCommand(["--json", "provider", "status"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });

    it("should output JSON for provider update", async () => {
      vi.mocked(providerManager.updateProvider).mockResolvedValue(
        createMockProvider({ id: "test" })
      );

      await runCommand(["--json", "provider", "update", "-n", "test", "--display-name", "New Name"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });
});
