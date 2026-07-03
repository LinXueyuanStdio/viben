/**
 * viben voice — Voice token command
 */
import type { Command } from "commander";
import { createClient } from "../client-factory";
import { readToken } from "../utils/token";

export function registerVoiceCommand(program: Command): void {
  program
    .command("voice")
    .description("Get a LiveKit voice token")
    .requiredOption("--api-key <key>", "Vocal Bridge API key")
    .requiredOption("--agent-id <id>", "Agent ID")
    .option("--name <name>", "Participant name")
    .action(async (options: { apiKey: string; agentId: string; name?: string }) => {
      const token = await readToken();
      if (!token) { console.error("Not logged in."); process.exit(1); }

      const client = createClient({ apiKey: token });
      const result = await client.voice.getToken({
        api_key: options.apiKey,
        agent_id: options.agentId,
        participant_name: options.name,
      });

      console.log(`LiveKit URL:   ${result.livekit_url}`);
      console.log(`Room:         ${result.room_name}`);
      console.log(`Participant:  ${result.participant_identity}`);
      console.log(`Token:        ${result.token}`);
      console.log(`Expires:      ${result.expires_in}s`);
    });
}
