import { chatAgent, vibenAgent } from "@viben/agent";

// Configure the agent here - single source of truth for the web app
export const workAgent = vibenAgent;
export const pageAgent = chatAgent;
export const webAgent = workAgent;
