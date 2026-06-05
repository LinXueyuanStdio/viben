import type { AssistantSection } from '../assistant-registry.js'

/**
 * Creates the "Remote Access" section for the assistant's system prompt.
 *
 * Describes how to generate one-time remote access links so users can
 * connect to this Viben instance from the app or a browser. The section
 * is static (no live state) — it teaches the assistant about available
 * roles, link expiry, and tunnel behavior.
 */
export function createRemoteSection(): AssistantSection {
  return {
    id: 'core:remote',
    title: 'Remote Access',
    priority: 35,
    buildContext: () => {
      return (
        `Generate a one-time remote access link so the user can connect to this Viben instance from the app or a browser.\n\n` +
        `The link contains a short-lived code (expires in 30 minutes, single-use) that exchanges for a long-lived token.\n\n` +
        `Roles:\n` +
        `  admin   — full control (default)\n` +
        `  viewer  — read-only access\n\n` +
        `The command automatically includes the tunnel URL if a tunnel is active. ` +
        `Without a tunnel, the local link only works on the same machine.\n\n` +
        `Always show both the link and QR code when available so the user can choose how to open it.`
      )
    },
    commands: [
      { command: 'viben remote', description: 'Generate remote access link (admin role, 24h expiry)' },
      { command: 'viben remote --role viewer', description: 'Generate read-only access link' },
      { command: 'viben remote --expire 48h', description: 'Generate link with custom expiry' },
      { command: 'viben remote --no-qr', description: 'Skip QR code output' },
    ],
  }
}
