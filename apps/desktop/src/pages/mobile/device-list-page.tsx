import { useEffect } from "react";
import { useDeviceStore, type DeviceInfo } from "@/stores/device-store";
import { useDeviceWebSocket } from "@/hooks/use-device-websocket";
import { useConnectionStore } from "@/stores/connection-store";
import { getGatewayUrl } from "@/lib/gateway/config";
import { getDevices } from "@/lib/gateway/modules/devices";
import { Smartphone, Monitor, Globe, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

function DeviceCard({ device }: { device: DeviceInfo }) {
  const Icon = device.type === "gateway" ? Monitor : Smartphone;
  const isOnline = device.status === "online";

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
      <div className={cn(
        "flex items-center justify-center h-10 w-10 rounded-full",
        isOnline ? "bg-green-500/10" : "bg-muted",
      )}>
        <Icon className={cn("h-5 w-5", isOnline ? "text-green-500" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{device.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <span>{device.type === "gateway" ? "Gateway" : "Client"}</span>
          <span>·</span>
          <span>{device.platform}</span>
          {device.address && (
            <>
              <span>·</span>
              <Globe className="h-3 w-3" />
              <span className="truncate">{device.address}</span>
            </>
          )}
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

export function DeviceListPage() {
  const devices = useDeviceStore((s) => s.devices);
  const setDevices = useDeviceStore((s) => s.setDevices);
  const active = useConnectionStore((s) => s.getActive());

  // Subscribe to real-time device events
  useDeviceWebSocket({ enabled: !!active });

  // Fetch initial device list
  useEffect(() => {
    if (!active) return;
    getDevices(getGatewayUrl())
      .then((res) => setDevices(res.devices))
      .catch(() => { /* ignore — WS will provide updates */ });
  }, [active, setDevices]);

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-6">
        <Monitor className="h-12 w-12" />
        <p>Not connected to any Gateway</p>
        <p className="text-sm">Go to Connect to pair with your desktop</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-semibold">Devices ({devices.length})</h2>
      {devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No devices found in the mesh.</p>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}
