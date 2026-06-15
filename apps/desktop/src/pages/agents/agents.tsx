import {
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExecutors } from "@/hooks/use-workspace-resources";
import { useTranslation } from "react-i18next";
import { AgentCard } from "./components";
import { mapExecutorToDisplay } from "./utils";

export function AgentsPage() {
  const { t } = useTranslation();
  const { executors, loading, error, refresh } = useExecutors();

  // Map executors to display format
  const agents = executors.map(mapExecutorToDisplay);

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
            />
          ))}
        </div>
      )}
    </div>
  );
}
