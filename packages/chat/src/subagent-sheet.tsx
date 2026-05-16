import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn, Button } from "@viben/ui";
import { MessageList } from "./message-list";
import type { AgentMessage } from "./types";

export interface SubagentSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subagentType?: string;
  messages: AgentMessage[];
  className?: string;
}

export function SubagentSheet({
  open,
  onClose,
  title,
  subagentType,
  messages,
  className,
}: SubagentSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 z-50 flex w-[480px] max-w-[85vw] flex-col border-l bg-background shadow-xl",
              className
            )}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium">{title}</h3>
                {subagentType && (
                  <span className="text-xs text-muted-foreground">
                    {subagentType}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 shrink-0"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* Message list */}
            <div className="flex flex-1 flex-col overflow-hidden min-h-0">
              <MessageList
                messages={messages}
                simpleMode
                toolExpandedInline
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
