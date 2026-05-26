import { type as osType } from "@tauri-apps/plugin-os";

let _platformType: string | null = null;

export function getPlatformType(): string {
  if (!_platformType) {
    try {
      _platformType = osType();
    } catch (e) {
      // Fallback: detect from user agent if Tauri plugin fails
      console.warn("[platform] osType() failed, using fallback:", e);
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("android")) {
        _platformType = "android";
      } else if (ua.includes("iphone") || ua.includes("ipad")) {
        _platformType = "ios";
      } else if (ua.includes("mac")) {
        _platformType = "macos";
      } else if (ua.includes("win")) {
        _platformType = "windows";
      } else if (ua.includes("linux")) {
        _platformType = "linux";
      } else {
        _platformType = "unknown";
      }
    }
  }
  return _platformType;
}

export function isMobile(): boolean {
  const t = getPlatformType();
  return t === "android" || t === "ios";
}

export function isDesktop(): boolean {
  return !isMobile();
}

/** Reset cached platform type — only for tests */
export function _resetForTesting(): void {
  _platformType = null;
}
