/**
 * Executor Registry
 *
 * Central registry for executor factories. Each platform registers
 * its factory function, which creates configured executor instances.
 */

import type { ExecutorType, AvailabilityInfo } from "../../types";
import type { Executor, ExecutorConfig } from "./types";

type ExecutorFactory = (config?: ExecutorConfig) => Executor;

const registry = new Map<ExecutorType, ExecutorFactory>();

/**
 * Register an executor factory
 */
export function registerExecutor(type: ExecutorType, factory: ExecutorFactory): void {
  registry.set(type, factory);
}

/**
 * Get an executor instance
 *
 * @throws Error if executor type is not registered
 */
export function getExecutor(type: ExecutorType, config?: ExecutorConfig): Executor {
  const factory = registry.get(type);
  if (!factory) {
    throw new Error(`Unknown executor type: ${type}`);
  }
  return factory(config);
}

/**
 * Check if executor is registered
 */
export function hasExecutor(type: ExecutorType): boolean {
  return registry.has(type);
}

/**
 * Get all registered executor types
 */
export function getRegisteredTypes(): ExecutorType[] {
  return Array.from(registry.keys());
}

/**
 * Get all available executors (installed or logged in)
 */
export function getAvailableExecutors(): Array<{
  type: ExecutorType;
  executor: Executor;
  availability: AvailabilityInfo;
}> {
  const result: Array<{
    type: ExecutorType;
    executor: Executor;
    availability: AvailabilityInfo;
  }> = [];

  for (const type of registry.keys()) {
    const executor = getExecutor(type);
    const availability = executor.getAvailabilityInfo();
    if (availability.status !== "NOT_FOUND") {
      result.push({ type, executor, availability });
    }
  }

  return result;
}
