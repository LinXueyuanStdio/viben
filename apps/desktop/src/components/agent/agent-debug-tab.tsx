/**
 * Agent Debug Tab Component
 *
 * Two-panel debug view:
 * - Left: Conversation area (messages + chat input)
 * - Right: Trace visualization (call tree / timeline)
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  CheckCircle2,
  TreeDeciduous,
  Activity,
  Bot,
  MessageSquare,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MessageList, ChatInput } from "@/components/chat";
import {
  SpanNode,
  TimelineView,
  SpanDetailPanel,
  formatDuration,
  formatDateTime,
  copyToClipboard,
  flattenSpans,
  filterSpans,
} from "@/components/observability";
import type { TraceSpanNode, TraceTree } from "@/components/observability";
import type { AgentMessage, MessageAttachment, TaskPlan, PendingQuestion } from "@/types";

// ============================================================================
// Types
// ============================================================================

export interface AgentDebugTabProps {
  // Agent info
  agentId: string;
  agentPath: string;
  sessionId?: string;

  // Conversation props
  messages: AgentMessage[];
  onSendMessage: (content: string, attachments?: MessageAttachment[]) => void;
  isStreaming?: boolean;

  // Plan/Question handling
  pendingPlan?: TaskPlan | null;
  pendingQuestions?: PendingQuestion | null;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
  onCancel?: () => void;

  // Trace data
  traceId?: string;
  traceTree?: TraceTree | null;
  selectedSpan?: TraceSpanNode | null;
  onSelectSpan: (span: TraceSpanNode | null) => void;

  className?: string;
}

// ============================================================================
// Resize Handle Component
// ============================================================================

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  className?: string;
}

function ResizeHandle({ onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const startXRef = React.useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startXRef.current;
      startXRef.current = moveEvent.clientX;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className={cn(
        "group relative w-1 cursor-col-resize shrink-0",
        "flex items-center justify-center",
        isDragging && "bg-primary/30",
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Hover/drag indicator line */}
      <div
        className={cn(
          "absolute inset-y-0 w-0.5 transition-colors",
          isDragging ? "bg-primary" : "bg-transparent group-hover:bg-border"
        )}
      />
      {/* Grip handle */}
      <div
        className={cn(
          "absolute flex items-center justify-center w-4 h-8 rounded-md transition-all",
          isDragging
            ? "bg-primary text-primary-foreground"
            : "bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentDebugTab({
  agentId: _agentId,
  agentPath: _agentPath,
  sessionId,
  messages,
  onSendMessage,
  isStreaming,
  pendingPlan,
  pendingQuestions,
  onApprovePlan,
  onRejectPlan,
  onAnswerQuestions,
  onCancel,
  traceId,
  traceTree,
  selectedSpan,
  onSelectSpan,
  className,
}: AgentDebugTabProps) {
  const { t } = useTranslation("agentDetail");
  const [leftPanelWidth, setLeftPanelWidth] = React.useState(50); // percentage
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [activeTraceTab, setActiveTraceTab] = React.useState<"tree" | "timeline">("tree");
  const [searchQuery] = React.useState("");

  // Handle resize
  const handleResize = React.useCallback((delta: number) => {
    setLeftPanelWidth((prev) => {
      const containerWidth = window.innerWidth;
      const deltaPercent = (delta / containerWidth) * 100;
      const newWidth = prev + deltaPercent;
      return Math.min(Math.max(newWidth, 30), 70); // Clamp between 30% and 70%
    });
  }, []);

  // Copy ID handler
  const handleCopyId = async (id: string, _type: "trace" | "span") => {
    const success = await copyToClipboard(id);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Flatten spans for timeline view
  const flattenedSpans = React.useMemo(() => {
    if (!traceTree) return [];
    return flattenSpans(traceTree);
  }, [traceTree]);

  // Filter spans by search query
  const filteredSpans = React.useMemo(() => {
    return filterSpans(flattenedSpans, searchQuery);
  }, [flattenedSpans, searchQuery]);

  // Handle send message
  const handleSendMessage = React.useCallback(
    (content: string, attachments?: MessageAttachment[]) => {
      onSendMessage(content, attachments);
    },
    [onSendMessage]
  );

  return (
    <div className={cn("flex h-full overflow-hidden", className)}>
      {/* Left Panel - Conversation Area */}
      <div
        className="flex flex-col min-w-0 h-full border-r border-border"
        style={{ width: `${leftPanelWidth}%` }}
      >
        {/* Conversation Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{t("debugTab", "Debug")}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-foreground mb-2">
                {t("noTraceYet", "Send a message to see the call trace")}
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                {t("debugDescription", "Messages and tool calls will appear here")}
              </p>
            </div>
          ) : (
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              pendingPlan={pendingPlan}
              pendingQuestions={pendingQuestions}
              onApprovePlan={onApprovePlan}
              onRejectPlan={onRejectPlan}
              onAnswerQuestions={onAnswerQuestions}
              className="h-full"
            />
          )}
        </div>

        {/* Chat Input */}
        <div className="shrink-0 border-t border-border bg-background">
          <ChatInput
            onSend={handleSendMessage}
            onCancel={onCancel}
            isLoading={isStreaming}
            placeholder={t("inputPlaceholder", "Type a message...")}
            className="rounded-none border-0"
          />
        </div>
      </div>

      {/* Resize Handle */}
      <ResizeHandle onResize={handleResize} />

      {/* Right Panel - Trace Visualization */}
      <div
        className="flex flex-col min-w-0 h-full"
        style={{ width: `${100 - leftPanelWidth}%` }}
      >
        {/* Trace Info Bar */}
        <div className="px-4 py-3 border-b border-border bg-muted/30 space-y-2 shrink-0">
          {/* Trace ID */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-20 shrink-0">
              {t("traceId", "Trace ID")}:
            </span>
            <code className="text-xs font-mono truncate flex-1">
              {traceId || "-"}
            </code>
            {traceId && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleCopyId(traceId, "trace")}
                    >
                      {copiedId === traceId ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("copyTraceId", "Copy Trace ID")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Session ID */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-20 shrink-0">
              {t("sessionId", "Session ID")}:
            </span>
            <code className="text-xs font-mono truncate flex-1">
              {sessionId || "-"}
            </code>
            {sessionId && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleCopyId(sessionId, "trace")}
                    >
                      {copiedId === sessionId ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("copySessionId", "Copy Session ID")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Trace Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Tabs */}
          <Tabs
            value={activeTraceTab}
            onValueChange={(v) => setActiveTraceTab(v as "tree" | "timeline")}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-4 pt-2 shrink-0">
              <TabsList>
                <TabsTrigger value="tree" className="gap-1.5">
                  <TreeDeciduous className="h-4 w-4" />
                  {t("callTree", "Call Tree")}
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1.5">
                  <Activity className="h-4 w-4" />
                  {t("timeline", "Timeline")}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 flex gap-2 p-4">
              {/* Main Trace View */}
              <div className="flex-1 min-w-0 min-h-0">
                {!traceTree ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <TreeDeciduous className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      {t("noTraceYet", "Send a message to see the call trace")}
                    </p>
                  </div>
                ) : (
                  <>
                    <TabsContent value="tree" className="m-0 h-full">
                      <div className="h-full rounded-lg overflow-hidden bg-[#1e1e1e] border border-[#333]">
                        <ScrollArea className="h-full">
                          <div className="p-4 font-mono text-sm">
                            <SpanNode
                              node={traceTree.root}
                              formatDuration={formatDuration}
                              traceStartTime={traceTree.startTime}
                              totalDuration={traceTree.totalDuration}
                              selectedSpan={selectedSpan || null}
                              onSelectSpan={onSelectSpan}
                              searchQuery={searchQuery}
                            />
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>

                    <TabsContent value="timeline" className="m-0 h-full">
                      <div className="h-full rounded-lg overflow-hidden border bg-card">
                        <ScrollArea className="h-full">
                          <div className="p-4">
                            <TimelineView
                              spans={filteredSpans}
                              traceStartTime={traceTree.startTime}
                              totalDuration={traceTree.totalDuration}
                              formatDuration={formatDuration}
                              selectedSpan={selectedSpan || null}
                              onSelectSpan={onSelectSpan}
                            />
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  </>
                )}
              </div>

              {/* Span Detail Panel */}
              {selectedSpan && (
                <SpanDetailPanel
                  span={selectedSpan}
                  formatDuration={formatDuration}
                  formatDateTime={formatDateTime}
                  onClose={() => onSelectSpan(null)}
                  onCopyId={handleCopyId}
                  copiedId={copiedId}
                />
              )}
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
