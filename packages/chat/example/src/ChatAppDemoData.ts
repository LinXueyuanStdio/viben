import type { ChatAppAgentItem, ChatAppSessionItem } from "./ChatApp";

export const DEFAULT_CHAT_APP_SESSIONS: ChatAppSessionItem[] = [
  {
    id: "2c88f85a-690d-49ca-95f4-c3aa71da1da8",
    title: "Claude Code: breadcrumb navigation debug",
    subtitle: "2c88f85a...jsonl",
  },
  {
    id: "2e83fc8b-a852-4530-a5f3-497bcafa9da6",
    title: "Claude Code: 2e83fc8b session replay",
    subtitle: "2e83fc8b...jsonl",
  },
  {
    id: "3bbcc4d2-0267-4938-98c3-c06a380828ba",
    title: "Claude Code: 3bbcc4d2 session replay",
    subtitle: "3bbcc4d2...jsonl",
  },
];

export const DEFAULT_CHAT_APP_AGENTS: ChatAppAgentItem[] = [
  { id: "claude-code", name: "Claude Code", type: "agent & executor" },
  { id: "openai-browser", name: "OpenAI · Browser", type: "agent & executor" },
];

export const CHAT_APP_COMPACT_GREETING_FALLBACKS = [
  "Ready when you are.",
  "What should we shape next?",
  "I am here when you need me.",
  "Drop a thought and I will follow it.",
  "Ready to inspect the next step.",
  "Tell me what changed.",
  "I can help trace the thread.",
  "Send a note when you are ready.",
  "Standing by for the next move.",
  "Let me know where to look.",
  "We can pick this up anywhere.",
  "Ready to continue the session.",
  "I can help turn that into action.",
  "What are we improving next?",
  "Share the next clue.",
  "I am ready to review.",
  "Point me at the issue.",
  "We can keep this tight.",
  "What should I focus on?",
  "Ready for the next task.",
  "Send the rough version.",
  "I can help refine it.",
  "Let us keep the flow going.",
  "What should we debug next?",
  "I am listening.",
  "Ready to compare options.",
  "Show me what you want changed.",
  "We can move from here.",
  "What would make this better?",
  "Ready to run the next pass.",
  "I can help make it clearer.",
  "Drop the next instruction.",
  "Ready to look closer.",
  "Tell me what feels off.",
  "We can tighten the details.",
  "Ready to continue.",
  "What should this become?",
  "I can help with the next edit.",
  "Let us inspect the behavior.",
  "Ready for a quick pass.",
  "Send the next idea.",
  "I can help make it work.",
  "Where should we start?",
  "Ready to follow your lead.",
  "Let us make the next move.",
  "I can help connect the dots.",
  "What needs attention?",
  "Ready when the thought lands.",
  "Send me the next target.",
  "Let’s make progress.",
] as const;

export const CHAT_APP_COMPACT_GREETING_COUNT = CHAT_APP_COMPACT_GREETING_FALLBACKS.length;
