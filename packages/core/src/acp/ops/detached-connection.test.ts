import { describe, expect, it, vi } from "vitest";
import type {
  AcpConnection,
  AcpRequestPermissionRequest,
  AcpRequestPermissionResponse,
  AcpSessionEvent,
  AcpSessionNotification,
} from "../types";
import { DetachedConnection } from "./detached-connection";
import { AcpSessionEventRecorder } from "./session-event-recorder";
import { InMemoryAcpSessionEventStore, type AcpSessionEventIdentity } from "./session-event-store";
import { InMemoryAcpSessionIndexStore } from "./session-index-store";
import type { PermissionHandler } from "./permission-handler";

const identity: AcpSessionEventIdentity = {
  executor_type: "CODEX",
  session_id: "session-1",
};

function createRecorder(): {
  recorder: AcpSessionEventRecorder;
  events: InMemoryAcpSessionEventStore;
  index: InMemoryAcpSessionIndexStore;
} {
  const events = new InMemoryAcpSessionEventStore();
  const index = new InMemoryAcpSessionIndexStore();
  return {
    recorder: new AcpSessionEventRecorder(events, identity, index),
    events,
    index,
  };
}

function permissionRequest(): AcpRequestPermissionRequest {
  return {
    sessionId: identity.session_id,
    toolCall: {
      toolCallId: "tool-1",
      title: "Run command",
      kind: "execute",
      rawInput: { command: "pwd" },
    },
    options: [
      { optionId: "yes", name: "Yes", kind: "allow_once" },
      { optionId: "no", name: "No", kind: "reject_once" },
    ],
  };
}

function permissionResponse(optionId = "yes"): AcpRequestPermissionResponse {
  return {
    outcome: {
      outcome: "selected",
      optionId,
    },
  };
}

function cancelledPermissionResponse(): AcpRequestPermissionResponse {
  return {
    outcome: {
      outcome: "cancelled",
    },
  };
}

function createResolvingConnection(): AcpConnection & {
  permissionRequests: AcpRequestPermissionRequest[];
  clientRequests: { method: string; params?: Record<string, unknown> }[];
} {
  return {
    permissionRequests: [],
    clientRequests: [],
    sessionUpdate() {},
    async requestPermission(params) {
      this.permissionRequests.push(params);
      return permissionResponse("yes");
    },
    async requestClient(method, params) {
      this.clientRequests.push({ method, params });
      return { ok: true };
    },
    notifyClient() {},
  };
}

function createPermissionCancellingConnection(): AcpConnection {
  return {
    sessionUpdate() {},
    async requestPermission() {
      return cancelledPermissionResponse();
    },
    async requestClient() {
      return { ok: true };
    },
    notifyClient() {},
  };
}

describe("DetachedConnection", () => {
  it("records session updates while detached", async () => {
    const { recorder, events } = createRecorder();
    const connection = new DetachedConnection(recorder, identity.session_id);
    const update: AcpSessionNotification = {
      sessionId: identity.session_id,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "hello" },
      },
    };

    await connection.sessionUpdate(update);

    await expect(events.loadEvents(identity)).resolves.toMatchObject([
      {
        seq: 0,
        type: "session_update",
        data: update,
      },
    ]);
  });

  it("records pending permission requests and resolves them on resume", async () => {
    const { recorder, events } = createRecorder();
    const connection = new DetachedConnection(recorder, identity.session_id);
    const activeConnection = createResolvingConnection();

    const responsePromise = connection.requestPermission(permissionRequest());
    await vi.waitFor(async () => {
      await expect(events.loadEvents(identity)).resolves.toMatchObject([
        {
          seq: 0,
          type: "permission_request",
          status: "pending",
        },
      ]);
    });

    const history = await connection.resume(activeConnection);
    await expect(responsePromise).resolves.toEqual(permissionResponse("yes"));

    expect(history).toMatchObject([
      {
        seq: 0,
        type: "permission_request",
        status: "pending",
      },
    ]);
    expect(activeConnection.permissionRequests).toEqual([permissionRequest()]);
    await expect(events.loadEvents(identity)).resolves.toMatchObject([
      {
        seq: 0,
        type: "permission_request",
        status: "resolved",
      },
    ]);
  });

  it("cancels pending requests on close", async () => {
    const { recorder, events } = createRecorder();
    const connection = new DetachedConnection(recorder, identity.session_id);

    const responsePromise = connection.requestPermission(permissionRequest());
    await vi.waitFor(async () => {
      await expect(events.loadEvents(identity)).resolves.toHaveLength(1);
    });

    await connection.close();

    await expect(responsePromise).rejects.toThrow("Detached connection closed");
    await expect(events.loadEvents(identity)).resolves.toMatchObject([
      {
        seq: 0,
        type: "permission_request",
        status: "cancelled",
      },
    ]);
  });

  it("marks resumed permission cancellation responses as cancelled", async () => {
    const { recorder, events } = createRecorder();
    const connection = new DetachedConnection(recorder, identity.session_id);

    const responsePromise = connection.requestPermission(permissionRequest());
    await vi.waitFor(async () => {
      await expect(events.loadEvents(identity)).resolves.toHaveLength(1);
    });

    await connection.resume(createPermissionCancellingConnection());

    await expect(responsePromise).resolves.toEqual(cancelledPermissionResponse());
    await expect(events.loadEvents(identity)).resolves.toMatchObject([
      {
        seq: 0,
        type: "permission_request",
        status: "cancelled",
      },
    ]);
  });

  it("abandons client tool requests after timeout", async () => {
    const { recorder, events } = createRecorder();
    const connection = new DetachedConnection(recorder, identity.session_id, "default", undefined, 5);

    const responsePromise = connection.requestClient("client/method", { a: 1 });

    await expect(responsePromise).rejects.toThrow("Client tool request timed out");
    await expect(events.loadEvents(identity)).resolves.toMatchObject([
      {
        seq: 0,
        type: "client_tool_call",
        status: "abandoned",
        data: {
          method: "client/method",
          params: { a: 1 },
        },
      },
    ]);
  });

  it("records automatic permission responses without pending request events", async () => {
    const { recorder, events } = createRecorder();
    const handler: PermissionHandler = {
      async evaluate() {
        return {
          auto: true,
          response: permissionResponse("yes"),
        };
      },
    };
    const connection = new DetachedConnection(recorder, identity.session_id, "default", handler);

    await expect(connection.requestPermission(permissionRequest())).resolves.toEqual(permissionResponse("yes"));

    const history = await events.loadEvents(identity);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      seq: 0,
      type: "permission_response",
      data: permissionResponse("yes"),
    } satisfies Partial<AcpSessionEvent>);
  });

  it("abandons pending history events through the recorder", async () => {
    const { recorder, events } = createRecorder();
    await events.appendEvent(identity, {
      type: "permission_request",
      ts: "2026-06-23T00:00:00.000Z",
      status: "pending",
      data: permissionRequest(),
    });

    const history = await recorder.abandonPending();

    expect(history).toMatchObject([{ seq: 0, status: "abandoned" }]);
    await expect(events.loadEvents(identity)).resolves.toMatchObject([{ seq: 0, status: "abandoned" }]);
  });
});
