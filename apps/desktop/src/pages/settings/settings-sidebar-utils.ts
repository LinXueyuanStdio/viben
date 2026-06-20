import type { SettingsSection } from "@/navigation/navigation-meta";
import { normalizeSettingsSection } from "@/navigation/navigation-meta";
import type { TabNavigationState } from "@/stores/tab-store";

export function isSettingsPathname(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

export function isSettingsUrl(url: string): boolean {
  const pathname = url.split(/[?#]/, 1)[0] ?? url;
  return isSettingsPathname(pathname);
}

export function getSettingsSectionFromPathname(pathname: string): SettingsSection {
  if (!isSettingsPathname(pathname)) return "general";
  const section = pathname.split("/settings/")[1];
  return normalizeSettingsSection(section);
}

export function findPreviousNonSettingsHistoryIndex(
  history: TabNavigationState[],
  currentIndex: number,
): number | null {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry && !isSettingsUrl(entry.url)) {
      return index;
    }
  }
  return null;
}
