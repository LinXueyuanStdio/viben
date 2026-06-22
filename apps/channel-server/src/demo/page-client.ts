import WebSocket from "ws";
import {
  createBridgeEnvelope,
  parseBridgeEnvelope,
  type ActionInvokePayload
} from "../protocol.js";

const bridgeSessionId = process.env.BRIDGE_SESSION_ID ?? "demo";
const url = `ws://127.0.0.1:${process.env.PORT ?? 17891}/bridge?bridge_session_id=${encodeURIComponent(bridgeSessionId)}&role=page&client_id=page-demo`;
const socket = new WebSocket(url);

socket.on("open", () => {
  console.log("[page-demo] connected", url);
  socket.send(
    JSON.stringify(
      createBridgeEnvelope({
        type: "action_manifest",
        bridge_session_id: bridgeSessionId,
        source: "page",
        target: "gateway",
        payload: {
          page_id: "demo-page",
          page_instance_id: "page-demo-tab",
          updated_at: new Date().toISOString(),
          actions: [
            {
              id: "page.echo",
              title: "Echo",
              description: "Return the provided text from the cloud page.",
              permission: "read",
              input_schema: {
                type: "object",
                properties: {
                  text: { type: "string" }
                },
                required: ["text"]
              },
              output_schema: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  handled_by: { type: "string" }
                }
              }
            }
          ]
        }
      })
    )
  );
});

socket.on("message", (data) => {
  const envelope = parseBridgeEnvelope(String(data));
  console.log("[page-demo] received", envelope.type);

  if (envelope.type !== "invoke_action") return;

  const payload = envelope.payload as ActionInvokePayload;
  const input = payload.input;
  const text =
    input && typeof input === "object" && !Array.isArray(input) && "text" in input
      ? String(input.text)
      : "";

  socket.send(
    JSON.stringify(
      createBridgeEnvelope({
        type: "action_result",
        bridge_session_id: bridgeSessionId,
        source: "page",
        target: "gateway",
        payload: {
          invocation_id: payload.invocation_id,
          action_id: payload.action_id,
          output: {
            text,
            handled_by: "page-demo-tab"
          }
        }
      })
    )
  );
});
