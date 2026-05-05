/**
 * OpenClaw Configuration Section
 *
 * Provides gateway connection settings (host, port, auth)
 * and a "Test Connection" button that checks availability via gateway API.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, XCircle, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getGatewayClient } from "@/lib/gateway";

type ConnectionStatus = "idle" | "connecting" | "connected" | "failed";

export function OpenClawConfigSection() {
  const { t } = useTranslation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState("");

  const handleTestConnection = async () => {
    setConnectionStatus("connecting");
    setConnectionError("");

    try {
      const client = getGatewayClient();
      const result = await client.checkAvailability("OPENCLAW");

      if (result.type === "LOGIN_DETECTED" || result.type === "INSTALLATION_FOUND") {
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("failed");
        setConnectionError("OpenClaw gateway not detected");
      }
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
          defaultValue="127.0.0.1"
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
          defaultValue={18789}
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
          placeholder="Optional"
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
