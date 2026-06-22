export type {
  ActionDescriptor,
  ActionErrorPayload,
  ActionInvokePayload,
  ActionManifest,
  ActionPermission,
  ActionResultPayload,
  BridgeEnvelope,
  BridgeEnvelopeBase,
  BridgeHelloPayload,
  BridgePeerRole,
  BridgePresencePayload,
  BridgeSessionRef,
  JsonSchemaObject,
  JsonValue
} from "@viben/protocol";

export {
  createBridgeEnvelope,
  isBridgeEnvelope,
  isBridgePeerRole,
  parseBridgeEnvelope
} from "@viben/protocol";
