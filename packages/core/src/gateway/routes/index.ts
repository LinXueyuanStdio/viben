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
import { registerChannelRoutes } from "./channels";
import { registerExecutorRoutes } from "./executors";
import { registerModelRoutes } from "./models";
import { registerWebSocketRoutes } from "./ws";
import { registerHistoryRoutes } from "./history";
import { registerTerminalRoutes } from "./terminal";
import { registerGroupChatRoutes } from "./group-chats";
import { registerWorkspaceRoutes } from "./workspaces";

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
  registerChannelRoutes(fastify);
  registerExecutorRoutes(fastify);
  registerModelRoutes(fastify);
  registerWebSocketRoutes(fastify, state);
  registerHistoryRoutes(fastify);
  registerTerminalRoutes(fastify, state);
  registerWorkspaceRoutes(fastify);
  registerGroupChatRoutes(fastify, state);
}

// Re-export individual route registrations
export { registerHealthRoutes } from "./health";
export { registerAgentRoutes } from "./agents";
export { registerTaskRoutes } from "./tasks";
export { registerSessionRoutes } from "./sessions";
export { registerCronRoutes } from "./cron";
export { registerEventsRoutes } from "./events";
export { registerChannelRoutes } from "./channels";
export { registerExecutorRoutes } from "./executors";
export { registerModelRoutes } from "./models";
export { registerWebSocketRoutes } from "./ws";
export { registerHistoryRoutes } from "./history";
export { registerTerminalRoutes, getActiveSessionCount, killAllSessions } from "./terminal";
export { registerWorkspaceRoutes } from "./workspaces";
export { registerGroupChatRoutes } from "./group-chats";
