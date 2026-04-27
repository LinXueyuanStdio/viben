export type RelationshipType = "blocks" | "blocked_by" | "relates_to" | "duplicates";

export interface TaskRelationship {
  id: string;
  type: RelationshipType;
  targetTaskId: string;
  targetTaskTitle: string;
  targetTaskStatus?: string;
}

export interface RelationshipConfig {
  type: RelationshipType;
  /** i18n key for the label */
  labelKey: string;
  color: string;
  icon: string; // Lucide icon name
}

export const RELATIONSHIP_CONFIG: Record<RelationshipType, RelationshipConfig> = {
  blocks: {
    type: "blocks",
    labelKey: "kanban.relationship.blocks",
    color: "hsl(var(--destructive))",
    icon: "Ban",
  },
  blocked_by: {
    type: "blocked_by",
    labelKey: "kanban.relationship.blockedBy",
    color: "hsl(var(--destructive))",
    icon: "CircleSlash",
  },
  relates_to: {
    type: "relates_to",
    labelKey: "kanban.relationship.relatesTo",
    color: "hsl(var(--primary))",
    icon: "Link",
  },
  duplicates: {
    type: "duplicates",
    labelKey: "kanban.relationship.duplicates",
    color: "hsl(var(--muted-foreground))",
    icon: "Copy",
  },
};

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicates",
];
