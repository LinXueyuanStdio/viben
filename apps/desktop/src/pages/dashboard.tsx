import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Database, Bot, Activity, Settings, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/use-agents";
import { useMcp } from "@/hooks/use-mcp";
import { usePython } from "@/hooks/use-python";
import { useAppStore } from "@/stores";

export function DashboardPage() {
  const { agents, loading: agentsLoading } = useAgents();
  const { status: mcpStatus } = useMcp();
  const { selectedPython, browseMcpInfo } = usePython();
  const { providers, totalSearches } = useAppStore();

  const installedAgents = agents.filter((a) => a.installed);
  const configuredAgents = agents.filter((a) => a.configured);
  const enabledProviders = providers.filter((p) => p.enabled);

  // Check if setup is complete
  const isSetupComplete = selectedPython?.is_valid && browseMcpInfo?.installed;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Setup Banner */}
      {!isSetupComplete && (
        <div className="mb-6 p-4 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Setup Required
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {!selectedPython?.is_valid
                  ? "Python 3.10+ is required to run browse-mcp."
                  : "Install the browse-mcp package to get started."}
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/settings">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Searches"
          value={totalSearches.toLocaleString()}
          description="All time"
          icon={Search}
        />
        <StatCard
          title="Active Providers"
          value={`${enabledProviders.length}`}
          description={`Out of ${providers.length} available`}
          icon={Database}
          linkTo="/providers"
        />
        <StatCard
          title="Configured Agents"
          value={agentsLoading ? "..." : `${configuredAgents.length}`}
          description={
            agentsLoading
              ? "Detecting..."
              : `${installedAgents.length} installed`
          }
          icon={Bot}
          linkTo="/agents"
        />
        <StatCard
          title="Server Status"
          value={mcpStatus.running ? "Running" : "Stopped"}
          description={
            mcpStatus.running
              ? `PID ${mcpStatus.pid} · ${mcpStatus.transport}`
              : "Not started"
          }
          icon={Activity}
          valueClassName={mcpStatus.running ? "text-green-600" : "text-muted-foreground"}
          linkTo="/search-service"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <QuickActionCard
          title="Configure AI Agents"
          description="Set up browse-mcp for your AI assistants"
          linkTo="/agents"
          count={`${configuredAgents.length}/${installedAgents.length} configured`}
        />
        <QuickActionCard
          title="Manage Providers"
          description="Enable or disable academic search sources"
          linkTo="/providers"
          count={`${enabledProviders.length} enabled`}
        />
      </div>

      {/* Python Status */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Environment Status</h2>
        <div className="space-y-3">
          <StatusRow
            label="Python"
            value={
              selectedPython
                ? `${selectedPython.version} (${selectedPython.path})`
                : "Not configured"
            }
            ok={selectedPython?.is_valid ?? false}
          />
          <StatusRow
            label="browse-mcp"
            value={
              browseMcpInfo?.installed
                ? `v${browseMcpInfo.version}`
                : "Not installed"
            }
            ok={browseMcpInfo?.installed ?? false}
          />
          <StatusRow
            label="MCP Server"
            value={mcpStatus.running ? `Running (${mcpStatus.transport})` : "Stopped"}
            ok={mcpStatus.running}
          />
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  valueClassName?: string;
  linkTo?: string;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  valueClassName,
  linkTo,
}: StatCardProps) {
  const content = (
    <div className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`text-2xl font-bold ${valueClassName || ""}`}>{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }

  return content;
}

interface QuickActionCardProps {
  title: string;
  description: string;
  linkTo: string;
  count: string;
}

function QuickActionCard({ title, description, linkTo, count }: QuickActionCardProps) {
  return (
    <Link
      to={linkTo}
      className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
    >
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground mt-1">{count}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}

interface StatusRowProps {
  label: string;
  value: string;
  ok: boolean;
}

function StatusRow({ label, value, ok }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={ok ? "text-foreground" : "text-muted-foreground"}>
          {value}
        </span>
        <div
          className={`h-2 w-2 rounded-full ${
            ok ? "bg-green-500" : "bg-muted"
          }`}
        />
      </div>
    </div>
  );
}
