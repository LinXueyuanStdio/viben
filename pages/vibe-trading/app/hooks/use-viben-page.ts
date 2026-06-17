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
      console.log("[vibe-trading] bindToSDK called");
      console.log("[vibe-trading] vibenPage.state:", vibenPage.state);
      console.log("[vibe-trading] vibenPage.clientId:", vibenPage.clientId);
      console.log("[vibe-trading] vibenPage.theme:", vibenPage.theme);
      console.log("[vibe-trading] vibenPage.gatewayUrl:", vibenPage.gatewayUrl);
      console.log("[vibe-trading] typeof vibenPage.onThemeChange:", typeof vibenPage.onThemeChange);

      setConnected(true);
      setClientId(vibenPage.clientId);
      unsubscribeState = vibenPage.onStateChange((connectionState: string) => {
        console.log("[vibe-trading] onStateChange:", connectionState);
        setConnected(connectionState === "connected");
      });
      if (vibenPage.theme === "dark") {
        console.log("[vibe-trading] applying dark theme on connect");
        document.documentElement.classList.add("dark");
      }
      if (typeof vibenPage.onThemeChange === "function") {
        unsubscribeTheme = vibenPage.onThemeChange((theme: string) => {
          console.log("[vibe-trading] onThemeChange fired:", theme);
          document.documentElement.classList.toggle("dark", theme === "dark");
        });
      } else {
        console.warn("[vibe-trading] vibenPage.onThemeChange is not a function!");
      }
      if (actionsRef.current) {
        unregisterActions = vibenPage.actions.register(pageUid, actionsRef.current);
        console.log("[vibe-trading] actions registered");
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
    console.log("[vibe-trading] SDK already loaded or script tag exists, skipping inject");
    return;
  }
  const resolvedGatewayUrl =
    gatewayUrl || process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18790";
  console.log("[vibe-trading] injecting SDK script from:", `${resolvedGatewayUrl}/api/page/_sdk/v1/viben-page-sdk.js`);
  const scriptElement = document.createElement("script");
  scriptElement.src = `${resolvedGatewayUrl}/api/page/_sdk/v1/viben-page-sdk.js`;
  scriptElement.dataset.vibenSdk = "true";
  if (pageUid) scriptElement.dataset.page = pageUid;
  scriptElement.onload = () => console.log("[vibe-trading] SDK script loaded successfully");
  scriptElement.onerror = (e) => console.error("[vibe-trading] SDK script load FAILED:", e);
  document.head.appendChild(scriptElement);
}
