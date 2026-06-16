/**
 * CLI commands registration with lazy loading
 *
 * Commands are loaded on demand based on argv to minimize startup time.
 * Only the command being executed loads its heavy dependencies.
 */
import type { Command } from "commander";

interface CommandMeta {
  name: string;
  description: string;
  loader: () => Promise<{ register: (program: Command) => void }>;
}

const COMMANDS: CommandMeta[] = [
  { name: "init", description: "Initialize a Viben workspace", loader: () => import("./init").then(m => ({ register: m.registerInitCommand })) },
  { name: "config", description: "Manage configuration", loader: () => import("./config").then(m => ({ register: m.registerConfigCommand })) },
  { name: "workspace", description: "Manage workspaces", loader: () => import("./workspace").then(m => ({ register: m.registerWorkspaceCommand })) },
  { name: "executor", description: "Manage executors", loader: () => import("./executor").then(m => ({ register: m.registerExecutorCommand })) },
  { name: "agent", description: "Manage AI agents", loader: () => import("./agent").then(m => ({ register: m.registerAgentCommand })) },
  { name: "provider", description: "Manage AI providers", loader: () => import("./provider").then(m => ({ register: m.registerProviderCommand })) },
  { name: "model", description: "Manage AI models", loader: () => import("./model").then(m => ({ register: m.registerModelCommand })) },
  { name: "channel", description: "Manage channels", loader: () => import("./channel").then(m => ({ register: m.registerChannelCommand })) },
  { name: "service", description: "Manage services", loader: () => import("./service").then(m => ({ register: m.registerServiceCommand })) },
  { name: "gateway", description: "Gateway management", loader: () => import("./gateway").then(m => ({ register: m.registerGatewayCommand })) },
  { name: "cron", description: "Manage cron jobs", loader: () => import("./cron").then(m => ({ register: m.registerCronCommand })) },
  { name: "mcp", description: "Manage MCP servers", loader: () => import("./mcp").then(m => ({ register: m.registerMcpCommand })) },
  { name: "skill", description: "Manage skills", loader: () => import("./skill").then(m => ({ register: m.registerSkillCommand })) },
  { name: "telemetry", description: "Manage telemetry", loader: () => import("./telemetry").then(m => ({ register: m.registerTelemetryCommand })) },
  { name: "update", description: "Update Viben", loader: () => import("./update").then(m => ({ register: m.registerUpdateCommand })) },
  { name: "queue", description: "Manage task queues", loader: () => import("./queue").then(m => ({ register: m.registerQueueCommand })) },
  { name: "swarm", description: "Manage agent swarms", loader: () => import("./swarm").then(m => ({ register: m.registerSwarmCommand })) },
  { name: "task", description: "Manage tasks", loader: () => import("./task").then(m => ({ register: m.registerTaskCommand })) },
  { name: "context", description: "Manage context", loader: () => import("./context").then(m => ({ register: m.registerContextCommand })) },
  { name: "user", description: "Manage user settings", loader: () => import("./user").then(m => ({ register: m.registerUserCommand })) },
  { name: "session", description: "Manage sessions", loader: () => import("./session").then(m => ({ register: m.registerSessionCommand })) },
  { name: "idea", description: "Manage ideas", loader: () => import("./idea").then(m => ({ register: m.registerIdeaCommand })) },
  { name: "reward", description: "Manage rewards", loader: () => import("./reward").then(m => ({ register: m.registerRewardCommand })) },
  { name: "evo", description: "Manage evolution", loader: () => import("./evo").then(m => ({ register: m.registerEvoCommand })) },
  { name: "index", description: "Generate context index", loader: () => import("./index-cmd").then(m => ({ register: m.registerIndexCommand })) },
  { name: "login", description: "Login to Viben", loader: () => import("./login").then(m => ({ register: m.registerLoginCommand })) },
  { name: "page", description: "Manage workspace pages", loader: () => import("./page").then(m => ({ register: m.registerPageCommand })) },
  { name: "account", description: "Trading account management", loader: () => import("./account").then(m => ({ register: m.registerAccountCommand })) },
  { name: "app", description: "Launch or install Viben desktop app", loader: () => import("./app").then(m => ({ register: m.registerAppCommand })) },
  { name: "pet", description: "Manage pets", loader: () => import("./pet").then(m => ({ register: m.registerPetCommand })) },
];

function getTargetCommand(): string | null {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith("-")) continue;
    return arg;
  }
  return null;
}

/**
 * Register all commands on the program.
 * Uses lazy loading: only the target command's module is imported.
 */
export async function registerCommands(program: Command): Promise<void> {
  const target = getTargetCommand();
  const commandNames = new Set(COMMANDS.map(c => c.name));

  if (target && commandNames.has(target)) {
    const cmd = COMMANDS.find(c => c.name === target)!;
    const { register } = await cmd.loader();
    register(program);

    for (const other of COMMANDS) {
      if (other.name !== target) {
        program.command(other.name).description(other.description);
      }
    }
  } else {
    for (const cmd of COMMANDS) {
      program.command(cmd.name).description(cmd.description);
    }
  }
}
