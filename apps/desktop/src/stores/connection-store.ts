import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface GatewayConnection {
  gateway_id: string;
  name: string;
  lan_url?: string;
  tunnel_url?: string;
  device_id?: string;
  last_connected: string;
}

interface ConnectionState {
  connections: GatewayConnection[];
  active_gateway_id: string | null;
  addConnection: (conn: GatewayConnection) => void;
  removeConnection: (gatewayId: string) => void;
  setActive: (gatewayId: string) => void;
  getActive: () => GatewayConnection | undefined;
  updateDeviceId: (gatewayId: string, deviceId: string) => void;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connections: [],
      active_gateway_id: null,

      addConnection: (conn) => set((s) => {
        const filtered = s.connections.filter((c) => c.gateway_id !== conn.gateway_id);
        return { connections: [...filtered, conn] };
      }),

      removeConnection: (gatewayId) => set((s) => ({
        connections: s.connections.filter((c) => c.gateway_id !== gatewayId),
        active_gateway_id: s.active_gateway_id === gatewayId ? null : s.active_gateway_id,
      })),

      setActive: (gatewayId) => set({ active_gateway_id: gatewayId }),

      getActive: () => {
        const { connections, active_gateway_id } = get();
        return connections.find((c) => c.gateway_id === active_gateway_id);
      },

      updateDeviceId: (gatewayId, deviceId) => set((s) => ({
        connections: s.connections.map((c) =>
          c.gateway_id === gatewayId ? { ...c, device_id: deviceId } : c
        ),
      })),
    }),
    {
      name: "viben-gateway-connections",
      partialize: (state) => ({
        connections: state.connections,
        active_gateway_id: state.active_gateway_id,
      }),
    },
  ),
);
