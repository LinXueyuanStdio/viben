import { useUiStore } from "@/stores/ui-store";

export function handleWakeWordDetected(): void {
  useUiStore.getState().openChatPopup();
}
