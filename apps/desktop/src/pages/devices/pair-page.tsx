import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDeviceStore, type DeviceInfo } from "@/stores/device-store";
import { useDeviceWebSocket } from "@/hooks/use-device-websocket";
import { getGatewayUrl } from "@/lib/gateway/config";
import { getDevices, getDeviceQr, disconnectDevice, type QrResponse } from "@/lib/gateway/modules/devices";
import {
  Monitor,
  Smartphone,
  Tablet,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  QrCode,
  Copy,
  Check,
  MoreVertical,
  Trash2,
  Info,
  Laptop,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";

function getDeviceIcon(type: string, platform?: string) {
  if (type === "gateway") return Server;
  if (platform?.toLowerCase().includes("tablet") || platform?.toLowerCase().includes("ipad")) return Tablet;
  if (platform?.toLowerCase().includes("desktop") || platform?.toLowerCase().includes("mac") || platform?.toLowerCase().includes("windows")) return Laptop;
  if (platform?.toLowerCase().includes("mobile") || platform?.toLowerCase().includes("android") || platform?.toLowerCase().includes("iphone")) return Smartphone;
  return Monitor;
}

function formatLastSeen(timestamp: string | undefined, t: (key: string) => string): string {
  if (!timestamp) return t("devices.never");
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t("common.justNow");
  if (diffMin < 60) return `${diffMin}${t("common.minutesAgo")}`;
  if (diffHour < 24) return `${diffHour}${t("common.hoursAgo")}`;
  return `${diffDay}${t("common.daysAgo")}`;
}

interface DeviceCardProps {
  device: DeviceInfo;
  onViewDetails: (device: DeviceInfo) => void;
  onDisconnect: (device: DeviceInfo) => void;
}

function DeviceCard({ device, onViewDetails, onDisconnect }: DeviceCardProps) {
  const { t } = useTranslation();
  const Icon = getDeviceIcon(device.type, device.platform);
  const isOnline = device.status === "online";

  return (
    <Card className={cn(
      "transition-colors duration-200",
      isOnline ? "border-green-500/30" : "border-border"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "flex items-center justify-center h-12 w-12 rounded-xl shrink-0",
            "transition-colors duration-200",
            isOnline
              ? "bg-gradient-to-br from-green-500/20 to-emerald-500/10"
              : "bg-muted"
          )}>
            <Icon className={cn(
              "h-6 w-6 transition-colors",
              isOnline ? "text-green-500" : "text-muted-foreground"
            )} />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{device.name}</span>
              <Badge
                variant={isOnline ? "default" : "secondary"}
                className={cn(
                  "text-xs px-1.5 py-0",
                  isOnline && "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                )}
              >
                {isOnline ? t("devices.online") : t("devices.offline")}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div className="flex items-center gap-2">
                <span>{device.type === "gateway" ? t("devices.gateway") : t("devices.client")}</span>
                {device.platform && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{device.platform}</span>
                  </>
                )}
              </div>
              {device.last_seen && (
                <div className="text-muted-foreground/70">
                  {t("devices.lastSeen")}: {formatLastSeen(device.last_seen, t)}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOnline ? (
              <Tooltip>
                <TooltipTrigger>
                  <Wifi className="h-4 w-4 text-green-500" />
                </TooltipTrigger>
                <TooltipContent>{t("devices.connected")}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger>
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>{t("devices.disconnected")}</TooltipContent>
              </Tooltip>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDetails(device)}>
                  <Info className="h-4 w-4 mr-2" />
                  {t("devices.viewDetails")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDisconnect(device)}
                  className="text-destructive focus:text-destructive"
                  disabled={!isOnline}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("devices.disconnect")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DeviceDetailsDialogProps {
  device: DeviceInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DeviceDetailsDialog({ device, open, onOpenChange }: DeviceDetailsDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copyId = useCallback(() => {
    if (device?.id) {
      navigator.clipboard.writeText(device.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("common.copied"));
    }
  }, [device?.id, t]);

  if (!device) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("devices.deviceDetails")}</DialogTitle>
          <DialogDescription>{device.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground mb-1">{t("devices.deviceId")}</div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded truncate flex-1">
                  {device.id}
                </code>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyId}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">{t("devices.type")}</div>
              <div>{device.type === "gateway" ? t("devices.gateway") : t("devices.client")}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">{t("devices.platform")}</div>
              <div>{device.platform || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">{t("common.status")}</div>
              <Badge variant={device.status === "online" ? "default" : "secondary"}>
                {device.status === "online" ? t("devices.online") : t("devices.offline")}
              </Badge>
            </div>
            {device.last_seen && (
              <div className="col-span-2">
                <div className="text-muted-foreground mb-1">{t("devices.lastSeen")}</div>
                <div>{new Date(device.last_seen).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DevicePairPage() {
  const { t } = useTranslation();
  const { logEvent } = useAnalytics();
  const devices = useDeviceStore((s) => s.devices);
  const setDevices = useDeviceStore((s) => s.setDevices);
  const removeDevice = useDeviceStore((s) => s.removeDevice);
  const [qr, setQr] = useState<QrResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<DeviceInfo | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useDeviceWebSocket({ enabled: true });

  const loadData = useCallback(async () => {
    const baseUrl = getGatewayUrl();
    const [qrRes, devRes] = await Promise.all([
      getDeviceQr(baseUrl).catch(() => null),
      getDevices(baseUrl).catch(() => ({ devices: [] })),
    ]);
    if (qrRes) {
      setQr(qrRes);
      try {
        logEvent(AnalyticsEvents.DEVICE_QR_CODE_GENERATED, { device_type: "gateway" });
      } catch {}
    }
    setDevices(devRes.devices);
  }, [setDevices, logEvent]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // Track device_pair_page_opened
  useEffect(() => {
    try { logEvent(AnalyticsEvents.DEVICE_PAIR_PAGE_OPENED, { source: "sidebar" }); } catch {}
  }, []);

  const refreshQr = useCallback(async () => {
    setRefreshing(true);
    try {
      const qrRes = await getDeviceQr(getGatewayUrl());
      setQr(qrRes);
      toast.success(t("devices.qrRefreshed"));
    } catch {
      toast.error(t("devices.qrRefreshFailed"));
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  const handleViewDetails = useCallback((device: DeviceInfo) => {
    setSelectedDevice(device);
    setDetailsOpen(true);
  }, []);

  const handleDisconnect = useCallback((device: DeviceInfo) => {
    setDisconnectTarget(device);
  }, []);

  const confirmDisconnect = useCallback(async () => {
    if (!disconnectTarget) return;
    setDisconnecting(true);
    try {
      await disconnectDevice(getGatewayUrl(), disconnectTarget.id);
      removeDevice(disconnectTarget.id);
      toast.success(t("devices.disconnectSuccess", { name: disconnectTarget.name }));
    } catch {
      toast.error(t("devices.disconnectFailed"));
    } finally {
      setDisconnecting(false);
      setDisconnectTarget(null);
    }
  }, [disconnectTarget, removeDevice, t]);

  const onlineCount = devices.filter(d => d.status === "online").length;

  return (
    <TooltipProvider>
      <div className="h-full overflow-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("devices.pairTitle")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("devices.pairDescription")}
            </p>
          </div>
          <Button variant="outline" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {t("common.refresh")}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* QR Code Section - 2 columns */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <QrCode className="h-5 w-5" />
                {t("devices.qrCode")}
              </CardTitle>
              <CardDescription>
                {t("devices.qrDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="relative">
                {loading ? (
                  <div className="flex items-center justify-center h-56 w-56 rounded-xl bg-muted">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : qr?.qr_data_url ? (
                  <div className="relative group">
                    <img
                      src={qr.qr_data_url}
                      alt={t("devices.pairingQrAlt", "Pairing QR Code")}
                      className="h-56 w-56 rounded-xl shadow-lg"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={refreshQr}
                        disabled={refreshing}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                        {t("common.refresh")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-56 w-56 rounded-xl bg-muted text-muted-foreground gap-2">
                    <QrCode className="h-8 w-8" />
                    <span className="text-sm text-center px-4">
                      {t("devices.qrGenerateFailed")}
                    </span>
                    <Button variant="outline" size="sm" onClick={refreshQr}>
                      {t("devices.retry")}
                    </Button>
                  </div>
                )}
              </div>

              {qr?.payload && (
                <div className="text-center space-y-1">
                  <div className="text-sm font-medium">{qr.payload.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {qr.payload.lan && <span>{t("devices.lan", "LAN")}: {qr.payload.lan}</span>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Devices Section - 3 columns */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {t("devices.connectedDevices")}
                <Badge variant="secondary" className="text-xs">
                  {onlineCount}/{devices.length}
                </Badge>
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : devices.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Smartphone className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-2">
                    {t("devices.noDevices")}
                  </p>
                  <p className="text-sm text-muted-foreground/70">
                    {t("devices.scanToConnect")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {devices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onViewDetails={handleViewDetails}
                    onDisconnect={handleDisconnect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Device Details Dialog */}
        <DeviceDetailsDialog
          device={selectedDevice}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />

        {/* Disconnect Confirmation Dialog */}
        <AlertDialog
          open={!!disconnectTarget}
          onOpenChange={(open) => { if (!open) setDisconnectTarget(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("devices.disconnectConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("devices.disconnectConfirmDescription", { name: disconnectTarget?.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={disconnecting}>
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDisconnect}
                disabled={disconnecting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("devices.disconnecting")}
                  </>
                ) : (
                  t("devices.disconnect")
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
