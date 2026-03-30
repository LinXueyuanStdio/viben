/**
 * API client for authentication
 */
import { proxyFetch } from "../http";

export const VIBEN_WEB_URL = "https://viben-web.vercel.app";

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
 */
export async function verifyToken(token: string): Promise<UserInfo> {
  try {
    const response = await proxyFetch(`${VIBEN_WEB_URL}/api/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthApiError(
          "Invalid or expired token. Generate a new one at https://viben-web.vercel.app/settings/tokens",
          "INVALID_TOKEN"
        );
      }
      throw new AuthApiError(
        `Server error: ${response.status}`,
        "SERVER_ERROR"
      );
    }

    const data = (await response.json()) as { user: UserInfo };
    return data.user;
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error;
    }
    throw new AuthApiError(
      "Could not connect to server. Check your internet connection.",
      "NETWORK_ERROR"
    );
  }
}
