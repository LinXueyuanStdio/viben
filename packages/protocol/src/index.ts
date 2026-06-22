export type BridgePeerRole = "page" | "gateway";

export type ActionPermission = "read" | "write" | "dangerous" | "local";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, JsonSchemaObject>;
  items?: JsonSchemaObject;
  required?: string[];
  enum?: JsonValue[];
  description?: string;
  additionalProperties?: boolean | JsonSchemaObject;
}

export interface BridgeSessionRef {
  bridge_session_id: string;
  user_id?: string;
  page_id?: string;
  page_instance_id?: string;
  gateway_instance_id?: string;
}

export interface ActionDescriptor {
  id: string;
  title: string;
  description?: string;
  permission: ActionPermission;
  input_schema?: JsonSchemaObject;
  output_schema?: JsonSchemaObject;
}

export interface ActionManifest {
  page_id: string;
  page_instance_id: string;
  actions: ActionDescriptor[];
  updated_at: string;
}

export interface BridgeEnvelopeBase<TType extends string, TPayload = unknown> {
  type: TType;
  message_id: string;
  bridge_session_id: string;
  source: BridgePeerRole | "channel_server";
  target?: BridgePeerRole | "channel_server";
  created_at: string;
  payload: TPayload;
}

export interface BridgeHelloPayload {
  role: BridgePeerRole;
  client_id: string;
  page_id?: string;
  page_instance_id?: string;
  gateway_instance_id?: string;
}

export interface BridgePresencePayload {
  role: BridgePeerRole;
  client_id: string;
  connected: boolean;
  peer_count: number;
}

export interface ActionInvokePayload {
  invocation_id: string;
  action_id: string;
  input: JsonValue;
  timeout_ms?: number;
  require_confirmation?: boolean;
}

export interface ActionResultPayload {
  invocation_id: string;
  action_id: string;
  output: JsonValue;
}

export interface ActionErrorPayload {
  invocation_id: string;
  action_id: string;
  error: {
    code: string;
    message: string;
    details?: JsonValue;
  };
}

export type BridgeEnvelope =
  | BridgeEnvelopeBase<"hello", BridgeHelloPayload>
  | BridgeEnvelopeBase<"presence", BridgePresencePayload>
  | BridgeEnvelopeBase<"action_manifest", ActionManifest>
  | BridgeEnvelopeBase<"invoke_action", ActionInvokePayload>
  | BridgeEnvelopeBase<"action_result", ActionResultPayload>
  | BridgeEnvelopeBase<"action_error", ActionErrorPayload>
  | BridgeEnvelopeBase<"ping", Record<string, never>>
  | BridgeEnvelopeBase<"pong", Record<string, never>>;

export function createBridgeEnvelope<TType extends BridgeEnvelope["type"]>(
  input: Omit<Extract<BridgeEnvelope, { type: TType }>, "message_id" | "created_at">
): Extract<BridgeEnvelope, { type: TType }> {
  return {
    ...input,
    message_id: crypto.randomUUID(),
    created_at: new Date().toISOString()
  } as Extract<BridgeEnvelope, { type: TType }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isBridgePeerRole(value: unknown): value is BridgePeerRole {
  return value === "page" || value === "gateway";
}

export function isBridgeEnvelope(value: unknown): value is BridgeEnvelope {
  if (!isRecord(value)) return false;
  return (
    typeof value.type === "string" &&
    typeof value.message_id === "string" &&
    typeof value.bridge_session_id === "string" &&
    typeof value.source === "string" &&
    typeof value.created_at === "string" &&
    "payload" in value
  );
}

export function parseBridgeEnvelope(text: string): BridgeEnvelope {
  const parsed: unknown = JSON.parse(text);
  if (!isBridgeEnvelope(parsed)) {
    throw new Error("Invalid bridge envelope");
  }
  return parsed;
}
