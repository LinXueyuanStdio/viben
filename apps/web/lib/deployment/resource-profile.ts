export type OpenAgentsResourceProfile = "standard" | "hobby";

export function getOpenAgentsResourceProfile(): OpenAgentsResourceProfile {
  return process.env.VIBEN_AGENTS_RESOURCE_PROFILE === "hobby"
    ? "hobby"
    : "standard";
}

export function isHobbyResourceProfile(): boolean {
  return getOpenAgentsResourceProfile() === "hobby";
}
