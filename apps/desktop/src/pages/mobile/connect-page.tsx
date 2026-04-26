import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { QrScanner, type QrPayload } from "@/components/mobile/qr-scanner";
import { useConnectionStore } from "@/stores/connection-store";
import { setGatewayUrl, pingGatewayUrl } from "@/lib/gateway/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Keyboard } from "lucide-react";
import { isMobile } from "@/lib/platform";

export function ConnectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addConnection = useConnectionStore((s) => s.addConnection);
  const setActive = useConnectionStore((s) => s.setActive);
  const connections = useConnectionStore((s) => s.connections);

  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  const connectToGateway = useCallback(async (
    gatewayId: string,
    name: string,
    lanUrl?: string,
    tunnelUrl?: string,
  ) => {
    setConnecting(true);
    setError(null);

    const urls = [lanUrl, tunnelUrl].filter(Boolean) as string[];
    let reachableUrl: string | null = null;

    for (const url of urls) {
      if (await pingGatewayUrl(url)) {
        reachableUrl = url;
        break;
      }
    }

    if (!reachableUrl) {
      setError(t("mobile.connect.cannotReach", "Cannot reach desktop Gateway. Ensure you're on the same network."));
      setConnecting(false);
      return;
    }

    setGatewayUrl(reachableUrl);
    addConnection({
      gateway_id: gatewayId,
      name,
      lan_url: lanUrl,
      tunnel_url: tunnelUrl,
      last_connected: new Date().toISOString(),
    });
    setActive(gatewayId);
    setConnecting(false);
    navigate("/m/devices");
  }, [addConnection, setActive, navigate, t]);

  const handleQrScan = useCallback((payload: QrPayload) => {
    connectToGateway(payload.gateway_id, payload.name, payload.lan, payload.tunnel);
  }, [connectToGateway]);

  const handleManualConnect = useCallback(async () => {
    const url = manualUrl.trim().replace(/\/$/, "");
    if (!url) return;

    setConnecting(true);
    setError(null);

    if (!(await pingGatewayUrl(url))) {
      setError(t("mobile.connect.cannotReachUrl", { url, defaultValue: "Cannot reach {{url}}" }));
      setConnecting(false);
      return;
    }

    setGatewayUrl(url);
    addConnection({
      gateway_id: url,
      name: url,
      lan_url: url,
      last_connected: new Date().toISOString(),
    });
    setActive(url);
    setConnecting(false);
    setManualOpen(false);
    navigate("/m/devices");
  }, [manualUrl, addConnection, setActive, navigate, t]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">{t("mobile.connect.title", "Connect to Desktop")}</h1>
        <p className="text-muted-foreground">
          {t("mobile.connect.subtitle", "Scan the QR code shown on your desktop's Devices page")}
        </p>
      </div>

      {connecting ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm text-muted-foreground">{t("mobile.status.connecting", "Connecting...")}</span>
        </div>
      ) : (
        <>
          {isMobile() && <QrScanner onScan={handleQrScan} />}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>{t("mobile.connect.or", "or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" onClick={() => setManualOpen(true)} className="gap-2">
            <Keyboard className="h-4 w-4" />
            {t("mobile.connect.enterUrlManually", "Enter URL manually")}
          </Button>
        </>
      )}

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      {connections.length > 0 && (
        <div className="w-full max-w-sm">
          <h3 className="text-sm font-medium mb-2">{t("mobile.connect.recentConnections", "Recent connections")}</h3>
          <div className="space-y-2">
            {connections.map((conn) => (
              <Button
                key={conn.gateway_id}
                variant="ghost"
                className="w-full justify-start"
                onClick={() => connectToGateway(
                  conn.gateway_id,
                  conn.name,
                  conn.lan_url,
                  conn.tunnel_url,
                )}
              >
                {conn.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mobile.connect.enterGatewayUrl", "Enter Gateway URL")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="http://192.168.1.100:18790"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualConnect()}
          />
          <DialogFooter>
            <Button onClick={handleManualConnect} disabled={connecting || !manualUrl.trim()}>
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("mobile.connect.connectButton", "Connect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
