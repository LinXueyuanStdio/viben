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

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  created: "created the task",
  status_changed: "changed the status",
  priority_changed: "changed the priority",
  assignee_changed: "changed the assignee",
  title_changed: "changed the title",
  description_changed: "changed the description",
  tag_added: "added a tag",
  tag_removed: "removed a tag",
  due_date_changed: "changed the due date",
  comment_added: "added a comment",
};
