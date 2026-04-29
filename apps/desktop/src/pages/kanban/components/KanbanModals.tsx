import {
  BulkActionsBar,
  CommandPalette,
  BoardSettingsDialog,
} from "@viben/kanban";
import {
  TaskDetailDialog,
  CreateTaskDialog,
} from "@/components/workspace";
import { QueueSettingsModal } from "@/components/workspace/kanban/queue-settings-modal";
import type { UseKanbanBoardReturn } from "../hooks/useKanbanBoard";

interface KanbanModalsProps {
  board: UseKanbanBoardReturn;
}

export function KanbanModals({ board }: KanbanModalsProps) {
  const {
    t,
    workspace,
    sortedTasks,
    columnStatuses,
    selectedCount,
    selectAll,
    clearSelection,
    handleBulkStatusChange,
    handleBulkDelete,
    // Command palette
    commands,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    // Create task dialog
    createDialogOpen,
    setCreateDialogOpen,
    handleCreateTaskSubmit,
    createDialogColumnId,
    createTask,
    availableAgents,
    availableModels,
    defaultAgentId,
    defaultModelId,
    isLoadingAgents,
    isLoadingModels,
    // Task detail dialog
    isPanelOpen,
    handleClosePanel,
    selectedTask,
    handleTaskUpdate,
    handleStartTask,
    availableTasks,
    handleNavigateToTask,
    autoStartTaskOnOpen,
    setAutoStartTaskOnOpen,
    // Board settings
    settingsOpen,
    setSettingsOpen,
    columnConfigs,
    handleColumnsChange,
    // Queue settings
    queueSettingsOpen,
    setQueueSettingsOpen,
    maxParallelTasks,
    updateGatewayMaxConcurrency,
    setMaxParallelTasks,
    isLoadingGatewayStatus,
  } = board;

  return (
    <>
      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedCount}
        totalCount={sortedTasks.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onBulkStatusChange={handleBulkStatusChange}
        onBulkDelete={handleBulkDelete}
        statuses={columnStatuses.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
      />

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        commands={commands}
        placeholder={t("workspace.commandPalette.placeholder", "Search commands...")}
        labels={{
          noResults: t("workspace.commandPalette.noResults", "No matching commands"),
          navigation: t("workspace.commandPalette.navigation", "Navigation"),
          action: t("workspace.commandPalette.action", "Action"),
          view: t("workspace.commandPalette.view", "View"),
          filter: t("workspace.commandPalette.filter", "Filter"),
          sort: t("workspace.commandPalette.sort", "Sort"),
          settings: t("workspace.commandPalette.settings", "Settings"),
          resultsCount: t("workspace.commandPalette.resultsCount", "{{count}} results"),
          navigate: t("workspace.commandPalette.navigateHint", "navigate"),
          select: t("workspace.commandPalette.selectHint", "select"),
          close: t("workspace.commandPalette.closeHint", "close"),
        }}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateTaskSubmit}
        defaultColumnId={createDialogColumnId}
        isSubmitting={createTask.isPending}
        availableAgents={availableAgents}
        availableModels={availableModels}
        defaultAgentId={defaultAgentId}
        defaultModelId={defaultModelId}
        isLoadingOptions={isLoadingAgents || isLoadingModels}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        open={isPanelOpen}
        onOpenChange={(open) => {
          if (!open) handleClosePanel();
        }}
        task={selectedTask}
        onUpdate={handleTaskUpdate}
        onStartTask={handleStartTask}
        availableTasks={availableTasks}
        availableAgents={availableAgents}
        onNavigateToTask={handleNavigateToTask}
        workspacePath={workspace?.path}
        autoStartOnOpen={autoStartTaskOnOpen}
        onAutoStartConsumed={() => setAutoStartTaskOnOpen(false)}
      />

      {/* Board Settings Dialog */}
      <BoardSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        columns={columnConfigs}
        onColumnsChange={handleColumnsChange}
        translations={{
          title: t("workspace.boardSettingsDialog.title"),
          description: t("workspace.boardSettingsDialog.description"),
          doubleClickToEdit: t("workspace.boardSettingsDialog.doubleClickToEdit"),
          changeColor: t("workspace.boardSettingsDialog.changeColor"),
          deleteColumn: t("workspace.boardSettingsDialog.deleteColumn"),
          noColumns: t("workspace.boardSettingsDialog.noColumns"),
          cancel: t("common.cancel"),
          saveChanges: t("workspace.boardSettingsDialog.saveChanges"),
          colors: {
            gray: t("workspace.colors.gray"),
            blue: t("workspace.colors.blue"),
            yellow: t("workspace.colors.yellow"),
            green: t("workspace.colors.green"),
            red: t("workspace.colors.red"),
            purple: t("workspace.colors.purple"),
            orange: t("workspace.colors.orange"),
            cyan: t("workspace.colors.cyan"),
          },
        }}
      />

      {/* Queue Settings Modal */}
      <QueueSettingsModal
        open={queueSettingsOpen}
        onOpenChange={setQueueSettingsOpen}
        currentMaxParallel={maxParallelTasks}
        onSave={async (value) => {
          await updateGatewayMaxConcurrency(value);
          setMaxParallelTasks(value);
        }}
        isSaving={isLoadingGatewayStatus}
      />
    </>
  );
}
