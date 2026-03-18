/**
 * Sandbox Service
 *
 * Manages sandbox providers for isolated code execution.
 * Provider priority: codex > claude > native
 */
import type {
  ISandboxProvider,
  SandboxExecOptions,
  SandboxExecResult,
  SandboxProviderType,
  ScriptOptions,
  SandboxCapabilities,
} from "../sandbox/types";
import { NativeProvider } from "../sandbox/providers/native";
import { CodexProvider } from "../sandbox/providers/codex";
import { ClaudeProvider } from "../sandbox/providers/claude";
import { logger as globalLogger } from "../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "sandbox" });

export class SandboxService {
  private providers = new Map<SandboxProviderType, ISandboxProvider>();
  private initialized = false;

  /**
   * Initialize and detect available providers
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Register all providers
    const allProviders: ISandboxProvider[] = [
      new NativeProvider(),
      new CodexProvider(),
      new ClaudeProvider(),
    ];

    for (const provider of allProviders) {
      const available = await provider.isAvailable();
      if (available) {
        await provider.init();
        this.providers.set(provider.type, provider);
        log.info({ providerName: provider.name, providerType: provider.type }, "Provider available");
      }
    }

    this.initialized = true;
  }

  /**
   * Get the best available provider
   * Priority: codex > claude > native
   */
  async getBestProvider(preferred?: SandboxProviderType): Promise<ISandboxProvider> {
    await this.init();

    // If preferred provider is specified and available, use it
    if (preferred && this.providers.has(preferred)) {
      return this.providers.get(preferred)!;
    }

    // Select by priority
    const priority: SandboxProviderType[] = ["codex", "claude", "native"];
    for (const type of priority) {
      if (this.providers.has(type)) {
        return this.providers.get(type)!;
      }
    }

    throw new Error("No sandbox provider available");
  }

  /**
   * Get a specific provider by type
   */
  async getProvider(type: SandboxProviderType): Promise<ISandboxProvider | undefined> {
    await this.init();
    return this.providers.get(type);
  }

  /**
   * Execute a command
   */
  async exec(
    options: SandboxExecOptions,
    preferred?: SandboxProviderType
  ): Promise<SandboxExecResult> {
    const provider = await this.getBestProvider(preferred);
    return provider.exec(options);
  }

  /**
   * Run a script file
   */
  async runScript(
    filePath: string,
    workDir: string,
    options?: ScriptOptions,
    preferred?: SandboxProviderType
  ): Promise<SandboxExecResult> {
    const provider = await this.getBestProvider(preferred);
    return provider.runScript(filePath, workDir, options);
  }

  /**
   * Get available providers list
   */
  async getAvailableProviders(): Promise<SandboxProviderType[]> {
    await this.init();
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider details
   */
  async getProviderDetails(): Promise<
    Array<{
      type: SandboxProviderType;
      name: string;
      capabilities: SandboxCapabilities;
    }>
  > {
    await this.init();
    return Array.from(this.providers.values()).map((provider) => ({
      type: provider.type,
      name: provider.name,
      capabilities: provider.getCapabilities(),
    }));
  }

  /**
   * Stop all running executions
   */
  async stopAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.stop();
    }
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.shutdown();
    }
    this.providers.clear();
    this.initialized = false;
  }
}

// Singleton instance
let sandboxService: SandboxService | null = null;

export function getSandboxService(): SandboxService {
  if (!sandboxService) {
    sandboxService = new SandboxService();
  }
  return sandboxService;
}

// Re-export types
export type {
  ISandboxProvider,
  SandboxProviderType,
  SandboxCapabilities,
  SandboxExecOptions,
  SandboxExecResult,
  ScriptOptions,
  SandboxConfig,
} from "../sandbox/types";
