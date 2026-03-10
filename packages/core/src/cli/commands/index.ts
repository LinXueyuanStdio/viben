/**
 * CLI commands registration
 */
import type { Command } from "commander";

import { registerInitCommand } from "./init";
import { registerConfigCommand } from "./config";
import { registerWorkspaceCommand } from "./workspace";
import { registerExecutorCommand } from "./executor";
import { registerAgentCommand } from "./agent";
import { registerProviderCommand } from "./provider";
import { registerModelCommand } from "./model";
import { registerChannelCommand } from "./channel";
import { registerServiceCommand } from "./service";
import { registerGatewayCommand } from "./gateway";
import { registerCronCommand } from "./cron";
import { registerMcpCommand } from "./mcp";
import { registerSkillCommand } from "./skill";
import { registerTelemetryCommand } from "./telemetry";
import { registerTeamCommand } from "./team";
import { registerQueueCommand } from "./queue";
import { registerSwarmCommand } from "./swarm";
import { registerTaskCommand } from "./task";
import { registerContextCommand } from "./context";
import { registerUserCommand } from "./user";
import { registerSessionCommand } from "./session";
import { registerIdeaCommand } from "./idea";

/**
 * Register all commands on the program
 */
export function registerCommands(program: Command): void {
  registerInitCommand(program);
  registerConfigCommand(program);
  registerWorkspaceCommand(program);
  registerExecutorCommand(program);
  registerAgentCommand(program);
  registerProviderCommand(program);
  registerModelCommand(program);
  registerChannelCommand(program);
  registerServiceCommand(program);
  registerGatewayCommand(program);
  registerCronCommand(program);
  registerMcpCommand(program);
  registerSkillCommand(program);
  registerTelemetryCommand(program);
  registerTeamCommand(program);
  registerQueueCommand(program);
  registerSwarmCommand(program);
  registerTaskCommand(program);
  registerContextCommand(program);
  registerUserCommand(program);
  registerSessionCommand(program);
  registerIdeaCommand(program);
}
