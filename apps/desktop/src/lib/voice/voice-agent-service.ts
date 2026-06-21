import i18n from "@/i18n";
import { useOverlayStore } from "@/stores/overlay-store";
import { useVoiceStore } from "@/stores/voice-store";
import type { VoiceConfig, VoiceConnectionState } from "@/types/voice";
import { audioLevelMonitor } from "./audio-level-monitor";
import { playSound } from "./audio-feedback";
import type { TranscriptEvent, VocalBridgeState } from "./vocal-bridge-client";
import { vocalBridgeClient } from "./vocal-bridge-client";

let listenersRegistered = false;
let silenceTimer: ReturnType<typeof setTimeout> | null = null;
let isNewAgentResponse = true;

function clearSilenceTimer(): void {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
}

function startSilenceTimer(): void {
  clearSilenceTimer();

  const store = useVoiceStore.getState();
  if (store.connectionState !== "listening") return;

  silenceTimer = setTimeout(() => {
    if (useVoiceStore.getState().connectionState === "listening") {
      console.log("[VoiceAgentService] Silence timeout, disconnecting...");
      void vocalBridgeClient.disconnect();
    }
  }, store.config.silenceTimeout * 1000);
}

function resetSilenceTimer(): void {
  if (useVoiceStore.getState().connectionState === "listening") {
    startSilenceTimer();
  }
}

function setWaveAudioLevel(level: number): void {
  const clamped = Math.max(0, Math.min(1, level));
  useOverlayStore.getState().actions.setWaveConfig({ audioLevel: clamped });
}

function stopWave(): void {
  const overlayActions = useOverlayStore.getState().actions;
  overlayActions.setWaveState("ending");
  setTimeout(() => {
    if (useOverlayStore.getState().waveState === "ending") {
      useOverlayStore.getState().actions.setWaveState("idle");
    }
  }, 300);
}

function handleVocalBridgeState(state: VocalBridgeState): void {
  const voiceActions = useVoiceStore.getState().actions;
  const overlayActions = useOverlayStore.getState().actions;

  switch (state) {
    case "connecting":
      voiceActions.setConnectionState("connecting");
      break;
    case "connected":
    case "waiting_for_agent":
      if (useVoiceStore.getState().connectionState === "speaking") {
        voiceActions.finishAgentResponse();
      }
      voiceActions.setConnectionState("listening");
      overlayActions.setWaveState("listening");
      startSilenceTimer();
      break;
    case "disconnected":
      voiceActions.finishAgentResponse();
      voiceActions.setConnectionState("idle");
      stopWave();
      clearSilenceTimer();
      audioLevelMonitor.stop();
      break;
    case "error":
      voiceActions.finishAgentResponse();
      voiceActions.setConnectionState("error");
      stopWave();
      clearSilenceTimer();
      audioLevelMonitor.stop();
      break;
  }
}

function handleTranscript(event: TranscriptEvent): void {
  const voiceActions = useVoiceStore.getState().actions;
  const overlayActions = useOverlayStore.getState().actions;

  if (event.role === "user") {
    voiceActions.updateUserTranscript(event.text);
    resetSilenceTimer();
    voiceActions.setPopupOpacity(0.3);
    isNewAgentResponse = true;
    return;
  }

  if (isNewAgentResponse) {
    voiceActions.startNewAgentResponse();
    isNewAgentResponse = false;
  }

  voiceActions.appendAgentResponse(event.text);
  voiceActions.setConnectionState("speaking");
  overlayActions.setWaveState("speaking-calm");
  clearSilenceTimer();
}

function handleError(error: Error): void {
  console.error("[VoiceAgentService] Error:", error);
  const store = useVoiceStore.getState();
  store.actions.setError(error.message);
  if (store.config.enableSoundEffects) {
    playSound("error");
  }
}

function registerVoiceAgentListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  vocalBridgeClient.onStateChange(handleVocalBridgeState);
  vocalBridgeClient.onTranscript(handleTranscript);
  vocalBridgeClient.onError(handleError);
  audioLevelMonitor.onLevelChange(setWaveAudioLevel);
}

function validateConfig(config: VoiceConfig): boolean {
  const actions = useVoiceStore.getState().actions;

  if (!config.vocalBridgeApiKey) {
    console.error("[VoiceAgentService] No API Key configured");
    actions.setError(i18n.t("settings.voice.errors.noApiKey"));
    return false;
  }

  if (!config.vocalBridgeAgentId) {
    console.error("[VoiceAgentService] No Agent ID configured");
    actions.setError(i18n.t("settings.voice.errors.noAgentId"));
    return false;
  }

  return true;
}

export function getVoiceAgentConnectionState(): VoiceConnectionState {
  return useVoiceStore.getState().connectionState;
}

export function isVoiceAgentConnected(): boolean {
  const state = getVoiceAgentConnectionState();
  return state === "listening" || state === "speaking" || state === "processing";
}

export async function connectVoiceAgent(): Promise<void> {
  registerVoiceAgentListeners();

  const store = useVoiceStore.getState();
  const { connectionState, config, actions } = store;

  if (connectionState !== "idle") {
    console.log("[VoiceAgentService] Already connected, state:", connectionState);
    return;
  }

  if (!validateConfig(config)) {
    return;
  }

  const startTime = performance.now();
  console.log(
    "[VoiceAgentService] Connecting with API Key:",
    `${config.vocalBridgeApiKey.slice(0, 8)}...`,
    "Agent ID:",
    config.vocalBridgeAgentId
  );

  vocalBridgeClient.configure(config.vocalBridgeApiKey, config.vocalBridgeAgentId);

  actions.setConnectionState("connecting");
  actions.clearAgentResponse();
  actions.updateUserTranscript("");

  try {
    const [, monitorStarted] = await Promise.all([
      vocalBridgeClient.connect().then(() => {
        console.log("[VoiceAgentService] VocalBridge connected in", (performance.now() - startTime).toFixed(0), "ms");
      }),
      audioLevelMonitor.start().then((started) => {
        console.log("[VoiceAgentService] AudioLevelMonitor started in", (performance.now() - startTime).toFixed(0), "ms, success:", started);
        return started;
      }),
    ]);

    console.log("[VoiceAgentService] Total connect time:", (performance.now() - startTime).toFixed(0), "ms");

    if (!monitorStarted) {
      console.warn("[VoiceAgentService] Audio level monitor failed to start, wave effects may not respond to voice");
    }

    if (config.enableSoundEffects) {
      playSound("wake-up");
    }
  } catch (error) {
    console.error("[VoiceAgentService] Connection failed:", error);
    audioLevelMonitor.stop();
    actions.setConnectionState("error");
    actions.setError(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function disconnectVoiceAgent(): Promise<void> {
  clearSilenceTimer();
  audioLevelMonitor.stop();
  await vocalBridgeClient.disconnect();
  useVoiceStore.getState().actions.setConnectionState("idle");
  useVoiceStore.getState().actions.clearAgentResponse();
  stopWave();
}

export async function toggleVoiceAgentMicrophone(): Promise<void> {
  await vocalBridgeClient.toggleMicrophone();
}
