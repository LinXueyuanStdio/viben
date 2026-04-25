export type OAuthStatus = "idle" | "waiting" | "timeout" | "success" | "error";

export const OAUTH_TIMEOUT_MS = 150000; // 2.5 minutes

// OAuth flow steps for visual feedback
export const OAUTH_STEPS = [
  { key: "browser", labelKey: "settings.account.oauth.openBrowser" },
  { key: "authorize", labelKey: "settings.account.oauth.waitingAuth" },
  { key: "callback", labelKey: "settings.account.oauth.completing" },
] as const;
