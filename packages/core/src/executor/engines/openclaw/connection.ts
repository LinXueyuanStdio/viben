/**
 * OpenClaw Connection Manager
 *
 * Wraps @openclaw/sdk's OpenClaw client for use within viben.
 * Handles connection lifecycle and configuration.
 */

import { OpenClaw } from "@openclaw/sdk";
import type { OpenClawGatewayConfig } from "./types";

export class OpenClawConnectionManager {
  private client: OpenClaw | null = null;
  private config: OpenClawGatewayConfig;

  constructor(config: OpenClawGatewayConfig) {
    this.config = config;
  }

  /**
   * Connect to the OpenClaw gateway
   */
  async connect(): Promise<OpenClaw> {
    if (this.client) {
      return this.client;
    }

    const url = `ws://${this.config.host}:${this.config.port}`;
    const options: ConstructorParameters<typeof OpenClaw>[0] = { url };

    if (this.config.auth.mode === "token" && this.config.auth.token) {
      options.token = this.config.auth.token;
    } else if (this.config.auth.mode === "password" && this.config.auth.password) {
      options.password = this.config.auth.password;
    }

    this.client = new OpenClaw(options);
    await this.client.connect();
    return this.client;
  }

  /**
   * Disconnect from the gateway
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  /**
   * Get the connected client (throws if not connected)
   */
  getClient(): OpenClaw {
    if (!this.client) {
      throw new Error("OpenClaw client not connected. Call connect() first.");
    }
    return this.client;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.client !== null;
  }
}
