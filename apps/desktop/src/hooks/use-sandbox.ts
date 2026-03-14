/**
 * Sandbox Management Hook
 *
 * Provides functions for managing sandbox providers via the Gateway API.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getGatewayUrl } from "@/lib/gateway";

/**
 * Sandbox provider type
 */
export type SandboxProviderType = "native" | "codex" | "claude";

/**
 * Sandbox capabilities
 */
export interface SandboxCapabilities {
  supportsVolumeMounts: boolean;
  supportsNetworking: boolean;
  isolation: "vm" | "container" | "process" | "none";
  supportedRuntimes: string[];
  supportsPooling: boolean;
}

/**
 * Provider details
 */
export interface SandboxProviderDetails {
  type: SandboxProviderType;
  name: string;
  capabilities: SandboxCapabilities;
}

/**
 * Sandbox execution result
 */
export interface SandboxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  provider?: {
    type: SandboxProviderType;
    name: string;
  };
}

/**
 * Sandbox configuration (session-level)
 */
export interface SandboxConfig {
  enabled: boolean;
  provider?: SandboxProviderType;
  image?: string;
  providerConfig?: Record<string, unknown>;
}

export interface UseSandboxReturn {
  /** Available provider types */
  providers: SandboxProviderType[];
  /** Detailed provider information */
  providerDetails: SandboxProviderDetails[];
  /** Whether we're loading */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
  /** Refresh providers */
  refreshProviders: () => Promise<void>;
  /** Execute a command */
  exec: (
    command: string,
    args?: string[],
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      provider?: SandboxProviderType;
    }
  ) => Promise<SandboxExecResult | null>;
  /** Run a script file */
  runScript: (
    filePath: string,
    workDir: string,
    options?: {
      args?: string[];
      env?: Record<string, string>;
      packages?: string[];
      timeout?: number;
      provider?: SandboxProviderType;
    }
  ) => Promise<SandboxExecResult | null>;
  /** Get provider details by type */
  getProviderDetails: (type: SandboxProviderType) => SandboxProviderDetails | undefined;
  /** Check if a provider is available */
  isProviderAvailable: (type: SandboxProviderType) => boolean;
}

export function useSandbox(): UseSandboxReturn {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<SandboxProviderType[]>([]);
  const [providerDetails, setProviderDetails] = useState<SandboxProviderDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gatewayUrl = useMemo(() => getGatewayUrl(), []);

  // Fetch available providers
  const refreshProviders = useCallback(async () => {
    if (!gatewayUrl) {
      setError(t("errors.sandbox.gatewayNotConnected"));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${gatewayUrl}/api/sandbox/available`);
      if (!response.ok) {
        throw new Error(t("errors.sandbox.fetchProvidersFailed", { error: response.statusText }));
      }
      const data = await response.json();
      setProviders(data.providers || []);
      setProviderDetails(data.details || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProviders([]);
      setProviderDetails([]);
    } finally {
      setIsLoading(false);
    }
  }, [gatewayUrl, t]);

  // Initial load
  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  // Execute a command
  const exec = useCallback(
    async (
      command: string,
      args?: string[],
      options?: {
        cwd?: string;
        env?: Record<string, string>;
        timeout?: number;
        provider?: SandboxProviderType;
      }
    ): Promise<SandboxExecResult | null> => {
      if (!gatewayUrl) {
        setError(t("errors.sandbox.gatewayNotConnected"));
        return null;
      }

      try {
        const response = await fetch(`${gatewayUrl}/api/sandbox/exec`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command,
            args,
            cwd: options?.cwd,
            env: options?.env,
            timeout: options?.timeout,
            provider: options?.provider,
          }),
        });

        if (!response.ok) {
          throw new Error(t("errors.sandbox.executionFailed", { error: response.statusText }));
        }

        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [gatewayUrl, t]
  );

  // Run a script file
  const runScript = useCallback(
    async (
      filePath: string,
      workDir: string,
      options?: {
        args?: string[];
        env?: Record<string, string>;
        packages?: string[];
        timeout?: number;
        provider?: SandboxProviderType;
      }
    ): Promise<SandboxExecResult | null> => {
      if (!gatewayUrl) {
        setError(t("errors.sandbox.gatewayNotConnected"));
        return null;
      }

      try {
        const response = await fetch(`${gatewayUrl}/api/sandbox/run/file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_path: filePath,
            work_dir: workDir,
            args: options?.args,
            env: options?.env,
            packages: options?.packages,
            timeout: options?.timeout,
            provider: options?.provider,
          }),
        });

        if (!response.ok) {
          throw new Error(t("errors.sandbox.scriptExecutionFailed", { error: response.statusText }));
        }

        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [gatewayUrl, t]
  );

  // Get provider details by type
  const getProviderDetails = useCallback(
    (type: SandboxProviderType): SandboxProviderDetails | undefined => {
      return providerDetails.find((p) => p.type === type);
    },
    [providerDetails]
  );

  // Check if provider is available
  const isProviderAvailable = useCallback(
    (type: SandboxProviderType): boolean => {
      return providers.includes(type);
    },
    [providers]
  );

  return {
    providers,
    providerDetails,
    isLoading,
    error,
    refreshProviders,
    exec,
    runScript,
    getProviderDetails,
    isProviderAvailable,
  };
}
