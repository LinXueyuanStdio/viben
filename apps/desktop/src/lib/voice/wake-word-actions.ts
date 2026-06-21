import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { useOverlayStore } from "@/stores/overlay-store";
import { useUiStore } from "@/stores/ui-store";
import { connectVoiceAgent } from "./voice-agent-service";

export function handleWakeWordDetected(): void {
  const authState = useAuthStore.getState();
  const uiState = useUiStore.getState();

  if (!authState.isAuthenticated) {
    if (uiState.isChatPopupOpen) {
      toast.info("聊天面板已打开");
      return;
    }

    uiState.openChatPopup();
    return;
  }

  const overlayActions = useOverlayStore.getState().actions;
  overlayActions.show();
  overlayActions.setWaveState("listening");

  void connectVoiceAgent().catch((error: unknown) => {
    console.error("[WakeWord] Failed to connect voice agent:", error);
    toast.error("语音智能体连接失败", {
      description: error instanceof Error ? error.message : String(error),
    });
  });
}
