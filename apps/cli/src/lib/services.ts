/**
 * Service management for Viben CLI
 *
 * Handles background service status, start, stop, and logs.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { spawn, ChildProcess, exec } from 'child_process';
import { getStateDir } from './scope';

/**
 * Service types
 */
export type ServiceType = 'mcp' | 'viben';

/**
 * Service status
 */
export type ServiceStatus = 'running' | 'stopped' | 'error' | 'unknown';

/**
 * Service information
 */
export interface ServiceInfo {
  name: string;
  type: ServiceType;
  status: ServiceStatus;
  pid?: number;
  uptime?: string;
  error?: string;
  command?: string;
  args?: string[];
}

/**
 * Service process storage
 */
interface ServiceProcess {
  name: string;
  type: ServiceType;
  pid: number;
  command: string;
  args?: string[];
  startedAt: string;
}

/**
 * Services state file
 */
const SERVICES_FILE = 'services.yaml';

/**
 * Logs directory
 */
const LOGS_DIR = 'logs';

/**
 * Get services file path
 */
function getServicesFilePath(): string {
  return path.join(getStateDir(), SERVICES_FILE);
}

/**
 * Get logs directory path
 */
function getLogsDir(): string {
  return path.join(getStateDir(), LOGS_DIR);
}

/**
 * Get log file path for a service
 */
export function getServiceLogPath(serviceName: string): string {
  const logsDir = getLogsDir();
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  // Sanitize service name for file path
  const sanitized = serviceName.replace(/[^a-zA-Z0-9-_]/g, '-');
  return path.join(logsDir, `${sanitized}.log`);
}

/**
 * Read services state from file
 */
function readServicesState(): ServiceProcess[] {
  const filePath = getServicesFilePath();

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = yaml.parse(content) as { services?: ServiceProcess[] };
    return data?.services || [];
  } catch {
    return [];
  }
}

/**
 * Write services state to file
 */
function writeServicesState(services: ServiceProcess[]): void {
  const filePath = getServicesFilePath();
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const content = yaml.stringify({ version: 1, services }, { indent: 2 });
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Check if a process is running by PID
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Signal 0 tests if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate uptime string
 */
function calculateUptime(startedAt: string): string {
  const startTime = new Date(startedAt).getTime();
  const now = Date.now();
  const diff = now - startTime;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Parse service name to get type and identifier
 */
export function parseServiceName(name: string): { type: ServiceType; identifier: string } {
  if (name.startsWith('mcp:')) {
    return { type: 'mcp', identifier: name.slice(4) };
  }
  if (name.startsWith('viben:')) {
    return { type: 'viben', identifier: name.slice(6) };
  }
  // Default to viben type
  return { type: 'viben', identifier: name };
}

/**
 * Get service status
 */
export function getServiceStatus(name: string): ServiceInfo {
  const services = readServicesState();
  const service = services.find((s) => s.name === name);

  if (!service) {
    return {
      name,
      type: parseServiceName(name).type,
      status: 'stopped',
    };
  }

  const running = isProcessRunning(service.pid);

  if (!running) {
    // Clean up stale entry
    const updated = services.filter((s) => s.name !== name);
    writeServicesState(updated);

    return {
      name,
      type: service.type,
      status: 'stopped',
    };
  }

  return {
    name,
    type: service.type,
    status: 'running',
    pid: service.pid,
    uptime: calculateUptime(service.startedAt),
    command: service.command,
    args: service.args,
  };
}

/**
 * List all services with their status
 */
export function listServices(): ServiceInfo[] {
  const services = readServicesState();
  const result: ServiceInfo[] = [];

  // Check actual status of each tracked service
  for (const service of services) {
    const info = getServiceStatus(service.name);
    result.push(info);
  }

  // Add known viben services that might not be tracked
  const knownServices = ['viben:sync', 'viben:index'];
  for (const name of knownServices) {
    if (!result.find((s) => s.name === name)) {
      result.push({
        name,
        type: 'viben',
        status: 'stopped',
      });
    }
  }

  return result;
}

/**
 * Start a service
 */
export async function startService(
  name: string,
  command: string,
  args: string[] = []
): Promise<ServiceInfo> {
  // Check if already running
  const current = getServiceStatus(name);
  if (current.status === 'running') {
    return current;
  }

  const logPath = getServiceLogPath(name);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  return new Promise((resolve, reject) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: ['ignore', logStream, logStream],
      });

      // Allow parent to exit independently
      child.unref();

      if (!child.pid) {
        reject(new Error('Failed to start service: no PID'));
        return;
      }

      // Record the service
      const services = readServicesState();
      const existing = services.findIndex((s) => s.name === name);

      const serviceProcess: ServiceProcess = {
        name,
        type: parseServiceName(name).type,
        pid: child.pid,
        command,
        args,
        startedAt: new Date().toISOString(),
      };

      if (existing >= 0) {
        services[existing] = serviceProcess;
      } else {
        services.push(serviceProcess);
      }

      writeServicesState(services);

      // Wait a bit to check if process started successfully
      setTimeout(() => {
        const status = getServiceStatus(name);
        resolve(status);
      }, 500);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stop a service
 */
export async function stopService(name: string): Promise<ServiceInfo> {
  const services = readServicesState();
  const service = services.find((s) => s.name === name);

  if (!service) {
    return {
      name,
      type: parseServiceName(name).type,
      status: 'stopped',
    };
  }

  // Try to kill the process
  try {
    process.kill(service.pid, 'SIGTERM');

    // Wait for process to terminate
    await new Promise<void>((resolve) => {
      let attempts = 0;
      const check = () => {
        if (!isProcessRunning(service.pid) || attempts >= 10) {
          resolve();
          return;
        }
        attempts++;
        setTimeout(check, 200);
      };
      check();
    });

    // Force kill if still running
    if (isProcessRunning(service.pid)) {
      process.kill(service.pid, 'SIGKILL');
    }
  } catch {
    // Process might already be dead
  }

  // Remove from services state
  const updated = services.filter((s) => s.name !== name);
  writeServicesState(updated);

  return {
    name,
    type: service.type,
    status: 'stopped',
  };
}

/**
 * Restart a service
 */
export async function restartService(
  name: string,
  command?: string,
  args?: string[]
): Promise<ServiceInfo> {
  const current = getServiceStatus(name);

  // Stop if running
  if (current.status === 'running') {
    await stopService(name);
  }

  // Start with the provided command or the last known command
  const cmd = command || current.command;
  const cmdArgs = args || current.args || [];

  if (!cmd) {
    return {
      name,
      type: parseServiceName(name).type,
      status: 'error',
      error: 'No command specified and no previous command found',
    };
  }

  return startService(name, cmd, cmdArgs);
}

/**
 * Read service logs
 */
export function readServiceLogs(name: string, lines: number = 100): string[] {
  const logPath = getServiceLogPath(name);

  if (!fs.existsSync(logPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const allLines = content.split('\n').filter((line) => line.trim());

    // Return last N lines
    return allLines.slice(-lines);
  } catch {
    return [];
  }
}

/**
 * Clear service logs
 */
export function clearServiceLogs(name: string): void {
  const logPath = getServiceLogPath(name);

  if (fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '', 'utf-8');
  }
}

/**
 * Watch service logs (returns a function to stop watching)
 */
export function watchServiceLogs(
  name: string,
  callback: (line: string) => void
): () => void {
  const logPath = getServiceLogPath(name);

  // Ensure log file exists
  if (!fs.existsSync(logPath)) {
    const logsDir = path.dirname(logPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.writeFileSync(logPath, '', 'utf-8');
  }

  // Track file position
  let position = fs.statSync(logPath).size;

  const watcher = fs.watch(logPath, (eventType) => {
    if (eventType === 'change') {
      const stat = fs.statSync(logPath);
      if (stat.size > position) {
        const fd = fs.openSync(logPath, 'r');
        const buffer = Buffer.alloc(stat.size - position);
        fs.readSync(fd, buffer, 0, buffer.length, position);
        fs.closeSync(fd);

        const newContent = buffer.toString('utf-8');
        const lines = newContent.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          callback(line);
        }

        position = stat.size;
      }
    }
  });

  return () => {
    watcher.close();
  };
}
