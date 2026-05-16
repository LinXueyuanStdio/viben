import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { homeDir } from "@tauri-apps/api/path";
import { getGatewayClient, type ExecutorUIMessage, type MemberType, type MemberRole, type AgentResponse } from "@/lib/gateway";
import { filterModelsByExecutor } from "@/lib/executor-constraints";
import {
  useAgentConversation,
  useAgents,
  useAgentDetail,
  useModels,
  useLocalWorkspaces,
  useChatConfig,
  useGroupChat,
  useChatNotifications,
  useGroupNotifications,
  useExecutorSessions,
  useExecutorSessionMessages,
  useChatList,
  isExecutorType,
} from "@/hooks";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { useTasks } from "@/hooks/use-kanban";
import { useVitePreview } from "@/hooks/use-vite-preview";
import type { AgentMessage, Artifact } from "@/types";
import { useChatConfigStore } from "@/stores/chat-config-store";
import { useSlashCommands, type CommandContext } from "@/features/slash-commands";
import type { SlashCommand } from "@viben/chat";
import { useToast } from "@/hooks/use-toast";
import {
  type Conversation,
  fileSessionToConversation,
  uiMessageToAgentMessage,
  saveLastSessionId,
  loadLastAgentId,
  saveLastAgentId,
} from "../conversation-utils";

export function useWorkspaceChat() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    openWorkspaceAgentDetail,
    openWorkspaceExecutorDetail,
    openPath,
    openWorkspaceHome,
  } = useDesktopRouting();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const navigateWithinDesktop = useCallback(
    (url: string) => {
      if (url.startsWith("/login")) {
        navigate(url);
        return;
      }

      openPath(url, {
        title: url,
      });
    },
    [navigate, openPath]
  );

  // ========== UI State ==========
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isCreateAgentDialogOpen, setIsCreateAgentDialogOpen] = useState(false);
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");

  // Create agent dialog state
  const [selectedAgentTemplate, setSelectedAgentTemplate] = useState<AgentResponse | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [createAgentLocation, setCreateAgentLocation] = useState<"workspace" | "global">("workspace");
  const [globalVibenPath, setGlobalVibenPath] = useState<string>("");

  // Resizable panel widths
  const [leftPanelWidth, setLeftPanelWidth] = useState(240);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

  const MIN_LEFT_PANEL_WIDTH = 240;
  const MAX_LEFT_PANEL_WIDTH = 480;
  const MIN_RIGHT_PANEL_WIDTH = 280;
  const MAX_RIGHT_PANEL_WIDTH = 480;

  const handleLeftPanelResize = useCallback((delta: number) => {
    setLeftPanelWidth((prev) =>
      Math.min(MAX_LEFT_PANEL_WIDTH, Math.max(MIN_LEFT_PANEL_WIDTH, prev + delta))
    );
  }, []);

  const handleRightPanelResize = useCallback((delta: number) => {
    setRightPanelWidth((prev) =>
      Math.min(MAX_RIGHT_PANEL_WIDTH, Math.max(MIN_RIGHT_PANEL_WIDTH, prev + delta))
    );
  }, []);

  // Left panel ScrollArea ref and width tracking
  const leftPanelScrollRef = useRef<HTMLDivElement>(null);
  const [leftPanelScrollWidth, setLeftPanelScrollWidth] = useState<number | null>(null);

  useEffect(() => {
    homeDir().then((home) => {
      const homePath = home.endsWith("/") ? home : `${home}/`;
      setGlobalVibenPath(`${homePath}.viben/agents/`);
    });
  }, []);

  useEffect(() => {
    const scrollArea = leftPanelScrollRef.current;
    if (!scrollArea) return;
    const updateWidth = () => {
      const width = scrollArea.getBoundingClientRect().width;
      setLeftPanelScrollWidth(width);
    };
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(scrollArea);
    return () => resizeObserver.disconnect();
  }, []);

  const leftPanelContentStyle: React.CSSProperties = leftPanelScrollWidth
    ? { width: leftPanelScrollWidth, maxWidth: leftPanelScrollWidth }
    : {};

  // ========== Conversation State ==========
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [_sessionsError, setSessionsError] = useState<string | null>(null);

  // ========== Group Chat State ==========
  const [selectedGroupChatId, setSelectedGroupChatId] = useState<string | null>(null);
  const [selectedGroupSessionId, setSelectedGroupSessionId] = useState<string | null>(null);
  const [isCreatingGroupChat, setIsCreatingGroupChat] = useState(false);
  const [groupChatInput, setGroupChatInput] = useState("");
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [renameGroupChatId, setRenameGroupChatId] = useState<string | null>(null);
  const [renameGroupChatName, setRenameGroupChatName] = useState("");
  const [mutedGroupChats, setMutedGroupChats] = useState<Set<string>>(new Set());

  // Right sidebar detail views
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);
  const [rightSidebarExecutorDetail, setRightSidebarExecutorDetail] = useState<{
    id: string;
    name: string;
    type: string;
    config_path?: string;
  } | null>(null);

  // Artifact-message linking state
  const [highlightedArtifactId, setHighlightedArtifactId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const hasAutoExpandedSidebarRef = useRef(false);

  // ========== External Hooks ==========
  const { workspaces, isLoading: isLoadingWorkspace } = useLocalWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  const { data: tasks = [], isLoading: isTasksLoading } = useTasks(workspace?.path);

  const {
    previewUrl: livePreviewUrl,
    status: livePreviewStatus,
    error: livePreviewError,
    startPreview,
    stopPreview,
    isNodeAvailable,
  } = useVitePreview(workspaceId || null);

  const handleStartLivePreview = useCallback(() => {
    if (workspace?.path) {
      startPreview(workspace.path);
    }
  }, [workspace?.path, startPreview]);

  const toast = useToast();

  const selectedAgentIdRef = useRef<string | null>(null);

  // Chat list
  const {
    groupChats: _chatListGroupChats,
    executors: chatListExecutors,
    agents: chatListAgents,
    loading: isLoadingChatList,
    refresh: refreshChatList,
  } = useChatList({
    workspacePath: workspace?.path,
    includeGlobal: true,
  });

  // Agent detail
  const {
    agent: detailAgentData,
    loading: isLoadingDetailAgent,
    error: _detailAgentError,
  } = useAgentDetail(detailAgentId, workspace?.path);

  const rightSidebarAgentDetail = detailAgentData ? {
    id: detailAgentData.id,
    name: detailAgentData.name,
    path: detailAgentData.config_path,
    description: detailAgentData.description,
    model: detailAgentData.model,
    provider: detailAgentData.provider,
    system_prompt: detailAgentData.system_prompt,
    temperature: detailAgentData.temperature,
    max_tokens: detailAgentData.max_tokens,
    mcp_servers: detailAgentData.mcp_servers?.map((s) => typeof s === "string" ? s : s.name),
    skills: detailAgentData.skills,
    created_at: detailAgentData.created_at,
    updated_at: detailAgentData.updated_at,
  } : null;

  const isLoadingExecutors = isLoadingChatList;
  const loadExecutors = refreshChatList;

  // Executor state
  const [selectedSidebarExecutorId, setSelectedSidebarExecutorId] = useState<string | null>(null);
  const [selectedExecutorSessionId, setSelectedExecutorSessionId] = useState<string | null>(null);

  const selectedSidebarExecutor = chatListExecutors.find((e) => e.id === selectedSidebarExecutorId);
  const selectedExecutorType = selectedSidebarExecutor?.id || null;

  const {
    sessions: executorSessions,
    isLoading: isLoadingExecutorSessions,
    error: _executorSessionsError,
    refresh: refreshExecutorSessions,
  } = useExecutorSessions(selectedExecutorType, workspace?.path || null);

  useEffect(() => {
    if (executorSessions.length > 0 && !selectedExecutorSessionId) {
      setSelectedExecutorSessionId(executorSessions[0].id);
    }
    if (executorSessions.length === 0 && selectedExecutorSessionId) {
      setSelectedExecutorSessionId(null);
    }
  }, [executorSessions, selectedExecutorSessionId]);

  const {
    messages: executorMessages,
    isLoading: isLoadingExecutorMessages,
    error: _executorMessagesError,
    refresh: _refreshExecutorMessages,
  } = useExecutorSessionMessages(selectedExecutorType, selectedExecutorSessionId, workspace?.path || null);

  // Convert ExecutorUIMessage to AgentMessage
  const executorMessagesAsAgentMessages = useMemo(() => {
    const convertMessages = (messages: ExecutorUIMessage[]): AgentMessage[] => {
      const toolResultMap = new Map<string, ExecutorUIMessage>();
      messages.forEach((msg) => {
        if (msg.type === "tool_result" && msg.tool_use_id) {
          toolResultMap.set(msg.tool_use_id, msg);
        }
      });

      const result: AgentMessage[] = [];
      messages.forEach((msg: ExecutorUIMessage) => {
        switch (msg.type) {
          case "user":
            result.push({ id: msg.id, type: "user", content: msg.content || "" });
            break;
          case "text":
            result.push({ id: msg.id, type: "text", content: msg.content || "" });
            break;
          case "thinking":
            result.push({ id: msg.id, type: "thinking", content: msg.content || "" });
            break;
          case "tool_use": {
            const toolResult = msg.tool_use_id ? toolResultMap.get(msg.tool_use_id) : undefined;
            const toolName = msg.tool_name || "unknown";

            if (toolName === "AskUserQuestion" && msg.tool_input) {
              const input = msg.tool_input as { questions?: Array<{
                question: string;
                header?: string;
                options?: Array<{ label: string; description?: string }>;
                multiSelect?: boolean;
              }> };
              if (input.questions && input.questions.length > 0) {
                result.push({
                  id: msg.id,
                  type: "ask_question",
                  questions: input.questions.map(q => ({
                    question: q.question,
                    header: q.header || "",
                    options: q.options || [],
                    multiSelect: q.multiSelect || false,
                  })),
                });
                break;
              }
            }

            if (toolName === "EnterPlanMode") {
              result.push({ id: msg.id, type: "plan_mode", planModeAction: "enter" });
              break;
            }
            if (toolName === "ExitPlanMode") {
              result.push({ id: msg.id, type: "plan_mode", planModeAction: "exit" });
              break;
            }

            const subagentMessages = msg.subagent_messages
              ? convertMessages(msg.subagent_messages)
              : undefined;

            result.push({
              id: msg.id,
              type: "tool_use",
              name: toolName,
              input: msg.tool_input || {},
              toolUseId: msg.tool_use_id,
              output: toolResult?.content || toolResult?.tool_output,
              isError: toolResult?.is_error,
              subagentId: msg.subagent_id,
              subagentMessages,
            });
            break;
          }
          case "tool_result":
            break;
          case "error":
            result.push({
              id: msg.id,
              type: "error",
              message: msg.content || t("common.unknownError"),
              isError: true,
            });
            break;
        }
      });
      return result;
    };
    return convertMessages(executorMessages);
  }, [executorMessages, t]);

  // Executor session statistics
  const executorSessionStats = useMemo(() => {
    const toolNames = new Set<string>();
    let totalContentLength = 0;
    executorMessages.forEach((msg) => {
      if (msg.type === "tool_use" && msg.tool_name) toolNames.add(msg.tool_name);
      if (msg.content) totalContentLength += msg.content.length;
      if (msg.tool_output) totalContentLength += msg.tool_output.length;
    });
    return {
      toolsCount: toolNames.size,
      skillsCount: 0,
      estimatedTokens: Math.round(totalContentLength / 4),
    };
  }, [executorMessages]);

  // Models
  const { models: vibenModels } = useModels();

  const executorModels = useMemo(() => {
    if (!selectedExecutorType) return [];
    const allModels = vibenModels
      .filter((m) => m.is_available)
      .map((m) => ({ id: m.id, name: m.name, provider: m.provider_id, provider_id: m.provider_id }));
    return filterModelsByExecutor(allModels, selectedExecutorType);
  }, [selectedExecutorType, vibenModels]);

  const [selectedExecutorModelId, setSelectedExecutorModelId] = useState<string | null>(null);

  useEffect(() => {
    if (executorModels.length > 0) {
      setSelectedExecutorModelId(executorModels[0].id);
    } else {
      setSelectedExecutorModelId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExecutorType]);

  // Agents
  const { agents, defaultAgentId, setDefaultAgent, updateAgent, removeAgent, createAgent, templates: agentTemplates, refreshTemplates } = useAgents({ workspacePath: workspace?.path });

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  const agentModelsForPanel = vibenModels.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider_id,
    enabled: m.is_available,
  }));

  const { selectedAgentId, setSelectedAgentId } = useChatConfig({ workspacePath: workspace?.path });
  selectedAgentIdRef.current = selectedAgentId;

  // Slash commands
  const {
    commands: slashCommands,
    execute: executeSlashCommand,
  } = useSlashCommands({
    workspacePath: workspace?.path,
    agentId: selectedAgentId || undefined,
  });

  // Notifications
  const { notifyAIResponse, notifyChatError } = useChatNotifications();

  // Current conversation/agent
  const currentConversation = conversations.find((c) => c.id === selectedConversationId);
  const currentAgent = agents.find((a) => a.id === selectedAgentId);
  const currentChatListAgent = chatListAgents.find((a) => a.id === selectedAgentId);

  const currentAgentConfig = currentAgent ? {
    name: currentAgent.name,
    model: currentAgent.model,
    provider: currentAgent.provider,
    system_prompt: currentAgent.system_prompt,
    append_prompt: currentAgent.append_prompt,
    temperature: currentAgent.temperature,
    max_tokens: currentAgent.max_tokens,
    executor_type: currentAgent.executor_type,
    mcp_servers: currentAgent.mcp_servers,
    skills: currentAgent.skills,
    plan_mode: currentAgent.plan_mode,
    approvals: currentAgent.approvals,
  } : undefined;

  const sandboxConfig = useChatConfigStore((state) => state.sandboxConfig);

  // Agent conversation
  const {
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    pendingExecApproval,
    artifacts,
    toolUsages,
    error,
    sendMessage,
    steerMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    approveExec,
    cancel,
    clearMessages,
    loadMessages,
    gatewayConnected,
    connectionStatus,
    contextUsage,
    checkGatewayConnection,
    commandQueue,
  } = useAgentConversation(workspace?.path || "", {
    agentConfigPath: currentAgent?.config_path,
    agentDir: currentAgent?.agent_dir,
    agentConfig: currentAgent?.config_path ? undefined : currentAgentConfig,
    sessionId: selectedConversationId || undefined,
    sandboxConfig,
    useWebSocket: currentAgent?.executor_type === "OPENCLAW",
  });

  // Debug log
  useEffect(() => {
    console.log("[WorkspaceChat] messages changed:", messages.length, "isStreaming:", isStreaming, "phase:", phase);
    console.log("[WorkspaceChat] selectedConversationId:", selectedConversationId, "isGroupChatMode:", selectedGroupChatId !== null);
    if (messages.length > 0) {
      console.log("[WorkspaceChat] Last message:", messages[messages.length - 1]);
    }
  }, [messages, isStreaming, phase, selectedConversationId, selectedGroupChatId]);

  // Group notifications
  const { notifyGroupMessage, notifyMemberJoined, notifyMemberLeft } = useGroupNotifications();

  // Group chat hook
  const {
    groupChats,
    currentGroupChat,
    sessions: groupChatSessions,
    currentSession: currentGroupChatSession,
    messages: groupChatMessages,
    members: groupChatMembers,
    typingMembers,
    thinkingAgents,
    sessionAgents,
    viewMode: groupChatViewMode,
    viewAgentId: groupChatViewAgentId,
    isConnected: groupChatConnected,
    isLoading: isLoadingGroupChat,
    error: groupChatError,
    loadGroupChats,
    createGroupChat,
    loadGroupChat,
    updateGroupChat,
    deleteGroupChat,
    loadSessions: loadGroupChatSessions,
    createSession: createGroupChatSession,
    selectSession: selectGroupChatSession,
    addMember: addGroupChatMember,
    removeMember: removeGroupChatMember,
    sendMessage: sendGroupChatMessage,
    switchView: switchGroupChatView,
    sendTyping,
    setWorkspacePath: setGroupChatWorkspacePath,
  } = useGroupChat(selectedGroupChatId || undefined, selectedGroupSessionId || undefined, {
    userId: "user-1",
    userDisplayName: t("common.you"),
    workspacePath: workspace?.path,
    autoConnect: true,
    notificationCallbacks: {
      onNewMessage: (groupId, groupName, message, currentUserId) => {
        notifyGroupMessage(groupId, groupName, message, currentUserId);
      },
      onMemberJoined: (groupId, groupName, member) => {
        notifyMemberJoined(groupId, groupName, member);
      },
      onMemberLeft: (groupId, groupName, memberId, memberName) => {
        notifyMemberLeft(groupId, groupName, memberId, memberName);
      },
    },
  });

  useEffect(() => {
    if (workspace?.path) setGroupChatWorkspacePath(workspace.path);
  }, [workspace?.path, setGroupChatWorkspacePath]);

  useEffect(() => {
    if (workspace?.path) loadGroupChats({ workspace_path: workspace.path, include_global: true });
  }, [workspace?.path, loadGroupChats]);

  const isGroupChatMode = selectedGroupChatId !== null;

  // ========== Notification Effects ==========
  const prevPhaseRef = useRef<string | null>(null);
  const prevErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevPhaseRef.current === "running" && phase === "completed") {
      const lastAssistantMessage = [...messages].reverse().find(
        (m) => m.type === "text" || m.type === "result"
      );
      if (lastAssistantMessage && lastAssistantMessage.content) {
        const agentName = currentAgent?.name || t("chat.defaultAgent");
        notifyAIResponse(agentName, lastAssistantMessage.content, {
          agentId: selectedAgentId || undefined,
          workspaceId: workspaceId,
          sessionId: selectedConversationId || undefined,
        });
      }
    }
    prevPhaseRef.current = phase;
  }, [phase, messages, currentAgent, selectedAgentId, workspaceId, selectedConversationId, notifyAIResponse, t]);

  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      notifyChatError(error, currentAgent?.name);
    }
    prevErrorRef.current = error;
  }, [error, currentAgent, notifyChatError]);

  // Auto-expand sidebar
  useEffect(() => {
    if (isStreaming) return;
    if (!selectedConversationId && !selectedGroupChatId && !selectedSidebarExecutorId) return;
    if (hasAutoExpandedSidebarRef.current) return;

    const hasArtifacts = artifacts.length > 0;
    const hasWorkspace = !!workspace?.path;
    const hasFileOps = messages.some(
      (m) => m.type === "tool_use" && ["Read", "Write", "Edit", "Bash", "Glob"].includes(m.name || "")
    );
    const hasMcpTools = messages.some((m) => m.type === "tool_use" && (m.name || "").startsWith("mcp__"));
    const hasSkills = messages.some((m) => m.type === "tool_use" && m.name === "Skill");
    const hasContent = hasArtifacts || (hasWorkspace && hasFileOps) || hasMcpTools || hasSkills;

    if (hasContent) {
      setIsSidebarOpen(true);
      hasAutoExpandedSidebarRef.current = true;
    }
  }, [artifacts.length, messages, workspace?.path, isStreaming, selectedConversationId, selectedGroupChatId, selectedSidebarExecutorId]);

  useEffect(() => {
    hasAutoExpandedSidebarRef.current = false;
  }, [selectedConversationId, selectedGroupChatId, selectedSidebarExecutorId]);

  // ========== Session Loading ==========
  const isLoadingRef = useRef(false);

  const refreshAgentSessions = useCallback(async () => {
    if (!selectedAgentId || isLoadingRef.current) return;
    setIsLoadingSessions(true);
    setSessionsError(null);
    try {
      const client = getGatewayClient();
      const isReachable = await client.ping();
      if (!isReachable) return;
      const sessions = await client.listAgentSessions(selectedAgentId, workspace?.path);
      const validSessions = sessions.filter(s => s && s.id);
      const convs = validSessions.map(fileSessionToConversation);
      convs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setConversations(convs);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to refresh sessions:", error);
      setSessionsError(error instanceof Error ? error.message : t("errors.sessions.refreshFailed"));
    } finally {
      setIsLoadingSessions(false);
    }
  }, [selectedAgentId, workspace?.path, t]);

  // Restore last agent
  const hasInitializedAgentRef = useRef(false);
  useEffect(() => {
    if (hasInitializedAgentRef.current) return;
    if (!workspaceId || agents.length === 0) return;
    hasInitializedAgentRef.current = true;
    const lastAgentId = loadLastAgentId(workspaceId);
    if (lastAgentId && agents.some((a) => a.id === lastAgentId)) {
      setSelectedAgentId(lastAgentId);
    } else {
      setSelectedAgentId(defaultAgentId || agents[0].id);
    }
  }, [workspaceId, agents, defaultAgentId, setSelectedAgentId]);

  // Load sessions on agent change
  const prevAgentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedAgentId) return;
    if (agents.length === 0) return;
    if (!agents.some((a) => a.id === selectedAgentId)) return;
    if (isLoadingRef.current) return;
    if (prevAgentRef.current === selectedAgentId) return;

    const isAgentSwitch = prevAgentRef.current !== null;
    isLoadingRef.current = true;
    prevAgentRef.current = selectedAgentId;
    const targetAgentId = selectedAgentId;

    const loadAndSelect = async () => {
      if (isAgentSwitch) {
        setSelectedConversationId(null);
        setConversations([]);
      }
      setIsLoadingSessions(true);
      setSessionsError(null);
      try {
        const client = getGatewayClient();
        const isReachable = await client.ping();
        if (prevAgentRef.current !== targetAgentId) return;
        if (!isReachable) { setConversations([]); return; }

        const sessions = await client.listAgentSessions(targetAgentId, workspace?.path);
        if (prevAgentRef.current !== targetAgentId) return;

        const validSessions = sessions.filter(s => s && s.id);
        const convs = validSessions.map(fileSessionToConversation);
        convs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        if (convs.length > 0) {
          setConversations(convs);
          setSelectedConversationId(convs[0].id);
        } else {
          setConversations([]);
        }
      } catch (error) {
        console.error("[WorkspaceChat] Failed to load sessions:", error);
        setSessionsError(error instanceof Error ? error.message : t("errors.sessions.loadFailed"));
        setConversations([]);
      } finally {
        setIsLoadingSessions(false);
        isLoadingRef.current = false;
      }
    };
    loadAndSelect();
  }, [selectedAgentId, agents, workspace?.path, t]);

  // Persist selections
  useEffect(() => {
    if (workspaceId && selectedConversationId) saveLastSessionId(workspaceId, selectedConversationId);
  }, [workspaceId, selectedConversationId]);

  useEffect(() => {
    if (workspaceId && selectedAgentId) saveLastAgentId(workspaceId, selectedAgentId);
  }, [workspaceId, selectedAgentId]);

  // Navigate back if workspace not found
  useEffect(() => {
    if (!isLoadingWorkspace && !workspace && workspaceId) {
      openWorkspaceHome(workspaceId);
    }
  }, [isLoadingWorkspace, openWorkspaceHome, workspace, workspaceId]);

  // Load messages on session change
  const prevSessionRef = useRef<string | null>(null);
  const isLoadingMessagesRef = useRef(false);

  useEffect(() => {
    if (!selectedConversationId || !selectedAgentId) {
      prevSessionRef.current = null;
      return;
    }
    if (prevSessionRef.current === selectedConversationId) return;
    if (isLoadingMessagesRef.current) return;

    prevSessionRef.current = selectedConversationId;
    isLoadingMessagesRef.current = true;
    const agentId = selectedAgentId;
    const sessionId = selectedConversationId;

    const loadSessionMessages = async () => {
      try {
        const client = getGatewayClient();
        const uiMessages = await client.listSessionUIMessages(agentId, sessionId, workspace?.path);
        if (prevSessionRef.current !== sessionId) return;

        if (uiMessages.length > 0) {
          const agentMessages = uiMessages
            .map(uiMessageToAgentMessage)
            .filter((msg): msg is AgentMessage => msg !== null);

          // Extract SDK session ID for resume - REST API returns snake_case (sdk_session_id)
          const sdkSessionMsg = uiMessages
            .filter((msg) => msg.type === "sdk_session")
            .pop();
          const savedSdkSessionId = sdkSessionMsg?.sdkSessionId || sdkSessionMsg?.sdk_session_id;

          loadMessages(agentMessages, savedSdkSessionId);
        } else {
          clearMessages();
        }
      } catch (error) {
        console.error("[WorkspaceChat] Failed to load messages:", error);
        if (prevSessionRef.current === sessionId) clearMessages();
      } finally {
        isLoadingMessagesRef.current = false;
      }
    };
    loadSessionMessages();
  }, [selectedConversationId, selectedAgentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========== Filtered/Computed ==========
  const filteredGroupChats = useMemo(() => {
    if (!searchQuery.trim()) return groupChats;
    const query = searchQuery.toLowerCase();
    return groupChats.filter(
      (g) => g.name.toLowerCase().includes(query) || (g.description?.toLowerCase().includes(query) ?? false)
    );
  }, [groupChats, searchQuery]);

  const filteredChatListAgents = useMemo(() => {
    if (!searchQuery.trim()) return chatListAgents;
    const query = searchQuery.toLowerCase();
    return chatListAgents.filter(
      (a) => a.name.toLowerCase().includes(query) || (a.description?.toLowerCase().includes(query) ?? false)
    );
  }, [chatListAgents, searchQuery]);

  const filteredExecutors = useMemo(() => {
    if (!searchQuery.trim()) return chatListExecutors;
    const query = searchQuery.toLowerCase();
    return chatListExecutors.filter(
      (e) => e.name.toLowerCase().includes(query) || (e.icon_type?.toLowerCase().includes(query) ?? false)
    );
  }, [chatListExecutors, searchQuery]);

  const agentConversations = useMemo(() => {
    if (!selectedAgentId) return conversations;
    return conversations.filter((c) => c.agentId === selectedAgentId);
  }, [conversations, selectedAgentId]);

  const executorSessionsForSelector = useMemo(() => {
    return executorSessions.map((session) => ({
      id: session.id,
      name: session.name || t("chat.sessionFallbackName", "Session {{id}}", { id: session.id.slice(0, 8) }),
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      messageCount: session.message_count ?? 0,
    }));
  }, [executorSessions]);

  const filteredMessages = useMemo(() => {
    if (!conversationSearchQuery.trim()) return messages;
    const query = conversationSearchQuery.toLowerCase();
    return messages.filter((m) => m.content?.toLowerCase().includes(query));
  }, [messages, conversationSearchQuery]);

  const currentUserGroupRole = useMemo(() => {
    if (!groupChatMembers.length) return undefined;
    const currentUserMember = groupChatMembers.find(
      (m) => m.member_type === "human" && m.member_id === "user-1"
    );
    return currentUserMember?.role;
  }, [groupChatMembers]);

  // ========== Handlers ==========
  const openCreateAgentDialog = (template?: AgentResponse | null) => {
    setSelectedAgentTemplate(template || null);
    setNewAgentName(template ? template.name : "");
    setNewAgentDescription(template?.description || "");
    setCreateAgentLocation("workspace");
    setIsCreateAgentDialogOpen(true);
  };

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    setCreatingAgent(true);
    const isWorkspaceAgent = createAgentLocation === "workspace" && workspace?.path;
    try {
      const newAgent = await createAgent({
        name: newAgentName.trim(),
        description: newAgentDescription.trim() || undefined,
        base_path: isWorkspaceAgent ? workspace.path : undefined,
        from_template: selectedAgentTemplate?.id,
      });
      await refreshChatList();
      setIsCreateAgentDialogOpen(false);
      setNewAgentName("");
      setNewAgentDescription("");
      setSelectedAgentTemplate(null);
      setSelectedAgentId(newAgent.id);
      setSelectedGroupChatId(null);
      setSelectedGroupSessionId(null);
      setSelectedSidebarExecutorId(null);
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!workspaceId || !selectedAgentId) return;
    try {
      const client = getGatewayClient();
      const agent = agents.find((a) => a.id === selectedAgentId);
      const agentConfigSnapshot = agent ? {
        id: agent.id, name: agent.name, description: agent.description,
        model: agent.model, provider: agent.provider, system_prompt: agent.system_prompt,
        temperature: agent.temperature, max_tokens: agent.max_tokens,
        plan_mode: agent.plan_mode, approvals: agent.approvals,
      } : undefined;

      const newSession = await client.createAgentSession(selectedAgentId, {
        prompt: t("chat.newConversation") + (agent ? ` - ${agent.name}` : ""),
        agent_config_path: agent?.config_path,
        agent_config: agentConfigSnapshot,
        workspace_path: workspace?.path,
      });
      const newConversation = fileSessionToConversation(newSession);
      setConversations([newConversation, ...conversations]);
      setSelectedConversationId(newConversation.id);
      clearMessages();
    } catch (error) {
      console.error("[WorkspaceChat] Failed to create session:", error);
      const agent = agents.find((a) => a.id === selectedAgentId);
      const newConversation: Conversation = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        title: t("chat.newConversation") + (agent ? ` - ${agent.name}` : ""),
        agentId: selectedAgentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      };
      setConversations([newConversation, ...conversations]);
      setSelectedConversationId(newConversation.id);
      clearMessages();
    }
  };

  const handleArtifactSelect = useCallback((artifact: Artifact) => {
    setHighlightedArtifactId(artifact.id);
    if (artifact.sourceMessageId) setHighlightedMessageId(artifact.sourceMessageId);
    setIsSidebarOpen(true);
    setTimeout(() => { setHighlightedArtifactId(null); setHighlightedMessageId(null); }, 3000);
  }, []);

  const handleArtifactMessageClick = useCallback((messageId: string) => {
    const sourceArtifact = artifacts.find((a) => a.sourceMessageId === messageId);
    if (sourceArtifact) setHighlightedArtifactId(sourceArtifact.id);
    setHighlightedMessageId(messageId);
    setTimeout(() => { setHighlightedArtifactId(null); setHighlightedMessageId(null); }, 3000);
  }, [artifacts]);

  const handleRenameSession = (sessionId: string, newTitle: string) => {
    if (!workspaceId) return;
    setConversations(conversations.map((c) =>
      c.id === sessionId ? { ...c, title: newTitle, updatedAt: new Date().toISOString() } : c
    ));
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!workspaceId || !selectedAgentId) return;
    try {
      const client = getGatewayClient();
      await client.deleteAgentSession(selectedAgentId, sessionId);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to delete session:", error);
    }
    const updated = conversations.filter((c) => c.id !== sessionId);
    setConversations(updated);
    if (selectedConversationId === sessionId) {
      setSelectedConversationId(updated.length > 0 ? updated[0].id : null);
      clearMessages();
    }
  };

  const handlePinSession = (sessionId: string) => {
    if (!workspaceId) return;
    const updated = conversations.map((c) =>
      c.id === sessionId ? { ...c, isPinned: !c.isPinned, updatedAt: new Date().toISOString() } : c
    );
    updated.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    setConversations(updated);
  };

  const handleArchiveSession = (sessionId: string) => {
    if (!workspaceId) return;
    const updated = conversations.map((c) =>
      c.id === sessionId ? { ...c, isArchived: true } : c
    );
    setConversations(updated);
    if (selectedConversationId === sessionId) {
      const remaining = updated.filter((c) => !c.isArchived);
      setSelectedConversationId(remaining.length > 0 ? remaining[0].id : null);
      clearMessages();
    }
  };

  const handleStarSession = (sessionId: string) => {
    if (!workspaceId) return;
    setConversations(conversations.map((c) =>
      c.id === sessionId ? { ...c, isStarred: !c.isStarred } : c
    ));
  };

  const handleDuplicateSession = async (sessionId: string) => {
    if (!workspaceId || !selectedAgentId) return;
    const original = conversations.find((c) => c.id === sessionId);
    if (!original) return;
    try {
      const client = getGatewayClient();
      const agent = agents.find((a) => a.id === selectedAgentId);
      const agentConfigSnapshot = agent ? {
        id: agent.id, name: agent.name, description: agent.description,
        model: agent.model, provider: agent.provider, system_prompt: agent.system_prompt,
        temperature: agent.temperature, max_tokens: agent.max_tokens,
        plan_mode: agent.plan_mode, approvals: agent.approvals,
      } : undefined;

      const newSession = await client.createAgentSession(selectedAgentId, {
        prompt: t("chat.copyName", { name: original.title }),
        agent_config_path: agent?.config_path,
        agent_config: agentConfigSnapshot,
        workspace_path: workspace?.path,
      });
      const duplicate = fileSessionToConversation(newSession);
      setConversations([duplicate, ...conversations]);
      setSelectedConversationId(duplicate.id);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to duplicate session:", error);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!workspaceId || !selectedConversationId) {
      await handleCreateConversation();
    }
    if (selectedAgentId && selectedConversationId) {
      try {
        const client = getGatewayClient();
        await client.appendSessionMessage(selectedAgentId, selectedConversationId, {
          role: "user", content: message,
        });
      } catch (error) {
        console.error("[WorkspaceChat] Failed to save message:", error);
      }
    }
    await sendMessage(message);
    if (selectedConversationId) {
      setConversations(conversations.map((c) =>
        c.id === selectedConversationId
          ? { ...c, lastMessage: message.slice(0, 100), messageCount: c.messageCount + 1, updatedAt: new Date().toISOString() }
          : c
      ));
    }
  };

  const handleSlashCommand = useCallback(
    async (command: SlashCommand) => {
      const context: CommandContext = {
        sessionId: selectedConversationId || undefined,
        messages: messages.map((m) => ({
          role: m.type === "user" ? "user" : "assistant",
          content: typeof m.content === "string" ? m.content : "",
        })),
        clearMessages,
        sendMessage: handleSendMessage,
        workspacePath: workspace?.path,
        agentId: selectedAgentIdRef.current || undefined,
        currentModel: currentAgent?.model,
        setModel: undefined,
        openDialog: (name, _props) => {
          switch (name) {
            case "command-help":
              toast.info(
                t("commands.helpAvailable", "{{count}} commands available. Type / to browse.", { count: slashCommands.length }),
                { description: t("commands.helpTip", "Use ↑↓ to navigate, Enter to select") }
              );
              break;
            case "login":
              navigate("/login");
              break;
            default:
              console.warn(`Unknown dialog: ${name}`);
          }
        },
        showToast: (message, type) => {
          if (type === "error") toast.error(message);
          else if (type === "success") toast.success(message);
          else toast.info(message);
        },
        navigate: navigateWithinDesktop,
        t,
      };

      const result = await executeSlashCommand(command, context);
      if (result) {
        if (result.type === "message" && result.content) {
          const description = typeof result.content === "string" ? result.content : t("chat.commandExecuted");
          toast.info(description, { description: `/${command.name}` });
        } else if (result.type === "prompt" && result.prompt) {
          handleSendMessage(result.prompt);
        } else if (result.type === "action" && result.toast) {
          if (result.toast.type === "error") toast.error(result.toast.message);
          else toast.success(result.toast.message);
        } else if (result.type === "ui") {
          if (result.dialog) context.openDialog(result.dialog.name, result.dialog.props);
          if (result.navigateTo) {
            openPath(result.navigateTo, {
              title: result.navigateTo,
            });
          }
        }
      }
    },
    [selectedConversationId, messages, clearMessages, handleSendMessage, workspace?.path, currentAgent?.model, executeSlashCommand, navigateWithinDesktop, openPath, t, toast, slashCommands.length]
  );

  const handleClearMessages = () => {
    clearMessages();
    if (selectedConversationId && workspaceId) {
      setConversations(conversations.map((c) =>
        c.id === selectedConversationId
          ? { ...c, messageCount: 0, lastMessage: undefined, updatedAt: new Date().toISOString() }
          : c
      ));
    }
    setIsClearDialogOpen(false);
  };

  const handleArchiveConversation = () => {
    if (!workspaceId || !selectedConversationId) return;
    const updated = conversations.map((c) =>
      c.id === selectedConversationId ? { ...c, isArchived: true } : c
    );
    setConversations(updated);
    const remaining = updated.filter((c) => !c.isArchived);
    setSelectedConversationId(remaining.length > 0 ? remaining[0].id : null);
    clearMessages();
  };

  const handleExportConversation = () => {
    if (!currentConversation) return;
    const exportData = {
      title: currentConversation.title,
      agent: currentAgent?.name || t("chat.defaultAgent", "Default Agent"),
      createdAt: currentConversation.createdAt,
      messages: messages.map((m) => ({ type: m.type, content: m.content })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentConversation.title.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExportDialogOpen(false);
  };

  const handleShareConversation = () => {
    if (!currentConversation) return;
    const shareText = messages
      .map((m) => `${m.type === "user" ? t("chat.you") : currentAgent?.name || t("chat.defaultAgentName", "Agent")}: ${m.content}`)
      .join("\n\n");
    navigator.clipboard.writeText(shareText);
    setIsShareDialogOpen(false);
  };

  // Group chat handlers
  const handleCreateGroupChat = async (data: {
    name: string;
    description?: string;
    initial_members: Array<{
      member_type: "human" | "agent";
      member_id: string;
      display_name: string;
      role?: "owner" | "admin" | "member";
      model?: string;
    }>;
  }) => {
    setIsCreatingGroupChat(true);
    try {
      const members = data.initial_members.map((m) => ({
        type: m.member_type,
        member_id: m.member_id,
        display_name: m.display_name,
        role: m.role,
        model: m.model,
      }));
      const result = await createGroupChat({ name: data.name, description: data.description, members });
      setSelectedGroupChatId(result.group_chat.id);
      setSelectedConversationId(null);
      setIsCreateGroupDialogOpen(false);
      if (result.group_chat.id) {
        try {
          const session = await createGroupChatSession(result.group_chat.id, t("groupChat.initialSession", "Initial Session"));
          setSelectedGroupSessionId(session.id);
        } catch (err) {
          console.error("[WorkspaceChat] Failed to create initial session:", err);
        }
      }
    } catch (error) {
      console.error("[WorkspaceChat] Failed to create group chat:", error);
      throw error;
    } finally {
      setIsCreatingGroupChat(false);
    }
  };

  const handleSelectGroupChat = async (groupChatId: string) => {
    setSelectedGroupChatId(groupChatId);
    setSelectedConversationId(null);
    setSelectedGroupSessionId(null);
    await loadGroupChat(groupChatId);
    await loadGroupChatSessions(groupChatId);
    if (groupChatSessions.length > 0) setSelectedGroupSessionId(groupChatSessions[0].id);
  };

  const handleSendGroupChatMessage = async (content: string) => {
    if (!selectedGroupChatId || !selectedGroupSessionId || !content.trim()) return;
    try { await sendGroupChatMessage(content); } catch (error) {
      console.error("[WorkspaceChat] Failed to send group chat message:", error);
    }
  };

  const handleDeleteGroupChat = async (groupChatId: string) => {
    try {
      await deleteGroupChat(groupChatId);
      if (selectedGroupChatId === groupChatId) {
        setSelectedGroupChatId(null);
        setSelectedGroupSessionId(null);
      }
    } catch (error) {
      console.error("[WorkspaceChat] Failed to delete group chat:", error);
    }
  };

  const handleLeaveGroupChat = async () => {
    if (!selectedGroupChatId) return;
    try {
      await removeGroupChatMember("user-1");
      setSelectedGroupChatId(null);
      setSelectedGroupSessionId(null);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to leave group chat:", error);
    }
  };

  const handleCreateGroupChatSession = async () => {
    if (!selectedGroupChatId) return;
    try {
      const session = await createGroupChatSession(selectedGroupChatId, t("groupChat.sessionNumber", "Session {{number}}", { number: groupChatSessions.length + 1 }));
      setSelectedGroupSessionId(session.id);
    } catch (error) {
      console.error("[WorkspaceChat] Failed to create group chat session:", error);
    }
  };

  const handleSelectGroupChatSession = (sessionId: string) => {
    setSelectedGroupSessionId(sessionId);
    selectGroupChatSession(sessionId);
  };

  const handleSwitchGroupChatView = (view: "ui" | "agent", agentId?: string) => {
    switchGroupChatView(view, agentId);
  };

  const handleRenameGroupChat = async (groupChatId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await updateGroupChat(groupChatId, { name: newName.trim() });
      setRenameGroupChatId(null);
      setRenameGroupChatName("");
    } catch (error) {
      console.error("[WorkspaceChat] Failed to rename group chat:", error);
    }
  };

  const handleToggleMuteGroupChat = (groupChatId: string) => {
    setMutedGroupChats((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupChatId)) newSet.delete(groupChatId);
      else newSet.add(groupChatId);
      return newSet;
    });
  };

  const handleOpenRenameDialog = (groupChatId: string, currentName: string) => {
    setRenameGroupChatId(groupChatId);
    setRenameGroupChatName(currentName);
  };

  const handleAddGroupChatMember = async (member: {
    type: MemberType;
    member_id: string;
    display_name: string;
    role?: MemberRole;
    model?: string;
  }) => {
    try { await addGroupChatMember(member); } catch (error) {
      console.error("[WorkspaceChat] Failed to add member:", error);
      throw error;
    }
  };

  const handleRemoveGroupChatMember = async (memberId: string) => {
    try { await removeGroupChatMember(memberId); } catch (error) {
      console.error("[WorkspaceChat] Failed to remove member:", error);
      throw error;
    }
  };

  const handleNavigateToAgentSettings = () => {
    const targetAgentId = selectedAgentId || currentAgent?.id;
    if (targetAgentId && workspaceId) {
      if (isExecutorType(targetAgentId)) {
        openWorkspaceExecutorDetail(workspaceId, targetAgentId);
      } else {
        openWorkspaceAgentDetail(workspaceId, targetAgentId);
      }
    }
  };

  const handleOpenSessionFolder = async () => {
    if (!selectedConversationId) return;
    const agentId = selectedAgentId || currentAgent?.id;
    if (!agentId) return;

    const possiblePaths: string[] = [];
    if (currentAgent?.config_path) {
      const agentDir = currentAgent.config_path.replace(/\/config\.yaml$/, "");
      possiblePaths.push(`${agentDir}/.agent_sessions/${selectedConversationId}/config.yaml`);
    }
    const home = await homeDir();
    possiblePaths.push(`${home}/.viben/agents/${agentId}/.agent_sessions/${selectedConversationId}/config.yaml`);

    for (const sessionPath of possiblePaths) {
      try {
        await revealItemInDir(sessionPath);
        return;
      } catch (err) {
        const errorMsg = String(err);
        if (errorMsg.includes("No such file") || errorMsg.includes("os error 2")) continue;
        console.error("[WorkspaceChat] Error opening path:", sessionPath, err);
      }
    }
    console.error("[WorkspaceChat] Session not found at any path");
  };

  // ========== Return ==========
  return {
    // Route params
    workspaceId,
    navigate,
    t,

    // Workspace
    workspace,
    isLoadingWorkspace,

    // UI State
    isSidebarOpen, setIsSidebarOpen,
    searchQuery, setSearchQuery,
    leftPanelWidth, handleLeftPanelResize,
    rightPanelWidth, handleRightPanelResize,
    isLeftPanelCollapsed, setIsLeftPanelCollapsed,
    leftPanelScrollRef,
    leftPanelContentStyle,

    // Dialog states
    isSearchDialogOpen, setIsSearchDialogOpen,
    isHistoryDialogOpen, setIsHistoryDialogOpen,
    isExportDialogOpen, setIsExportDialogOpen,
    isGroupDialogOpen, setIsGroupDialogOpen,
    isShareDialogOpen, setIsShareDialogOpen,
    isClearDialogOpen, setIsClearDialogOpen,
    isCreateAgentDialogOpen, setIsCreateAgentDialogOpen,
    isCreateGroupDialogOpen, setIsCreateGroupDialogOpen,
    conversationSearchQuery, setConversationSearchQuery,

    // Create agent dialog
    selectedAgentTemplate,
    newAgentName, setNewAgentName,
    newAgentDescription, setNewAgentDescription,
    creatingAgent,
    createAgentLocation, setCreateAgentLocation,
    globalVibenPath,

    // Conversations
    conversations,
    selectedConversationId, setSelectedConversationId,
    isLoadingSessions,
    currentConversation,
    agentConversations,

    // Agent
    agents,
    selectedAgentId, setSelectedAgentId,
    currentAgent,
    currentChatListAgent,
    defaultAgentId,
    setDefaultAgent,
    updateAgent,
    removeAgent,
    agentTemplates,
    agentModelsForPanel,

    // Chat list
    chatListAgents,
    chatListExecutors,
    filteredChatListAgents,
    filteredExecutors,
    filteredGroupChats,
    isLoadingExecutors,
    loadExecutors,

    // Agent conversation
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    pendingExecApproval,
    artifacts,
    toolUsages,
    error,
    approvePlan,
    rejectPlan,
    answerQuestions,
    approveExec,
    cancel,
    clearMessages,
    gatewayConnected,
    connectionStatus,
    contextUsage,
    checkGatewayConnection,
    commandQueue,

    // Executor
    selectedSidebarExecutorId, setSelectedSidebarExecutorId,
    selectedExecutorSessionId, setSelectedExecutorSessionId,
    selectedSidebarExecutor,
    executorSessions,
    executorSessionsForSelector,
    isLoadingExecutorSessions,
    refreshExecutorSessions,
    executorMessagesAsAgentMessages,
    isLoadingExecutorMessages,
    executorModels,
    selectedExecutorModelId, setSelectedExecutorModelId,
    executorSessionStats,

    // Group Chat
    selectedGroupChatId, setSelectedGroupChatId,
    selectedGroupSessionId, setSelectedGroupSessionId,
    isGroupChatMode,
    groupChats,
    currentGroupChat,
    groupChatSessions,
    currentGroupChatSession,
    groupChatMessages,
    groupChatMembers,
    typingMembers,
    thinkingAgents,
    sessionAgents,
    groupChatViewMode,
    groupChatViewAgentId,
    groupChatConnected,
    isLoadingGroupChat,
    groupChatError,
    groupChatInput, setGroupChatInput,
    isMembersDialogOpen, setIsMembersDialogOpen,
    renameGroupChatId, setRenameGroupChatId,
    renameGroupChatName, setRenameGroupChatName,
    mutedGroupChats,
    isCreatingGroupChat,
    currentUserGroupRole,
    addGroupChatMember,
    removeGroupChatMember,
    updateGroupChat,
    deleteGroupChat,
    sendTyping,

    // Right sidebar
    detailAgentId, setDetailAgentId,
    rightSidebarExecutorDetail, setRightSidebarExecutorDetail,
    rightSidebarAgentDetail,
    isLoadingDetailAgent,
    highlightedArtifactId,
    highlightedMessageId,

    // Tasks
    tasks,
    isTasksLoading,

    // Live preview
    livePreviewUrl,
    livePreviewStatus,
    livePreviewError,
    isNodeAvailable,
    handleStartLivePreview,
    stopPreview,

    // Slash commands
    slashCommands,

    // Filtered
    filteredMessages,

    // Handlers
    openCreateAgentDialog,
    handleCreateAgent,
    handleCreateConversation,
    handleArtifactSelect,
    handleArtifactMessageClick,
    handleRenameSession,
    handleDeleteSession,
    handlePinSession,
    handleArchiveSession,
    handleStarSession,
    handleDuplicateSession,
    handleSendMessage,
    steerMessage,
    handleSlashCommand,
    handleClearMessages,
    handleArchiveConversation,
    handleExportConversation,
    handleShareConversation,
    handleNavigateToAgentSettings,
    handleOpenSessionFolder,
    refreshAgentSessions,

    // Group chat handlers
    handleCreateGroupChat,
    handleSelectGroupChat,
    handleSendGroupChatMessage,
    handleDeleteGroupChat,
    handleLeaveGroupChat,
    handleCreateGroupChatSession,
    handleSelectGroupChatSession,
    handleSwitchGroupChatView,
    handleRenameGroupChat,
    handleToggleMuteGroupChat,
    handleOpenRenameDialog,
    handleAddGroupChatMember,
    handleRemoveGroupChatMember,
  };
}
