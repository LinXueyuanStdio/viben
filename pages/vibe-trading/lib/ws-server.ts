import { WebSocketServer, WebSocket } from "ws";
import { readEventsFrom, countLines } from "./session-store";

const WS_PORT = 3001;

let wss: WebSocketServer | null = null;

// Clients grouped by sessionId
const sessionClients = new Map<string, Set<WebSocket>>();

export function getWsServer(): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ port: WS_PORT });

  wss.on("connection", (ws, req) => {
    // URL: ws://localhost:3001?session_id=xxx&from_line=0
    const url = new URL(req.url ?? "", `http://localhost:${WS_PORT}`);
    const sessionId = url.searchParams.get("session_id");
    const fromLine = parseInt(url.searchParams.get("from_line") ?? "0");

    if (!sessionId) {
      ws.close(4000, "Missing session_id");
      return;
    }

    // Register client
    if (!sessionClients.has(sessionId)) {
      sessionClients.set(sessionId, new Set());
    }
    sessionClients.get(sessionId)!.add(ws);

    // Send initial events
    sendEventsToClient(ws, sessionId, fromLine);

    // Handle close
    ws.on("close", () => {
      const clients = sessionClients.get(sessionId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) sessionClients.delete(sessionId);
      }
    });

    // Handle ping/pong for keepalive
    ws.on("pong", () => {
      /* client is alive */
    });
  });

  // Heartbeat: ping all clients every 30s
  setInterval(() => {
    wss?.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30000);

  console.log(`[ws] WebSocket server running on port ${WS_PORT}`);
  return wss;
}

async function sendEventsToClient(ws: WebSocket, sessionId: string, fromLine: number) {
  try {
    const events = await readEventsFrom(sessionId, fromLine);
    const totalLines = await countLines(sessionId);
    if (events.length > 0 && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ events, total_lines: totalLines }));
    }
  } catch {
    // Session may not exist
  }
}

// Called by session-store after appending events
export function broadcastToSession(sessionId: string, fromLine: number) {
  const clients = sessionClients.get(sessionId);
  if (!clients || clients.size === 0) return;

  // Send to all connected clients for this session
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      sendEventsToClient(ws, sessionId, fromLine);
    }
  }
}

export function getWsPort(): number {
  return WS_PORT;
}
