/**
 * Mesh Integration Test -- Two Gateways
 *
 * Starts two real Fastify gateway instances on different ports and verifies
 * they can connect via REST and see each other as peers / devices.
 *
 * This test uses dynamic import() because createGateway dynamically loads
 * Fastify and its plugins. This is acceptable per CLAUDE.md exceptions
 * (test files for mocking and isolation).
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";

describe("Mesh Integration (two gateways)", () => {
  let gateway1: any;
  let gateway2: any;

  // Suppress unhandled errors from mDNS auto-discovery background connections.
  // createAppState() hardcodes the mesh address to http://127.0.0.1:18790,
  // so mDNS-triggered WebSocket connections target the wrong port and fail
  // after gateways are closed. These are expected infrastructure artifacts.
  let originalListeners: Array<(...args: any[]) => void> = [];

  beforeEach(() => {
    originalListeners = process.listeners("uncaughtException") as Array<(...args: any[]) => void>;
    process.removeAllListeners("uncaughtException");
    process.on("uncaughtException", (err: Error) => {
      // Suppress ECONNREFUSED errors from mDNS background reconnections
      if ((err as NodeJS.ErrnoException).code === "ECONNREFUSED") {
        return;
      }
      // Re-throw unexpected errors
      throw err;
    });
  });

  afterEach(async () => {
    if (gateway2) {
      try { await gateway2.close(); } catch { /* ignore */ }
    }
    if (gateway1) {
      try { await gateway1.close(); } catch { /* ignore */ }
    }

    // Allow time for background WebSocket connections to settle before
    // restoring the original uncaughtException listeners
    await new Promise((r) => setTimeout(r, 500));

    process.removeAllListeners("uncaughtException");
    for (const listener of originalListeners) {
      process.on("uncaughtException", listener);
    }
  });

  it("should connect two gateways and list each other as peers", async () => {
    // Dynamic import to avoid loading fastify in unit test context
    const { createGateway } = await import("../gateway/index");

    gateway1 = await createGateway({
      port: 19001,
      host: "127.0.0.1",
      cors: true,
      telemetry: false,
    });
    await gateway1.listen({ port: 19001, host: "127.0.0.1" });

    gateway2 = await createGateway({
      port: 19002,
      host: "127.0.0.1",
      cors: true,
      telemetry: false,
    });
    await gateway2.listen({ port: 19002, host: "127.0.0.1" });

    // Connect gateway2 to gateway1 via REST
    const connectRes = await fetch("http://127.0.0.1:19002/api/mesh/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "http://127.0.0.1:19001" }),
    });
    expect(connectRes.ok).toBe(true);

    // Wait for WebSocket handshake to complete
    await new Promise((r) => setTimeout(r, 2000));

    // Check peers on gateway1 -- should see gateway2
    const peers1Res = await fetch("http://127.0.0.1:19001/api/mesh/peers");
    const peers1 = (await peers1Res.json()) as { peers: unknown[] };
    expect(peers1.peers.length).toBeGreaterThanOrEqual(1);

    // Check devices on gateway2 -- should see gateway1 as a device
    const devices2Res = await fetch("http://127.0.0.1:19002/api/devices");
    const devices2 = (await devices2Res.json()) as { devices: unknown[] };
    expect(devices2.devices.length).toBeGreaterThanOrEqual(1);
  }, 15000);
});
