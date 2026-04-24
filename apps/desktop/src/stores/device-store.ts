import { create } from "zustand";

export interface DeviceInfo {
  id: string;
  type: "gateway" | "client";
  name: string;
  gateway_id: string;
  platform: string;
  status: "online" | "offline";
  address?: string;
  capabilities: string[];
  connected_at: string;
  last_seen: string;
}

interface DeviceState {
  devices: DeviceInfo[];
  setDevices: (devices: DeviceInfo[]) => void;
  addDevice: (device: DeviceInfo) => void;
  removeDevice: (deviceId: string) => void;
  updateDevice: (deviceId: string, updates: Partial<DeviceInfo>) => void;
  getDevice: (id: string) => DeviceInfo | undefined;
  getGateways: () => DeviceInfo[];
}

export const useDeviceStore = create<DeviceState>()((set, get) => ({
  devices: [],
  setDevices: (devices) => set({ devices }),
  addDevice: (device) => set((s) => ({ devices: [...s.devices, device] })),
  removeDevice: (deviceId) => set((s) => ({ devices: s.devices.filter((d) => d.id !== deviceId) })),
  updateDevice: (deviceId, updates) => set((s) => ({
    devices: s.devices.map((d) => d.id === deviceId ? { ...d, ...updates } : d),
  })),
  getDevice: (id) => get().devices.find((d) => d.id === id),
  getGateways: () => get().devices.filter((d) => d.type === "gateway"),
}));
