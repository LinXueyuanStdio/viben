import {
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExecutors } from "@/hooks/use-workspace-resources";
import { useAppStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { AgentCard } from "./components";
import { mapExecutorToDisplay } from "./utils";

export function AgentsPage() {
  const { t } = useTranslation();
  const { executors, loading, error, refresh } = useExecutors();
  const {
    mcpServers,
    setAgentAssignment,
    removeAgentAssignment,
    getAgentAssignment,
  } = useAppStore();

  // Map executors to display format
  const agents = executors.map(mapExecutorToDisplay);

  // Note: MCP configuration is no longer handled via Gateway API
  // The configureBrowseMcp functionality has been removed
  const handleConfigure = async (
    agentId: string,
    serverId: string,
    apiKeyId?: string
  ) => {
    const server = mcpServers.find((s) => s.id === serverId);
    if (!server) return;

    try {
      // Save the assignment locally (actual MCP config must be done manually)
      setAgentAssignment(agentId, serverId, apiKeyId);
      console.log("[AgentsPage] Note: MCP configuration must be done manually. Assignment saved locally.");
    } catch (err) {
      console.error("Failed to configure:", err);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("agents.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("agents.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {t("common.refresh")}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {mcpServers.length === 0 && (
        <div className="mb-6 p-4 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {t("agents.noServersWarning")}
          </p>
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
              servers={mcpServers}
              assignment={getAgentAssignment(agent.id)}
              onConfigure={handleConfigure}
              onRemoveAssignment={() => removeAgentAssignment(agent.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
