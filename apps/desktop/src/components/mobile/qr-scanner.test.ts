import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-barcode-scanner", () => ({
  Format: {
    QRCode: "QR_CODE",
  },
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  scan: vi.fn(),
}));

import { checkPermissions, Format, requestPermissions, scan } from "@tauri-apps/plugin-barcode-scanner";
import { ensureQrScannerCameraPermission, scanQrCode } from "./qr-scanner";

describe("ensureQrScannerCameraPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests camera permission before scanning when Android still needs a prompt", async () => {
    vi.mocked(checkPermissions).mockResolvedValue("prompt");
    vi.mocked(requestPermissions).mockResolvedValue("granted");

    await expect(ensureQrScannerCameraPermission()).resolves.toBe(true);

    expect(checkPermissions).toHaveBeenCalledTimes(1);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it("requests camera permission when Android reports denied before the first prompt", async () => {
    vi.mocked(checkPermissions).mockResolvedValue("denied");
    vi.mocked(requestPermissions).mockResolvedValue("granted");

    await expect(ensureQrScannerCameraPermission()).resolves.toBe(true);

    expect(checkPermissions).toHaveBeenCalledTimes(1);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it("scans QR codes with the back camera", async () => {
    const scanned = {
      content: JSON.stringify({
        type: "viben-gateway",
        gateway_id: "gateway-1",
        name: "Desktop",
      }),
      format: Format.QRCode,
      bounds: null,
    };
    vi.mocked(scan).mockResolvedValue(scanned);

    await expect(scanQrCode()).resolves.toBe(scanned);

    expect(scan).toHaveBeenCalledWith({ formats: [Format.QRCode], cameraDirection: "back" });
  });
});
