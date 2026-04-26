import { platform } from "@tauri-apps/plugin-os";

// Platform detection using Tauri OS plugin
export function usePlatform(): string {
  try {
    return platform();
  } catch {
    return "macos";
  }
}
