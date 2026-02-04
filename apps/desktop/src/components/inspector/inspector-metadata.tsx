import { useState, useEffect } from "react";
import {
  Settings2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Server,
  Cpu,
  Globe,
  Tag,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { McpServerCapabilities } from "@/types";

interface InspectorMetadataProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  serverCapabilities: McpServerCapabilities | null;
  serverInfo?: {
    name?: string;
    version?: string;
    protocolVersion?: string;
  };
  enabled?: boolean;
}

interface ServerMetadata {
  name?: string;
  version?: string;
  protocolVersion?: string;
  vendor?: string;
  homepage?: string;
  documentation?: string;
  capabilities: McpServerCapabilities | null;
  extensions?: Record<string, unknown>;
}

export function InspectorMetadata({
  makeRequest,
  serverCapabilities,
  serverInfo,
  enabled = true,
}: InspectorMetadataProps) {
  const { t } = useTranslation();
  const [metadata, setMetadata] = useState<ServerMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["capabilities"]));

  useEffect(() => {
    if (serverCapabilities || serverInfo) {
      setMetadata({
        name: serverInfo?.name,
        version: serverInfo?.version,
        protocolVersion: serverInfo?.protocolVersion,
        capabilities: serverCapabilities,
      });
    }
  }, [serverCapabilities, serverInfo]);

  const fetchMetadata = async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      // Try to get extended server info
      const response = await makeRequest<ServerMetadata>("server/info", {});
      setMetadata((prev) => ({
        ...prev,
        ...response,
        capabilities: prev?.capabilities || serverCapabilities,
      }));
    } catch {
      // Server info not supported, use what we have
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (key: string, value: unknown) => {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const renderCapabilityBadge = (name: string, enabled: boolean | undefined) => {
    return (
      <Badge
        key={name}
        variant={enabled ? "default" : "outline"}
        className={`text-xs ${enabled ? "bg-green-500/10 text-green-600 border-green-500/30" : "opacity-50"}`}
      >
        {name}
      </Badge>
    );
  };

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <h4 className="text-sm font-medium">{t("inspector.metadataNotAvailable")}</h4>
        <p className="text-xs text-muted-foreground mt-1">{t("inspector.metadataNotAvailableDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-slate-500" />
          <span className="text-sm font-medium">{t("inspector.metadata")}</span>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMetadata} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* Server Info Card */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Server className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-medium">{metadata?.name || t("inspector.unknownServer")}</h3>
            <p className="text-xs text-muted-foreground">
              {metadata?.version ? `v${metadata.version}` : t("inspector.versionUnknown")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Protocol</div>
              <div className="text-sm font-mono">{metadata?.protocolVersion || "unknown"}</div>
            </div>
          </div>
          {metadata?.vendor && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Vendor</div>
                <div className="text-sm">{metadata.vendor}</div>
              </div>
            </div>
          )}
          {metadata?.homepage && (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Homepage</div>
                <a
                  href={metadata.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline"
                >
                  {metadata.homepage}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Capabilities Section */}
      <div className="rounded-lg border overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
          onClick={() => toggleSection("capabilities")}
        >
          <div className="flex items-center gap-2">
            {expandedSections.has("capabilities") ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">{t("inspector.serverCapabilities")}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard("capabilities", metadata?.capabilities);
            }}
          >
            {copied === "capabilities" ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </button>

        {expandedSections.has("capabilities") && (
          <div className="p-4 pt-0 border-t">
            <div className="flex flex-wrap gap-2 mb-4">
              {renderCapabilityBadge("tools", !!metadata?.capabilities?.tools)}
              {renderCapabilityBadge("resources", !!metadata?.capabilities?.resources)}
              {renderCapabilityBadge("prompts", !!metadata?.capabilities?.prompts)}
              {renderCapabilityBadge("roots", !!metadata?.capabilities?.roots)}
              {renderCapabilityBadge("sampling", !!metadata?.capabilities?.sampling)}
            </div>

            <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto max-h-64">
              {JSON.stringify(metadata?.capabilities, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Raw Metadata Section */}
      <div className="rounded-lg border overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
          onClick={() => toggleSection("raw")}
        >
          <div className="flex items-center gap-2">
            {expandedSections.has("raw") ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">{t("inspector.rawMetadata")}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard("raw", metadata);
            }}
          >
            {copied === "raw" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </button>

        {expandedSections.has("raw") && (
          <div className="p-4 pt-0 border-t">
            <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto max-h-96">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-start gap-3">
          <Settings2 className="h-5 w-5 text-slate-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
              {t("inspector.aboutMetadata")}
            </h4>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              {t("inspector.aboutMetadataDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
