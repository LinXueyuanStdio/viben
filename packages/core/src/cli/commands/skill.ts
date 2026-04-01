/**
 * CLI skill command - Manage skills
 *
 * Uses skill/ops functions for all operations.
 */
import chalk from "chalk";
import { join } from "node:path";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  outputSuccess,
  handleCommandError,
  getOutputContext,
  formatDate,
  truncate,
} from "../lib";
import {
  listSkills,
  listAvailableSkills,
  getSkill,
  installSkill,
  uninstallSkill,
  enableSkill,
  disableSkill,
  getEnabledSkills,
  getSkillDir,
  searchSkillRegistry,
  getSkillFromRegistry,
  downloadSkillFromRegistry,
} from "../../skill/ops";
import type { SkillTarget } from "../../skill/ops/types";

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
    .option("-g, --global", "List only global skills")
    .option("-c, --claude", "List only Claude skills")
    .option("-a, --all", "List skills from all targets")
    .action(
      async (options: {
        available?: boolean;
        agent?: string;
        global?: boolean;
        claude?: boolean;
        all?: boolean;
      }) => {
        const ctx = getOutputContext(program);
        try {
          if (options.available) {
            // List available skills from marketplace
            const result = await listAvailableSkills();

            if (!result.success) {
              throw new Error(result.error);
            }

            output(
              ctx,
              successResponse({ skills: result.skills, count: result.total }),
              () => {
                if (result.skills.length === 0) {
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
                  result.skills.map((s) => [s.name, s.version, s.description || "-"])
                );
              }
            );
          } else {
            // List installed skills from specified or all targets
            let target: SkillTarget | undefined;
            const listAll = options.all || (!options.agent && !options.global && !options.claude);

            if (options.agent) {
              target = "agent";
            } else if (options.global) {
              target = "global";
            } else if (options.claude) {
              target = "claude";
            }

            const result = await listSkills(
              target ? { target, agentId: options.agent } : (listAll ? undefined : undefined)
            );

            if (!result.success) {
              throw new Error(result.error);
            }

            output(
              ctx,
              successResponse({ skills: result.skills, count: result.count }),
              () => {
                if (result.skills.length === 0) {
                  if (options.agent) {
                    console.log(
                      chalk.gray(`No skills installed for agent "${options.agent}".`)
                    );
                    console.log();
                    console.log("Install a skill with:");
                    console.log(
                      chalk.cyan(`  viben skill install <name> --agent ${options.agent}`)
                    );
                  } else {
                    console.log(chalk.gray("No skills installed."));
                    console.log();
                    console.log("Install a skill with:");
                    console.log(chalk.cyan("  viben skill install <name>"));
                    console.log();
                    console.log("View available skills with:");
                    console.log(chalk.cyan("  viben skill list --available"));
                  }
                  return;
                }

                let title: string;
                if (options.agent) {
                  title = `Skills for Agent: ${options.agent}`;
                } else if (options.global) {
                  title = "Global Skills:";
                } else if (options.claude) {
                  title = "Claude Skills:";
                } else {
                  title = "Installed Skills:";
                }
                console.log(chalk.bold(title));
                console.log();
                outputTable(
                  ctx,
                  ["Name", "Version", "Target", "Path", "Installed At"],
                  result.skills.map((s) => [
                    s.name,
                    s.version,
                    s.target || "-",
                    s.path,
                    formatDate(s.installed_at),
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

  // skill view <name> - show skill details (replaces 'show' and 'path')
  skill
    .command("view <name>")
    .description("Show skill details")
    .option("--agent <id>", "Agent ID (for agent-specific skills)")
    .option("-g, --global", "View global skill")
    .option("-c, --claude", "View Claude skill")
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
          // Determine target
          let target: SkillTarget | undefined;
          if (options.agent) {
            target = "agent";
          } else if (options.claude) {
            target = "claude";
          } else if (options.global) {
            target = "global";
          }

          const result = await getSkill(
            name,
            target ? { target, agentId: options.agent } : undefined
          );

          if (!result.success || !result.skill) {
            throw new Error(result.error || `Skill "${name}" not found`);
          }

          output(ctx, successResponse({ skill: result.skill }), () => {
            console.log(chalk.bold(`Skill: ${result.skill!.name}`));
            console.log();
            outputKeyValue(ctx, {
              ID: result.skill!.id,
              Name: result.skill!.name,
              Version: result.skill!.version,
              Description: result.skill!.description || "-",
              Path: result.skill!.path,
              Source: result.skill!.source,
            });
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // skill install <nameWithVersion> - install a skill
  // Supports: skill install <name>, skill install <name>@<version>, skill install <name>@latest
  skill
    .command("install <nameWithVersion>")
    .description("Install a skill (supports name@version syntax)")
    .option("--agent <id>", "Install to a specific agent")
    .option("-g, --global", "Install globally (default)")
    .option("-c, --claude", "Install to Claude skills directory")
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

          const result = await installSkill({
            name,
            target,
            agentId: options.agent,
            customPath: options.path,
            sourcePath: options.source,
            version: finalVersion,
            executor: options.executor,
            force: options.force,
          });

          if (!result.success) {
            throw new Error(result.error || result.message);
          }

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
    .option("-g, --global", "Uninstall from global (default)")
    .option("-c, --claude", "Uninstall from Claude skills directory")
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

          const result = await uninstallSkill({
            name,
            target,
            agentId: options.agent,
            customPath: options.path,
          });

          if (!result.success) {
            throw new Error(result.error || result.message);
          }

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
        const result = await enableSkill(name, options.agent);

        if (!result.success) {
          throw new Error(result.error);
        }

        output(ctx, successResponse({ config: result }), () => {
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
        const result = await disableSkill(name, options.agent);

        if (!result.success) {
          throw new Error(result.error);
        }

        output(ctx, successResponse({ config: result }), () => {
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
        const enabled = await getEnabledSkills(options.agent);

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

  // Backward compatibility aliases
  skill.command("show <name>", { hidden: true }).action(async (name: string) => {
    // Redirect to view command
    const result = await getSkill(name);
    if (result.success && result.skill) {
      console.log(chalk.bold(`Skill: ${result.skill.name}`));
      console.log();
      console.log(`Path: ${result.skill.path}`);
    } else {
      console.error(result.error || `Skill "${name}" not found`);
    }
  });

  skill.command("path <name>", { hidden: true }).action(async (name: string) => {
    // Redirect to view - just print the path
    const path = getSkillDir("global", name);
    console.log(path);
  });

  // =============================================================================
  // Marketplace Commands
  // =============================================================================

  // skill search <query> - search marketplace
  skill
    .command("search <query>")
    .description("Search skill packages in marketplace")
    .option("-l, --limit <n>", "Maximum results", "10")
    .option("-t, --type <type>", "Filter by type (command, prompt, agent)")
    .action(
      async (
        query: string,
        options: { limit: string; type?: "command" | "prompt" | "agent" }
      ) => {
        const ctx = getOutputContext(program);
        try {
          const result = await searchSkillRegistry({
            query,
            limit: parseInt(options.limit, 10),
            type: options.type,
          });

          if (!result.success) {
            throw new Error(result.error);
          }

          output(
            ctx,
            successResponse({ skills: result.skills, total: result.total }),
            () => {
              if (result.skills.length === 0) {
                console.log(chalk.gray(`No skills found for "${query}".`));
                return;
              }

              console.log(chalk.bold(`Search Results for "${query}":`));
              console.log();
              outputTable(
                ctx,
                ["Name", "Type", "Version", "Downloads", "Description"],
                result.skills.map((s) => [
                  s.name,
                  s.skill_type,
                  s.version,
                  String(s.downloads_count),
                  truncate(s.description || "-", 35),
                ])
              );
            }
          );
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // skill download <name> [version] - download without installing
  skill
    .command("download <name> [version]")
    .description("Download a skill package to current directory")
    .action(async (name: string, version?: string) => {
      const ctx = getOutputContext(program);
      try {
        const pkgInfo = await getSkillFromRegistry(name);
        if (!pkgInfo.success || !pkgInfo.skill) {
          throw new Error(`Skill '${name}' not found`);
        }

        const targetDir = join(process.cwd(), pkgInfo.skill.slug);

        if (!ctx.quiet) {
          console.log(`Downloading ${name}@${version || pkgInfo.skill.version}...`);
        }

        const result = await downloadSkillFromRegistry(
          pkgInfo.skill.id,
          version,
          targetDir
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        output(ctx, successResponse({ path: targetDir }), () => {
          outputSuccess(ctx, `Downloaded to ${targetDir}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
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

  // Handle "latest" as undefined (let ops resolve it)
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
