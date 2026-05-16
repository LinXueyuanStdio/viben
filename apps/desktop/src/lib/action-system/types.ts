import type { ClientToolResult } from "../client-side-tool/types";

/** JSON Schema 7 subset for action input/output definitions */
export type JSONSchema7 = Record<string, unknown>;

/** Options for the requireApproval dialog */
export interface ApprovalOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/** Context passed to every action execute function */
export interface ExecutionContext {
  /** Show confirmation dialog. Resolves true if confirmed, throws UserCancelledException if cancelled. */
  requireApproval: (message: string, options?: ApprovalOptions) => Promise<boolean>;
  /** Current session ID */
  sessionId: string;
  /** Current tool_use_id for correlation */
  toolUseId: string;
}

/** Definition of a single action (without namespace prefix in name) */
export interface ActionDef {
  name: string;
  description: string;
  input_schema?: JSONSchema7;
  output_schema?: JSONSchema7;
  execute: (payload: unknown, ctx: ExecutionContext) => Promise<ClientToolResult>;
}

/** Action info returned by list_actions (with full namespace.name) */
export interface ActionInfo {
  name: string;
  description: string;
}

/** Action detail returned by get_action_detail */
export interface ActionDetail extends ActionInfo {
  input_schema?: JSONSchema7;
  output_schema?: JSONSchema7;
}
