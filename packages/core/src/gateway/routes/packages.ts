/**
 * Package management routes
 *
 * Provides endpoints for:
 * - Listing installed packages (MCP and Skills)
 * - Updating packages from marketplace
 */
import type { FastifyInstance } from "fastify";
import { mcpManager } from "../../mcp";
import { skillsManager } from "../../skills";
import type { InstalledMcp, InstalledSkill } from "../../types";

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

/**
 * Request body for installing a skill from zip
 */
interface InstallSkillBody {
  name: string;
  zip_path: string;
  force?: boolean;
  version?: string;
}

/**
 * Response for skill installation
 */
interface InstallSkillResponse {
  success: boolean;
  name: string;
  version: string;
  path: string;
  message: string;
  error?: string;
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
    installed_at: mcp.installedAt,
  };
}

/**
 * Convert InstalledSkill to API response format
 */
function skillToPackage(skill: InstalledSkill): InstalledPackage {
  return {
    id: skill.name,
    name: skill.name,
    version: skill.version,
    package_type: "skill",
    install_path: skill.path,
    installed_at: skill.installedAt,
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
      const installedSkills = await skillsManager.listInstalledSkills();

      return reply.send({
        mcp: installedMcps.map(mcpToPackage),
        skills: installedSkills.map(skillToPackage),
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
   */
  fastify.get<{
    Reply: { packages: InstalledPackage[] };
  }>("/api/packages/skills", async (_request, reply) => {
    try {
      const installedSkills = await skillsManager.listInstalledSkills();
      return reply.send({
        packages: installedSkills.map(skillToPackage),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to list skill packages: ${message}`);
      return reply.status(500).send({
        packages: [],
      });
    }
  });

  /**
   * POST /api/skill/install
   * Install a skill from a zip file
   */
  fastify.post<{
    Body: InstallSkillBody;
    Reply: InstallSkillResponse;
  }>("/api/skill/install", async (request, reply) => {
    const { name, zip_path, force = false, version } = request.body;

    if (!name || !zip_path) {
      return reply.status(400).send({
        success: false,
        name: name || "",
        version: version || "1.0.0",
        path: "",
        message: "Missing required fields",
        error: "Missing required fields: name, zip_path",
      });
    }

    try {
      const result = await skillsManager.installSkill({
        name,
        target: "global",
        zipPath: zip_path,
        force,
        version,
      });

      return reply.send({
        success: result.success,
        name: result.name,
        version: result.version,
        path: result.path,
        message: result.message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to install skill ${name}: ${message}`);

      // Determine error code
      let errorCode = "UNKNOWN_ERROR";
      if (error && typeof error === "object" && "name" in error) {
        const errorName = (error as { name: string }).name;
        if (errorName === "AlreadyExistsError") {
          errorCode = "ALREADY_EXISTS";
        } else if (errorName === "ValidationError") {
          errorCode = "VALIDATION_ERROR";
        }
      }

      return reply.status(500).send({
        success: false,
        name,
        version: version || "1.0.0",
        path: "",
        message: "Installation failed",
        error: `${errorCode}: ${message}`,
      });
    }
  });

  /**
   * DELETE /api/skill/:name
   * Uninstall a skill
   */
  fastify.delete<{
    Params: { name: string };
    Reply: { success: boolean; message: string; error?: string };
  }>("/api/skill/:name", async (request, reply) => {
    const { name } = request.params;

    if (!name) {
      return reply.status(400).send({
        success: false,
        message: "Missing skill name",
        error: "Missing required parameter: name",
      });
    }

    try {
      const result = await skillsManager.uninstallSkill({
        name,
        target: "global",
      });

      return reply.send({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to uninstall skill ${name}: ${message}`);
      return reply.status(500).send({
        success: false,
        message: "Uninstallation failed",
        error: message,
      });
    }
  });
}
