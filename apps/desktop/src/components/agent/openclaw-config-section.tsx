/**
 * OpenClaw Configuration Section
 *
 * Provides gateway connection settings (host, port, auth)
 * and a "Test Connection" button that performs a real device-auth handshake
 * via the local viben gateway (proxied).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, XCircle, Wifi, Clock, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getGatewayUrl } from "@/lib/gateway/config";
import { testOpenClawConnection } from "@/lib/gateway/modules/agent-execution";
import type { TestConnectionResult } from "@/lib/gateway/modules/agent-execution";

type ConnectionStatus = "idle" | "connecting" | "connected" | "pairing_required" | "failed";

const PAIRING_POLL_INTERVAL = 5000; // 5 seconds
const PAIRING_TIMEOUT = 300_000; // 5 minutes

export interface OpenClawConfigSectionProps {
  config?: Record<string, unknown>;
  onConfigChange?: (config: Record<string, unknown>) => void;
}

export function OpenClawConfigSection({ config, onConfigChange }: OpenClawConfigSectionProps) {
  const { t } = useTranslation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pairingTimeLeft, setPairingTimeLeft] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pairingStartRef = useRef<number>(0);

  const gateway = (config?.gateway ?? {}) as Record<string, unknown>;
  const host = (gateway.host as string) ?? "127.0.0.1";
  const port = (gateway.port as number) ?? 18789;
  const token = (gateway.token as string) ?? "";
  const password = (gateway.password as string) ?? "";

  const updateGateway = (field: string, value: unknown) => {
    const newGateway = { ...gateway, [field]: value };
    onConfigChange?.({ ...config, gateway: newGateway });
  };

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  const doTest = useCallback(async (): Promise<TestConnectionResult> => {
    const baseUrl = getGatewayUrl();
    return testOpenClawConnection(baseUrl, {
      host,
      port,
      token: token || undefined,
      password: password || undefined,
    });
  }, [host, port, token, password]);

  const startPairingPoll = useCallback(() => {
    pairingStartRef.current = Date.now();
    setPairingTimeLeft(Math.ceil(PAIRING_TIMEOUT / 1000));

    // Countdown timer
    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - pairingStartRef.current;
      const remaining = Math.max(0, Math.ceil((PAIRING_TIMEOUT - elapsed) / 1000));
      setPairingTimeLeft(remaining);
      if (remaining <= 0) {
        stopPolling();
        setConnectionStatus("failed");
        setConnectionError(t("settingsAgents.openclawPairingTimeout"));
      }
    }, 1000);

    // Polling for approval
    pollRef.current = setInterval(async () => {
      try {
        const result = await doTest();
        if (result.status === "connected") {
          stopPolling();
          setConnectionStatus("connected");
          setDeviceId(result.device_id || null);
        } else if (result.status === "failed") {
          stopPolling();
          setConnectionStatus("failed");
          setConnectionError(result.message || "Connection failed");
        }
        // If still pairing_required, keep polling
      } catch {
        // Ignore errors during polling, keep retrying
      }
    }, PAIRING_POLL_INTERVAL);
  }, [doTest, stopPolling, t]);

  const handleTestConnection = async () => {
    stopPolling();
    setConnectionStatus("connecting");
    setConnectionError("");
    setDeviceId(null);

    try {
      const result = await doTest();

      switch (result.status) {
        case "connected":
          setConnectionStatus("connected");
          setDeviceId(result.device_id || null);
          break;
        case "pairing_required":
          setConnectionStatus("pairing_required");
          setDeviceId(result.device_id || null);
          startPairingPoll();
          break;
        case "failed":
          setConnectionStatus("failed");
          setConnectionError(result.message || "Connection failed");
          break;
      }
    } catch (err) {
      setConnectionStatus("failed");
      setConnectionError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const handleCancelPairing = () => {
    stopPolling();
    setConnectionStatus("idle");
  };

  const formatTimeLeft = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
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
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={connectionStatus === "connecting" || connectionStatus === "pairing_required"}
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

        {/* Pairing Required State */}
        {connectionStatus === "pairing_required" && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <Clock className="h-4 w-4 animate-pulse" />
              <span className="font-medium">{t("settingsAgents.openclawPairingRequired")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.openclawPairingWaiting")}
            </p>
            {deviceId && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Fingerprint className="h-3.5 w-3.5" />
                <span className="font-mono text-[10px] select-all">{deviceId.slice(0, 16)}...</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatTimeLeft(pairingTimeLeft)}
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleCancelPairing}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {/* Device ID (shown after successful connection) */}
        {connectionStatus === "connected" && deviceId && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Fingerprint className="h-3.5 w-3.5" />
            <span>{t("settingsAgents.openclawDeviceId")}:</span>
            <span className="font-mono text-[10px] select-all">{deviceId.slice(0, 16)}...</span>
          </div>
        )}
      </div>
    </div>
  );
}
