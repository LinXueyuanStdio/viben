/**
 * OpenClaw Configuration Section
 *
 * Provides gateway connection settings (host, port, auth)
 * and a "Test Connection" button that attempts a real WebSocket connection.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, XCircle, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConnectionStatus = "idle" | "connecting" | "connected" | "failed";

export interface OpenClawConfigSectionProps {
  config?: Record<string, unknown>;
  onConfigChange?: (config: Record<string, unknown>) => void;
}

export function OpenClawConfigSection({ config, onConfigChange }: OpenClawConfigSectionProps) {
  const { t } = useTranslation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState("");

  const gateway = (config?.gateway ?? {}) as Record<string, unknown>;
  const host = (gateway.host as string) ?? "127.0.0.1";
  const port = (gateway.port as number) ?? 18789;
  const token = (gateway.token as string) ?? "";
  const password = (gateway.password as string) ?? "";

  const updateGateway = (field: string, value: unknown) => {
    const newGateway = { ...gateway, [field]: value };
    onConfigChange?.({ ...config, gateway: newGateway });
  };

  const handleTestConnection = async () => {
    setConnectionStatus("connecting");
    setConnectionError("");

    try {
      // Build WebSocket URL to the OpenClaw gateway
      const wsUrl = `ws://${host}:${port}`;

      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        setConnectionStatus("failed");
        setConnectionError("Connection timeout (5s)");
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        setConnectionStatus("connected");
        // Close after successful test
        ws.close(1000);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        setConnectionStatus("failed");
        setConnectionError(`Cannot connect to ${host}:${port}`);
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        // Only mark failed if we haven't already set connected
        if (connectionStatus === "connecting") {
          if (event.code !== 1000) {
            setConnectionStatus("failed");
            setConnectionError(`Connection closed: ${event.reason || `code ${event.code}`}`);
          }
        }
      };
    } catch (err) {
      setConnectionStatus("failed");
      setConnectionError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t("settingsAgents.openclawOptions")}
      </div>

      {/* Gateway Host */}
      <div className="space-y-1">
        <Label className="text-sm font-normal">
          {t("settingsAgents.openclawGatewayHost")}
        </Label>
        <Input
          value={host}
          onChange={(e) => updateGateway("host", e.target.value)}
          placeholder="127.0.0.1"
          className="h-8 text-sm"
        />
      </div>

      {/* Gateway Port */}
      <div className="space-y-1">
        <Label className="text-sm font-normal">
          {t("settingsAgents.openclawGatewayPort")}
        </Label>
        <Input
          type="number"
          value={port}
          onChange={(e) => updateGateway("port", parseInt(e.target.value) || 18789)}
          placeholder="18789"
          className="h-8 text-sm"
        />
      </div>

      {/* Auth Token */}
      <div className="space-y-1">
        <Label className="text-sm font-normal">
          {t("settingsAgents.openclawGatewayToken")}
        </Label>
        <Input
          type="password"
          value={token}
          onChange={(e) => updateGateway("token", e.target.value || undefined)}
          placeholder={t("settingsAgents.openclawOptional")}
          className="h-8 text-sm"
        />
      </div>

      {/* Auth Password */}
      <div className="space-y-1">
        <Label className="text-sm font-normal">
          {t("settingsAgents.openclawGatewayPassword")}
        </Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => updateGateway("password", e.target.value || undefined)}
          placeholder={t("settingsAgents.openclawOptional")}
          className="h-8 text-sm"
        />
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={connectionStatus === "connecting"}
        >
          {connectionStatus === "connecting" ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Wifi className="h-3.5 w-3.5 mr-1.5" />
          )}
          {t("settingsAgents.openclawTestConnection")}
        </Button>

        {connectionStatus === "connected" && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("settingsAgents.openclawConnected")}
          </span>
        )}

        {connectionStatus === "failed" && (
          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5" />
            {connectionError || t("settingsAgents.openclawConnectionFailed")}
          </span>
        )}
      </div>
    </div>
  );
}
