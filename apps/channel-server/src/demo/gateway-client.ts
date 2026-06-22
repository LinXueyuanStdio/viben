import WebSocket from "ws";
import {
  createBridgeEnvelope,
  parseBridgeEnvelope,
  type ActionManifest
} from "../protocol.js";

const bridgeSessionId = process.env.BRIDGE_SESSION_ID ?? "demo";
const url = `ws://127.0.0.1:${process.env.PORT ?? 17891}/bridge?bridge_session_id=${encodeURIComponent(bridgeSessionId)}&role=gateway&client_id=gateway-demo`;
const socket = new WebSocket(url);
let invoked = false;

socket.on("open", () => {
  console.log("[gateway-demo] connected", url);
});

socket.on("message", (data) => {
  const envelope = parseBridgeEnvelope(String(data));
  console.log("[gateway-demo] received", envelope.type);

  if (envelope.type === "action_manifest" && !invoked) {
    invoked = true;
    const manifest = envelope.payload as ActionManifest;
    const action = manifest.actions[0];
    if (!action) {
      console.log("[gateway-demo] manifest has no actions");
      return;
    }

    socket.send(
      JSON.stringify(
        createBridgeEnvelope({
          type: "invoke_action",
          bridge_session_id: bridgeSessionId,
          source: "gateway",
          target: "page",
          payload: {
            invocation_id: crypto.randomUUID(),
            action_id: action.id,
            input: {
              text: "hello from gateway"
            },
            timeout_ms: 10000
          }
        })
      )
    );
  }

  if (envelope.type === "action_result" || envelope.type === "action_error") {
    console.log("[gateway-demo] final", JSON.stringify(envelope.payload, null, 2));
  }
});
