/**
 * Installed Sources routes
 *
 * Provides HTTP API for managing browse-mcp-cli installed sources and providers.
 */
import type { FastifyInstance } from "fastify";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface InstalledSource {
  name: string;
  provider: string;
  enabled: boolean;
}

interface InstalledProviderInfo {
  name: string;
  description?: string;
  package?: string;
  sources: string[];
  count: number;
}

interface InstalledSourcesResponse {
  providers: Record<string, InstalledProviderInfo>;
  sources: InstalledSource[];
  total: number;
  enabled: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Run browse-mcp-cli command and parse JSON output
 */
async function runBrowseMcpCli<T>(
  pythonPath: string,
  args: string[]
): Promise<T> {
  const command = `"${pythonPath}" -m browse_mcp_cli ${args.join(" ")}`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    // Try to parse JSON from stdout
    if (stdout.trim()) {
      try {
        return JSON.parse(stdout) as T;
      } catch {
        // If stdout is not JSON, it might be an error message
        throw new Error(stdout.trim() || stderr.trim() || "Unknown error");
      }
    }

    // If no stdout, check stderr for error
    if (stderr.trim()) {
      throw new Error(stderr.trim());
    }

    throw new Error("No output from browse-mcp-cli");
  } catch (err) {
    if (err instanceof Error) {
      // Check if it's an exec error with stderr
      const execErr = err as Error & { stderr?: string };
      if (execErr.stderr) {
        throw new Error(execErr.stderr);
      }
      throw err;
    }
    throw new Error(String(err));
  }
}

/**
 * Parse the list output from browse-mcp-cli
 */
function parseListOutput(output: string): InstalledSourcesResponse {
  // Try to parse as JSON first (if cli outputs JSON)
  try {
    return JSON.parse(output);
  } catch {
    // Fall back to parsing text output
  }

  const sources: InstalledSource[] = [];
  const providers: Record<string, InstalledProviderInfo> = {};
  let currentProvider = "";

  const lines = output.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and headers
    if (!trimmed || trimmed.startsWith("=") || trimmed.startsWith("-")) {
      continue;
    }

    // Provider header (e.g., "provider_name (3 sources)")
    const providerMatch = trimmed.match(/^(\w+)\s*\((\d+)\s+sources?\)/i);
    if (providerMatch) {
      currentProvider = providerMatch[1];
      providers[currentProvider] = {
        name: currentProvider,
        sources: [],
        count: parseInt(providerMatch[2], 10),
      };
      continue;
    }

    // Source line (e.g., "[✓] source_name" or "[ ] source_name")
    const sourceMatch = trimmed.match(/^\[([\s✓x])\]\s*(\S+)/);
    if (sourceMatch && currentProvider) {
      const enabled = sourceMatch[1] === "✓";
      const name = sourceMatch[2];
      sources.push({ name, provider: currentProvider, enabled });
      providers[currentProvider]?.sources.push(name);
    }
  }

  return {
    providers,
    sources,
    total: sources.length,
    enabled: sources.filter((s) => s.enabled).length,
  };
}

// ============================================================================
// Routes
// ============================================================================

export function registerInstalledSourcesRoutes(fastify: FastifyInstance): void {
  /**
   * Get installed sources from browse-mcp-cli
   * GET /api/sources/installed
   */
  fastify.get<{
    Querystring: { python_path: string };
  }>("/api/sources/installed", async (request, reply) => {
    const { python_path } = request.query;

    if (!python_path) {
      reply.code(400);
      return { error: "python_path is required" };
    }

    try {
      // Run browse-mcp-cli list --json
      const result = await runBrowseMcpCli<InstalledSourcesResponse>(
        python_path,
        ["list", "--json"]
      );
      return result;
    } catch (err) {
      // Try without --json flag for older versions
      try {
        const { stdout } = await execAsync(
          `"${python_path}" -m browse_mcp_cli list`,
          { timeout: 30000 }
        );
        return parseListOutput(stdout);
      } catch (fallbackErr) {
        reply.code(500);
        return {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  });

  /**
   * Show details of a specific provider
   * GET /api/sources/provider/:provider
   */
  fastify.get<{
    Params: { provider: string };
    Querystring: { python_path: string };
  }>("/api/sources/provider/:provider", async (request, reply) => {
    const { provider } = request.params;
    const { python_path } = request.query;

    if (!python_path) {
      reply.code(400);
      return { error: "python_path is required" };
    }

    try {
      // Run browse-mcp-cli show provider --json
      const result = await runBrowseMcpCli<Record<string, unknown>>(
        python_path,
        ["show", provider, "--json"]
      );
      return result;
    } catch (err) {
      // Try without --json flag
      try {
        const { stdout } = await execAsync(
          `"${python_path}" -m browse_mcp_cli show ${provider}`,
          { timeout: 30000 }
        );
        return { raw_output: stdout };
      } catch (fallbackErr) {
        reply.code(500);
        return {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  });

  /**
   * Install a provider plugin
   * POST /api/sources/provider/install
   */
  fastify.post<{
    Body: {
      python_path: string;
      provider: string;
      upgrade?: boolean;
    };
  }>("/api/sources/provider/install", async (request, reply) => {
    const { python_path, provider, upgrade } = request.body;

    if (!python_path) {
      reply.code(400);
      return { error: "python_path is required" };
    }

    if (!provider) {
      reply.code(400);
      return { error: "provider is required" };
    }

    try {
      const args = ["install", provider];
      if (upgrade) {
        args.push("--upgrade");
      }

      const { stdout, stderr } = await execAsync(
        `"${python_path}" -m browse_mcp_cli ${args.join(" ")}`,
        { timeout: 120000 } // 2 minutes for installation
      );

      return {
        success: true,
        output: stdout || stderr,
        provider,
      };
    } catch (err) {
      const execErr = err as Error & { stdout?: string; stderr?: string };
      reply.code(500);
      return {
        success: false,
        error: execErr.message,
        stdout: execErr.stdout,
        stderr: execErr.stderr,
      };
    }
  });
}
