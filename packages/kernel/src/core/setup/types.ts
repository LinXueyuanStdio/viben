/**
 * Configurable sections of the setup wizard. Each section maps to a
 * dedicated setup step that can be run independently during reconfiguration.
 */
export type OnboardSection =
  | "channels"
  | "agents"
  | "runMode"
  | "integrations";

/** Action a user can take on an already-configured channel during reconfiguration. */
export type ConfiguredChannelAction = "modify" | "disable" | "delete" | "skip";

/** Logical identifier for a messaging channel (e.g. "telegram", "discord", "sse"). */
export type ChannelId = string;

/** Runtime status of a channel, used by the wizard to show current state. */
export type ChannelStatus = {
  id: ChannelId;
  label: string;
  /** Whether the channel has been configured (has required credentials). */
  configured: boolean;
  /** Whether the channel is actively enabled — a channel can be configured but disabled. */
  enabled: boolean;
  /** Additional context shown in the status line (e.g. "Chat ID: 12345"). */
  hint?: string;
};

/**
 * Menu options for the reconfigure wizard's section picker.
 * Order here determines display order in the CLI menu.
 */
export const ONBOARD_SECTION_OPTIONS: Array<{
  value: OnboardSection;
  label: string;
  hint: string;
}> = [
  { value: "channels", label: "Channels", hint: "Link/update messaging platforms" },
  { value: "agents", label: "Agents", hint: "Install agents, change default" },
  { value: "runMode", label: "Run mode", hint: "Foreground/daemon, auto-start" },
  { value: "integrations", label: "Integrations", hint: "Claude CLI session transfer" },
];

/** Display metadata for each core-managed channel type. */
export const CHANNEL_META: Record<string, { label: string; method: string }> = {
  sse: { label: "Desktop App", method: "SSE" },
  telegram: { label: "Telegram", method: "Bot API" },
  discord: { label: "Discord", method: "Bot API" },
};

/** A community adapter discovered from the Viben plugin registry. */
export interface CommunityAdapterOption {
  /** npm package name, e.g. "@viben/adapter-slack" */
  name: string
  /** Human-readable name, e.g. "Slack Adapter" */
  displayName: string
  /** Emoji icon for display in the CLI menu */
  icon: string
  /** Whether the plugin has been verified by the Viben team */
  verified: boolean
}

