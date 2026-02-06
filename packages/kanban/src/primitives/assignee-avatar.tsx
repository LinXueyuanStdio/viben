"use client";

import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback, cn } from "@viben/ui";
import type { Assignee } from "./assignee-types";

const sizeMap = {
  sm: "h-5 w-5 text-[10px]",
  md: "h-6 w-6 text-xs",
  lg: "h-8 w-8 text-sm",
} as const;

export interface AssigneeAvatarProps {
  assignee: Assignee;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AssigneeAvatar = React.forwardRef<HTMLDivElement, AssigneeAvatarProps>(
  ({ assignee, size = "md", showName = false, className }, ref) => {
    const sizeClass = sizeMap[size];

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 transition-all duration-200",
          className
        )}
      >
        <Avatar
          className={cn(
            sizeClass,
            "hover:ring-2 hover:ring-primary/50 transition-all duration-200"
          )}
        >
          {assignee.avatar && (
            <AvatarImage src={assignee.avatar} alt={assignee.name} />
          )}
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(assignee.name)}
          </AvatarFallback>
        </Avatar>
        {showName && (
          <span className="text-sm font-medium">{assignee.name}</span>
        )}
      </div>
    );
  }
);
AssigneeAvatar.displayName = "AssigneeAvatar";

export { AssigneeAvatar, getInitials };
