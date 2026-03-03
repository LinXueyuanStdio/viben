/**
 * Logging Level Control Component
 *
 * Provides UI control for setting the MCP server's logging level.
 * Uses the MCP SDK's logging/setLevel method.
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * MCP Logging levels per RFC 5424 syslog severity levels
 * @see https://spec.modelcontextprotocol.io/specification/2024-11-05/server/utilities/logging/
 */
export type LoggingLevel =
  | "debug"
  | "info"
  | "notice"
  | "warning"
  | "error"
  | "critical"
  | "alert"
  | "emergency";

const LOGGING_LEVELS: LoggingLevel[] = [
  "debug",
  "info",
  "notice",
  "warning",
  "error",
  "critical",
  "alert",
  "emergency",
];

interface LoggingLevelControlProps {
  /** Whether logging is supported by the server */
  enabled: boolean;
  /** Current connection status */
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  /** Function to make MCP requests */
  makeRequest: <T = unknown>(
    method: string,
    params?: Record<string, unknown>
  ) => Promise<T>;
}

export function LoggingLevelControl({
  enabled,
  connectionStatus,
  makeRequest,
}: LoggingLevelControlProps) {
  const { t } = useTranslation();
  const [currentLevel, setCurrentLevel] = useState<LoggingLevel | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLevelChange = useCallback(
    async (level: LoggingLevel) => {
      if (!enabled || connectionStatus !== "connected") return;

      setIsChanging(true);
      setError(null);

      try {
        await makeRequest("logging/setLevel", { level });
        setCurrentLevel(level);
      } catch (err) {
        console.error("Failed to set logging level:", err);
        setError(err instanceof Error ? err.message : "Failed to set logging level");
      } finally {
        setIsChanging(false);
      }
    },
    [enabled, connectionStatus, makeRequest]
  );

  // Don't render if logging is not supported or not connected
  if (!enabled || connectionStatus !== "connected") {
    return null;
  }

  return (
    <div className="p-3 rounded-lg border border-border bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {t("inspector.loggingLevel", "Logging Level")}
          </span>
        </div>
        {isChanging && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <Select
        value={currentLevel || undefined}
        onValueChange={(value) => handleLevelChange(value as LoggingLevel)}
        disabled={isChanging}
      >
        <SelectTrigger className="w-full h-8 text-xs">
          <SelectValue placeholder={t("inspector.selectLoggingLevel", "Select level...")} />
        </SelectTrigger>
        <SelectContent>
          {LOGGING_LEVELS.map((level) => (
            <SelectItem key={level} value={level} className="text-xs">
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && (
        <div className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        {t(
          "inspector.loggingLevelDesc",
          "Set the minimum logging level for server notifications."
        )}
      </p>
    </div>
  );
}
