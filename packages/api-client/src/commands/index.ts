/**
 * CLI Commands barrel export
 *
 * Each module exports a `register*Command(program: Command): void` function
 * compatible with packages/core's lazy-loading command registry.
 */
export { registerAuthCommand } from "./auth";
export { registerProfileCommand } from "./profile";
export { registerApiKeyCommand } from "./api-key";
export { registerMcpMarketCommand } from "./mcp-market";
export { registerSkillMarketCommand } from "./skill-market";
export { registerCollectionsCommand } from "./collections";
export { registerFavoritesCommand } from "./favorites";
export { registerPagesPublishCommand } from "./pages-publish";
export { registerVoiceCommand } from "./voice";
