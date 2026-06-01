import { useState } from "react";
import {
  Check,
  X,
  Settings2,
  Server,
  Key,
  ChevronDown,
} from "lucide-react";
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
  assignment?: { serverId: string; apiKeyId?: string };
  onConfigure: (agentId: string, serverId: string, apiKeyId?: string) => void;
  onRemoveAssignment: () => void;
}

export function AgentCard({
  agent,
  servers,
  assignment,
  onConfigure,
  onRemoveAssignment,
}: AgentCardProps) {
  const { t } = useTranslation();
  const [showConfig, setShowConfig] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState(
    assignment?.serverId || servers[0]?.id || ""
  );
  const [selectedKeyId, setSelectedKeyId] = useState(
    assignment?.apiKeyId || ""
  );

  const selectedServer = servers.find((s) => s.id === selectedServerId);
  const assignedServer = servers.find((s) => s.id === assignment?.serverId);
  const assignedApiKey = assignedServer?.apiKeys.find(
    (k) => k.id === assignment?.apiKeyId
  );

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

  const handleApply = () => {
    if (selectedServerId) {
      onConfigure(
        agent.id,
        selectedServerId,
        selectedKeyId || undefined
      );
      setShowConfig(false);
    }
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

      {/* Current Assignment */}
      {assignment && assignedServer && (
        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{assignedServer.name}</span>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {assignedServer.transport.toUpperCase()}
              </span>
            </div>
            {assignedApiKey && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Key className="h-3 w-3" />
                <span>{assignedApiKey.name}</span>
                <code className="bg-muted px-1 rounded text-[10px]">
                  {assignedApiKey.keyPrefix}
                </code>
              </div>
            )}
          </div>
        </div>
      )}

      {agent.config_path && (
        <p
          className="text-xs text-muted-foreground mb-4 font-mono truncate"
          title={agent.config_path}
        >
          {agent.config_path}
        </p>
      )}

      <div className="flex gap-2">
        {agent.installed ? (
          servers.length > 0 ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfig(!showConfig)}
              >
                <Settings2 className="h-4 w-4 mr-1" />
                {assignment ? t("agents.changeServer") : t("common.configure")}
                <ChevronDown
                  className={`h-3 w-3 ml-1 transition-transform ${
                    showConfig ? "rotate-180" : ""
                  }`}
                />
              </Button>
              {assignment && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemoveAssignment}
                  className="text-destructive hover:text-destructive"
                >
                  {t("common.remove")}
                </Button>
              )}
            </>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              {t("agents.noServersAvailable")}
            </Button>
          )
        ) : (
          <Button variant="secondary" size="sm" disabled>
            {t("agents.notAvailable")}
          </Button>
        )}
      </div>

      {/* Server Selection Panel */}
      {showConfig && agent.installed && servers.length > 0 && (
        <div className="mt-4 pt-4 border-t space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("agents.selectMcpServer")}
            </label>
            <select
              value={selectedServerId}
              onChange={(e) => {
                setSelectedServerId(e.target.value);
                setSelectedKeyId(""); // Reset key when server changes
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name} ({server.transport.toUpperCase()})
                  {server.status === "running" ? ` - ${t("agents.serverRunning")}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Selection - Required */}
          {selectedServer && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("agents.apiKeyRequired")}
              </label>
              {selectedServer.apiKeys.length > 0 ? (
                <select
                  value={selectedKeyId}
                  onChange={(e) => setSelectedKeyId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">{t("agents.selectApiKey")}</option>
                  {selectedServer.apiKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name} ({key.keyPrefix})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 p-2 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-900">
                  {t("agents.noApiKeysWarning")}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!selectedKeyId || !selectedServer?.apiKeys?.length}
            >
              {t("agents.applyConfiguration")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>

          {!selectedKeyId && (selectedServer?.apiKeys?.length ?? 0) > 0 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              {t("agents.selectKeyToApply")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
