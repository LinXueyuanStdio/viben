import { describe, it, expect, beforeEach } from "vitest";
import { useConnectionStore } from "./connection-store";

describe("connection-store", () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connections: [],
      active_gateway_id: null,
    });
  });

  it("adds a connection", () => {
    useConnectionStore.getState().addConnection({
      gateway_id: "gw-1",
      name: "Desktop A",
      lan_url: "http://192.168.1.100:18790",
      last_connected: "2026-04-14T00:00:00Z",
    });
    expect(useConnectionStore.getState().connections).toHaveLength(1);
    expect(useConnectionStore.getState().connections[0].gateway_id).toBe("gw-1");
  });

  it("does not add duplicate gateway_id", () => {
    const store = useConnectionStore.getState();
    store.addConnection({ gateway_id: "gw-1", name: "A", last_connected: "2026-04-14T00:00:00Z" });
    store.addConnection({ gateway_id: "gw-1", name: "B", last_connected: "2026-04-14T01:00:00Z" });
    expect(useConnectionStore.getState().connections).toHaveLength(1);
    expect(useConnectionStore.getState().connections[0].name).toBe("B");
  });

  it("removes a connection", () => {
    useConnectionStore.getState().addConnection({ gateway_id: "gw-1", name: "A", last_connected: "2026-04-14T00:00:00Z" });
    useConnectionStore.getState().removeConnection("gw-1");
    expect(useConnectionStore.getState().connections).toHaveLength(0);
  });

  it("sets active gateway", () => {
    useConnectionStore.getState().addConnection({ gateway_id: "gw-1", name: "A", last_connected: "2026-04-14T00:00:00Z" });
    useConnectionStore.getState().setActive("gw-1");
    expect(useConnectionStore.getState().active_gateway_id).toBe("gw-1");
  });

  it("getActive returns the active connection", () => {
    useConnectionStore.getState().addConnection({ gateway_id: "gw-1", name: "A", last_connected: "2026-04-14T00:00:00Z" });
    useConnectionStore.getState().setActive("gw-1");
    const active = useConnectionStore.getState().getActive();
    expect(active?.gateway_id).toBe("gw-1");
  });

  it("updates device_id for a connection", () => {
    useConnectionStore.getState().addConnection({ gateway_id: "gw-1", name: "A", last_connected: "2026-04-14T00:00:00Z" });
    useConnectionStore.getState().updateDeviceId("gw-1", "device-123");
    expect(useConnectionStore.getState().connections[0].device_id).toBe("device-123");
  });
});
