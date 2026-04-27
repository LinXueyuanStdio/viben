export type ActivityType =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "assignee_changed"
  | "title_changed"
  | "description_changed"
  | "tag_added"
  | "tag_removed"
  | "due_date_changed"
  | "comment_added";

export interface ActivityActor {
  id: string;
  name: string;
  avatar?: string;
}

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  actor: ActivityActor;
  timestamp: string;
  data: {
    oldValue?: string;
    newValue?: string;
    [key: string]: unknown;
  };
}

/** i18n keys for activity labels */
export const ACTIVITY_LABEL_KEYS: Record<ActivityType, string> = {
  created: "kanban.activity.created",
  status_changed: "kanban.activity.statusChanged",
  priority_changed: "kanban.activity.priorityChanged",
  assignee_changed: "kanban.activity.assigneeChanged",
  title_changed: "kanban.activity.titleChanged",
  description_changed: "kanban.activity.descriptionChanged",
  tag_added: "kanban.activity.tagAdded",
  tag_removed: "kanban.activity.tagRemoved",
  due_date_changed: "kanban.activity.dueDateChanged",
  comment_added: "kanban.activity.commentAdded",
};
