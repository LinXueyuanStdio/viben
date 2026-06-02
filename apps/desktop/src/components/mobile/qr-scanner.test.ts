import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-barcode-scanner", () => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
}));

import { checkPermissions, requestPermissions } from "@tauri-apps/plugin-barcode-scanner";
import { ensureQrScannerCameraPermission } from "./qr-scanner";

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
});
