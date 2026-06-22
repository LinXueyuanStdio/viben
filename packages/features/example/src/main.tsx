import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ActionManifestPanel,
  createBridgeEnvelope,
  createDemoManifest,
  envelopeLabel,
  findAction,
  summarizeActionManifest,
  type ActionDescriptor,
  type BridgeEnvelope
} from "@viben/features";
import "./styles.css";

function App() {
  const manifest = useMemo(() => createDemoManifest(new Date("2026-06-23T00:00:00.000Z")), []);
  const [selectedAction, setSelectedAction] = useState<ActionDescriptor>(manifest.actions[0]);
  const [events, setEvents] = useState<BridgeEnvelope[]>([
    createBridgeEnvelope({
      type: "action_manifest",
      bridge_session_id: "example-session",
      source: "page",
      target: "gateway",
      payload: manifest
    })
  ]);

  const summary = summarizeActionManifest(manifest);

  const invokeSelectedAction = () => {
    const action = findAction(manifest, selectedAction.id);
    if (!action) return;

    const invocationId = crypto.randomUUID();
    const invocation = createBridgeEnvelope({
      type: "invoke_action",
      bridge_session_id: "example-session",
      source: "gateway",
      target: "page",
      payload: {
        invocation_id: invocationId,
        action_id: action.id,
        input:
          action.id === "page.setTitle"
            ? { title: "Updated from gateway" }
            : { text: "Hello from the local gateway" },
        require_confirmation: action.permission !== "read",
        timeout_ms: 10000
      }
    });

    const result = createBridgeEnvelope({
      type: "action_result",
      bridge_session_id: "example-session",
      source: "page",
      target: "gateway",
      payload: {
        invocation_id: invocationId,
        action_id: action.id,
        output: {
          ok: true,
          handled_by: manifest.page_instance_id
        }
      }
    });

    setEvents((current) => [invocation, result, ...current]);
  };

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">packages/features example</p>
          <h1>Cloud Page Action Bridge</h1>
          <p>
            This demo uses shared protocol types, business helpers, and a reusable React panel
            from <code>@viben/features</code>.
          </p>
        </div>
        <div className="stats">
          <span>{summary.actionCount} actions</span>
          <span>{summary.highestPermission} max permission</span>
          <span>{summary.requiresConfirmation ? "confirmation needed" : "no confirmation"}</span>
        </div>
      </section>

      <section className="grid">
        <ActionManifestPanel
          manifest={manifest}
          selectedActionId={selectedAction.id}
          onSelectAction={setSelectedAction}
        />

        <section className="card">
          <p className="eyebrow">Gateway side</p>
          <h2>{selectedAction.title}</h2>
          <p>{selectedAction.description}</p>
          <dl>
            <div>
              <dt>Action ID</dt>
              <dd>{selectedAction.id}</dd>
            </div>
            <div>
              <dt>Permission</dt>
              <dd>{selectedAction.permission}</dd>
            </div>
          </dl>
          <button type="button" onClick={invokeSelectedAction}>
            Invoke action
          </button>
        </section>
      </section>

      <section className="card events">
        <p className="eyebrow">Bridge envelopes</p>
        <h2>Message log</h2>
        {events.map((event) => (
          <article key={event.message_id}>
            <strong>{envelopeLabel(event)}</strong>
            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
          </article>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
