/**
 * Sandbox Routes
 *
 * API endpoints for sandbox command execution.
 */
import type { FastifyInstance } from "fastify";
import { getSandboxService, type SandboxProviderType } from "../../services/sandbox";
import { logger as globalLogger } from "../../telemetry";

const log = globalLogger.child({ module: "sandbox" });

/**
 * Register sandbox routes
 */
export function registerSandboxRoutes(fastify: FastifyInstance): void {
  const sandboxService = getSandboxService();

  /**
   * GET /api/sandbox/available
   * Get list of available sandbox providers
   */
  fastify.get("/api/sandbox/available", async () => {
    const providers = await sandboxService.getAvailableProviders();
    const details = await sandboxService.getProviderDetails();
    return { providers, details };
  });

  /**
   * POST /api/sandbox/exec
   * Execute a command in sandbox
   */
  fastify.post<{
    Body: {
      command: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      provider?: SandboxProviderType;
    };
  }>("/api/sandbox/exec", async (request, reply) => {
    const { command, args, cwd, env, timeout, provider } = request.body;

    if (!command) {
      return reply.status(400).send({ error: "command is required" });
    }

    const result = await sandboxService.exec(
      { command, args, cwd, env, timeout },
      provider
    );
    return result;
  });

  /**
   * POST /api/sandbox/run/file
   * Run a script file in sandbox
   */
  fastify.post<{
    Body: {
      file_path: string;
      work_dir: string;
      args?: string[];
      env?: Record<string, string>;
      packages?: string[];
      timeout?: number;
      provider?: SandboxProviderType;
    };
  }>("/api/sandbox/run/file", async (request, reply) => {
    const { file_path, work_dir, args, env, packages, timeout, provider } = request.body;

    if (!file_path) {
      return reply.status(400).send({ error: "file_path is required" });
    }
    if (!work_dir) {
      return reply.status(400).send({ error: "work_dir is required" });
    }

    const result = await sandboxService.runScript(
      file_path,
      work_dir,
      { args, env, packages, timeout },
      provider
    );
    return result;
  });

  /**
   * POST /api/sandbox/stop
   * Stop all running sandbox executions
   */
  fastify.post("/api/sandbox/stop", async () => {
    await sandboxService.stopAll();
    return { success: true };
  });

  log.info("Sandbox routes registered");
}
