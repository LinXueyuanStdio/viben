export type VibenAgentResourceProfile = "standard" | "hobby";

export function getVibenAgentResourceProfile(): VibenAgentResourceProfile {
  return process.env.VIBEN_AGENTS_RESOURCE_PROFILE === "hobby"
    ? "hobby"
    : "standard";
}

export function isHobbyResourceProfile(): boolean {
  return getVibenAgentResourceProfile() === "hobby";
}
