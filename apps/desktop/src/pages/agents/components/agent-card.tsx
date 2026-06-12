import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { McpServerInstance } from "@/types";
import { useTranslation } from "react-i18next";
import type { ExecutorDisplayInfo } from "../types";

// ============================================================================
// StatusBadge
// ============================================================================

interface StatusBadgeProps {
  label: string;
  active: boolean;
}

export function StatusBadge({ label, active }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
        active
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}

// ============================================================================
// AgentCard
// ============================================================================

interface AgentCardProps {
  agent: ExecutorDisplayInfo;
  servers: McpServerInstance[];
}

export function AgentCard({ agent }: AgentCardProps) {
  const { t } = useTranslation();

  const iconMap: Record<string, string> = {
    CLAUDE: "C",
    CLAUDE_CODE: "CC",
    CURSOR: "Cu",
    WINDSURF: "W",
    VSCODE: "VS",
    CONTINUE: "Co",
    CODEX: "Cx",
    OPENCODE: "OC",
    ZED: "Z",
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
                label={agent.installed ? t("common.installed") : t("agents.notFound")}
                active={agent.installed}
              />
              {agent.installed && (
                <StatusBadge
                  label={agent.has_mcp_config ? t("common.configured") : t("common.notConfigured")}
                  active={agent.has_mcp_config}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {agent.config_path && (
        <p
          className="text-xs text-muted-foreground mb-4 font-mono truncate"
          title={agent.config_path}
        >
          {agent.config_path}
        </p>
      )}

      <div className="flex gap-2">
        {!agent.installed && (
          <Button variant="secondary" size="sm" disabled>
            {t("agents.notAvailable")}
          </Button>
        )}
      </div>
    </div>
  );
}
