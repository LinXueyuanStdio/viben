/**
 * SpanDetailPanel Component
 *
 * Shows detailed information about a selected span including
 * HTTP info, timing, attributes, and events
 */
import { useState } from "react";
import {
  X,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Tag,
  Zap,
  Info,
  FileJson,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import type { TraceSpanNode } from "./types";
import { SPAN_KIND_NAMES } from "./types";
import { getSpanKindIcon } from "./utils";

export interface SpanDetailPanelProps {
  span: TraceSpanNode;
  formatDuration: (ms: number) => string;
  formatDateTime: (timestamp: number) => string;
  onClose: () => void;
  onCopyId: (id: string, type: "trace" | "span") => void;
  copiedId: string | null;
}

export function SpanDetailPanel({
  span,
  formatDuration,
  formatDateTime,
  onClose,
  onCopyId,
  copiedId,
}: SpanDetailPanelProps) {
  const { t } = useTranslation();
  const [activeDetailTab, setActiveDetailTab] = useState<"info" | "attributes" | "events">(
    "info"
  );

  // Extract HTTP info
  const httpMethod = span.attributes["http.method"] as string | undefined;
  const httpStatusCode = span.attributes["http.status_code"] as number | undefined;
  const httpRoute = span.attributes["http.route"] as string | undefined;
  const httpUrl = span.attributes["http.url"] as string | undefined;
  const httpTarget = span.attributes["http.target"] as string | undefined;

  return (
    <div className="w-80 flex flex-col rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-muted/30">
        <h3 className="font-semibold text-sm truncate flex-1">{t("observability.spanDetails")}</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Span name */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          {span.status.code === 1 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : span.status.code === 2 ? (
            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          ) : (
            <div className="h-4 w-4 rounded-full bg-yellow-500 flex-shrink-0" />
          )}
          <span className="font-medium text-sm truncate">{span.displayName}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-mono">{span.name}</p>

        {/* Span ID with copy */}
        <div className="flex items-center gap-1 mt-2">
          <span className="text-xs text-muted-foreground">{t("common.id")}:</span>
          <code className="text-xs font-mono truncate flex-1">{span.spanId}</code>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => onCopyId(span.spanId, "span")}
                >
                  {copiedId === span.spanId ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("observability.copySpanId")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeDetailTab}
        onValueChange={(v) => setActiveDetailTab(v as "info" | "attributes" | "events")}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="mx-2 mt-2">
          <TabsTrigger value="info" className="text-xs">
            <Info className="h-3 w-3 mr-1" />
            {t("observability.info")}
          </TabsTrigger>
          <TabsTrigger value="attributes" className="text-xs">
            <Tag className="h-3 w-3 mr-1" />
            {t("observability.attributes")}
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            {t("observability.events")}
            {span.events.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {span.events.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="info" className="mt-0 p-3 space-y-3">
            {/* Status */}
            {span.status.code === 2 && span.status.message && (
              <div className="p-2 rounded bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {t("observability.error")}
                </div>
                <p className="text-xs mt-1 text-red-400">{span.status.message}</p>
              </div>
            )}

            {/* HTTP Info */}
            {(httpMethod || httpStatusCode || httpRoute || httpUrl) && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("observability.httpSection", "HTTP")}
                </div>
                {httpMethod && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("observability.method")}</span>
                    <Badge
                      variant="outline"
                      className={`${
                        httpMethod === "GET"
                          ? "border-blue-500/50 text-blue-500"
                          : httpMethod === "POST"
                          ? "border-green-500/50 text-green-500"
                          : httpMethod === "PUT"
                          ? "border-yellow-500/50 text-yellow-500"
                          : httpMethod === "DELETE"
                          ? "border-red-500/50 text-red-500"
                          : ""
                      }`}
                    >
                      {httpMethod}
                    </Badge>
                  </div>
                )}
                {httpStatusCode && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("observability.statusCode")}</span>
                    <Badge
                      variant="outline"
                      className={`${
                        httpStatusCode >= 200 && httpStatusCode < 300
                          ? "border-green-500/50 text-green-500"
                          : httpStatusCode >= 400 && httpStatusCode < 500
                          ? "border-yellow-500/50 text-yellow-500"
                          : httpStatusCode >= 500
                          ? "border-red-500/50 text-red-500"
                          : ""
                      }`}
                    >
                      {httpStatusCode}
                    </Badge>
                  </div>
                )}
                {(httpRoute || httpTarget) && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t("observability.route")}</span>
                    <p className="font-mono text-xs mt-0.5 break-all">
                      {httpRoute || httpTarget}
                    </p>
                  </div>
                )}
                {httpUrl && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t("observability.url")}</span>
                    <p className="font-mono text-xs mt-0.5 break-all">{httpUrl}</p>
                  </div>
                )}
              </div>
            )}

            {/* Timing */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("observability.timing")}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">{t("observability.start")}</span>
                  <p className="font-mono text-xs">{formatDateTime(span.startTime)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t("observability.end")}</span>
                  <p className="font-mono text-xs">{formatDateTime(span.endTime)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("observability.duration")}</span>
                <span className="font-mono font-medium">{formatDuration(span.duration)}</span>
              </div>
            </div>

            {/* Span Kind */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("observability.spanKind")}
              </div>
              <div className="flex items-center gap-2">
                {getSpanKindIcon(span.kind)}
                <span className="text-sm">{SPAN_KIND_NAMES[span.kind] || t("observability.unknownSpanKind", { kind: span.kind, defaultValue: "UNKNOWN ({{kind}})" })}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="attributes" className="mt-0 p-3">
            {Object.keys(span.attributes).length === 0 ? (
              <div className="text-center text-muted-foreground py-4 text-sm">
                <FileJson className="h-6 w-6 mx-auto mb-2 opacity-50" />
                {t("observability.noAttributes")}
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(span.attributes).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground text-xs font-mono">{key}</span>
                    <p className="font-mono text-xs mt-0.5 break-all bg-muted/50 p-1.5 rounded">
                      {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-0 p-3">
            {span.events.length === 0 ? (
              <div className="text-center text-muted-foreground py-4 text-sm">
                <Zap className="h-6 w-6 mx-auto mb-2 opacity-50" />
                {t("observability.noEvents")}
              </div>
            ) : (
              <div className="space-y-3">
                {span.events.map((event, index) => {
                  // Parse SSE payload for better display
                  const ssePayload = event.attributes?.["sse.payload"];
                  let parsedPayload: Record<string, unknown> | null = null;
                  if (typeof ssePayload === "string") {
                    try {
                      parsedPayload = JSON.parse(ssePayload);
                    } catch {
                      // Keep as string
                    }
                  }

                  return (
                    <div key={index} className="p-2 rounded border bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{event.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.time).toLocaleTimeString()}
                        </span>
                      </div>
                      {parsedPayload ? (
                        // Display parsed SSE payload in a readable format
                        <div className="mt-2 space-y-1">
                          {Object.entries(parsedPayload).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="text-muted-foreground font-mono">{key}:</span>
                              <span className="ml-1 font-mono break-all">
                                {typeof value === "object"
                                  ? JSON.stringify(value, null, 2)
                                  : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : event.attributes && Object.keys(event.attributes).length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {Object.entries(event.attributes).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="text-muted-foreground font-mono">{key}:</span>
                              <span className="ml-1 font-mono break-all">
                                {typeof value === "object"
                                  ? JSON.stringify(value)
                                  : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
