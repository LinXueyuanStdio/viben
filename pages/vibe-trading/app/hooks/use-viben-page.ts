"use client";

import { useEffect, useRef, useState } from "react";

type ActionDefinition =
  | ((...args: any[]) => Promise<any>)
  | {
      description: string;
      inputSchema?: Record<string, unknown>;
      execute: (...args: any[]) => Promise<any>;
    };

interface UseVibenPageOptions {
  gatewayUrl?: string;
  enabled?: boolean;
}

export function useVibenPage(
  pageUid: string,
  actions?: Record<string, ActionDefinition>,
  options?: UseVibenPageOptions
) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    ensureVibenSDKLoaded(options?.gatewayUrl, pageUid);

    let unsubscribeState: (() => void) | undefined;
    let unsubscribeTheme: (() => void) | undefined;
    let unregisterActions: (() => void) | undefined;

    function bindToSDK(vibenPage: any) {
      setConnected(true);
      setClientId(vibenPage.clientId);
      unsubscribeState = vibenPage.onStateChange((connectionState: string) => {
        setConnected(connectionState === "connected");
      });
      // SDK's notifyThemeChange already toggles .dark on documentElement,
      // but we also apply the initial theme from client:init
      if (vibenPage.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      if (typeof vibenPage.onThemeChange === "function") {
        unsubscribeTheme = vibenPage.onThemeChange(() => {});
      }
      if (actionsRef.current) {
        unregisterActions = vibenPage.actions.register(pageUid, actionsRef.current);
      }
    }

    const vibenPage = (window as any).VibenPage;
    if (vibenPage?.state === "connected") {
      bindToSDK(vibenPage);
    } else {
      const handleConnected = (event: Event) => bindToSDK((event as CustomEvent).detail);
      window.addEventListener("viben:connected", handleConnected, { once: true });
      return () => window.removeEventListener("viben:connected", handleConnected);
    }

    return () => {
      unsubscribeState?.();
      unsubscribeTheme?.();
      unregisterActions?.();
    };
  }, [pageUid, enabled]);

  return { connected, clientId };
}

function ensureVibenSDKLoaded(gatewayUrl?: string, pageUid?: string) {
  if ((window as any).VibenPage || document.querySelector("[data-viben-sdk]")) {
    return;
  }
  const resolvedGatewayUrl =
    gatewayUrl || process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18790";
  const scriptElement = document.createElement("script");
  scriptElement.src = `${resolvedGatewayUrl}/api/page/_sdk/v1/viben-page-sdk.js`;
  scriptElement.dataset.vibenSdk = "true";
  if (pageUid) scriptElement.dataset.page = pageUid;
  document.head.appendChild(scriptElement);
}
