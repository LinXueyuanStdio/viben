/**
 * Gateway routes index
 */
import type { FastifyInstance } from "fastify";
import type { AppState } from "../state";
import { registerHealthRoutes } from "./health";
import { registerAgentRoutes } from "./agents";
import { registerTaskRoutes } from "./tasks";
import { registerSessionRoutes } from "./sessions";
import { registerCronRoutes } from "./cron";
import { registerEventsRoutes } from "./events";

/**
 * Register all routes
 */
export function registerRoutes(fastify: FastifyInstance, state: AppState): void {
  registerHealthRoutes(fastify);
  registerAgentRoutes(fastify);
  registerTaskRoutes(fastify, state);
  registerSessionRoutes(fastify, state);
  registerCronRoutes(fastify, state);
  registerEventsRoutes(fastify, state);
}

// Re-export individual route registrations
export { registerHealthRoutes } from "./health";
export { registerAgentRoutes } from "./agents";
export { registerTaskRoutes } from "./tasks";
export { registerSessionRoutes } from "./sessions";
export { registerCronRoutes } from "./cron";
export { registerEventsRoutes } from "./events";
