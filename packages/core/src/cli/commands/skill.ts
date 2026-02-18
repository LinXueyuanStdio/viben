/**
 * CLI skill command - Manage skills
 *
 * Uses skillsManager from skills module.
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import type { SkillTarget } from "../../skills/types";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  outputSuccess,
  handleCommandError,
} from "../lib";
import { skillsManager } from "../../skills";

/**
 * Get output context from program options
 */
function getOutputContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Register the skill command
 */
export function registerSkillCommand(program: Command): void {
  const skill = program.command("skill").description("Manage skills");

  // skill list - list installed skills
  skill
    .command("list")
    .description("List installed skills")
    .option("--available", "List available skills from marketplace")
    .option("--agent <id>", "List skills for a specific agent")
    .option("--global", "List only global skills")
    .option("--claude", "List only Claude skills")
    .action(
      async (options: {
        available?: boolean;
        agent?: string;
        global?: boolean;
        claude?: boolean;
      }) => {
        const ctx = getOutputContext(program);
        try {
          if (options.available) {
            // List available skills from marketplace
            const available = await skillsManager.listAvailableSkills();

            output(
              ctx,
              successResponse({ skills: available, count: available.length }),
              () => {
                if (available.length === 0) {
                  console.log(chalk.gray("No skills available in marketplace."));
                  console.log();
                  console.log(chalk.gray("Marketplace integration coming soon."));
                  return;
                }

                console.log(chalk.bold("Available Skills:"));
                console.log();
                outputTable(
                  ctx,
                  ["Name", "Version", "Description"],
                  available.map((s) => [s.name, s.version, s.description || "-"])
                );
              }
            );
          } else if (options.agent) {
            // List skills for specific agent
            const skills = await skillsManager.listAgentSkills(options.agent);

            output(
              ctx,
              successResponse({ agent: options.agent, skills, count: skills.length }),
              () => {
                if (skills.length === 0) {
                  console.log(
                    chalk.gray(`No skills installed for agent "${options.agent}".`)
                  );
                  console.log();
                  console.log("Install a skill with:");
                  console.log(
                    chalk.cyan(`  viben skill install <name> --agent ${options.agent}`)
                  );
                  return;
                }

                console.log(chalk.bold(`Skills for Agent: ${options.agent}`));
                console.log();
                outputTable(
                  ctx,
                  ["Name", "Version", "Path"],
                  skills.map((s) => [s.name, s.version, s.path])
                );
              }
            );
          } else {
            // List installed skills from specified or all targets
            let target: SkillTarget | undefined;
            if (options.global) {
              target = "global";
            } else if (options.claude) {
              target = "claude";
            }

            const skills = await skillsManager.listInstalledSkills(
              target ? { target } : undefined
            );

            output(
              ctx,
              successResponse({ skills, count: skills.length }),
              () => {
                if (skills.length === 0) {
                  console.log(chalk.gray("No skills installed."));
                  console.log();
                  console.log("Install a skill with:");
                  console.log(chalk.cyan("  viben skill install <name>"));
                  console.log();
                  console.log("View available skills with:");
                  console.log(chalk.cyan("  viben skill list --available"));
                  return;
                }

                console.log(chalk.bold("Installed Skills:"));
                console.log();
                outputTable(
                  ctx,
                  ["Name", "Version", "Path", "Installed At"],
                  skills.map((s) => [
                    s.name,
                    s.version,
                    s.path,
                    formatDate(s.installedAt),
                  ])
                );
              }
            );
          }
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // skill show <name> - show skill details
  skill
    .command("show <name>")
    .description("Show skill details")
    .option("--agent <id>", "Agent ID (for agent-specific skills)")
    .action(async (name: string, options: { agent?: string }) => {
      const ctx = getOutputContext(program);
      try {
        const skillInfo = await skillsManager.getSkillInfo(
          name,
          options.agent ? { target: "agent", agentId: options.agent } : undefined
        );

        if (!skillInfo) {
          throw new Error(`Skill "${name}" not found`);
        }

        output(ctx, successResponse({ skill: skillInfo }), () => {
          console.log(chalk.bold(`Skill: ${skillInfo.name}`));
          console.log();
          outputKeyValue(ctx, {
            ID: skillInfo.id,
            Name: skillInfo.name,
            Version: skillInfo.version,
            Description: skillInfo.description || "-",
            Path: skillInfo.path,
            Source: skillInfo.source,
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // skill install <nameWithVersion> - install a skill
  // Supports: skill install <name>, skill install <name>@<version>, skill install <name>@latest
  skill
    .command("install <nameWithVersion>")
    .description("Install a skill (supports name@version syntax)")
    .option("--agent <id>", "Install to a specific agent")
    .option("--global", "Install globally (default)")
    .option("--claude", "Install to Claude skills directory")
    .option("--path <path>", "Install to custom path")
    .option("--source <path>", "Install from local path")
    .option("--version <version>", "Specific version to install")
    .option("--executor <name>", "Use executor for installation (e.g., CLAUDE_CODE)")
    .option("-f, --force", "Overwrite if already installed")
    .action(
      async (
        nameWithVersion: string,
        options: {
          agent?: string;
          global?: boolean;
          claude?: boolean;
          path?: string;
          source?: string;
          version?: string;
          executor?: string;
          force?: boolean;
        }
      ) => {
        const ctx = getOutputContext(program);
        try {
          // Parse name@version syntax
          const { name, version } = parseNameWithVersion(nameWithVersion);

          // --version option overrides @version in name
          const finalVersion = options.version || version;

          // Determine target
          let target: SkillTarget = "global";
          if (options.agent) {
            target = "agent";
          } else if (options.claude) {
            target = "claude";
          } else if (options.path) {
            target = "custom";
          } else if (options.executor) {
            // Handle executor-based installation
            target = getTargetFromExecutor(options.executor);
          }

          const result = await skillsManager.installSkill({
            name,
            target,
            agentId: options.agent,
            customPath: options.path,
            sourcePath: options.source,
            version: finalVersion,
            executor: options.executor,
            force: options.force,
          });

          output(ctx, successResponse({ result }), () => {
            outputSuccess(ctx, result.message);
            console.log();
            outputKeyValue(ctx, {
              Name: result.name,
              Version: result.version,
              Path: result.path,
              Target: result.target,
            });
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // skill uninstall <name> - uninstall a skill
  skill
    .command("uninstall <name>")
    .description("Uninstall a skill")
    .option("--agent <id>", "Uninstall from a specific agent")
    .option("--global", "Uninstall from global (default)")
    .option("--claude", "Uninstall from Claude skills directory")
    .option("--path <path>", "Uninstall from custom path")
    .action(
      async (
        name: string,
        options: {
          agent?: string;
          global?: boolean;
          claude?: boolean;
          path?: string;
        }
      ) => {
        const ctx = getOutputContext(program);
        try {
          // Determine target
          let target: SkillTarget = "global";
          if (options.agent) {
            target = "agent";
          } else if (options.claude) {
            target = "claude";
          } else if (options.path) {
            target = "custom";
          }

          const result = await skillsManager.uninstallSkill({
            name,
            target,
            agentId: options.agent,
            customPath: options.path,
          });

          output(ctx, successResponse({ result }), () => {
            outputSuccess(ctx, result.message);
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // skill enable <name> - enable a skill for an agent
  skill
    .command("enable <name>")
    .description("Enable a skill for an agent")
    .requiredOption("--agent <id>", "Agent ID")
    .action(async (name: string, options: { agent: string }) => {
      const ctx = getOutputContext(program);
      try {
        const config = await skillsManager.enableSkill(name, options.agent);

        output(ctx, successResponse({ config }), () => {
          outputSuccess(
            ctx,
            `Skill "${name}" enabled for agent "${options.agent}"`
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // skill disable <name> - disable a skill for an agent
  skill
    .command("disable <name>")
    .description("Disable a skill for an agent")
    .requiredOption("--agent <id>", "Agent ID")
    .action(async (name: string, options: { agent: string }) => {
      const ctx = getOutputContext(program);
      try {
        const config = await skillsManager.disableSkill(name, options.agent);

        output(ctx, successResponse({ config }), () => {
          outputSuccess(
            ctx,
            `Skill "${name}" disabled for agent "${options.agent}"`
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // skill enabled - list enabled skills for an agent
  skill
    .command("enabled")
    .description("List enabled skills for an agent")
    .requiredOption("--agent <id>", "Agent ID")
    .action(async (options: { agent: string }) => {
      const ctx = getOutputContext(program);
      try {
        const enabled = await skillsManager.getEnabledSkills(options.agent);

        output(
          ctx,
          successResponse({ agent: options.agent, skills: enabled, count: enabled.length }),
          () => {
            if (enabled.length === 0) {
              console.log(
                chalk.gray(`No skills enabled for agent "${options.agent}".`)
              );
              console.log();
              console.log("Enable a skill with:");
              console.log(
                chalk.cyan(`  viben skill enable <name> --agent ${options.agent}`)
              );
              return;
            }

            console.log(chalk.bold(`Enabled Skills for Agent: ${options.agent}`));
            console.log();
            outputTable(
              ctx,
              ["Skill", "Enabled At"],
              enabled.map((s) => [s.skillName, formatDate(s.enabledAt)])
            );
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // skill path <name> - get path to a skill
  skill
    .command("path <name>")
    .description("Get the path to a skill")
    .option("--agent <id>", "Agent ID (for agent-specific skills)")
    .option("--global", "Get global skill path")
    .option("--claude", "Get Claude skill path")
    .action(
      async (
        name: string,
        options: {
          agent?: string;
          global?: boolean;
          claude?: boolean;
        }
      ) => {
        const ctx = getOutputContext(program);
        try {
          let path: string;

          if (options.agent) {
            path = skillsManager.getAgentSkillPath(options.agent, name);
          } else if (options.claude) {
            path = skillsManager.getClaudeSkillPath(name);
          } else {
            path = skillsManager.getSharedSkillPath(name);
          }

          output(ctx, successResponse({ name, path }), () => {
            console.log(path);
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );
}

/**
 * Parse name@version syntax
 * Supports: "skill-name", "skill-name@1.0.0", "skill-name@latest"
 */
function parseNameWithVersion(nameWithVersion: string): {
  name: string;
  version: string | undefined;
} {
  const atIndex = nameWithVersion.lastIndexOf("@");

  // No @ or @ is at position 0 (like @scope/package)
  if (atIndex <= 0) {
    return { name: nameWithVersion, version: undefined };
  }

  const name = nameWithVersion.substring(0, atIndex);
  const version = nameWithVersion.substring(atIndex + 1);

  // Handle "latest" as undefined (let skillsManager resolve it)
  if (version === "latest") {
    return { name, version: undefined };
  }

  return { name, version };
}

/**
 * Get skill target from executor name
 */
function getTargetFromExecutor(executor: string): SkillTarget {
  switch (executor.toUpperCase()) {
    case "CLAUDE_CODE":
      return "claude";
    default:
      return "global";
  }
}

/**
 * Format a date string for display
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) {
    return "-";
  }

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 24 hours ago
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours === 0) {
        const minutes = Math.floor(diff / (60 * 1000));
        if (minutes === 0) {
          return "just now";
        }
        return `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }

    // Less than 7 days ago
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}d ago`;
    }

    // Format as date
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}
