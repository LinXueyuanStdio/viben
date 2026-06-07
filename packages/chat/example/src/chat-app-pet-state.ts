import type { AgentMessage } from "@viben/chat";
import type { AssistantPetState, PetInteractionState } from "./VibenPetAvatar";

export type SessionPlayerStatus = "idle" | "playing" | "paused";

export function getAssistantPetState(
  messages: AgentMessage[],
  isStreaming: boolean,
  playerStatus: SessionPlayerStatus = "idle",
  hasPendingUserMessages = false
): AssistantPetState {
  if (messages.length === 0) return "idle";
  if (isStreaming) return "review";
  if (hasPendingUserMessages || playerStatus === "playing") return "waiting";
  const latestStatefulMessage = [...messages].reverse().find((message) =>
    message.type !== "summary" && message.type !== "plan_mode"
  );
  if (latestStatefulMessage && (latestStatefulMessage.type === "error" || latestStatefulMessage.isError)) return "failed";
  if (playerStatus === "paused") return "waving";
  return "idle";
}

export function getPetInteractionForSessionStatus(
  playerStatus: SessionPlayerStatus = "idle",
  isStreaming = false,
  hasPendingUserMessages = false
): PetInteractionState {
  if (isStreaming || hasPendingUserMessages || playerStatus === "playing") return "waiting";
  if (playerStatus === "paused") return "hover";
  return "idle";
}
