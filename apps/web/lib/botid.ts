import { checkBotId } from "botid/server";

/**
 * Shared Vercel BotID server-side configuration.
 *
 * `extraAllowedHosts` tells BotID which frontend origins are permitted to
 * call the protected endpoints — anything on our own domains plus Vercel
 * preview / sandbox URLs.
 */
function resolveAllowedHosts(): string[] {
  const base = [
    "vercel.com",
    "*.vercel.com",
    "*.vercel.dev",
    "*.vercel.run",
  ];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const hostname = new URL(appUrl).hostname;
      base.push(hostname, `*.${hostname}`);
    } catch { /* ignore invalid URLs */ }
  }

  // Additional custom domains
  base.push("viben.linxueyuan.online", "*.viben.linxueyuan.online");

  return base;
}

export const botIdConfig = {
  advancedOptions: {
    extraAllowedHosts: resolveAllowedHosts(),
  },
};

export async function checkBotProtection() {
  if (process.env.NODE_ENV !== "production") {
    return {
      isHuman: true,
      isBot: false,
      isVerifiedBot: false,
      bypassed: true,
    };
  }

  return checkBotId(botIdConfig);
}
