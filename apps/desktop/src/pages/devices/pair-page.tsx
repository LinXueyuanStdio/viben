import { useEffect, useState } from "react";
import { useDeviceStore, type DeviceInfo } from "@/stores/device-store";
import { useDeviceWebSocket } from "@/hooks/use-device-websocket";
import { getGatewayUrl } from "@/lib/gateway/config";
import { getDevices, getDeviceQr, type QrResponse } from "@/lib/gateway/modules/devices";
import { Monitor, Smartphone, Wifi, WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function DeviceCard({ device }: { device: DeviceInfo }) {
  const Icon = device.type === "gateway" ? Monitor : Smartphone;
  const isOnline = device.status === "online";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div className={cn(
        "flex items-center justify-center h-9 w-9 rounded-full",
        isOnline ? "bg-green-500/10" : "bg-muted",
      )}>
        <Icon className={cn("h-4 w-4", isOnline ? "text-green-500" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{device.name}</div>
        <div className="text-xs text-muted-foreground">
          {device.type === "gateway" ? "Gateway" : "Client"} · {device.platform}
        </div>
      </div>
      {isOnline ? (
        <Wifi className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </div>
  );
}

export function DevicePairPage() {
  const devices = useDeviceStore((s) => s.devices);
  const setDevices = useDeviceStore((s) => s.setDevices);
  const [qr, setQr] = useState<QrResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useDeviceWebSocket({ enabled: true });

  useEffect(() => {
    const baseUrl = getGatewayUrl();
    Promise.all([
      getDeviceQr(baseUrl).catch(() => null),
      getDevices(baseUrl).catch(() => ({ devices: [] })),
    ]).then(([qrRes, devRes]) => {
      if (qrRes) setQr(qrRes);
      setDevices(devRes.devices);
      setLoading(false);
    });
  }, [setDevices]);

  const refreshQr = () => {
    setLoading(true);
    getDeviceQr(getGatewayUrl())
      .then(setQr)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Device Pairing</h1>
        <p className="text-muted-foreground mt-1">
          Scan the QR code below with your mobile device to connect
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col items-center gap-4 p-6 rounded-lg border bg-card">
          <h2 className="text-lg font-semibold">QR Code</h2>
          {loading ? (
            <div className="flex items-center justify-center h-64 w-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : qr?.qr_data_url ? (
            <img
              src={qr.qr_data_url}
              alt="Pairing QR Code"
              className="h-64 w-64 rounded-lg"
            />
          ) : (
            <div className="flex items-center justify-center h-64 w-64 rounded-lg bg-muted text-muted-foreground text-sm">
              Failed to generate QR code
            </div>
          )}
          <Button variant="outline" size="sm" onClick={refreshQr} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {qr?.payload?.name && (
            <p className="text-sm text-muted-foreground">
              Gateway: {qr.payload.name}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Connected Devices ({devices.length})</h2>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No devices connected. Scan the QR code from your mobile to pair.
            </p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <DeviceCard key={device.id} device={device} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
