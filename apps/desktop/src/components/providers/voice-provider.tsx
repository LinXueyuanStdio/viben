// apps/desktop/src/components/providers/voice-provider.tsx
import type { ReactNode } from "react";
import { VocalBridgeProvider } from "@vocalbridgeai/react";
import { useVoiceStore } from "@/stores/voice-store";

// 默认 token URL - 通过我们的后端代理获取 token
const DEFAULT_TOKEN_URL = "https://viben-web.vercel.app/api/voice-token";

interface VoiceProviderProps {
  children: ReactNode;
}

/**
 * 自定义 tokenProvider
 * 因为我们需要传递用户配置的 api_key 和 agent_id
 */
function createTokenProvider(apiKey: string, agentId: string, tokenUrl?: string) {
  const url = tokenUrl || DEFAULT_TOKEN_URL;

  return async () => {
    console.log("[VoiceProvider] Fetching token from:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        agent_id: agentId,
        participant_name: "Viben User",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Token fetch failed: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("[VoiceProvider] Token received:", {
      room_name: data.room_name,
      livekit_url: data.livekit_url,
    });

    // SDK 期望的字段名是 url，但 API 返回 livekit_url
    return {
      url: data.livekit_url,
      token: data.token,
      room_name: data.room_name,
      participant_identity: data.participant_identity,
      expires_in: data.expires_in,
      agent_mode: data.agent_mode,
    };
  };
}

/**
 * Voice Provider
 * 包装 VocalBridgeProvider，使用用户配置的凭证
 */
export function VoiceProvider({ children }: VoiceProviderProps) {
  const { config, configLoaded } = useVoiceStore();

  // 如果配置未加载，直接渲染 children
  if (!configLoaded) {
    return <>{children}</>;
  }

  // 如果没有配置 API Key 或 Agent ID，也直接渲染 children
  // 用户可以在设置页配置后再使用语音功能
  if (!config.vocalBridgeApiKey || !config.vocalBridgeAgentId) {
    return <>{children}</>;
  }

  return (
    <VocalBridgeProvider
      options={{
        auth: {
          tokenProvider: createTokenProvider(
            config.vocalBridgeApiKey,
            config.vocalBridgeAgentId
          ),
        },
        participantName: "Viben User",
        debug: true,
      }}
    >
      {children}
    </VocalBridgeProvider>
  );
}
