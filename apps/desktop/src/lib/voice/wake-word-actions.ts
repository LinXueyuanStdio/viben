import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { useOverlayStore } from "@/stores/overlay-store";
import { useUiStore } from "@/stores/ui-store";
import { useVoiceAgentRequestStore } from "@/stores/voice-agent-request-store";

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
  useVoiceAgentRequestStore.getState().requestConnection("wake_word");
}
