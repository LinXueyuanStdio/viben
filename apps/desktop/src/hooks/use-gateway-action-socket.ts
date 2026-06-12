import { useEffect, useState } from "react";
import { gatewayActionSocket } from "@/lib/action-system/gateway-action-socket";
import { getGatewayUrl } from "@/lib/gateway/config";
import { getIdentitySync, getOrCreateIdentity } from "@/stores/client-id-store";

export function useGatewayActionSocket(): { state: string } {
  const [state, setState] = useState<string>(gatewayActionSocket.state);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const identity = getIdentitySync() ?? await getOrCreateIdentity();
      if (cancelled) return;

      const gatewayUrl = getGatewayUrl();
      gatewayActionSocket.connect(gatewayUrl, identity);
    }

    init();

    const interval = setInterval(() => {
      const current = gatewayActionSocket.state;
      setState((prev) => prev !== current ? current : prev);
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      gatewayActionSocket.disconnect();
    };
  }, []);

  return { state };
}
