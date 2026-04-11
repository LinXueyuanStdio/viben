/**
 * QR Code Generation Module
 *
 * Generates QR code data URLs for gateway connection payloads.
 * The qrcode package is an optional dependency -- throws if not available.
 */
import type QRCode from "qrcode";
import type { QrPayload } from "./types";

// Lazy-loaded qrcode module
let qrcodeModule: typeof QRCode | null = null;
let loadAttempted = false;

async function getQrcode(): Promise<typeof QRCode> {
  if (qrcodeModule) return qrcodeModule;
  if (loadAttempted) throw new Error("qrcode package not available");
  loadAttempted = true;
  try {
    qrcodeModule = (await import("qrcode")) as unknown as typeof QRCode;
    return qrcodeModule;
  } catch {
    throw new Error("qrcode package not available. Install it with: pnpm add qrcode");
  }
}

/**
 * Generate a QR code as a data URL from a gateway connection payload.
 *
 * @param payload - The QR payload containing gateway connection info
 * @returns A data URL string (e.g. "data:image/png;base64,...")
 */
export async function generateQrDataUrl(payload: QrPayload): Promise<string> {
  const qr = await getQrcode();
  const json = JSON.stringify(payload);
  return qr.toDataURL(json, { width: 256, margin: 2 });
}
