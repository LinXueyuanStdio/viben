import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useVoiceAgent } from "@/hooks/use-voice-agent";
import { useVoiceAgentRequestStore } from "@/stores/voice-agent-request-store";

export function VoiceAgentRequestController() {
  const voice = useVoiceAgent();
  const connectionRequestId = useVoiceAgentRequestStore((state) => state.connectionRequestId);
  const lastHandledRequestIdRef = useRef(0);

  useEffect(() => {
    if (connectionRequestId === 0 || connectionRequestId === lastHandledRequestIdRef.current) {
      return;
    }

    lastHandledRequestIdRef.current = connectionRequestId;

    if (voice.isConnected || voice.state === "connecting") {
      return;
    }

    void voice.connect().catch((error: unknown) => {
      console.error("[VoiceAgentRequestController] Failed to connect voice agent:", error);
      toast.error("语音智能体连接失败", {
        description: error instanceof Error ? error.message : String(error),
      });
    });
  }, [connectionRequestId, voice]);

  return null;
}
