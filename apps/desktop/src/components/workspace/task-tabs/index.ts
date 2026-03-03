/**
 * Task Detail Panel Tab Components
 * 任务详情面板标签页组件
 *
 * These components are used in the task detail modal/panel to display
 * different aspects of a task: subtasks, PRD documents, logs, and files.
 */

export { TaskSubtasksTab } from "./task-subtasks-tab";
export type { TaskSubtasksTabProps, ExtendedSubtask } from "./task-subtasks-tab";

export { TaskPRDTab } from "./task-prd-tab";
export type { TaskPRDTabProps } from "./task-prd-tab";

export { TaskLogsTab } from "./task-logs-tab";
export type { TaskLogsTabProps, TaskLog, TaskLogPhase, LogEntry, LogEntryType } from "./task-logs-tab";

export { TaskFilesTab } from "./task-files-tab";
export type { TaskFilesTabProps, TaskFile } from "./task-files-tab";
