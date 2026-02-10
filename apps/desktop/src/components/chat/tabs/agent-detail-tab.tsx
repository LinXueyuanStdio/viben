/**
 * Agent detail tab content for the right sidebar
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bot, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AgentDetailTabContentProps } from "./types";

/**
 * Agent detail tab content
 */
export function AgentDetailTabContent({
  agent,
  onSettings,
}: AgentDetailTabContentProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Agent Info Header */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-400 shadow-md">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="font-semibold">{agent.name}</h3>
          {agent.type && (
            <p className="text-xs text-muted-foreground">{agent.type}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Agent Details */}
      <div className="space-y-3">
        {agent.model && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("agent.model", "Model")}</span>
            <span className="font-medium">{agent.model}</span>
          </div>
        )}
        {agent.description && (
          <div>
            <span className="text-xs text-muted-foreground">{t("agent.description", "Description")}</span>
            <p className="text-sm mt-1">{agent.description}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {onSettings && (
        <>
          <Separator />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onSettings(agent.id)}
          >
            <Settings className="h-4 w-4 mr-2" />
            {t("agent.settings", "Agent Settings")}
          </Button>
        </>
      )}
    </div>
  );
}
