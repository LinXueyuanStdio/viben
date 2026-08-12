import {
  type FinishReason,
  type LanguageModelUsage,
  type ModelMessage,
  type UIMessageChunk,
} from "ai";
import type { AgentModelSelection } from "@viben/agent";
import { getRun } from "workflow/api";
import { pageAgent } from "@/app/config";
import type {
  WebAgentMessageMetadata,
  WebAgentStepFinishMetadata,
  WebAgentUIMessage,
} from "@/app/types";
import {
  buildPageChatInstructions,
  createPageMcpTools,
} from "@/lib/page-chat/page-mcp-tools";
import { resolvePageChatContext } from "@/lib/page-chat/page-chat-context";
import type { WorkflowRunStepTiming } from "@/lib/db/workflow-runs";
import { extractGatewayCost } from "./gateway-metadata";
import { addLanguageModelUsage } from "./usage-utils";

type Writable = WritableStream<UIMessageChunk>;

export type PageAgentStepResult = {
  responseMessage: WebAgentUIMessage | undefined;
  responseMessages: unknown[];
  finishReason: FinishReason | undefined;
  rawFinishReason: string | undefined;
  stepUsage: LanguageModelUsage | undefined;
  stepCost: number | undefined;
  stepWasAborted: boolean;
  stepTiming: WorkflowRunStepTiming;
};

function buildStepTiming(
  stepNumber: number,
  startedAt: Date,
  finishedAt: Date,
  finishReason?: string,
  rawFinishReason?: string,
): WorkflowRunStepTiming {
  return {
    stepNumber,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    finishReason,
    rawFinishReason,
  };
}

function withModelMetadata(
  metadata: WebAgentMessageMetadata | undefined,
  selectedModelId: string,
  modelId: string,
): WebAgentMessageMetadata {
  return {
    ...metadata,
    selectedModelId,
    modelId,
  };
}

function startStopMonitor(runId: string, abortController: AbortController) {
  let shouldStop = false;

  const done = (async () => {
    const run = getRun(runId);

    while (!shouldStop && !abortController.signal.aborted) {
      let runStatus:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled";

      try {
        runStatus = await run.status;
      } catch {
        await delay(150);
        continue;
      }

      if (runStatus === "cancelled") {
        abortController.abort();
        return;
      }

      await delay(150);
    }
  })();

  return {
    stop() {
      shouldStop = true;
    },
    done,
  };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export async function runPageAgentStep(input: {
  messages: ModelMessage[];
  originalMessages: WebAgentUIMessage[];
  messageId: string;
  writable: Writable;
  workflowRunId: string;
  chatId: string;
  sessionId: string;
  userId: string;
  requestUrl: string;
  selectedModelId: string;
  modelId: string;
  model: AgentModelSelection;
  stepNumber: number;
}): Promise<PageAgentStepResult> {
  "use step";

  const stepStartedAt = new Date();
  const abortController = new AbortController();
  const stopMonitor = startStopMonitor(input.workflowRunId, abortController);
  const { page, bearerToken } = await resolvePageChatContext({
    sessionId: input.sessionId,
    userId: input.userId,
  });
  const runtime = await createPageMcpTools({
    endpoint: new URL("/api/mcp/v1", input.requestUrl),
    bearerToken,
    page,
  });

  try {
    let responseMessage: WebAgentUIMessage | undefined;
    let lastStepUsage: LanguageModelUsage | undefined;
    let lastStepCost: number | undefined;
    const lastOriginalMessage = input.originalMessages.at(-1);
    const existingStepFinishReasons: WebAgentStepFinishMetadata[] =
      lastOriginalMessage?.role === "assistant"
        ? [...(lastOriginalMessage.metadata?.stepFinishReasons ?? [])]
        : [];
    const existingTotalMessageUsage =
      lastOriginalMessage?.role === "assistant"
        ? lastOriginalMessage.metadata?.totalMessageUsage
        : undefined;
    const existingTotalMessageCost =
      lastOriginalMessage?.role === "assistant"
        ? lastOriginalMessage.metadata?.totalMessageCost
        : undefined;
    let stepFinishReasons = existingStepFinishReasons;
    let totalMessageUsage = existingTotalMessageUsage;
    let totalMessageCost = existingTotalMessageCost;

    const result = await pageAgent.stream({
      messages: input.messages,
      options: {
        model: input.model,
        instructions: buildPageChatInstructions(page),
        tools: runtime.tools,
      },
      abortSignal: abortController.signal,
    });

    for await (const part of result.toUIMessageStream<WebAgentUIMessage>({
      originalMessages: input.originalMessages,
      generateMessageId: () => input.messageId,
      sendStart: false,
      sendFinish: false,
      messageMetadata: ({ part: streamPart }) => {
        if (streamPart.type === "finish-step") {
          lastStepUsage = streamPart.usage;
          if (streamPart.usage) {
            totalMessageUsage = totalMessageUsage
              ? addLanguageModelUsage(totalMessageUsage, streamPart.usage)
              : streamPart.usage;
          }
          const stepCost = extractGatewayCost(streamPart.providerMetadata);
          if (stepCost !== undefined) {
            lastStepCost = stepCost;
            totalMessageCost = (totalMessageCost ?? 0) + stepCost;
          }
          stepFinishReasons = [
            ...stepFinishReasons,
            {
              finishReason: streamPart.finishReason,
              rawFinishReason: streamPart.rawFinishReason,
            },
          ];
          return {
            selectedModelId: input.selectedModelId,
            modelId: input.modelId,
            lastStepUsage,
            totalMessageUsage,
            lastStepCost,
            totalMessageCost,
            lastStepFinishReason: streamPart.finishReason,
            lastStepRawFinishReason: streamPart.rawFinishReason,
            stepFinishReasons,
          } satisfies WebAgentMessageMetadata;
        }
        return undefined;
      },
      onFinish: ({ responseMessage: finishedResponseMessage }) => {
        responseMessage = finishedResponseMessage;
      },
    })) {
      const writer = input.writable.getWriter();
      await writer.write(part);
      writer.releaseLock();
    }

    if (responseMessage == null) {
      throw new Error("Page agent stream finished without a response message");
    }

    responseMessage = {
      ...responseMessage,
      metadata: withModelMetadata(
        responseMessage.metadata,
        input.selectedModelId,
        input.modelId,
      ),
    };

    const [stepUsage, finishReason, rawFinishReason, response, steps] =
      await Promise.all([
        result.totalUsage,
        result.finishReason,
        result.rawFinishReason,
        result.response,
        result.steps,
      ]);

    if (stepUsage) {
      responseMessage = {
        ...responseMessage,
        metadata: {
          ...responseMessage.metadata,
          totalMessageUsage: existingTotalMessageUsage
            ? addLanguageModelUsage(existingTotalMessageUsage, stepUsage)
            : stepUsage,
        },
      };
    }

    const stepsCost = steps.reduce<number | undefined>((sum, step) => {
      const cost = extractGatewayCost(step.providerMetadata);
      if (cost === undefined) {
        return sum;
      }
      return (sum ?? 0) + cost;
    }, undefined);

    if (stepsCost !== undefined) {
      responseMessage = {
        ...responseMessage,
        metadata: {
          ...responseMessage.metadata,
          lastStepCost,
          totalMessageCost: (existingTotalMessageCost ?? 0) + stepsCost,
        },
      };
    }

    const stepFinishedAt = new Date();

    return {
      responseMessage,
      responseMessages: response.messages,
      finishReason,
      rawFinishReason,
      stepUsage,
      stepCost: stepsCost,
      stepWasAborted: false,
      stepTiming: buildStepTiming(
        input.stepNumber,
        stepStartedAt,
        stepFinishedAt,
        finishReason,
        rawFinishReason,
      ),
    };
  } catch (error) {
    const stepFinishedAt = new Date();

    if (isAbortError(error)) {
      const abortedFinishReason: FinishReason = "stop";
      return {
        responseMessage: undefined,
        responseMessages: [],
        finishReason: abortedFinishReason,
        rawFinishReason: undefined,
        stepUsage: undefined,
        stepCost: undefined,
        stepWasAborted: true,
        stepTiming: buildStepTiming(
          input.stepNumber,
          stepStartedAt,
          stepFinishedAt,
          abortedFinishReason,
        ),
      };
    }

    const errorWithStepTiming =
      error instanceof Error ? error : new Error(String(error));
    Object.assign(errorWithStepTiming, {
      stepTiming: buildStepTiming(
        input.stepNumber,
        stepStartedAt,
        stepFinishedAt,
        "error",
        errorWithStepTiming.name,
      ),
    });
    throw errorWithStepTiming;
  } finally {
    stopMonitor.stop();
    await Promise.allSettled([stopMonitor.done, runtime.close()]);
  }
}
