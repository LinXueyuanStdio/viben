/**
 * Device WebSocket Hook
 *
 * Subscribes to the "devices" WebSocket channel and handles device/mesh events.
 * Updates Zustand store when devices connect, disconnect, or mesh peers change.
 */

import { useCallback, useRef } from "react";
import { useGatewayWebSocket, type GatewayEventPayload } from "./use-gateway-websocket";
import { useDeviceStore, type DeviceInfo } from "../stores/device-store";

type DeviceEventType =
  | "DeviceConnected"
  | "DeviceDisconnected"
  | "DeviceUpdated"
  | "MeshPeerJoined"
  | "MeshPeerLeft";

interface UseDeviceWebSocketOptions {
  enabled?: boolean;
  updateStore?: boolean;
}

export function useDeviceWebSocket(options: UseDeviceWebSocketOptions = {}) {
  const { enabled = true, updateStore = true } = options;

  const addDevice = useDeviceStore((s) => s.addDevice);
  const removeDevice = useDeviceStore((s) => s.removeDevice);
  const updateDevice = useDeviceStore((s) => s.updateDevice);

  const addDeviceRef = useRef(addDevice);
  const removeDeviceRef = useRef(removeDevice);
  const updateDeviceRef = useRef(updateDevice);

  addDeviceRef.current = addDevice;
  removeDeviceRef.current = removeDevice;
  updateDeviceRef.current = updateDevice;

  const handleEvent = useCallback((channel: string, payload: GatewayEventPayload) => {
    if (channel !== "devices") return;
    if (!updateStore) return;

    const eventType = payload.type as DeviceEventType;
    const data = payload.data as Record<string, unknown>;

    switch (eventType) {
      case "DeviceConnected":
        if (data.device) addDeviceRef.current(data.device as DeviceInfo);
        break;
      case "DeviceDisconnected":
        if (data.device_id) removeDeviceRef.current(data.device_id as string);
        break;
      case "DeviceUpdated":
        if (data.device) {
          const device = data.device as DeviceInfo;
          updateDeviceRef.current(device.id, device);
        }
        break;
      case "MeshPeerJoined":
        addDeviceRef.current({
          id: data.gateway_id as string,
          type: "gateway",
          name: data.name as string,
          gateway_id: data.gateway_id as string,
          platform: "desktop",
          status: "online",
          address: data.address as string | undefined,
          capabilities: [],
          connected_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        });
        break;
      case "MeshPeerLeft":
        if (data.gateway_id) removeDeviceRef.current(data.gateway_id as string);
        break;
    }
  }, [updateStore]);

  const { isConnected, state } = useGatewayWebSocket({
    channels: ["devices"],
    onEvent: handleEvent,
    enabled,
  });

  return { isConnected, state };
}
