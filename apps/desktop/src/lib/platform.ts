import { type as osType } from "@tauri-apps/plugin-os";

let _platformType: string | null = null;

export function getPlatformType(): string {
  if (!_platformType) {
    _platformType = osType();
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
