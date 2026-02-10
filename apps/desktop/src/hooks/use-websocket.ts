/**
 * React hook for WebSocket with heartbeat and auto-reconnect
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  WebSocketManager,
  WebSocketManagerOptions,
  WebSocketState,
} from "@/lib/websocket-manager";

export interface UseWebSocketOptions extends Omit<WebSocketManagerOptions, "url" | "onStateChange" | "onMessage" | "onError" | "onOpen" | "onClose"> {
  /** Called when a message is received */
  onMessage?: (data: unknown) => void;
  /** Called when an error occurs */
  onError?: (error: Event) => void;
  /** Called when connection opens */
  onOpen?: () => void;
  /** Called when connection closes */
  onClose?: (event: CloseEvent) => void;
}

export interface UseWebSocketReturn {
  /** Current connection state */
  state: WebSocketState;
  /** Whether connected */
  isConnected: boolean;
  /** Send string/binary data */
  send: (data: string | ArrayBuffer | Blob) => boolean;
  /** Send JSON data */
  sendJSON: (data: unknown) => boolean;
  /** Manually connect */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
}

/**
 * Hook for WebSocket connection with heartbeat and auto-reconnect
 *
 * @param url - WebSocket URL to connect to (null to skip connection)
 * @param options - WebSocket options
 * @returns WebSocket state and methods
 *
 * @example
 * ```tsx
 * const { state, isConnected, send, sendJSON } = useWebSocket(
 *   "ws://localhost:8080/ws",
 *   {
 *     onMessage: (data) => console.log("Received:", data),
 *     heartbeatInterval: 30000,
 *   }
 * );
 * ```
 */
export function useWebSocket(
  url: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const [state, setState] = useState<WebSocketState>("disconnected");
  const managerRef = useRef<WebSocketManager | null>(null);

  // Store callbacks in refs to avoid recreating manager on callback changes
  const onMessageRef = useRef(options.onMessage);
  const onErrorRef = useRef(options.onError);
  const onOpenRef = useRef(options.onOpen);
  const onCloseRef = useRef(options.onClose);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = options.onMessage;
  }, [options.onMessage]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  useEffect(() => {
    onOpenRef.current = options.onOpen;
  }, [options.onOpen]);

  useEffect(() => {
    onCloseRef.current = options.onClose;
  }, [options.onClose]);

  // Create/recreate manager when URL changes
  useEffect(() => {
    if (!url) {
      if (managerRef.current) {
        managerRef.current.disconnect();
        managerRef.current = null;
      }
      setState("disconnected");
      return;
    }

    // Disconnect existing manager
    if (managerRef.current) {
      managerRef.current.disconnect();
    }

    // Create new manager
    managerRef.current = new WebSocketManager({
      url,
      heartbeatInterval: options.heartbeatInterval,
      heartbeatTimeout: options.heartbeatTimeout,
      reconnectDelay: options.reconnectDelay,
      maxReconnectDelay: options.maxReconnectDelay,
      maxReconnectAttempts: options.maxReconnectAttempts,
      autoConnect: options.autoConnect ?? true,
      protocols: options.protocols,
      onStateChange: setState,
      onMessage: (data) => onMessageRef.current?.(data),
      onError: (error) => onErrorRef.current?.(error),
      onOpen: () => onOpenRef.current?.(),
      onClose: (event) => onCloseRef.current?.(event),
    });

    return () => {
      managerRef.current?.disconnect();
      managerRef.current = null;
    };
  }, [
    url,
    options.heartbeatInterval,
    options.heartbeatTimeout,
    options.reconnectDelay,
    options.maxReconnectDelay,
    options.maxReconnectAttempts,
    options.autoConnect,
    options.protocols,
  ]);

  const send = useCallback((data: string | ArrayBuffer | Blob) => {
    return managerRef.current?.send(data) ?? false;
  }, []);

  const sendJSON = useCallback((data: unknown) => {
    return managerRef.current?.sendJSON(data) ?? false;
  }, []);

  const connect = useCallback(() => {
    managerRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    managerRef.current?.disconnect();
  }, []);

  return {
    state,
    isConnected: state === "connected",
    send,
    sendJSON,
    connect,
    disconnect,
  };
}

export type { WebSocketState } from "@/lib/websocket-manager";
