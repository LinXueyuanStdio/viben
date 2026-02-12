/**
 * Service management for Viben CLI
 *
 * This module provides service/daemon management via NAPI bindings to viben-core.
 */

import {
  serviceList,
  serviceGetStatus,
  serviceStart,
  serviceStop,
  serviceRestart,
  serviceReadLogs,
  serviceClearLogs,
  serviceGetLogPath,
  serviceParseName,
  type ServiceInfo,
  type ServiceType,
  type ServiceStatus,
  type ParsedServiceName,
} from './native';

// Re-export types
export type { ServiceInfo, ServiceType, ServiceStatus, ParsedServiceName };

/**
 * Service process type (for compatibility)
 */
export interface ServiceProcess {
  name: string;
  pid?: number;
  command?: string;
  args?: string[];
  startedAt?: number;
}

/**
 * Parse service name to get type and identifier
 */
export function parseServiceName(name: string): { type: ServiceType; identifier: string } {
  const parsed = serviceParseName(name);
  return {
    type: parsed.serviceType as ServiceType,
    identifier: parsed.identifier,
  };
}

/**
 * Get log file path for a service
 */
export function getServiceLogPath(serviceName: string): string {
  return serviceGetLogPath(serviceName);
}

/**
 * Get service status (sync)
 */
export function getServiceStatus(name: string): ServiceInfo {
  return serviceGetStatus(name);
}

/**
 * Get service status (async - for API compatibility)
 */
export async function getServiceStatusAsync(name: string): Promise<ServiceInfo> {
  return serviceGetStatus(name);
}

/**
 * List all services with their status (sync)
 */
export function listServices(): ServiceInfo[] {
  return serviceList();
}

/**
 * List all services with their status (async - for API compatibility)
 */
export async function listServicesAsync(): Promise<ServiceInfo[]> {
  return serviceList();
}

/**
 * Start a service
 */
export async function startService(
  name: string,
  command: string,
  args: string[] = []
): Promise<ServiceInfo> {
  return serviceStart(name, command, args);
}

/**
 * Stop a service
 */
export async function stopService(name: string): Promise<ServiceInfo> {
  return serviceStop(name);
}

/**
 * Restart a service
 */
export async function restartService(
  name: string,
  command?: string,
  args?: string[]
): Promise<ServiceInfo> {
  return serviceRestart(name, command, args);
}

/**
 * Read service logs (sync)
 */
export function readServiceLogs(name: string, lines: number = 100): string[] {
  return serviceReadLogs(name, lines);
}

/**
 * Read service logs (async - for API compatibility)
 */
export async function readServiceLogsAsync(name: string, lines: number = 100): Promise<string[]> {
  return serviceReadLogs(name, lines);
}

/**
 * Clear service logs
 */
export async function clearServiceLogs(name: string): Promise<void> {
  return serviceClearLogs(name);
}

/**
 * Watch service logs (returns a function to stop watching)
 * Note: This requires polling in the current implementation
 */
export function watchServiceLogs(
  name: string,
  callback: (line: string) => void
): () => void {
  let lastLineCount = 0;
  let running = true;

  const poll = async () => {
    while (running) {
      const lines = serviceReadLogs(name, 1000);
      if (lines.length > lastLineCount) {
        const newLines = lines.slice(lastLineCount);
        newLines.forEach(callback);
        lastLineCount = lines.length;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  poll().catch(() => {});

  return () => {
    running = false;
  };
}

/**
 * ServiceManager class for backward compatibility
 * Note: This is kept for API compatibility but uses NAPI bindings internally
 */
export class ServiceManager {
  parseServiceName(name: string): { type: ServiceType; identifier: string } {
    return parseServiceName(name);
  }

  getLogPath(serviceName: string): string {
    return getServiceLogPath(serviceName);
  }

  async status(name: string): Promise<ServiceInfo> {
    return getServiceStatus(name);
  }

  async list(): Promise<ServiceInfo[]> {
    return listServices();
  }

  async start(options: { name: string; command: string; args?: string[] }): Promise<ServiceInfo> {
    return startService(options.name, options.command, options.args ?? []);
  }

  async stop(name: string): Promise<ServiceInfo> {
    return stopService(name);
  }

  async restart(name: string, command?: string, args?: string[]): Promise<ServiceInfo> {
    return restartService(name, command, args);
  }

  async readLogs(name: string, lines: number = 100): Promise<string[]> {
    return readServiceLogs(name, lines);
  }

  async clearLogs(name: string): Promise<void> {
    return clearServiceLogs(name);
  }

  watchLogs(options: { name: string; onLine: (line: string) => void }): () => void {
    return watchServiceLogs(options.name, options.onLine);
  }
}

/** Singleton service manager instance */
export const serviceManager = new ServiceManager();
