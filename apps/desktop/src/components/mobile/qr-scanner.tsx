import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { scan, Format } from "@tauri-apps/plugin-barcode-scanner";
import { Button } from "@/components/ui/button";
import { Camera, AlertCircle } from "lucide-react";

export interface QrPayload {
  type: "viben-gateway";
  gateway_id: string;
  name: string;
  lan?: string;
  tunnel?: string;
}

export function parseQrPayload(raw: string): QrPayload | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type !== "viben-gateway" || !parsed?.gateway_id || !parsed?.name) {
      return null;
    }
    return parsed as QrPayload;
  } catch {
    return null;
  }
}

interface QrScannerProps {
  onScan: (payload: QrPayload) => void;
  onError?: (error: string) => void;
}

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      const result = await scan({ formats: [Format.QRCode] });
      if (!result.content) {
        setScanning(false);
        return;
      }

      const payload = parseQrPayload(result.content);
      if (!payload) {
        const msg = t("mobile.qrScanner.invalidQrCode", "Invalid QR code. Please scan a Viben desktop QR code.");
        setError(msg);
        onError?.(msg);
        setScanning(false);
        return;
      }

      setScanning(false);
      onScan(payload);
    } catch (err) {
      setScanning(false);
      const msg = err instanceof Error ? err.message : t("mobile.qrScanner.cameraFailed", "Camera access failed");
      setError(msg);
      onError?.(msg);
    }
  }, [onScan, onError, t]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Button
        size="lg"
        onClick={handleScan}
        disabled={scanning}
        className="gap-2"
      >
        <Camera className="h-5 w-5" />
        {scanning ? t("mobile.qrScanner.scanning", "Scanning...") : t("mobile.qrScanner.scanQrCode", "Scan QR Code")}
      </Button>
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
