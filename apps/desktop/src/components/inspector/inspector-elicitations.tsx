import { useState } from "react";
import {
  MessageCircleQuestion,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface InspectorElicitationsProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  enabled?: boolean;
}

interface ElicitationRequest {
  id: string;
  message: string;
  requestedSchema?: Record<string, unknown>;
  timestamp: Date;
  status: "pending" | "responded" | "cancelled";
  response?: unknown;
}

export function InspectorElicitations({ makeRequest, enabled = true }: InspectorElicitationsProps) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<ElicitationRequest[]>([]);
  const [pendingResponse, setPendingResponse] = useState<string>("");
  const [selectedRequest, setSelectedRequest] = useState<ElicitationRequest | null>(null);
  const [responding, setResponding] = useState(false);
  const [copied, setCopied] = useState(false);

  const respondToElicitation = async () => {
    if (!selectedRequest || !pendingResponse.trim()) return;

    setResponding(true);
    try {
      // Try to parse as JSON first, otherwise use as string
      let responseValue: unknown;
      try {
        responseValue = JSON.parse(pendingResponse);
      } catch {
        responseValue = pendingResponse;
      }

      await makeRequest("elicitation/respond", {
        id: selectedRequest.id,
        response: responseValue,
      });

      setRequests((prev) =>
        prev.map((req) =>
          req.id === selectedRequest.id
            ? { ...req, status: "responded" as const, response: responseValue }
            : req
        )
      );
      setPendingResponse("");
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error responding to elicitation:", error);
    } finally {
      setResponding(false);
    }
  };

  const cancelElicitation = async (id: string) => {
    try {
      await makeRequest("elicitation/cancel", { id });
      setRequests((prev) =>
        prev.map((req) => (req.id === id ? { ...req, status: "cancelled" as const } : req))
      );
    } catch (error) {
      console.error("Error cancelling elicitation:", error);
    }
  };

  const clearRequests = () => {
    setRequests([]);
    setSelectedRequest(null);
  };

  const copySchema = async () => {
    if (!selectedRequest?.requestedSchema) return;
    await navigator.clipboard.writeText(JSON.stringify(selectedRequest.requestedSchema, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pending":
        return { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" };
      case "responded":
        return { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" };
      case "cancelled":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" };
      default:
        return { icon: Clock, color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <h4 className="text-sm font-medium">{t("inspector.elicitationsNotSupported")}</h4>
        <p className="text-xs text-muted-foreground mt-1">{t("inspector.elicitationsNotSupportedDesc")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Request List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-border pr-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="h-4 w-4 text-cyan-500" />
            <span className="text-sm font-medium">{t("inspector.elicitations")}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">{requests.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={clearRequests}
            disabled={requests.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto space-y-2">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MessageCircleQuestion className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">{t("inspector.noElicitations")}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{t("inspector.elicitationsWillAppear")}</p>
            </div>
          ) : (
            requests.map((request) => {
              const style = getStatusStyle(request.status);
              const Icon = style.icon;

              return (
                <div
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className={`p-2.5 rounded-lg cursor-pointer transition-colors border ${
                    selectedRequest?.id === request.id
                      ? "bg-cyan-500/10 border-cyan-500/30"
                      : "hover:bg-muted/50 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1 rounded ${style.bg}`}>
                      <Icon className={`h-3 w-3 ${style.color}`} />
                    </div>
                    <span className="font-mono text-xs truncate flex-1">{request.id}</span>
                    <Badge variant="outline" className="text-[10px] h-4">
                      {request.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 pl-6">
                    {request.message}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Request Details */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedRequest ? (
          <>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-mono text-sm font-semibold">{selectedRequest.id}</h3>
                <Badge variant={selectedRequest.status === "pending" ? "default" : "secondary"}>
                  {selectedRequest.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedRequest.timestamp.toLocaleString()}
              </p>
            </div>

            {/* Message */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {t("inspector.elicitationMessage")}
              </h4>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm">{selectedRequest.message}</p>
              </div>
            </div>

            {/* Requested Schema */}
            {selectedRequest.requestedSchema && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("inspector.requestedSchema")}
                  </h4>
                  <Button variant="ghost" size="sm" className="h-6" onClick={copySchema}>
                    {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="text-xs bg-muted/50 p-3 rounded-lg border overflow-x-auto max-h-32">
                  {JSON.stringify(selectedRequest.requestedSchema, null, 2)}
                </pre>
              </div>
            )}

            {/* Response */}
            {selectedRequest.status === "pending" ? (
              <div className="flex-1 flex flex-col">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {t("inspector.yourResponse")}
                </h4>
                <Textarea
                  value={pendingResponse}
                  onChange={(e) => setPendingResponse(e.target.value)}
                  placeholder={t("inspector.enterResponse")}
                  className="flex-1 min-h-[100px] font-mono text-xs"
                />
                <div className="flex items-center gap-2 mt-3">
                  <Button onClick={respondToElicitation} disabled={responding || !pendingResponse.trim()}>
                    {responding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    {t("inspector.sendResponse")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => cancelElicitation(selectedRequest.id)}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : selectedRequest.response !== undefined ? (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {t("inspector.responseProvided")}
                </h4>
                <pre className="text-xs bg-green-500/10 p-3 rounded-lg border border-green-500/20 overflow-x-auto">
                  {JSON.stringify(selectedRequest.response, null, 2)}
                </pre>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircleQuestion className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-sm font-medium mb-2">{t("inspector.aboutElicitations")}</h3>
            <p className="text-xs text-muted-foreground max-w-md">{t("inspector.aboutElicitationsDesc")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
