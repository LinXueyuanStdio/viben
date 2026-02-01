import { Check, X, RefreshCw, Settings2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/use-agents";
import { usePython } from "@/hooks/use-python";
import type { AgentInfo } from "@/types";

export function AgentsPage() {
  const { agents, loading, error, detectAgents, configureBrowseMcp } = useAgents();
  const { selectedPython } = usePython();

  const handleConfigure = async (agentId: string) => {
    try {
      await configureBrowseMcp(agentId, selectedPython?.path);
    } catch (err) {
      console.error("Failed to configure:", err);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Agents</h1>
          <p className="text-sm text-muted-foreground">
            Configure MCP server for your AI assistants
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={detectAgents} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {loading && agents.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onConfigure={() => handleConfigure(agent.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AgentCardProps {
  agent: AgentInfo;
  onConfigure: () => void;
}

function AgentCard({ agent, onConfigure }: AgentCardProps) {
  const iconMap: Record<string, string> = {
    "claude": "C",
    "claude-code": "CC",
    "cursor": "Cu",
    "windsurf": "W",
    "vscode": "VS",
    "continue": "Co",
    "codex": "Cx",
    "opencode": "OC",
    "zed": "Z",
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
            {iconMap[agent.id] || agent.name[0]}
          </div>
          <div>
            <h3 className="font-semibold">{agent.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                label={agent.installed ? "Installed" : "Not Found"}
                active={agent.installed}
              />
              {agent.installed && (
                <StatusBadge
                  label={agent.configured ? "Configured" : "Not Configured"}
                  active={agent.configured}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {agent.config_path && (
        <p className="text-xs text-muted-foreground mb-4 font-mono truncate" title={agent.config_path}>
          {agent.config_path}
        </p>
      )}

      <div className="flex gap-2">
        {agent.installed ? (
          <>
            <Button size="sm" onClick={onConfigure}>
              {agent.configured ? "Update Config" : "Configure"}
            </Button>
            {agent.configured && (
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-1" />
                View
              </Button>
            )}
          </>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Not Available
          </Button>
        )}
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  label: string;
  active: boolean;
}

function StatusBadge({ label, active }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
        active
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {active ? (
        <Check className="h-3 w-3" />
      ) : (
        <X className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}
