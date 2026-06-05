// Public API — maintains backward compatibility with all existing imports from setup.ts

export { runSetup, runReconfigure } from "./wizard.js";
export { printStartBanner } from "./helpers.js";

// Validation functions (re-exported from plugin locations for backward compat)
export {
  validateBotToken,
  validateChatId,
  validateBotAdmin,
} from "../../plugins/telegram/validators.js";

// Agent detection (used by tests)
export { detectAgents, validateAgentCommand } from "./setup-agents.js";

// Setup functions — re-exported for backward compat (were public in old setup.ts)
export { setupAgents } from "./setup-agents.js";
export { setupRunMode } from "./setup-run-mode.js";
