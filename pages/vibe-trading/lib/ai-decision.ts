import type {
  AgentInputEvent,
  AgentDecisionEvent,
  AgentErrorEvent,
} from "./types";
import { runAgentDecision } from "./viben-agent";

export interface AIDecisionOptions {
  model: string;
  strategy_name: string;
  strategy_description: string;
  risk_level: "low" | "medium" | "high";
}

export async function getAIDecision(
  input: AgentInputEvent,
  marketSummary: string,
  options: AIDecisionOptions
): Promise<AgentDecisionEvent | AgentErrorEvent> {
  try {
    return await runAgentDecision(input, marketSummary, {
      model: options.model,
      strategy_name: options.strategy_name,
      strategy_description: options.strategy_description,
      risk_level: options.risk_level,
      timeout_ms: 120_000,
    });
  } catch (error) {
    const ts = new Date().toISOString();
    return {
      type: "agent_error",
      ts,
      cycle: input.cycle,
      agent_session_id: input.agent_session_id,
      error: error instanceof Error ? error.message : "Unknown AI error",
      error_code: "api_error",
    };
  }
}
