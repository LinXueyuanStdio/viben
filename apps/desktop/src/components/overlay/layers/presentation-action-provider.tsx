import { useMemo } from "react";
import { nanoid } from "nanoid";
import { useActionProvider } from "@/hooks/use-action-provider";
import { useOverlayStore } from "@/stores/overlay-store";
import {
  ALL_STEP_COMMANDS,
  registerCompletionCallback,
  removeCompletionCallback,
  compilePresentationCommands,
} from "@viben/presentation";
import type { ClientToolResult, PresentationToolName } from "@viben/presentation";
import type { ExecutionContext } from "@/lib/action-system/types";

/**
 * Registers presentation actions under the "presentation" namespace.
 * This enables GUI_execute("presentation.draw", { commands: [...] }) etc.
 *
 * Mount at app root level (always available).
 */
export function PresentationActionProvider() {
  const actions = useMemo(() => ({
    ...Object.fromEntries(
      ALL_STEP_COMMANDS.map((def) => [
        def.name,
        {
          description: def.description,
          input_schema: { type: "object", properties: {} },
          execute: (payload: unknown, ctx: ExecutionContext) =>
            executePresentationAction(`presentation_${def.name}` as PresentationToolName, payload, ctx),
        },
      ]),
    ),
    stop: {
      description: "Exit presentation mode, clearing canvas and hiding overlay.",
      input_schema: { type: "object", properties: {} },
      execute: async (): Promise<ClientToolResult> => {
        const store = useOverlayStore.getState();
        if (store.presentationActive) {
          store.actions.stopPresentation();
        }
        return { content: [{ type: "text", text: "Presentation mode stopped." }] };
      },
    },
  }), []);

  useActionProvider("presentation", actions);
  return null;
}

// ============================================================================
// Helper: Execute a presentation action with async completion
// ============================================================================

/**
 * Timeout for waiting on presentation completion (matches the backend's 60s for GUI_execute).
 * Slightly less to ensure we respond before the backend times out.
 */
const PRESENTATION_ACTION_TIMEOUT_MS = 55_000;

async function executePresentationAction(
  toolName: PresentationToolName,
  payload: unknown,
  ctx: ExecutionContext
): Promise<ClientToolResult> {
  const store = useOverlayStore.getState();
  const toolInput = (payload as Record<string, unknown>) || {};
  const toolUseId = nanoid();

  const commands = compilePresentationCommands(toolName, toolInput);
  if (commands.length === 0) {
    return {
      content: [{ type: "text", text: "No valid commands produced from input." }],
      isError: true,
    };
  }

  // Start presentation if not active
  if (!store.presentationActive) {
    store.actions.startPresentation(ctx.sessionId);
  }

  // Register completion callback and create a promise
  const resultPromise = new Promise<ClientToolResult>((resolve) => {
    const timer = setTimeout(() => {
      removeCompletionCallback(toolUseId);
      resolve({
        content: [{ type: "text", text: "Presentation action timed out waiting for completion." }],
        isError: true,
      });
    }, PRESENTATION_ACTION_TIMEOUT_MS);

    registerCompletionCallback(toolUseId, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });

  // Dispatch commands to overlay store
  store.actions.addPresentationSteps({
    toolUseId,
    toolName,
    toolInput,
    commands,
  });

  // Mark stream done for this group so autoFinish triggers
  store.actions.markPresentationStreamDone();

  return resultPromise;
}
