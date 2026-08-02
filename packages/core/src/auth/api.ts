/**
 * API client for authentication
 */
import { VibenClient } from "@viben/api-client";
import { VIBEN_WEB_URL } from "@viben/api-client";
import { proxyFetch } from "../http";

// VIBEN_WEB_URL is NOT re-exported — consumers should import from @viben/api-client directly

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public code: "INVALID_TOKEN" | "NETWORK_ERROR" | "SERVER_ERROR"
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

/**
 * Verify token with the server and get user info
 * Uses VibenClient internally for consistent API access.
 */
export async function verifyToken(token: string): Promise<UserInfo> {
  try {
    const client = new VibenClient({
      baseUrl: VIBEN_WEB_URL,
      apiKey: token,
      fetch: proxyFetch,
    });
    const { user } = await client.user.me();
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl || undefined,
    };
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error;
    }
    // VibenClient throws ApiError for HTTP errors
    const apiError = error as { status?: number; message?: string };
    if (apiError.status === 401) {
      throw new AuthApiError(
        "Invalid or expired token. Generate a new one at https://viben-web.vercel.app/settings/api_keys",
        "INVALID_TOKEN"
      );
    }
    if (apiError.status && apiError.status >= 500) {
      throw new AuthApiError(
        `Server error: ${apiError.status}`,
        "SERVER_ERROR"
      );
    }
    throw new AuthApiError(
      "Could not connect to server. Check your internet connection.",
      "NETWORK_ERROR"
    );
  }
}
