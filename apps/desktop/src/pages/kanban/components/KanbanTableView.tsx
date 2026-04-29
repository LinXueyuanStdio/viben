import { Badge } from "@viben/ui";
import {
  TableView,
  PriorityIcon,
  DueDateBadge,
  formatRelativeTime,
  type TableColumn,
} from "@viben/kanban";
import {
  STATUS_TO_COLUMN,
  type TaskStatus as VibeTaskStatus,
} from "@/lib/kanban";
import type { UseKanbanBoardReturn } from "../hooks/useKanbanBoard";
import type { EnhancedTask, ColumnId } from "../types";
import { COLUMN_COLOR_VARS, validatePriority } from "../constants";

interface KanbanTableViewProps {
  board: UseKanbanBoardReturn;
}

export function KanbanTableView({ board }: KanbanTableViewProps) {
  const {
    t,
    sortedTasks,
    selectedTaskId,
    columnStatuses,
    handleCardClick,
  } = board;

  return (
    <div className="flex-1 h-full overflow-y-auto p-4">
      <TableView
        items={sortedTasks}
        selectedId={selectedTaskId ?? undefined}
        onItemClick={(item) => handleCardClick(item.id)}
        emptyMessage={t("workspace.noTasks", "No tasks found")}
        pagination
        pageSize={50}
        stickyHeader
        hoverable
        columns={[
          {
            id: "title",
            header: t("workspace.taskName", "Task"),
            accessor: (task) => (
              <div className="flex items-center gap-2 min-w-0">
                {task.status === "in_progress" && (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
                <span className="truncate font-medium">{task.title}</span>
              </div>
            ),
            sortable: true,
            minWidth: 200,
          },
          {
            id: "status",
            header: t("workspace.status", "Status"),
            accessor: (task) => {
              const mappedColumn = STATUS_TO_COLUMN[task.status as VibeTaskStatus];
              const column = columnStatuses.find((c) => c.id === mappedColumn);
              const colorVar = COLUMN_COLOR_VARS[mappedColumn as ColumnId];
              return (
                <Badge
                  variant="outline"
                  className="text-xs whitespace-nowrap"
                  style={{
                    borderColor: `hsl(var(${colorVar}) / 0.5)`,
                    backgroundColor: `hsl(var(${colorVar}) / 0.1)`,
                  }}
                >
                  {column?.name || task.status}
                </Badge>
              );
            },
            sortable: true,
            width: 120,
          },
          {
            id: "priority",
            header: t("workspace.priority.label", "Priority"),
            accessor: (task) => {
              const priority = validatePriority(task.priority);
              if (!priority || priority === "none") {
                return <span className="text-muted-foreground">-</span>;
              }
              return (
                <div className="flex items-center gap-1.5">
                  <PriorityIcon priority={priority} size="sm" />
                  <span className="capitalize text-xs">{priority}</span>
                </div>
              );
            },
            sortable: true,
            width: 100,
          },
          {
            id: "agent",
            header: t("workspace.agent", "Agent"),
            accessor: (task) => (
              <span className="text-xs text-muted-foreground truncate max-w-[150px] block">
                {task.agent_id || "-"}
              </span>
            ),
            sortable: true,
            width: 150,
          },
          {
            id: "dueDate",
            header: t("workspace.dueDate", "Due Date"),
            accessor: (task) => {
              if (!task.dueDate) {
                return <span className="text-muted-foreground">-</span>;
              }
              return <DueDateBadge dueDate={task.dueDate} />;
            },
            sortable: true,
            width: 120,
          },
          {
            id: "created",
            header: t("workspace.created", "Created"),
            accessor: (task) => (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(task.created_at)}
              </span>
            ),
            sortable: true,
            width: 100,
          },
          {
            id: "updated",
            header: t("workspace.updated", "Updated"),
            accessor: (task) => (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(task.updated_at)}
              </span>
            ),
            sortable: true,
            width: 100,
          },
        ] as TableColumn<EnhancedTask>[]}
        rowClassName={(task) =>
          task.is_stuck ? "bg-destructive/5" : task.status === "in_progress" ? "bg-green-500/5" : ""
        }
        labels={{
          showing: t("workspace.table.showing", "Showing"),
          of: t("workspace.table.of", "of"),
          items: t("workspace.table.items", "items"),
          page: t("workspace.table.page", "Page"),
        }}
      />
    </div>
  );
}
