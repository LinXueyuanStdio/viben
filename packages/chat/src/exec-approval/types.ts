/** Pending execution approval request */
export interface PendingExecApproval {
  id: string;
  tool_call: {
    title?: string;
    kind?: "read" | "edit" | "execute";
    command?: string;
    cwd?: string;
  };
  options: Array<{ id: string; label: string }>;
}
