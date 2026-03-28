/**
 * Package management routes
 *
 * Provides endpoints for:
 * - Listing installed packages (MCP and Skills)
 * - Updating packages from marketplace
 */
import type { FastifyInstance } from "fastify";
import { mcpManager } from "../../mcp";
import { listSkills } from "../../skill/ops";
import type { InstalledMcp } from "../../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Installed package info for API response
 */
export interface InstalledPackage {
  id: string;
  name: string;
  version: string;
  package_type: "mcp" | "skill";
  install_path: string;
  installed_at: string;
  slug?: string;
}

/**
 * Response for listing installed packages
 */
export interface InstalledPackagesResponse {
  mcp: InstalledPackage[];
  skills: InstalledPackage[];
}

/**
 * Request body for updating a package
 */
interface UpdatePackageBody {
  package_id: string;
  package_type: "mcp" | "skill";
}

/**
 * Response for package update
 */
interface UpdatePackageResponse {
  success: boolean;
  error?: string;
  message?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert InstalledMcp to API response format
 */
function mcpToPackage(mcp: InstalledMcp): InstalledPackage {
  return {
    id: mcp.name,
    name: mcp.name,
    version: mcp.version,
    package_type: "mcp",
    install_path: mcp.path,
    installed_at: mcp.installed_at,
  };
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register package management routes
 */
export function registerPackagesRoutes(fastify: FastifyInstance): void {
  /**
   * GET /api/packages/installed
   * List all installed packages (MCP and Skills)
   */
  fastify.get<{
    Reply: InstalledPackagesResponse;
  }>("/api/packages/installed", async (_request, reply) => {
    try {
      // Get installed MCPs
      const installedMcps = await mcpManager.listInstalled();

      // Get installed Skills (from all targets)
      const skillsResult = await listSkills();
      const installedSkills = skillsResult.success ? skillsResult.skills : [];

      return reply.send({
        mcp: installedMcps.map(mcpToPackage),
        skills: installedSkills.map((skill) => ({
          id: skill.name,
          name: skill.name,
          version: skill.version,
          package_type: "skill" as const,
          install_path: skill.path,
          installed_at: skill.installedAt,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to list installed packages: ${message}`);
      return reply.status(500).send({
        mcp: [],
        skills: [],
      });
    }
  });

  /**
   * POST /api/packages/update
   * Update a specific package to the latest version
   *
   * Note: This is a placeholder implementation.
   * Full implementation would:
   * 1. Fetch latest version from marketplace
   * 2. Download and install the update
   * 3. Update the installed.yaml tracking file
   */
  fastify.post<{
    Body: UpdatePackageBody;
    Reply: UpdatePackageResponse;
  }>("/api/packages/update", async (request, reply) => {
    const { package_id, package_type } = request.body;

    if (!package_id || !package_type) {
      return reply.status(400).send({
        success: false,
        error: "Missing required fields: package_id, package_type",
      });
    }

    if (package_type !== "mcp" && package_type !== "skill") {
      return reply.status(400).send({
        success: false,
        error: "Invalid package_type. Must be 'mcp' or 'skill'",
      });
    }

    try {
      // TODO: Implement actual package update logic
      // For now, return a placeholder response indicating the feature is not fully implemented
      fastify.log.info(
        `Package update requested: ${package_type}/${package_id}`
      );

      // Placeholder: In a full implementation, this would:
      // 1. Query marketplace for latest version
      // 2. Download the package
      // 3. Install/replace the existing package
      // 4. Update tracking files

      return reply.send({
        success: false,
        error: "Package update feature is not yet fully implemented",
        message: `Update requested for ${package_type} package: ${package_id}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to update package ${package_id}: ${message}`);
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });

  /**
   * GET /api/packages/mcp
   * List installed MCP packages only
   */
  fastify.get<{
    Reply: { packages: InstalledPackage[] };
  }>("/api/packages/mcp", async (_request, reply) => {
    try {
      const installedMcps = await mcpManager.listInstalled();
      return reply.send({
        packages: installedMcps.map(mcpToPackage),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to list MCP packages: ${message}`);
      return reply.status(500).send({
        packages: [],
      });
    }
  });

  /**
   * GET /api/packages/skills
   * List installed skill packages only
   *
   * Note: For full skill management, use the /api/skill/* endpoints instead.
   */
  fastify.get<{
    Reply: { packages: InstalledPackage[] };
  }>("/api/packages/skills", async (_request, reply) => {
    try {
      const skillsResult = await listSkills();
      const installedSkills = skillsResult.success ? skillsResult.skills : [];
      return reply.send({
        packages: installedSkills.map((skill) => ({
          id: skill.name,
          name: skill.name,
          version: skill.version,
          package_type: "skill" as const,
          install_path: skill.path,
          installed_at: skill.installedAt,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to list skill packages: ${message}`);
      return reply.status(500).send({
        packages: [],
      });
    }
  });

  // Note: Skill install/uninstall routes are now in ./skill.ts
  // - POST /api/skill/install
  // - DELETE /api/skill/:name
  // - GET /api/skill
  // - GET /api/skill/:name
  // - GET /api/skill/available
  // - GET /api/skill/enabled
  // - POST /api/skill/enable
  // - POST /api/skill/disable
}
