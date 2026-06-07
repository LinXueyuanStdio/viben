/** Pending execution approval request */
export interface PendingExecApproval {
  id: string;
  tool_call: {
    title?: string;
    kind?: "read" | "edit" | "execute";
    command?: string;
    cwd?: string;
    toolCallId?: string;
    toolName?: string;
    input?: unknown;
    details?: Array<{
      label: string;
      value: string;
    }>;
  };
  options: Array<{ id: string; label: string }>;
}
