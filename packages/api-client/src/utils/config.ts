/**
 * Web platform configuration utilities
 */
import { VIBEN_WEB_URL } from "../constants";

export { VIBEN_WEB_URL as DEFAULT_WEB_URL } from "../constants";

/**
 * Get the web platform base URL
 * Priority: VIBEN_WEB_URL env var > default
 */
export function getWebUrl(): string {
  return process.env.VIBEN_WEB_URL || VIBEN_WEB_URL;
}

/**
 * Resolve web URL — explicit value takes precedence over env and default
 */
export function resolveWebUrl(explicit?: string): string {
  return explicit ?? getWebUrl();
}
