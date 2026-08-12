import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { z } from "zod";
import { addCacheControl } from "./context-management";
import {
  type GatewayModelId,
  gateway,
} from "./models";
import type { AgentModelSelection } from "./viben-agent";

const defaultModelLabel = "anthropic/claude-opus-4.6" as const;
const defaultModel = gateway(defaultModelLabel);

export type ChatAgentModelInput = GatewayModelId | AgentModelSelection;

const chatCallOptionsSchema = z.object({
  model: z.custom<ChatAgentModelInput>().optional(),
  instructions: z.string().min(1),
  tools: z.custom<ToolSet>(),
});

export type ChatAgentCallOptions = z.infer<typeof chatCallOptionsSchema>;

function normalizeAgentModelSelection(
  selection: ChatAgentModelInput | undefined,
  fallbackId: GatewayModelId,
): AgentModelSelection {
  if (!selection) {
    return { id: fallbackId };
  }

  return typeof selection === "string" ? { id: selection } : selection;
}

export function prepareChatAgentCall({
  options,
  ...settings
}: {
  options?: ChatAgentCallOptions;
  tools?: ToolSet;
  [key: string]: unknown;
}) {
  if (!options) {
    throw new Error("Chat Agent requires call options with instructions.");
  }

  const mainSelection = normalizeAgentModelSelection(
    options.model,
    defaultModelLabel,
  );
  const callModel = gateway(mainSelection.id, {
    providerOptionsOverrides: mainSelection.providerOptionsOverrides,
  });

  return {
    ...settings,
    model: callModel,
    tools: addCacheControl({
      tools: options.tools,
      model: callModel,
    }),
    instructions: options.instructions,
  };
}

export const chatAgent = new ToolLoopAgent<ChatAgentCallOptions, ToolSet>({
  model: defaultModel,
  instructions: "",
  tools: {},
  stopWhen: stepCountIs(1),
  callOptionsSchema: chatCallOptionsSchema,
  prepareStep: ({ messages, model, steps: _steps }) => {
    return {
      messages: addCacheControl({
        messages,
        model,
      }),
    };
  },
  prepareCall: prepareChatAgentCall,
});

export type ChatAgent = typeof chatAgent;
