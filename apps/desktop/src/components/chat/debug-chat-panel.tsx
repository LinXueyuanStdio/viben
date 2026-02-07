/**
 * Debug Chat Panel
 *
 * Embedded chat panel for testing agent configurations in the settings page.
 * Uses a temporary workdir and the current (unsaved) agent config.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bot, Trash2, Loader2, AlertCircle, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ChatInput } from "./chat-input";
import { MessageList } from "./message-list";
import { cn } from "@/lib/utils";
import {
  type BaseCodingAgent,
  type ExecutorConfig,
  getAgentTypeInfo,
} from "@/types";
import {
  getGatewayClient,
  getGatewayUrl,
  setGatewayUrl,
  getAvailabilityStatus,
} from "@/lib/gateway";
import type { AvailabilityInfo } from "@/lib/gateway";
import type {
  AgentMessage,
  AgentPhase,
  TaskPlan,
  PendingQuestion,
} from "@/types";

// Default debug workdir
const DEBUG_WORKDIR = "/tmp/viben-debug";

interface DebugChatPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Callback when panel open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current agent type being configured */
  agentType: BaseCodingAgent;
  /** Current executor config (unsaved) */
  executorConfig?: ExecutorConfig;
}

export function DebugChatPanel({
  open,
  onOpenChange,
  agentType,
  executorConfig,
}: DebugChatPanelProps) {
  const { t } = useTranslation();
  const client = React.useMemo(() => getGatewayClient(), []);

  // Chat state
  const [messages, setMessages] = React.useState<AgentMessage[]>([]);
  const [phase, setPhase] = React.useState<AgentPhase>("idle");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [pendingPlan, setPendingPlan] = React.useState<TaskPlan | null>(null);
  const [pendingQuestions, setPendingQuestions] = React.useState<PendingQuestion | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);

  // Gateway state
  const [gatewayConnected, setGatewayConnected] = React.useState<boolean | null>(null);
  const [availability, setAvailability] = React.useState<AvailabilityInfo | null>(null);
  const [checkingAvailability, setCheckingAvailability] = React.useState(false);

  // Settings state
  const [showSettings, setShowSettings] = React.useState(false);
  const [gatewayUrlInput, setGatewayUrlInput] = React.useState(getGatewayUrl());
  const [workdirInput, setWorkdirInput] = React.useState(DEBUG_WORKDIR);

  // Check gateway connection on open
  React.useEffect(() => {
    if (open) {
      checkGateway();
    }
  }, [open]);

  // Check agent availability when agent type changes
  React.useEffect(() => {
    if (open && gatewayConnected) {
      checkAgentAvailability();
    }
  }, [open, gatewayConnected, agentType]);

  const checkGateway = async () => {
    try {
      const connected = await client.ping();
      setGatewayConnected(connected);
      if (!connected) {
        setError(t("gateway.connectionFailed", { defaultValue: "Cannot connect to Gateway" }));
      }
    } catch {
      setGatewayConnected(false);
      setError(t("gateway.connectionFailed", { defaultValue: "Cannot connect to Gateway" }));
    }
  };

  const checkAgentAvailability = async () => {
    setCheckingAvailability(true);
    try {
      const info = await client.checkAvailability(agentType);
      setAvailability(info);
    } catch (err) {
      console.error("[DebugChatPanel] Failed to check availability:", err);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSaveSettings = () => {
    setGatewayUrl(gatewayUrlInput);
    client.setBaseUrl(gatewayUrlInput);
    setShowSettings(false);
    // Re-check connection
    checkGateway();
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    setError(null);
    setPhase("running");
    setIsStreaming(true);

    // Add user message
    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      type: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Spawn or continue agent
      const response = await client.spawnAgent(agentType, {
        prompt: content,
        workdir: workdirInput,
        session_id: sessionId || undefined,
        config: executorConfig?.config as Record<string, unknown>,
      });

      setSessionId(response.session_id);

      // For now, add a mock response since Gateway doesn't have SSE streaming yet
      // TODO: Replace with actual SSE streaming when Gateway supports it
      const assistantMessage: AgentMessage = {
        id: crypto.randomUUID(),
        type: "text",
        content: t("gateway.agentSpawned", {
          defaultValue: `Agent ${agentType} spawned with session ${response.session_id}. Real-time streaming will be available when Gateway supports SSE.`,
        }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setPhase("completed");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setPhase("error");

      // Add error message
      const errMsg: AgentMessage = {
        id: crypto.randomUUID(),
        type: "error",
        message: errorMessage,
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCancel = () => {
    if (sessionId) {
      client.stopAgent(agentType, sessionId).catch(console.error);
    }
    client.cancelStream();
    setIsStreaming(false);
    setPhase("idle");
  };

  const handleClearMessages = () => {
    setMessages([]);
    setSessionId(null);
    setPhase("idle");
    setError(null);
    setPendingPlan(null);
    setPendingQuestions(null);
  };

  const agentInfo = getAgentTypeInfo(agentType);
  const availabilityStatus = availability ? getAvailabilityStatus(availability) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] p-0 flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-base">
                    {t("gateway.debugChat", { defaultValue: "Debug Chat" })}
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    {agentInfo?.name || agentType}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(!showSettings)}
                  className="h-8 w-8"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="space-y-2">
                <Label className="text-xs">
                  {t("gateway.url", { defaultValue: "Gateway URL" })}
                </Label>
                <Input
                  value={gatewayUrlInput}
                  onChange={(e) => setGatewayUrlInput(e.target.value)}
                  placeholder="http://localhost:30100"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">
                  {t("gateway.workdir", { defaultValue: "Working Directory" })}
                </Label>
                <Input
                  value={workdirInput}
                  onChange={(e) => setWorkdirInput(e.target.value)}
                  placeholder="/tmp/viben-debug"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(false)}
                  className="h-7 text-xs"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveSettings}
                  className="h-7 text-xs"
                >
                  {t("common.save")}
                </Button>
              </div>
            </div>
          )}

          {/* Status Bar */}
          <div className="mt-3 flex items-center gap-2 text-xs">
            {/* Gateway Status */}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  gatewayConnected === null
                    ? "bg-muted-foreground animate-pulse"
                    : gatewayConnected
                      ? "bg-emerald-500"
                      : "bg-destructive"
                )}
              />
              <span className="text-muted-foreground">
                {gatewayConnected === null
                  ? t("common.loading")
                  : gatewayConnected
                    ? t("gateway.connected", { defaultValue: "Connected" })
                    : t("gateway.disconnected", { defaultValue: "Disconnected" })}
              </span>
            </div>

            <span className="text-muted-foreground/50">|</span>

            {/* Agent Availability */}
            {checkingAvailability ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t("common.loading")}
                </span>
              </div>
            ) : availabilityStatus ? (
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    availabilityStatus.variant === "success"
                      ? "bg-emerald-500"
                      : availabilityStatus.variant === "error"
                        ? "bg-destructive"
                        : "bg-amber-500"
                  )}
                />
                <span className="text-muted-foreground">
                  {availabilityStatus.label}
                </span>
              </div>
            ) : null}

            <div className="flex-1" />

            {/* Clear button */}
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearMessages}
                className="h-6 px-2 text-xs"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {t("common.clear")}
              </Button>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Error Banner */}
          {error && (
            <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive flex-1">{error}</p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setError(null)}
                className="h-6 w-6"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Messages */}
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            pendingPlan={pendingPlan}
            pendingQuestions={pendingQuestions}
            onApprovePlan={() => {
              setPendingPlan(null);
              setPhase("running");
            }}
            onRejectPlan={() => {
              setPendingPlan(null);
              setPhase("idle");
            }}
            onAnswerQuestions={() => {
              setPendingQuestions(null);
              setPhase("running");
            }}
            className="flex-1"
          />

          {/* Input */}
          <div className="border-t border-border bg-background p-4">
            <ChatInput
              onSend={handleSendMessage}
              onCancel={handleCancel}
              isLoading={isStreaming}
              disabled={
                !gatewayConnected ||
                phase === "awaiting_approval" ||
                phase === "awaiting_input"
              }
              placeholder={
                !gatewayConnected
                  ? t("gateway.connectFirst", { defaultValue: "Connect to Gateway first..." })
                  : undefined
              }
              variant="compact"
              autoFocus
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
