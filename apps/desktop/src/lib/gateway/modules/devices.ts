/**
 * Devices & Mesh Module
 * 设备与 Mesh 网络模块
 */

import type { DeviceInfo } from "../../../stores/device-store";
import { GatewayError } from "../error";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new GatewayError(text || res.statusText, res.status);
  }
  return res.json();
}

export interface DeviceListResponse {
  devices: DeviceInfo[];
}

export interface QrResponse {
  qr_data_url: string;
  payload: {
    type: string;
    gateway_id: string;
    name: string;
    lan?: string;
    tunnel?: string;
  };
}

export interface SendMessageRequest {
  to_gateway: string;
  to_device?: string;
  action: string;
  payload: unknown;
}

export interface SendMessageResponse {
  message_id: string;
  status: string;
}

export async function getDevices(baseUrl: string): Promise<DeviceListResponse> {
  const res = await fetch(`${baseUrl}/api/devices`);
  return handleResponse<DeviceListResponse>(res);
}

export async function getDevice(baseUrl: string, id: string): Promise<DeviceInfo> {
  const res = await fetch(`${baseUrl}/api/devices/${id}`);
  return handleResponse<DeviceInfo>(res);
}

export async function disconnectDevice(baseUrl: string, id: string): Promise<{ success: boolean; device_id: string }> {
  const res = await fetch(`${baseUrl}/api/devices/${id}`, { method: "DELETE" });
  return handleResponse<{ success: boolean; device_id: string }>(res);
}

export async function getDeviceQr(baseUrl: string): Promise<QrResponse> {
  const res = await fetch(`${baseUrl}/api/devices/qr`);
  return handleResponse<QrResponse>(res);
}

export async function sendDeviceMessage(baseUrl: string, req: SendMessageRequest): Promise<SendMessageResponse> {
  const res = await fetch(`${baseUrl}/api/devices/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleResponse<SendMessageResponse>(res);
}

export async function getMeshPeers(baseUrl: string): Promise<{ peers: unknown[] }> {
  const res = await fetch(`${baseUrl}/api/mesh/peers`);
  return handleResponse<{ peers: unknown[] }>(res);
}

export async function connectMeshPeer(baseUrl: string, address: string): Promise<{ status: string }> {
  const res = await fetch(`${baseUrl}/api/mesh/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  return handleResponse<{ status: string }>(res);
}
