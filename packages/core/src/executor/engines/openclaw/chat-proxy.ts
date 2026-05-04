/**
 * OpenClaw Chat Proxy
 *
 * Provides streaming chat via OpenClaw SDK, converting events to SSEMessage.
 */

import type { OpenClaw, OpenClawEvent, Run } from "@openclaw/sdk";
import type { SSEMessage, ChatOptions } from "../../ops/types";
import { mapOpenClawEvent } from "./event-mapper";

export class OpenClawChatProxy {
  private client: OpenClaw;
  private currentRun: Run | null = null;
  private currentSessionKey: string | null = null;

  constructor(client: OpenClaw) {
    this.client = client;
  }

  /**
   * Stream a chat interaction, yielding SSEMessage events
   */
  async *stream(options: ChatOptions): AsyncGenerator<SSEMessage> {
    const { prompt, sessionId: sessionKey } = options;

    // Create or resolve session
    let session;
    if (sessionKey) {
      session = await this.client.sessions.get(sessionKey);
    } else {
      session = await this.client.sessions.create({
        key: `viben-${Date.now()}`,
      });
    }

    this.currentSessionKey = session.key;

    // Yield session info
    yield { type: "sdk_session", sdk_session_id: session.key };

    // Send message and get run
    const run = await session.send({ message: prompt });
    this.currentRun = run;

    // Stream events
    for await (const event of run.events()) {
      const sseMessage = mapOpenClawEvent(event as OpenClawEvent);
      if (sseMessage) {
        yield sseMessage;
      }

      // Stop on terminal events
      if (
        event.type === "run.completed" ||
        event.type === "run.failed" ||
        event.type === "run.cancelled" ||
        event.type === "run.timed_out"
      ) {
        break;
      }
    }

    this.currentRun = null;
  }

  /**
   * Abort the current run
   */
  async abort(): Promise<void> {
    if (this.currentRun) {
      await this.currentRun.cancel();
      this.currentRun = null;
    }
  }

  /**
   * Get the current session key
   */
  getSessionKey(): string | null {
    return this.currentSessionKey;
  }
}
