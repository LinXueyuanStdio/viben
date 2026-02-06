"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  cn,
} from "@viben/ui";
import { User, X } from "lucide-react";
import type { Assignee } from "./assignee-types";
import { AssigneeAvatar } from "./assignee-avatar";

export interface AssigneeSelectProps {
  availableUsers: Assignee[];
  value?: string;
  onChange: (userId: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}

const AssigneeSelect = React.forwardRef<HTMLButtonElement, AssigneeSelectProps>(
  (
    {
      availableUsers,
      value,
      onChange,
      disabled = false,
      placeholder = "Assign",
    },
    ref
  ) => {
    const selectedUser = value
      ? availableUsers.find((user) => user.id === value)
      : undefined;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-center rounded-md",
              "h-8 min-w-8 px-2 gap-2",
              "text-sm text-muted-foreground",
              "border border-transparent",
              "hover:border-border hover:bg-accent/50",
              "transition-all duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            {selectedUser ? (
              <AssigneeAvatar assignee={selectedUser} size="sm" />
            ) : (
              <>
                <User className="h-4 w-4" />
                <span className="sr-only">{placeholder}</span>
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {availableUsers.map((user) => (
            <DropdownMenuItem
              key={user.id}
              onClick={() => onChange(user.id)}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                value === user.id && "bg-accent"
              )}
            >
              <AssigneeAvatar assignee={user} size="sm" showName />
            </DropdownMenuItem>
          ))}
          {value && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onChange(undefined)}
                className="flex items-center gap-2 cursor-pointer text-muted-foreground"
              >
                <X className="h-4 w-4" />
                <span>Unassign</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
AssigneeSelect.displayName = "AssigneeSelect";

export { AssigneeSelect };
