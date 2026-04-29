import { motion, useReducedMotion } from "framer-motion";
import {
  PanelRightClose,
  PanelRightOpen,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isExecutorType, buildWorkspaceUrl } from "@/hooks";
import { WorkspaceHeader } from "@/components/workspace";
import {
  RightSidebar,
  CreateGroupChatDialog,
  GroupChatMembersDialog,
} from "./components";
import { LeftPanel } from "./components/left-panel";
import { AgentChatView } from "./components/agent-chat-view";
import { ExecutorChatView } from "./components/executor-chat-view";
import { GroupChatView } from "./components/group-chat-view";
import {
  SearchDialog,
  HistoryDialog,
  ExportDialog,
  GroupDialog,
  ShareDialog,
  ClearMessagesDialog,
  CreateAgentDialog,
  RenameGroupChatDialog,
} from "./components/chat-dialogs";
import { useWorkspaceChat } from "./hooks/use-workspace-chat";

// ============================================================================
// Main Component
// ============================================================================

export function WorkspaceChatPage() {
  const prefersReducedMotion = useReducedMotion();
  const chat = useWorkspaceChat();

  const {
    workspaceId,
    navigate,
    t,
    workspace,
    isLoadingWorkspace,
  } = chat;

  if (isLoadingWorkspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  // Share text for share dialog
  const shareText = chat.messages
    .map((m) => `${m.type === "user" ? t("chat.you") : chat.currentAgent?.name || t("chat.defaultAgentName", "Agent")}: ${m.content}`)
    .join("\n\n");

  return (
    <motion.div
      initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      className="flex h-full flex-col overflow-hidden"
    >
      {/* Header */}
      <WorkspaceHeader
        workspace={workspace}
        segments={[{ label: t("chat.title"), href: `/workspace/${workspaceId}/chat` }]}
        showRefresh={false}
        showRemove={false}
        rightContent={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => chat.setIsSidebarOpen(!chat.isSidebarOpen)}
            className="h-8"
          >
            {chat.isSidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        }
      />

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Panel */}
        <LeftPanel
          isCollapsed={chat.isLeftPanelCollapsed}
          onCollapse={chat.setIsLeftPanelCollapsed}
          width={chat.leftPanelWidth}
          onResize={chat.handleLeftPanelResize}
          scrollRef={chat.leftPanelScrollRef}
          contentStyle={chat.leftPanelContentStyle}
          searchQuery={chat.searchQuery}
          onSearchChange={chat.setSearchQuery}
          filteredGroupChats={chat.filteredGroupChats}
          selectedGroupChatId={chat.selectedGroupChatId}
          mutedGroupChats={chat.mutedGroupChats}
          workspacePath={workspace.path}
          onSelectGroupChat={chat.handleSelectGroupChat}
          onRenameGroupChat={(id, name) => chat.handleOpenRenameDialog(id, name)}
          onToggleMuteGroupChat={chat.handleToggleMuteGroupChat}
          onDeleteGroupChat={chat.handleDeleteGroupChat}
          onLeaveGroupChat={chat.handleLeaveGroupChat}
          filteredExecutors={chat.filteredExecutors}
          selectedSidebarExecutorId={chat.selectedSidebarExecutorId}
          isLoadingExecutors={chat.isLoadingExecutors}
          onSelectExecutor={(executor) => {
            chat.setSelectedGroupChatId(null);
            chat.setSelectedGroupSessionId(null);
            chat.setSelectedAgentId(null);
            chat.setSelectedSidebarExecutorId(executor.id);
          }}
          onExecutorSettings={(executor) => {
            const url = buildWorkspaceUrl(`/executor/${executor.id}`, workspace.path);
            navigate(url);
          }}
          onRefreshExecutors={chat.loadExecutors}
          filteredChatListAgents={chat.filteredChatListAgents}
          selectedAgentId={chat.selectedAgentId}
          isGroupChatMode={chat.isGroupChatMode}
          defaultAgentId={chat.defaultAgentId}
          conversations={chat.conversations}
          onSelectAgent={(agentId) => {
            chat.setSelectedGroupChatId(null);
            chat.setSelectedGroupSessionId(null);
            chat.setSelectedSidebarExecutorId(null);
            chat.setSelectedAgentId(agentId);
          }}
          onAgentSettings={(agentId) => {
            if (workspace.path) {
              const params = `?workspace_path=${encodeURIComponent(workspace.path)}`;
              if (isExecutorType(agentId)) navigate(`/executor/${agentId}${params}`);
              else navigate(`/agent/${agentId}${params}`);
            }
          }}
          onSetDefaultAgent={chat.setDefaultAgent}
          onDeleteAgent={chat.removeAgent}
          agentTemplates={chat.agentTemplates}
          onCreateAgent={chat.openCreateAgentDialog}
          onCreateGroupChat={() => chat.setIsCreateGroupDialogOpen(true)}
          navigate={navigate}
        />

        {/* Middle: Chat Area */}
        <div className="flex flex-1 w-0 flex-col min-w-0 overflow-hidden">
          {chat.isGroupChatMode && chat.currentGroupChat ? (
            <GroupChatView
              currentGroupChat={chat.currentGroupChat}
              groupChatMembers={chat.groupChatMembers}
              groupChatSessions={chat.groupChatSessions}
              currentGroupChatSession={chat.currentGroupChatSession}
              groupChatMessages={chat.groupChatMessages}
              typingMembers={chat.typingMembers}
              thinkingAgents={chat.thinkingAgents}
              sessionAgents={chat.sessionAgents}
              groupChatViewMode={chat.groupChatViewMode}
              groupChatViewAgentId={chat.groupChatViewAgentId}
              groupChatConnected={chat.groupChatConnected}
              isLoadingGroupChat={chat.isLoadingGroupChat}
              groupChatError={chat.groupChatError}
              groupChatInput={chat.groupChatInput}
              selectedGroupSessionId={chat.selectedGroupSessionId}
              onSelectSession={chat.handleSelectGroupChatSession}
              onCreateSession={chat.handleCreateGroupChatSession}
              onSwitchView={chat.handleSwitchGroupChatView}
              onSendMessage={chat.handleSendGroupChatMessage}
              onInputChange={chat.setGroupChatInput}
              onSendTyping={chat.sendTyping}
              onOpenMembersDialog={() => chat.setIsMembersDialogOpen(true)}
            />
          ) : chat.selectedSidebarExecutorId && chat.selectedSidebarExecutor ? (
            <ExecutorChatView
              selectedSidebarExecutor={chat.selectedSidebarExecutor}
              executorSessionsForSelector={chat.executorSessionsForSelector}
              selectedExecutorSessionId={chat.selectedExecutorSessionId}
              isLoadingExecutorSessions={chat.isLoadingExecutorSessions}
              executorMessagesAsAgentMessages={chat.executorMessagesAsAgentMessages}
              isLoadingExecutorMessages={chat.isLoadingExecutorMessages}
              executorModels={chat.executorModels}
              selectedExecutorModelId={chat.selectedExecutorModelId}
              executorSessionStats={chat.executorSessionStats}
              gatewayConnected={chat.gatewayConnected}
              onSelectSession={(sessionId) => chat.setSelectedExecutorSessionId(sessionId)}
              onRefreshSessions={chat.refreshExecutorSessions}
              onModelChange={chat.setSelectedExecutorModelId}
              onCheckGateway={chat.checkGatewayConnection}
              onOpenSearchDialog={() => chat.setIsSearchDialogOpen(true)}
              onExecutorAvatarClick={() => {
                chat.setRightSidebarExecutorDetail({
                  id: chat.selectedSidebarExecutor!.id,
                  name: chat.selectedSidebarExecutor!.name,
                  type: chat.selectedSidebarExecutor!.icon_type || "unknown",
                  config_path: (chat.selectedSidebarExecutor!.metadata?.config_path as string) || undefined,
                });
                chat.setDetailAgentId(null);
                chat.setIsSidebarOpen(true);
              }}
            />
          ) : (
            <AgentChatView
              selectedConversationId={chat.selectedConversationId}
              currentConversation={chat.currentConversation}
              agentConversations={chat.agentConversations}
              conversations={chat.conversations}
              agents={chat.agents}
              selectedAgentId={chat.selectedAgentId}
              currentAgent={chat.currentAgent}
              currentChatListAgent={chat.currentChatListAgent}
              messages={chat.messages}
              phase={chat.phase}
              isStreaming={chat.isStreaming}
              pendingPlan={chat.pendingPlan}
              pendingQuestions={chat.pendingQuestions}
              artifacts={chat.artifacts}
              error={chat.error}
              highlightedMessageId={chat.highlightedMessageId}
              gatewayConnected={chat.gatewayConnected}
              isLoadingSessions={chat.isLoadingSessions}
              slashCommands={chat.slashCommands}
              onSelectSession={(sessionId) => chat.setSelectedConversationId(sessionId)}
              onCreateConversation={chat.handleCreateConversation}
              onRenameSession={chat.handleRenameSession}
              onDeleteSession={chat.handleDeleteSession}
              onPinSession={chat.handlePinSession}
              onArchiveSession={chat.handleArchiveSession}
              onStarSession={chat.handleStarSession}
              onDuplicateSession={chat.handleDuplicateSession}
              onRefreshSessions={chat.refreshAgentSessions}
              onCheckGateway={chat.checkGatewayConnection}
              onSendMessage={chat.handleSendMessage}
              onCancel={chat.cancel}
              onApprovePlan={chat.approvePlan}
              onRejectPlan={chat.rejectPlan}
              onAnswerQuestions={chat.answerQuestions}
              onSlashCommand={chat.handleSlashCommand}
              onArtifactClick={(artifactId) => {
                const artifact = chat.artifacts.find((a) => a.id === artifactId);
                if (artifact) chat.handleArtifactSelect(artifact);
              }}
              onAgentAvatarClick={() => {
                const agentId = chat.selectedAgentId || chat.currentChatListAgent?.id;
                if (agentId) {
                  chat.setDetailAgentId(agentId);
                  chat.setRightSidebarExecutorDetail(null);
                  chat.setIsSidebarOpen(true);
                }
              }}
              onOpenSearchDialog={() => chat.setIsSearchDialogOpen(true)}
              onOpenHistoryDialog={() => chat.setIsHistoryDialogOpen(true)}
              onOpenExportDialog={() => chat.setIsExportDialogOpen(true)}
              onOpenGroupDialog={() => chat.setIsGroupDialogOpen(true)}
              onOpenShareDialog={() => chat.setIsShareDialogOpen(true)}
              onOpenClearDialog={() => chat.setIsClearDialogOpen(true)}
              onNavigateToAgentSettings={chat.handleNavigateToAgentSettings}
              onOpenSessionFolder={chat.handleOpenSessionFolder}
              onArchiveConversation={chat.handleArchiveConversation}
              onAgentSettings={(agentId) => {
                if (workspace.path) {
                  const params = `?workspace_path=${encodeURIComponent(workspace.path)}`;
                  if (isExecutorType(agentId)) navigate(`/executor/${agentId}${params}`);
                  else navigate(`/agent/${agentId}${params}`);
                }
              }}
            />
          )}
        </div>

        {/* Right sidebar */}
        <RightSidebar
          artifacts={chat.artifacts}
          toolUsages={chat.toolUsages}
          messages={chat.messages}
          workingDir={workspace.path}
          isOpen={chat.isSidebarOpen}
          onClose={() => chat.setIsSidebarOpen(false)}
          width={chat.rightPanelWidth}
          onResize={chat.handleRightPanelResize}
          tasks={chat.tasks}
          isTasksLoading={chat.isTasksLoading}
          onTaskClick={(task) => {
            if (workspace.path) navigate(`/workspace/${workspaceId}/kanban?task_id=${task.id}`);
          }}
          highlightedArtifactId={chat.highlightedArtifactId}
          onArtifactSelect={chat.handleArtifactSelect}
          onArtifactMessageClick={chat.handleArtifactMessageClick}
          groupChat={chat.isGroupChatMode && chat.currentGroupChat ? chat.currentGroupChat.group_chat : null}
          groupChatMembers={chat.isGroupChatMode ? chat.groupChatMembers : []}
          availableAgents={chat.agents.map((a) => ({ id: a.id, name: a.name }))}
          currentUserId="user-1"
          currentUserRole={chat.currentUserGroupRole}
          onAddMember={chat.addGroupChatMember}
          onRemoveMember={chat.removeGroupChatMember}
          onUpdateGroupChat={(data) => chat.updateGroupChat(chat.selectedGroupChatId!, data)}
          onLeaveGroupChat={chat.handleLeaveGroupChat}
          onDeleteGroupChat={() => chat.deleteGroupChat(chat.selectedGroupChatId!)}
          isGroupChatLoading={chat.isLoadingGroupChat}
          agentDetail={chat.rightSidebarAgentDetail}
          isAgentDetailLoading={chat.isLoadingDetailAgent}
          executorDetail={chat.rightSidebarExecutorDetail}
          workspacePath={workspace.path}
          onAgentSettings={(agentId) => {
            if (workspace.path) {
              const params = `?workspace_path=${encodeURIComponent(workspace.path)}`;
              navigate(`/agent/${agentId}${params}`);
            }
          }}
          onExecutorSettings={(executorId) => {
            if (workspace.path) {
              const params = `?workspace_path=${encodeURIComponent(workspace.path)}`;
              navigate(`/executor/${executorId}${params}`);
            }
          }}
          isAgentDefault={chat.rightSidebarAgentDetail?.id === chat.defaultAgentId}
          agentModels={chat.agentModelsForPanel}
          onAgentUpdate={async (id, updates) => { await chat.updateAgent(id, updates); }}
          onAgentSetDefault={chat.rightSidebarAgentDetail ? () => {
            chat.setDefaultAgent(chat.rightSidebarAgentDetail!.id);
          } : undefined}
          onAgentDelete={chat.rightSidebarAgentDetail ? () => {
            console.log("[WorkspaceChat] Delete agent:", chat.rightSidebarAgentDetail!.id);
          } : undefined}
          livePreviewUrl={chat.livePreviewUrl}
          livePreviewStatus={chat.livePreviewStatus}
          livePreviewError={chat.livePreviewError}
          isNodeAvailable={chat.isNodeAvailable}
          onStartLivePreview={chat.handleStartLivePreview}
          onStopLivePreview={chat.stopPreview}
        />
      </div>

      {/* Dialogs */}
      <SearchDialog
        open={chat.isSearchDialogOpen}
        onOpenChange={chat.setIsSearchDialogOpen}
        searchQuery={chat.conversationSearchQuery}
        onSearchQueryChange={chat.setConversationSearchQuery}
        filteredMessages={chat.filteredMessages}
        currentAgentName={chat.currentAgent?.name}
      />

      <HistoryDialog
        open={chat.isHistoryDialogOpen}
        onOpenChange={chat.setIsHistoryDialogOpen}
        messages={chat.messages}
        currentAgentName={chat.currentAgent?.name}
      />

      <ExportDialog
        open={chat.isExportDialogOpen}
        onOpenChange={chat.setIsExportDialogOpen}
        conversationTitle={chat.currentConversation?.title}
        messageCount={chat.messages.length}
        onExport={chat.handleExportConversation}
      />

      <GroupDialog
        open={chat.isGroupDialogOpen}
        onOpenChange={chat.setIsGroupDialogOpen}
      />

      <ShareDialog
        open={chat.isShareDialogOpen}
        onOpenChange={chat.setIsShareDialogOpen}
        shareText={shareText}
        onShare={chat.handleShareConversation}
      />

      <ClearMessagesDialog
        open={chat.isClearDialogOpen}
        onOpenChange={chat.setIsClearDialogOpen}
        onClear={chat.handleClearMessages}
      />

      <CreateAgentDialog
        open={chat.isCreateAgentDialogOpen}
        onOpenChange={chat.setIsCreateAgentDialogOpen}
        selectedTemplate={chat.selectedAgentTemplate}
        agentName={chat.newAgentName}
        onAgentNameChange={chat.setNewAgentName}
        agentDescription={chat.newAgentDescription}
        onAgentDescriptionChange={chat.setNewAgentDescription}
        createLocation={chat.createAgentLocation}
        onCreateLocationChange={chat.setCreateAgentLocation}
        workspacePath={workspace.path}
        globalVibenPath={chat.globalVibenPath}
        isCreating={chat.creatingAgent}
        onCreate={chat.handleCreateAgent}
      />

      <CreateGroupChatDialog
        open={chat.isCreateGroupDialogOpen}
        onOpenChange={chat.setIsCreateGroupDialogOpen}
        agents={chat.agents}
        onCreate={chat.handleCreateGroupChat}
        isCreating={chat.isCreatingGroupChat}
      />

      {chat.currentGroupChat && (
        <GroupChatMembersDialog
          open={chat.isMembersDialogOpen}
          onOpenChange={chat.setIsMembersDialogOpen}
          groupChatName={chat.currentGroupChat.group_chat.name}
          members={chat.groupChatMembers}
          currentUserId="user-1"
          currentUserRole={chat.currentUserGroupRole}
          availableAgents={chat.agents.map((a) => ({ id: a.id, name: a.name }))}
          onRemoveMember={chat.handleRemoveGroupChatMember}
          onAddMember={chat.handleAddGroupChatMember}
          isLoading={chat.isLoadingGroupChat}
        />
      )}

      <RenameGroupChatDialog
        open={chat.renameGroupChatId !== null}
        onOpenChange={(open) => {
          if (!open) {
            chat.setRenameGroupChatId(null);
            chat.setRenameGroupChatName("");
          }
        }}
        name={chat.renameGroupChatName}
        onNameChange={chat.setRenameGroupChatName}
        onRename={() => {
          if (chat.renameGroupChatId) {
            chat.handleRenameGroupChat(chat.renameGroupChatId, chat.renameGroupChatName);
          }
        }}
      />
    </motion.div>
  );
}
