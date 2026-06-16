import { useMemo } from "react";
import { nanoid } from "nanoid";
import { useActionProvider } from "@/hooks/use-action-provider";
import { useOverlayStore } from "@/stores/overlay-store";
import {
  ALL_STEP_COMMANDS,
  compilePresentationCommands,
} from "@viben/presentation";
import type { ClientToolResult, PresentationToolName } from "@viben/presentation";
import type { ActionDef, ExecutionContext } from "@/lib/action-system/types";

/**
 * Registers presentation actions under the "presentation" namespace.
 * This enables GUI_execute("presentation.draw", { commands: [...] }) etc.
 *
 * Mount at app root level (always available).
 */
export function PresentationActionProvider() {
  const actions = useMemo(() => createPresentationActions(), []);

  useActionProvider("presentation", actions);
  return null;
}

export function createPresentationActions(): Record<string, Omit<ActionDef, "name">> {
  return {
    ...Object.fromEntries(
      ALL_STEP_COMMANDS.map((def) => [
        def.name,
        {
          description: def.description,
          input_schema: def.inputSchema ?? { type: "object", properties: {} },
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
  };
}

// ============================================================================
// Helper: Execute a presentation action
// ============================================================================

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

  // Dispatch commands to overlay store
  store.actions.addPresentationSteps({
    toolUseId,
    toolName,
    toolInput,
    commands,
  });

  // Mark stream done for this group so autoFinish triggers
  store.actions.markPresentationStreamDone();

  return {
    content: [{ type: "text", text: `Executed ${commands.length} presentation command(s).` }],
  };
}
