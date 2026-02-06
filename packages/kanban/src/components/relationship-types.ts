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
  label: string;
  labelEn: string;
  color: string;
  icon: string; // Lucide icon name
}

export const RELATIONSHIP_CONFIG: Record<RelationshipType, RelationshipConfig> = {
  blocks: {
    type: "blocks",
    label: "阻塞",
    labelEn: "Blocks",
    color: "hsl(var(--destructive))",
    icon: "Ban",
  },
  blocked_by: {
    type: "blocked_by",
    label: "被阻塞",
    labelEn: "Blocked by",
    color: "hsl(var(--destructive))",
    icon: "CircleSlash",
  },
  relates_to: {
    type: "relates_to",
    label: "关联",
    labelEn: "Relates to",
    color: "hsl(var(--primary))",
    icon: "Link",
  },
  duplicates: {
    type: "duplicates",
    label: "重复",
    labelEn: "Duplicates",
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
