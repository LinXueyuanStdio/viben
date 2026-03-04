/**
 * Debug Chat Panel
 *
 * Embedded chat panel for testing agent configurations in the settings page.
 * Uses a temporary workdir and the current (unsaved) agent config.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bot, Trash2, Loader2, AlertCircle, X, Settings2, HelpCircle } from "lucide-react";
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
import { DesktopChatInput } from "./desktop-chat-input";
import { DesktopMessageList } from "./desktop-message-list";
import type { SlashCommand } from "@viben/chat";
import { cn } from "@/lib/utils";
import type { ExecutorType } from "@viben/core/shared";
import type { ExecutorConfig } from "@/types";
import { useExecutors } from "@/hooks";
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
  ToolUsage,
} from "@/types";

/**
 * Gateway event data structure
 */
interface GatewayEventData {
  agent_id?: string;
  session_id?: string;
  success?: boolean;
  task_id?: string;
  old_status?: string;
  new_status?: string;
  content?: string;
  role?: string;
  log_type?: string;
  message?: string;
  code?: string;
}

/**
 * WebSocket message from server (matching Rust WsMessage with serde tag="type", content="data")
 * Structure: { "type": "Event", "data": { "channel": "gateway", "payload": GatewayEvent } }
 * where GatewayEvent is { "type": "SessionMessage", "data": { session_id, content, role } }
 */
interface WsServerMessage {
  type: "Event" | "Pong" | "Subscribed" | "Error";
  data?: {
    channel?: string;
    // The payload is the serialized GatewayEvent
    payload?: {
      type?: string;  // e.g., "SessionMessage", "ExecutionLog", "AgentCompleted"
      data?: GatewayEventData;
    };
    // For Error type
    message?: string;
  };
}

/**
 * Get WebSocket URL from Gateway URL
 */
function getWebSocketUrl(): string {
  const gatewayUrl = getGatewayUrl();
  // Convert http(s):// to ws(s)://
  return gatewayUrl.replace(/^http/, "ws") + "/ws";
}

// Default debug workdir
const DEBUG_WORKDIR = "/tmp/viben-debug";

interface DebugChatPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Callback when panel open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current agent type being configured */
  agentType: ExecutorType;
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
  const { executors } = useExecutors();

  // Helper to get executor display name from Gateway API
  const getExecutorName = React.useCallback(
    (execType: ExecutorType) => {
      const executor = executors.find((e) => e.type === execType);
      return executor?.name || execType;
    },
    [executors]
  );

  // Chat state
  const [messages, setMessages] = React.useState<AgentMessage[]>([]);
  const [phase, setPhase] = React.useState<AgentPhase>("idle");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [pendingPlan, setPendingPlan] = React.useState<TaskPlan | null>(null);
  const [pendingQuestions, setPendingQuestions] = React.useState<PendingQuestion | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [_toolUsages, setToolUsages] = React.useState<ToolUsage[]>([]);

  // Gateway state
  const [gatewayConnected, setGatewayConnected] = React.useState<boolean | null>(null);
  const [availability, setAvailability] = React.useState<AvailabilityInfo | null>(null);
  const [checkingAvailability, setCheckingAvailability] = React.useState(false);

  // Settings state
  const [showSettings, setShowSettings] = React.useState(false);
  const [gatewayUrlInput, setGatewayUrlInput] = React.useState(getGatewayUrl());
  const [workdirInput, setWorkdirInput] = React.useState(DEBUG_WORKDIR);

  // WebSocket ref
  const wsRef = React.useRef<WebSocket | null>(null);

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

  // Cleanup WebSocket on unmount or close
  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

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

  /**
   * Handle incoming WebSocket event
   */
  const handleWsEvent = React.useCallback((eventType: string, eventData: GatewayEventData, targetSessionId: string) => {
    // Filter by session ID
    if (eventData.session_id !== targetSessionId) {
      console.log("[DebugChatPanel] Ignoring event for different session:", eventData.session_id);
      return;
    }

    console.log("[DebugChatPanel] Processing event:", eventType, eventData);

    switch (eventType) {
      case "AgentSpawned":
        console.log("[DebugChatPanel] Agent spawned confirmed for session:", targetSessionId);
        break;

      case "SessionMessage":
        const msg: AgentMessage = {
          id: crypto.randomUUID(),
          type: eventData.role === "user" ? "user" : "text",
          content: eventData.content || "",
        };
        setMessages((prev) => [...prev, msg]);
        break;

      case "ExecutionLog": {
        const logType = eventData.log_type;
        const content = eventData.content || "";

        if (logType === "tool_use") {
          try {
            const toolData = JSON.parse(content);
            const toolId = crypto.randomUUID();
            const toolMsg: AgentMessage = {
              id: toolId,
              type: "tool_use",
              name: toolData.name || "unknown",
              input: toolData.input || {},
            };
            setMessages((prev) => [...prev, toolMsg]);

            const toolUsage: ToolUsage = {
              id: toolId,
              name: toolData.name || "unknown",
              displayName: toolData.name || t("chat.unknownTool", "Unknown Tool"),
              input: toolData.input || {},
              timestamp: Date.now(),
            };
            setToolUsages((prev) => [...prev, toolUsage]);
          } catch {
            const textMsg: AgentMessage = {
              id: crypto.randomUUID(),
              type: "text",
              content,
            };
            setMessages((prev) => [...prev, textMsg]);
          }
        } else if (logType === "tool_result") {
          try {
            const resultData = JSON.parse(content);
            const resultMsg: AgentMessage = {
              id: crypto.randomUUID(),
              type: "tool_result",
              toolUseId: resultData.tool_use_id || "",
              output: resultData.output || content,
              isError: resultData.is_error,
            };
            setMessages((prev) => [...prev, resultMsg]);
          } catch {
            const textMsg: AgentMessage = {
              id: crypto.randomUUID(),
              type: "text",
              content,
            };
            setMessages((prev) => [...prev, textMsg]);
          }
        } else if (content.trim()) {
          const textMsg: AgentMessage = {
            id: crypto.randomUUID(),
            type: "text",
            content,
          };
          setMessages((prev) => [...prev, textMsg]);
        }
        break;
      }

      case "AgentCompleted":
        setIsStreaming(false);
        if (eventData.success) {
          setPhase("completed");
          const resultMsg: AgentMessage = {
            id: crypto.randomUUID(),
            type: "result",
            content: t("chat.agentCompleted", "Agent completed successfully."),
          };
          setMessages((prev) => [...prev, resultMsg]);
        } else {
          setPhase("error");
          const errMsg: AgentMessage = {
            id: crypto.randomUUID(),
            type: "error",
            message: t("chat.agentFailed", "Agent execution failed."),
            isError: true,
          };
          setMessages((prev) => [...prev, errMsg]);
        }
        break;

      case "Error":
        setError(eventData.message || t("common.unknownError", "Unknown error"));
        const errMsg: AgentMessage = {
          id: crypto.randomUUID(),
          type: "error",
          message: eventData.message || t("common.unknownError", "Unknown error"),
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
        setPhase("error");
        setIsStreaming(false);
        break;
    }
  }, [t]);

  /**
   * Subscribe to WebSocket events for a session
   * Returns a promise that resolves when the connection is open
   */
  const subscribeToEvents = React.useCallback((targetSessionId: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      const wsUrl = getWebSocketUrl();
      console.log("[DebugChatPanel] Connecting to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[DebugChatPanel] WebSocket connection opened for session:", targetSessionId);
        resolve(ws);
      };

      ws.onmessage = (e) => {
        try {
          const message: WsServerMessage = JSON.parse(e.data);
          console.log("[DebugChatPanel] WebSocket message:", message);

          if (message.type === "Event" && message.data?.payload) {
            const eventType = message.data.payload.type;
            const eventData = message.data.payload.data;
            if (eventType && eventData) {
              handleWsEvent(eventType, eventData, targetSessionId);
            }
          }
        } catch (err) {
          console.error("[DebugChatPanel] Failed to parse WebSocket message:", err, e.data);
        }
      };

      ws.onerror = (e) => {
        console.error("[DebugChatPanel] WebSocket error:", e);
      };

      ws.onclose = (e) => {
        console.log("[DebugChatPanel] WebSocket closed:", e.code, e.reason);
        if (e.code !== 1000) {
          // Abnormal close
          reject(new Error(`WebSocket closed: ${e.reason || e.code}`));
        }
      };

      // Timeout if connection doesn't open within 5 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          reject(new Error("WebSocket connection timeout"));
        }
      }, 5000);
    });
  }, [handleWsEvent]);

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

    // Generate session ID upfront so we can subscribe before spawning
    const newSessionId = sessionId || crypto.randomUUID();

    try {
      // IMPORTANT: Subscribe to WebSocket BEFORE spawning agent to avoid race condition
      // This ensures we don't miss any events that are broadcast immediately after spawn
      console.log("[DebugChatPanel] Subscribing to WebSocket for session:", newSessionId);
      await subscribeToEvents(newSessionId);
      console.log("[DebugChatPanel] WebSocket connected, now spawning agent...");

      // Spawn agent with our pre-generated session ID
      // No verbose "connecting" message - the UI shows streaming indicator
      const response = await client.spawnAgent(agentType, {
        prompt: content,
        workdir: workdirInput,
        session_id: newSessionId,
        config: executorConfig?.config as Record<string, unknown>,
      });

      console.log("[DebugChatPanel] Spawn response:", response);
      setSessionId(response.session_id);
      // Agent started - streaming indicator in UI is sufficient
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t("common.unknownError");
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
      setIsStreaming(false);
    }
  };

  const handleCancel = () => {
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (sessionId) {
      client.stopAgent(agentType, sessionId).catch(console.error);
    }
    client.cancelStream();
    setIsStreaming(false);
    setPhase("idle");
  };

  const handleClearMessages = () => {
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setMessages([]);
    setSessionId(null);
    setPhase("idle");
    setError(null);
    setPendingPlan(null);
    setPendingQuestions(null);
    setToolUsages([]);
  };

  const executorDisplayName = getExecutorName(agentType);
  const availabilityStatus = availability ? getAvailabilityStatus(availability) : null;

  // Slash commands for debug chat
  const slashCommands = React.useMemo<SlashCommand[]>(() => [
    {
      id: "clear",
      name: t("chat.slashCommands.clear", "clear"),
      description: t("chat.slashCommands.clearDesc", "Clear conversation history"),
      icon: <Trash2 className="h-4 w-4" />,
    },
    {
      id: "help",
      name: t("chat.slashCommands.help", "help"),
      description: t("chat.slashCommands.helpDesc", "Show available commands"),
      icon: <HelpCircle className="h-4 w-4" />,
    },
  ], [t]);

  // Handle slash command execution
  const handleSlashCommand = React.useCallback((command: SlashCommand) => {
    switch (command.id) {
      case "clear":
        handleClearMessages();
        break;
      case "help":
        // Could show a help modal or inject a help message
        break;
    }
  }, [handleClearMessages]);

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
                    {executorDisplayName}
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
                  placeholder={t("gateway.urlPlaceholder", "http://localhost:18790")}
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
                  placeholder={t("gateway.workdirPlaceholder", "/tmp/viben-debug")}
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
                  {t(availabilityStatus.labelKey)}
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
          <DesktopMessageList
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
          <div className="border-t border-border bg-background">
            <DesktopChatInput
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
              autoFocus
              showTopToolbar
              showConfigBar
              showResizeHandle
              enableWritingMode
              hideAgentSelector
              hideModelSelector
              slashCommands={slashCommands}
              onSlashCommand={handleSlashCommand}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
