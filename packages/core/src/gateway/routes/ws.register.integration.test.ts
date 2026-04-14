import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { createGateway } from "../index";
import type { FastifyInstance } from "fastify";

// Suppress ECONNREFUSED errors from mesh peer reconnection attempts during tests.
// When the gateway starts, it tries to reconnect to previously known peers (default port 18790).
// These connection attempts fail in test environments and produce uncaught exceptions.
function suppressMeshReconnectErrors(err: Error): void {
  if ((err as NodeJS.ErrnoException).code === "ECONNREFUSED") return;
  throw err;
}

describe("WS Register integration", () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(async () => {
    process.on("uncaughtException", suppressMeshReconnectErrors);
    server = await createGateway({ port: 0, host: "127.0.0.1", telemetry: false });
    await server.listen({ port: 0, host: "127.0.0.1" });
    const address = server.server.address();
    port = typeof address === "object" && address ? address.port : 0;
  }, 30000);

  afterAll(async () => {
    await server.close();
    process.off("uncaughtException", suppressMeshReconnectErrors);
  });

  it("registers a device and unregisters on close", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
    });

    // Send Register
    ws.send(JSON.stringify({
      type: "Register",
      data: { name: "Test Phone", platform: "mobile" },
    }));

    // Wait for Registered response
    const response = await new Promise<any>((resolve) => {
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "Registered") resolve(msg);
      });
    });

    expect(response.type).toBe("Registered");
    expect(response.data.device_id).toBeTruthy();
    expect(response.data.gateway_id).toBeTruthy();

    const deviceId = response.data.device_id;

    // Verify device appears in GET /api/devices
    const devicesRes = await fetch(`http://127.0.0.1:${port}/api/devices`);
    const devicesData = await devicesRes.json();
    const registeredDevice = devicesData.devices.find((d: any) => d.id === deviceId);
    expect(registeredDevice).toBeTruthy();
    expect(registeredDevice.name).toBe("Test Phone");
    expect(registeredDevice.platform).toBe("mobile");
    expect(registeredDevice.status).toBe("online");

    // Close WebSocket
    ws.close();

    // Wait for cleanup
    await new Promise((r) => setTimeout(r, 200));

    // Verify device is now offline or removed
    const devicesRes2 = await fetch(`http://127.0.0.1:${port}/api/devices`);
    const devicesData2 = await devicesRes2.json();
    const afterClose = devicesData2.devices.find((d: any) => d.id === deviceId);
    if (afterClose) {
      expect(afterClose.status).toBe("offline");
    }
  }, 15000);

  it("reconnects with saved device_id", async () => {
    const ws1 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise<void>((resolve) => { ws1.on("open", resolve); });

    // First registration
    ws1.send(JSON.stringify({
      type: "Register",
      data: { name: "Phone", platform: "mobile" },
    }));

    const resp1 = await new Promise<any>((resolve) => {
      ws1.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "Registered") resolve(msg);
      });
    });

    const deviceId = resp1.data.device_id;
    ws1.close();
    await new Promise((r) => setTimeout(r, 200));

    // Reconnect with saved device_id
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise<void>((resolve) => { ws2.on("open", resolve); });

    ws2.send(JSON.stringify({
      type: "Register",
      data: { name: "Phone", platform: "mobile", device_id: deviceId },
    }));

    const resp2 = await new Promise<any>((resolve) => {
      ws2.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "Registered") resolve(msg);
      });
    });

    expect(resp2.data.device_id).toBe(deviceId);
    ws2.close();
  }, 15000);
});
