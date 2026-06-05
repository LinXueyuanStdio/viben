/** Data needed to render the startup welcome message in the Assistant topic. */
export interface WelcomeContext {
  activeCount: number;
  errorCount: number;
  totalCount: number;
  agents: string[];
  defaultAgent: string;
  workspace: string;
}

/**
 * Build the welcome message sent to the Assistant topic on startup.
 * The message variant adapts based on whether there are active sessions or errors.
 */
export function buildWelcomeMessage(ctx: WelcomeContext): string {
  const { activeCount, errorCount, totalCount, agents, defaultAgent, workspace } = ctx;

  const agentList = agents
    .map((a) => `${a}${a === defaultAgent ? " (default)" : ""}`)
    .join(", ");

  // Variant 1: No sessions
  if (totalCount === 0) {
    return (
      `👋 <b>Viben is ready!</b>\n\n` +
      `📂 ${workspace}\n\n` +
      `No sessions yet. Tap 🆕 New Session to start, or ask me anything!`
    );
  }

  // Variant 2: Has errors
  if (errorCount > 0) {
    return (
      `👋 <b>Viben is ready!</b>\n\n` +
      `📂 ${workspace}\n` +
      `📊 ${activeCount} active, ${errorCount} errors / ${totalCount} total\n` +
      `⚠️ ${errorCount} session${errorCount > 1 ? "s have" : " has"} errors — ask me to check if you'd like.\n\n` +
      `Agents: ${agentList}`
    );
  }

  // Variant 3/4: Has active or fallback
  return (
    `👋 <b>Viben is ready!</b>\n\n` +
    `📂 ${workspace}\n` +
    `📊 ${activeCount} active / ${totalCount} total\n` +
    `Agents: ${agentList}`
  );
}

/**
 * Build a redirect message pointing to the Assistant topic.
 * Sent when a user sends a plain message in the General topic (threadId = 0),
 * which is not a session topic and cannot receive session messages.
 */
export function redirectToAssistant(
  chatId: number,
  assistantTopicId: number,
): string {
  const cleanId = String(chatId).replace("-100", "");
  const link = `https://t.me/c/${cleanId}/${assistantTopicId}`;
  return `💬 Please use the <a href="${link}">🤖 Assistant</a> topic to chat with Viben.`;
}
