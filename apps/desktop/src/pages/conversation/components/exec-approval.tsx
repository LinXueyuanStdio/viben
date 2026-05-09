import { useCallback, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Shield, Terminal, FileEdit, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PendingExecApproval } from "@/types";

interface ExecApprovalProps {
  approval: PendingExecApproval;
  onDecision: (decision: string) => void;
  className?: string;
}

const kindIcons = {
  read: Eye,
  edit: FileEdit,
  execute: Terminal,
} as const;

const kindColors = {
  read: "text-blue-500",
  edit: "text-amber-500",
  execute: "text-red-500",
} as const;

export function ExecApproval({
  approval,
  onDecision,
  className,
}: ExecApprovalProps) {
  const prefersReducedMotion = useReducedMotion();
  const kind = approval.tool_call.kind ?? "execute";
  const Icon = kindIcons[kind] ?? Terminal;
  const iconColor = kindColors[kind] ?? "text-red-500";

  const handleAllow = useCallback(() => {
    onDecision("allow_once");
  }, [onDecision]);

  const handleAlwaysAllow = useCallback(() => {
    onDecision("allow_always");
  }, [onDecision]);

  const handleReject = useCallback(() => {
    onDecision("reject");
  }, [onDecision]);

  // Keyboard shortcuts: Y = allow, A = always allow, N/Esc = reject, Enter = allow
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "y":
        case "enter":
          e.preventDefault();
          handleAllow();
          break;
        case "a":
          e.preventDefault();
          handleAlwaysAllow();
          break;
        case "n":
        case "escape":
          e.preventDefault();
          handleReject();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleAllow, handleAlwaysAllow, handleReject]);

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      className={cn("flex gap-3", className)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
        <Shield className="h-4 w-4 text-orange-500" />
      </div>
      <div className="flex-1">
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-orange-500/20">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
              <span className="text-sm font-medium text-foreground">
                Tool Approval Required
              </span>
            </div>
          </div>

          {/* Tool call details */}
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-start gap-3">
              <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", iconColor)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground font-mono break-all">
                  {approval.tool_call.command || approval.tool_call.title || "Unknown command"}
                </p>
                {approval.tool_call.cwd && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    cwd: {approval.tool_call.cwd}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-4 py-3 bg-muted/50 border-t border-orange-500/20 flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleAllow}
              className="flex-1"
            >
              Allow
              <kbd className="ml-1.5 text-[10px] opacity-60 border rounded px-1">Y</kbd>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAlwaysAllow}
              className="flex-1"
            >
              Always
              <kbd className="ml-1.5 text-[10px] opacity-60 border rounded px-1">A</kbd>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReject}
              className="flex-1"
            >
              Reject
              <kbd className="ml-1.5 text-[10px] opacity-60 border rounded px-1">N</kbd>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
