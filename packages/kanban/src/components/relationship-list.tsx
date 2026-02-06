"use client";

import * as React from "react";
import { cn } from "@viben/ui";
import type { TaskRelationship, RelationshipType } from "./relationship-types";
import { RELATIONSHIP_CONFIG, RELATIONSHIP_TYPES } from "./relationship-types";
import { RelationshipBadge } from "./relationship-badge";

export interface RelationshipListProps {
  relationships: TaskRelationship[];
  onRemove?: (relationshipId: string) => void;
  onNavigate?: (taskId: string) => void;
  className?: string;
}

export function RelationshipList({
  relationships,
  onRemove,
  onNavigate,
  className,
}: RelationshipListProps) {
  // Group relationships by type
  const groupedRelationships = React.useMemo(() => {
    const groups: Record<RelationshipType, TaskRelationship[]> = {
      blocks: [],
      blocked_by: [],
      relates_to: [],
      duplicates: [],
    };

    for (const rel of relationships) {
      if (groups[rel.type]) {
        groups[rel.type].push(rel);
      }
    }

    return groups;
  }, [relationships]);

  // Filter to only types that have relationships
  const activeTypes = RELATIONSHIP_TYPES.filter(
    (type) => groupedRelationships[type].length > 0
  );

  if (activeTypes.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {activeTypes.map((type) => {
        const config = RELATIONSHIP_CONFIG[type];
        const rels = groupedRelationships[type];

        return (
          <div key={type} className="space-y-1.5">
            <h4 className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {config.labelEn}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {rels.map((rel) => (
                <RelationshipBadge
                  key={rel.id}
                  relationship={rel}
                  onClick={onNavigate ? () => onNavigate(rel.targetTaskId) : undefined}
                  onRemove={onRemove ? () => onRemove(rel.id) : undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

RelationshipList.displayName = "RelationshipList";
