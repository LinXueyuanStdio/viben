"use client";

import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useSessionsShell } from "./sessions-shell-context";

export function SessionsIndexShell() {
  const { openNewSessionDialog } = useSessionsShell();

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquare />
            </EmptyMedia>
            <EmptyTitle>选择会话</EmptyTitle>
            <EmptyDescription>
              从左侧选择一个会话继续，或者创建一个新的。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openNewSessionDialog}>
              <Plus className="h-4 w-4" />
              新建会话
            </Button>
          </EmptyContent>
        </Empty>
      </div>
  );
}
