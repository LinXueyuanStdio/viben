import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type { MeshMessage, PeerInfo } from "./types";

export interface PeerConnectionEvents {
  message: [msg: MeshMessage];
  close: [code: number, reason: string];
  error: [err: Error];
  ready: [info: PeerInfo];
}

export class PeerConnection extends EventEmitter {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private peerInfo: PeerInfo | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;

  constructor(
    private localInfo: PeerInfo,
    private maxReconnectDelay = 60000,
  ) {
    super();
  }

  /** Connect as initiator to a remote gateway */
  connectTo(url: string): void {
    this.manualClose = false;
    const wsUrl = url.replace(/^http/, "ws") + "/api/mesh/ws";
    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      this.send({ type: "Hello", data: this.localInfo });
      this.startHeartbeat();
    });

    this.ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as MeshMessage;
        if (msg.type === "Pong") return;
        if (msg.type === "Welcome") {
          this.peerInfo = {
            gateway_id: msg.data.gateway_id,
            name: msg.data.name,
            version: msg.data.version,
            capabilities: msg.data.capabilities,
            address: msg.data.address,
          };
          this.reconnectAttempts = 0;
          this.emit("ready", this.peerInfo);
        }
        this.emit("message", msg);
      } catch {
        /* ignore parse errors */
      }
    });

    this.ws.on("close", (code: number, reason: Buffer) => {
      this.stopHeartbeat();
      this.emit("close", code, reason.toString());
      if (!this.manualClose) this.scheduleReconnect(url);
    });

    this.ws.on("error", (err: Error) => {
      this.emit("error", err);
    });
  }

  /** Accept an incoming WebSocket (server side) */
  accept(ws: WebSocket, remoteInfo: PeerInfo, knownPeers?: PeerInfo[]): void {
    this.manualClose = false;
    this.ws = ws;
    this.peerInfo = remoteInfo;

    // Send Welcome with our info and known peers
    const welcomeData = { ...this.localInfo, peers: knownPeers ?? [] };
    this.send({ type: "Welcome", data: welcomeData });
    this.startHeartbeat();

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as MeshMessage;
        if (msg.type === "Pong") return;
        this.emit("message", msg);
      } catch {
        /* ignore */
      }
    });

    ws.on("close", (code: number, reason: Buffer) => {
      this.stopHeartbeat();
      this.emit("close", code, reason.toString());
    });

    ws.on("error", (err: Error) => this.emit("error", err));

    this.emit("ready", remoteInfo);
  }

  send(msg: MeshMessage): boolean {
    if (!this.ws || this.ws.readyState !== 1 /* WebSocket.OPEN */) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  getPeerInfo(): PeerInfo | null {
    return this.peerInfo;
  }

  close(): void {
    this.manualClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "Ping" });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(url: string): void {
    const delay = Math.min(
      1000 * 2 ** this.reconnectAttempts,
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connectTo(url), delay);
  }
}
